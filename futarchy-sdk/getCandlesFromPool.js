#!/usr/bin/env node

// getCandlesFromPool.js - CLI Script for Fetching Pool Candles (Modular Version)

import { DataLayer } from './DataLayer.js';
import { createSupabasePoolFetcher } from './fetchers/SupabasePoolFetcher.js';
import { MockFetcher } from './fetchers/MockFetcher.js';
import { config } from './config.js';

// =============================================================================
// SETUP DATALAYER - Modular Configuration
// =============================================================================

function setupDataLayer(useMock = false) {
    console.log(`🔧 Setting up DataLayer...`);
    
    const dataLayer = new DataLayer();
    
    if (useMock) {
        // Use mock fetcher for testing
        console.log(`🎭 Using MockFetcher for testing`);
        const mockFetcher = new MockFetcher();
        dataLayer.registerFetcher(mockFetcher);
    } else {
        // Use real Supabase fetcher
        console.log(`📡 Using SupabasePoolFetcher`);
        const supabaseFetcher = createSupabasePoolFetcher(config.supabaseUrl, config.supabaseKey);
        dataLayer.registerFetcher(supabaseFetcher);
    }
    
    console.log(`✨ DataLayer ready with operations:`, dataLayer.getAvailableOperations());
    return dataLayer;
}

// =============================================================================
// CLI ARGUMENT PARSING
// =============================================================================

function parseArgs() {
    const args = process.argv.slice(2);
    
    const params = {
        pool: null,
        interval: '3600000', // default 1 hour
        limit: 10,           // default 10 candles
        useMock: false       // new flag for mock mode
    };
    
    // Parse arguments: --pool 0x123 --interval 3600000 --limit 5 --mock
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const nextArg = args[i + 1];
        
        switch (arg) {
            case '--pool':
            case '-p':
                params.pool = nextArg;
                i++; // skip next arg since we consumed it
                break;
            case '--interval':
            case '-i':
                params.interval = nextArg;
                i++;
                break;
            case '--limit':
            case '-l':
                params.limit = parseInt(nextArg);
                i++;
                break;
            case '--mock':
            case '-m':
                params.useMock = true;
                break;
            case '--help':
            case '-h':
                showHelp();
                process.exit(0);
                break;
            default:
                // If no flag, assume it's a pool address
                if (!params.pool && arg.startsWith('0x')) {
                    params.pool = arg;
                }
                break;
        }
    }
    
    return params;
}

function showHelp() {
    console.log(`
🔥 Pool Candles Fetcher - Modular DataLayer POC

Usage:
  npm run getCandlesFromPool -- --pool <address> [options]
  npm run getCandlesFromPool -- <pool_address> [options]

Options:
  --pool, -p <address>     Pool address to fetch candles from
  --interval, -i <ms>      Interval in milliseconds (default: 3600000 = 1 hour)
  --limit, -l <number>     Number of candles to fetch (default: 10)
  --mock, -m               Use mock data instead of Supabase
  --help, -h               Show this help

Examples:
  # Real Supabase data
  npm run getCandlesFromPool -- --pool 0xF336F812Db1ad142F22A9A4dd43D40e64B478361
  npm run getCandlesFromPool -- --pool 0xF336F812Db1ad142F22A9A4dd43D40e64B478361 --limit 5
  
  # Mock data for testing
  npm run getCandlesFromPool -- --pool 0xF336F812Db1ad142F22A9A4dd43D40e64B478361 --mock
  npm run getCandlesFromPool -- 0x123... --interval 60000 --limit 20 --mock

Interval Options:
  60000      = 1 minute
  3600000    = 1 hour (default)
  86400000   = 1 day

Available Operations:
  - pools.candle     Get pool candle data
  - pools.info       Get pool information  
  - pools.volume     Get pool volume data (Supabase only)
  - user.profile     Get user profile (Mock only)
  - market.stats     Get market statistics (Mock only)
    `);
}

