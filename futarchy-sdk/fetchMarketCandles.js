#!/usr/bin/env node

// fetchMarketCandles.js - CLI Script for Fetching Market Events and their Conditional Pool Candles

import { DataLayer } from './DataLayer.js';
import { createSupabasePoolFetcher } from './fetchers/SupabasePoolFetcher.js';
import { config } from './config.js';
import fs from 'fs/promises';
import path from 'path';

// =============================================================================
// SETUP DATALAYER
// =============================================================================

function setupDataLayer() {
    console.log(`🔧 Setting up DataLayer...`);
    
    const dataLayer = new DataLayer();
    const supabaseFetcher = createSupabasePoolFetcher(config.supabaseUrl, config.supabaseKey);
    dataLayer.registerFetcher(supabaseFetcher);
    
    console.log(`✨ DataLayer ready with operations:`, dataLayer.getAvailableOperations());
    return dataLayer;
}

// =============================================================================
// CLI ARGUMENT PARSING
// =============================================================================

function parseArgs() {
    const args = process.argv.slice(2);
    
    const params = {
        eventLimit: 10,        // Number of market events to fetch
        candleLimit: 50,       // Number of candles per pool
        interval: '3600000',   // Default 1 hour
        output: 'market-candles.json', // Output file name
        status: 'open',        // Market event status filter
        visibility: 'public'   // Market visibility filter
    };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const nextArg = args[i + 1];
        
        switch (arg) {
            case '--events':
            case '-e':
                params.eventLimit = parseInt(nextArg);
                i++;
                break;
            case '--candles':
            case '-c':
                params.candleLimit = parseInt(nextArg);
                i++;
                break;
            case '--interval':
            case '-i':
                params.interval = nextArg;
                i++;
                break;
            case '--output':
            case '-o':
                params.output = nextArg;
                i++;
                break;
            case '--status':
            case '-s':
                params.status = nextArg;
                i++;
                break;
            case '--visibility':
            case '-v':
                params.visibility = nextArg;
                i++;
                break;
            case '--help':
            case '-h':
                showHelp();
                process.exit(0);
                break;
        }
    }
    
    return params;
}

function showHelp() {
    console.log(`
🔥 Market Events & Conditional Pool Candles Fetcher

Usage:
  npm run fetchMarketCandles -- [options]
  node fetchMarketCandles.js [options]

Options:
  --events, -e <number>      Number of market events to fetch (default: 10)
  --candles, -c <number>     Number of candles per pool (default: 50)
  --interval, -i <ms>        Interval in milliseconds (default: 3600000 = 1 hour)
  --output, -o <file>        Output JSON file name (default: market-candles.json)
  --status, -s <status>      Filter by event status (default: open)
  --visibility, -v <vis>     Filter by visibility (default: public)
  --help, -h                 Show this help

Examples:
  # Fetch 5 market events with 100 candles each
  node fetchMarketCandles.js --events 5 --candles 100
  
  # Fetch with custom interval and output file
  node fetchMarketCandles.js --interval 86400000 --output daily-candles.json
  
  # Fetch all status events
  node fetchMarketCandles.js --status null

Interval Options:
  60000      = 1 minute
  3600000    = 1 hour (default)
  86400000   = 1 day
    `);
}

// =============================================================================
// FETCH CANDLES FOR A POOL
// =============================================================================

