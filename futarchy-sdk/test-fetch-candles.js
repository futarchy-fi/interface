#!/usr/bin/env node

// test-fetch-candles.js - Test fetching the last three candles from a pool using DataLayer

import 'dotenv/config';
import { DataLayer } from './DataLayer.js';
import { createSupabasePoolFetcher } from './fetchers/SupabasePoolFetcher.js';
import { MockFetcher } from './fetchers/MockFetcher.js';
import chalk from 'chalk';

// Test configuration
const TEST_CONFIG = {
    // Use the default YES pool from .env.example
    poolAddress: process.env.DEFAULT_YES_POOL || '0xF336F812Db1ad142F22A9A4dd43D40e64B478361',
    supabaseUrl: process.env.SUPABASE_URL || 'https://nvhqdqtlsdboctqjcelq.supabase.co',
    supabaseKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aHFkcXRsc2Rib2N0cWpjZWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDU3ODEsImV4cCI6MjA1NzcyMTc4MX0.6kjpxGVqSQNMz3DqycuNPv_ug8sdBNKeJsN0Z3X7oLg',
    useMock: process.env.USE_MOCK === 'true' || false
};

// =============================================================================
// MAIN TEST FUNCTION
// =============================================================================

async function testFetchCandles() {
    console.log(chalk.cyan.bold('\n======================================'));
    console.log(chalk.cyan.bold('   POOL CANDLES FETCHER TEST'));
    console.log(chalk.cyan.bold('======================================\n'));

    // Step 1: Initialize DataLayer
    console.log(chalk.yellow('📊 Initializing DataLayer...'));
    const dataLayer = new DataLayer();

    // Step 2: Register appropriate fetcher based on configuration
    if (TEST_CONFIG.useMock) {
        console.log(chalk.yellow('🎭 Using MockFetcher (USE_MOCK=true)'));
        const mockFetcher = new MockFetcher();
        dataLayer.registerFetcher(mockFetcher);
    } else {
        console.log(chalk.yellow('🌐 Using SupabasePoolFetcher for real data'));
        try {
            const supabaseFetcher = createSupabasePoolFetcher(
                TEST_CONFIG.supabaseUrl,
                TEST_CONFIG.supabaseKey
            );
            dataLayer.registerFetcher(supabaseFetcher);
            console.log(chalk.green('✅ SupabasePoolFetcher registered successfully'));
        } catch (error) {
            console.log(chalk.red('❌ Failed to create SupabasePoolFetcher:', error.message));
            console.log(chalk.yellow('🎭 Falling back to MockFetcher'));
            const mockFetcher = new MockFetcher();
            dataLayer.registerFetcher(mockFetcher);
        }
    }

    // Step 3: Display available operations
    console.log(chalk.cyan('\n📋 Available Operations:'));
    const operations = dataLayer.getAvailableOperations();
    operations.forEach(op => {
        console.log(chalk.gray(`  • ${op}`));
    });

    // Step 4: Fetch the last 3 candles
    console.log(chalk.yellow('\n🕯️ Fetching last 3 candles from pool...'));
    console.log(chalk.gray(`Pool Address: ${TEST_CONFIG.poolAddress}`));
    console.log(chalk.gray('─'.repeat(50)));

    try {
        const result = await dataLayer.fetch('pools.candle', {
            id: TEST_CONFIG.poolAddress,
            interval: '3600000', // 1 hour intervals (in milliseconds)
            limit: 3
        });

        if (result.status === 'success') {
            console.log(chalk.green('\n✅ Candles fetched successfully!'));
            console.log(chalk.gray(`Source: ${result.source || 'Unknown'}`));
            console.log(chalk.gray(`Count: ${result.count || result.data.length} candles\n`));

            // Display each candle
            result.data.forEach((candle, index) => {
                console.log(chalk.cyan(`📊 Candle #${index + 1}:`));
                console.log(chalk.gray('  ├─ Timestamp:'), new Date(candle.timestamp * 1000).toISOString());
                console.log(chalk.gray('  ├─ Price:'), chalk.green(`$${candle.price}`));
                console.log(chalk.gray('  ├─ Volume:'), chalk.blue(`${candle.volume}`));

                // Additional fields if available
                if (candle.open) console.log(chalk.gray('  ├─ Open:'), `$${candle.open}`);
                if (candle.high) console.log(chalk.gray('  ├─ High:'), `$${candle.high}`);
                if (candle.low) console.log(chalk.gray('  ├─ Low:'), `$${candle.low}`);
                if (candle.close) console.log(chalk.gray('  ├─ Close:'), `$${candle.close}`);

                console.log(chalk.gray('  └─ Pool:'), candle.address || TEST_CONFIG.poolAddress);
                console.log();
            });

            // Calculate price statistics
            if (result.data.length > 0) {
                const prices = result.data.map(c => parseFloat(c.price));
                const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
                const maxPrice = Math.max(...prices);
                const minPrice = Math.min(...prices);

                console.log(chalk.yellow('📈 Price Statistics:'));
                console.log(chalk.gray('  ├─ Average:'), chalk.green(`$${avgPrice.toFixed(4)}`));
                console.log(chalk.gray('  ├─ Maximum:'), chalk.green(`$${maxPrice.toFixed(4)}`));
                console.log(chalk.gray('  └─ Minimum:'), chalk.green(`$${minPrice.toFixed(4)}`));
            }

        } else {
            console.log(chalk.red(`\n❌ Failed to fetch candles: ${result.reason}`));
            if (result.availableOperations) {
                console.log(chalk.yellow('\nAvailable operations:'));
                result.availableOperations.forEach(op => {
                    console.log(chalk.gray(`  • ${op}`));
                });
            }
        }

    } catch (error) {
        console.error(chalk.red('\n💥 Error fetching candles:'), error.message);
        console.error(chalk.gray(error.stack));
    }

    // Step 5: Try fetching pool info if available
    console.log(chalk.yellow('\n\n📋 Fetching pool information...'));
    console.log(chalk.gray('─'.repeat(50)));

    try {
        const poolInfo = await dataLayer.fetch('pools.info', {
            id: TEST_CONFIG.poolAddress
        });

        if (poolInfo.status === 'success') {
            console.log(chalk.green('\n✅ Pool info fetched successfully!'));
            const info = poolInfo.data;

            console.log(chalk.cyan('\n🏊 Pool Details:'));
            console.log(chalk.gray('  ├─ Pool ID:'), info.poolId || info.address);
            console.log(chalk.gray('  ├─ Token0:'), info.token0 || 'Unknown');
            console.log(chalk.gray('  ├─ Token1:'), info.token1 || 'Unknown');
            console.log(chalk.gray('  ├─ Fee:'), info.fee ? `${info.fee / 10000}%` : 'Unknown');
            console.log(chalk.gray('  ├─ Liquidity:'), info.liquidity || 'Unknown');
            console.log(chalk.gray('  └─ Active:'), info.active !== undefined ? (info.active ? '✅' : '❌') : 'Unknown');
        } else {
            console.log(chalk.yellow(`ℹ️ Pool info not available: ${poolInfo.reason}`));
        }

    } catch (error) {
        console.error(chalk.yellow('ℹ️ Could not fetch pool info:'), error.message);
    }

    console.log(chalk.cyan('\n======================================'));
    console.log(chalk.cyan('   TEST COMPLETED'));
    console.log(chalk.cyan('======================================\n'));
}

// =============================================================================
// RUN THE TEST
// =============================================================================

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
    console.error(chalk.red('\n💥 Unhandled error:'), error);
    process.exit(1);
});

// Run the test
console.log(chalk.gray('Starting test...'));
testFetchCandles()
    .then(() => {
        console.log(chalk.green('✨ Test finished successfully'));
        process.exit(0);
    })
    .catch((error) => {
        console.error(chalk.red('💥 Test failed:'), error);
        process.exit(1);
    });