function validateArgs(params) {
    if (!params.pool) {
        console.error(`❌ Error: Pool address is required!`);
        console.log(`Use --help for usage information.`);
        process.exit(1);
    }
    
    if (!params.pool.startsWith('0x') || params.pool.length !== 42) {
        console.error(`❌ Error: Invalid pool address format. Must be 42 characters starting with 0x`);
        process.exit(1);
    }
    
    if (params.limit <= 0 || params.limit > 1000) {
        console.error(`❌ Error: Limit must be between 1 and 1000`);
        process.exit(1);
    }
    
    if (!params.interval || isNaN(parseInt(params.interval))) {
        console.error(`❌ Error: Invalid interval format. Must be a number in milliseconds`);
        process.exit(1);
    }
}

// =============================================================================
// RESULT FORMATTING
// =============================================================================

function formatResult(result) {
    console.log(`\n📊 POOL CANDLES RESULT`);
    console.log(`═══════════════════════════════════════════════════════════════`);
    
    if (result.status === "error") {
        console.log(`❌ Status: ${result.status}`);
        console.log(`💬 Reason: ${result.reason}`);
        if (result.availableOperations) {
            console.log(`🛠️  Available operations: ${result.availableOperations.join(', ')}`);
        }
        return;
    }
    
    console.log(`✅ Status: ${result.status}`);
    console.log(`📡 Source: ${result.source}`);
    console.log(`📈 Candles count: ${result.count}`);
    console.log(`⏰ Fetched at: ${new Date(result.timestamp).toLocaleString()}`);
    
    if (result.data && result.data.length > 0) {
        console.log(`\n📋 CANDLE DATA:`);
        console.log(`───────────────────────────────────────────────────────────────`);
        
        result.data.forEach((candle, index) => {
            const date = new Date(candle.timestamp * 1000).toLocaleString();
            console.log(`${index + 1}. ${date} | Price: $${candle.price} | Volume: ${candle.volume || 'N/A'}`);
        });
        
        if (result.data.length > 0) {
            const latest = result.data[0];
            const oldest = result.data[result.data.length - 1];
            console.log(`\n💡 SUMMARY:`);
            console.log(`   Latest Price: $${latest.price} (${new Date(latest.timestamp * 1000).toLocaleString()})`);
            console.log(`   Oldest Price: $${oldest.price} (${new Date(oldest.timestamp * 1000).toLocaleString()})`);
            
            if (result.data.length > 1) {
                const priceChange = ((latest.price - oldest.price) / oldest.price * 100).toFixed(2);
                const changeEmoji = priceChange >= 0 ? '📈' : '📉';
                console.log(`   Price Change: ${changeEmoji} ${priceChange}%`);
            }
        }
    } else {
        console.log(`\n📭 No candle data found for this pool/interval combination.`);
    }
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
    console.log(`\n🚀 Starting Pool Candles Fetcher (Modular Version)...`);
    
    // Parse and validate arguments
    const params = parseArgs();
    validateArgs(params);
    
    console.log(`\n🎯 Parameters:`);
    console.log(`   Pool: ${params.pool}`);
    console.log(`   Interval: ${params.interval}ms`);
    console.log(`   Limit: ${params.limit} candles`);
    console.log(`   Mode: ${params.useMock ? 'Mock' : 'Supabase'}`);
    
    try {
        // Setup modular DataLayer
        const dataLayer = setupDataLayer(params.useMock);
        
        // Fetch pool candles using the same interface regardless of implementation
        const result = await dataLayer.fetch('pools.candle', {
            id: params.pool,
            interval: params.interval,
            limit: params.limit
        });
        
        // Display results
        formatResult(result);
        
        // If using mock, show additional demo operations
        if (params.useMock) {
            console.log(`\n🎭 BONUS: Mock-only operations demo:`);
            
            const userProfile = await dataLayer.fetch('user.profile', { userId: params.pool });
            console.log(`User Profile:`, userProfile.data);
            
            const marketStats = await dataLayer.fetch('market.stats', {});
            console.log(`Market Stats:`, marketStats.data);
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