async function fetchPoolCandles(dataLayer, poolAddress, interval, limit) {
    if (!poolAddress) return null;
    
    try {
        const result = await dataLayer.fetch('pools.candle', {
            id: poolAddress,
            interval: interval,
            limit: limit
        });
        
        if (result.status === 'success') {
            return result.data;
        } else {
            console.warn(`⚠️  Failed to fetch candles for pool ${poolAddress}: ${result.reason}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ Error fetching candles for pool ${poolAddress}:`, error.message);
        return null;
    }
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
    console.log(`\n🚀 Starting Market Events & Conditional Pool Candles Fetcher...`);
    
    const params = parseArgs();
    
    console.log(`\n🎯 Parameters:`);
    console.log(`   Market Events Limit: ${params.eventLimit}`);
    console.log(`   Candles per Pool: ${params.candleLimit}`);
    console.log(`   Interval: ${params.interval}ms`);
    console.log(`   Output File: ${params.output}`);
    console.log(`   Status Filter: ${params.status}`);
    console.log(`   Visibility Filter: ${params.visibility}`);
    
    try {
        // Setup DataLayer
        const dataLayer = setupDataLayer();
        
        // Fetch market events
        console.log(`\n📊 Fetching market events...`);
        const eventsResult = await dataLayer.fetch('markets.events', {
            limit: params.eventLimit,
            status: params.status === 'null' ? null : params.status,
            visibility: params.visibility === 'null' ? null : params.visibility
        });
        
        if (eventsResult.status !== 'success') {
            console.error(`❌ Failed to fetch market events: ${eventsResult.reason}`);
            process.exit(1);
        }
        
        console.log(`✅ Fetched ${eventsResult.data.length} market events`);
        
        // Process each market event
        const results = [];
        let totalPoolsProcessed = 0;
        let totalCandlesFetched = 0;
        
        for (const event of eventsResult.data) {
            console.log(`\n🔍 Processing market: ${event.title?.substring(0, 60)}...`);
            
            const marketData = {
                id: event.id,
                title: event.title,
                type: event.type,
                status: event.event_status,
                end_date: event.end_date,
                tokens: event.tokens,
                pools: {
                    yes: event.pool_yes,
                    no: event.pool_no
                },
                conditional_pools: {},
                candles: {}
            };
            
            // Extract conditional pool addresses from metadata
            if (event.metadata?.conditional_pools) {
                marketData.conditional_pools = {
                    yes: event.metadata.conditional_pools.yes?.address,
                    no: event.metadata.conditional_pools.no?.address
                };
                
                // Fetch candles for YES conditional pool
                if (marketData.conditional_pools.yes) {
                    console.log(`  📈 Fetching candles for YES conditional pool: ${marketData.conditional_pools.yes}`);
                    const yesCandles = await fetchPoolCandles(
                        dataLayer, 
                        marketData.conditional_pools.yes, 
                        params.interval, 
                        params.candleLimit
                    );
                    
                    if (yesCandles) {
                        marketData.candles.yes_conditional = yesCandles;
                        totalCandlesFetched += yesCandles.length;
                        console.log(`     ✓ Fetched ${yesCandles.length} candles`);
                    }
                    totalPoolsProcessed++;
                }
                
                // Fetch candles for NO conditional pool
                if (marketData.conditional_pools.no) {
                    console.log(`  📉 Fetching candles for NO conditional pool: ${marketData.conditional_pools.no}`);
                    const noCandles = await fetchPoolCandles(
                        dataLayer, 
                        marketData.conditional_pools.no, 
                        params.interval, 
                        params.candleLimit
                    );
                    
                    if (noCandles) {
                        marketData.candles.no_conditional = noCandles;
                        totalCandlesFetched += noCandles.length;
                        console.log(`     ✓ Fetched ${noCandles.length} candles`);
                    }
                    totalPoolsProcessed++;
                }
            }
            
            // Also fetch candles for prediction pools if available
            if (event.metadata?.prediction_pools) {
                const predictionPools = {
                    yes: event.metadata.prediction_pools.yes?.address,
                    no: event.metadata.prediction_pools.no?.address
                };
                
                // Fetch candles for YES prediction pool
                if (predictionPools.yes) {
                    console.log(`  📊 Fetching candles for YES prediction pool: ${predictionPools.yes}`);
                    const yesCandles = await fetchPoolCandles(
                        dataLayer, 
                        predictionPools.yes, 
                        params.interval, 
                        params.candleLimit
                    );
                    
                    if (yesCandles) {
                        marketData.candles.yes_prediction = yesCandles;
                        totalCandlesFetched += yesCandles.length;
                        console.log(`     ✓ Fetched ${yesCandles.length} candles`);
                    }
                    totalPoolsProcessed++;
                }
                
                // Fetch candles for NO prediction pool
                if (predictionPools.no) {
                    console.log(`  📊 Fetching candles for NO prediction pool: ${predictionPools.no}`);
                    const noCandles = await fetchPoolCandles(
                        dataLayer, 
                        predictionPools.no, 
                        params.interval, 
                        params.candleLimit
                    );
                    
                    if (noCandles) {
                        marketData.candles.no_prediction = noCandles;
                        totalCandlesFetched += noCandles.length;
                        console.log(`     ✓ Fetched ${noCandles.length} candles`);
                    }
                    totalPoolsProcessed++;
                }
            }
            
            results.push(marketData);
        }
        
        // Prepare output data
        const outputData = {
            metadata: {
                fetched_at: new Date().toISOString(),
                parameters: params,
                summary: {
                    total_markets: results.length,
                    total_pools_processed: totalPoolsProcessed,
                    total_candles_fetched: totalCandlesFetched
                }
            },
            markets: results
        };
        
        // Write to file
        const outputPath = path.resolve(params.output);
        await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2));
        
        // Display summary
        console.log(`\n📋 SUMMARY`);
        console.log(`═══════════════════════════════════════════════════════════════`);
        console.log(`✅ Successfully processed ${results.length} market events`);
        console.log(`📊 Total pools processed: ${totalPoolsProcessed}`);
        console.log(`📈 Total candles fetched: ${totalCandlesFetched}`);
        console.log(`💾 Data saved to: ${outputPath}`);
        console.log(`📦 File size: ${(JSON.stringify(outputData).length / 1024).toFixed(2)} KB`);
        
        // Show sample of first market
        if (results.length > 0) {
            const firstMarket = results[0];
            console.log(`\n🔍 Sample (First Market):`);
            console.log(`   Title: ${firstMarket.title?.substring(0, 60)}...`);
            console.log(`   Status: ${firstMarket.status}`);
            console.log(`   Conditional Pools: YES=${firstMarket.conditional_pools.yes ? '✓' : '✗'}, NO=${firstMarket.conditional_pools.no ? '✓' : '✗'}`);
            
            const candleTypes = Object.keys(firstMarket.candles);
            if (candleTypes.length > 0) {
                console.log(`   Candle Data Available: ${candleTypes.join(', ')}`);
                
                // Show latest price from first available candle type
                const firstType = candleTypes[0];
                const candles = firstMarket.candles[firstType];
                if (candles && candles.length > 0) {
                    console.log(`   Latest ${firstType} price: $${candles[0].price}`);
                }
            }
        }
        
    } catch (error) {
        console.error(`\n💥 Unexpected error occurred:`);
        console.error(error.message);
        console.error(`\nStack trace:`);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the script
main().catch(console.error);