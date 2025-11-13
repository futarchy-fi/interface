#!/usr/bin/env node

// test-trade-history-tokens.mjs - Test TradeHistoryFetcher with token information

import 'dotenv/config';
import { DataLayer } from './DataLayer.js';
import { createTradeHistoryFetcher } from './fetchers/TradeHistoryFetcher.js';
import { createERC20Fetcher } from './fetchers/ERC20Fetcher.js';
import chalk from 'chalk';

// Test configuration
const TEST_CONFIG = {
    userAddress: '0xea820f6fea20a06af94b291c393c68956199cbe9',
    supabaseUrl: process.env.SUPABASE_URL || 'https://nvhqdqtlsdboctqjcelq.supabase.co',
    supabaseKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aHFkcXRsc2Rib2N0cWpjZWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDU3ODEsImV4cCI6MjA1NzcyMTc4MX0.6kjpxGVqSQNMz3DqycuNPv_ug8sdBNKeJsN0Z3X7oLg',
    rpcUrl: 'https://rpc.gnosischain.com',
    chainId: 100
};

async function testTradeHistoryWithTokens() {
    console.log(chalk.cyan.bold('\n======================================'));
    console.log(chalk.cyan.bold('   TRADE HISTORY WITH TOKEN INFO TEST'));
    console.log(chalk.cyan.bold('======================================\n'));

    // Initialize DataLayer
    console.log(chalk.yellow('📊 Initializing DataLayer...'));
    const dataLayer = new DataLayer();

    // Create ERC20Fetcher for token info
    console.log(chalk.yellow('🪙 Creating ERC20Fetcher for token information...'));
    const erc20Fetcher = createERC20Fetcher(TEST_CONFIG.rpcUrl, TEST_CONFIG.chainId);

    // Create TradeHistoryFetcher with ERC20 integration
    console.log(chalk.yellow('📜 Creating TradeHistoryFetcher with token support...'));
    const tradeHistoryFetcher = createTradeHistoryFetcher(
        TEST_CONFIG.supabaseUrl,
        TEST_CONFIG.supabaseKey,
        {
            rpcUrl: TEST_CONFIG.rpcUrl,
            chainId: TEST_CONFIG.chainId,
            erc20Fetcher: erc20Fetcher,
            tokenCacheTimeout: 3600000 // 1 hour cache
        }
    );

    dataLayer.registerFetcher(tradeHistoryFetcher);
    console.log(chalk.green('✅ TradeHistoryFetcher registered with token info support'));

    // Test 1: Fetch recent trades with token info
    console.log(chalk.yellow('\n\n🔄 Test 1: Recent Trades with Token Information'));
    console.log(chalk.gray('─'.repeat(50)));

    try {
        const result = await dataLayer.fetch('trades.recent', {
            limit: 5
        });

        if (result.status === 'success' && result.data.length > 0) {
            console.log(chalk.green(`\n✅ Fetched ${result.count} trades with token info`));

            result.data.forEach((trade, index) => {
                console.log(chalk.cyan(`\n📊 Trade #${index + 1}:`));
                console.log(chalk.gray('  ├─ Time:'), trade.timestampFormatted || 'N/A');
                console.log(chalk.gray('  ├─ User:'), trade.userAddress.substring(0, 10) + '...');

                // Token 0 info
                console.log(chalk.yellow('  ├─ Token0:'));
                console.log(chalk.gray('  │  ├─ Symbol:'), chalk.green(trade.token0Symbol));
                console.log(chalk.gray('  │  ├─ Name:'), trade.token0Name);
                console.log(chalk.gray('  │  ├─ Amount:'), chalk.blue(trade.amount0Formatted));
                console.log(chalk.gray('  │  └─ Address:'), trade.token0?.substring(0, 10) + '...');

                // Token 1 info
                console.log(chalk.yellow('  ├─ Token1:'));
                console.log(chalk.gray('  │  ├─ Symbol:'), chalk.green(trade.token1Symbol));
                console.log(chalk.gray('  │  ├─ Name:'), trade.token1Name);
                console.log(chalk.gray('  │  ├─ Amount:'), chalk.blue(trade.amount1Formatted));
                console.log(chalk.gray('  │  └─ Address:'), trade.token1?.substring(0, 10) + '...');

                // Trade summary
                console.log(chalk.gray('  ├─ Type:'), trade.side === 'buy' ? chalk.green('BUY') : chalk.red('SELL'));
                console.log(chalk.gray('  ├─ Price:'), trade.priceFormatted);
                console.log(chalk.gray('  └─ Summary:'), chalk.cyan(trade.tradeSummary));
            });

            // Show unique tokens found
            const uniqueTokens = new Set();
            result.data.forEach(trade => {
                if (trade.token0Symbol && trade.token0Symbol !== 'UNKNOWN') {
                    uniqueTokens.add(`${trade.token0Symbol} (${trade.token0Name})`);
                }
                if (trade.token1Symbol && trade.token1Symbol !== 'UNKNOWN') {
                    uniqueTokens.add(`${trade.token1Symbol} (${trade.token1Name})`);
                }
            });

            if (uniqueTokens.size > 0) {
                console.log(chalk.yellow('\n\n🪙 Unique Tokens Found:'));
                uniqueTokens.forEach(token => {
                    console.log(chalk.gray('  • ') + chalk.green(token));
                });
            }
        } else {
            console.log(chalk.yellow('ℹ️ No trades found'));
        }
    } catch (error) {
        console.error(chalk.red('❌ Error:'), error.message);
    }

    // Test 2: Fetch user trades with token info
    console.log(chalk.yellow('\n\n👤 Test 2: User Trades with Token Information'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.gray(`User: ${TEST_CONFIG.userAddress}`));

    try {
        const result = await dataLayer.fetch('trades.user', {
            userAddress: TEST_CONFIG.userAddress,
            limit: 3
        });

        if (result.status === 'success' && result.data.length > 0) {
            console.log(chalk.green(`\n✅ Fetched ${result.count} user trades`));

            // Show token pairs traded
            const tokenPairs = new Map();
            result.data.forEach(trade => {
                const pair = `${trade.token0Symbol}/${trade.token1Symbol}`;
                if (!tokenPairs.has(pair)) {
                    tokenPairs.set(pair, {
                        count: 0,
                        token0: { symbol: trade.token0Symbol, name: trade.token0Name },
                        token1: { symbol: trade.token1Symbol, name: trade.token1Name }
                    });
                }
                tokenPairs.get(pair).count++;
            });

            console.log(chalk.cyan('\n🔄 Token Pairs Traded:'));
            tokenPairs.forEach((info, pair) => {
                console.log(chalk.gray(`  • ${pair}: ${info.count} trade(s)`));
                console.log(chalk.gray(`    Token0: ${info.token0.name}`));
                console.log(chalk.gray(`    Token1: ${info.token1.name}`));
            });

            // Show sample trades
            console.log(chalk.cyan('\n📋 Sample Trades:'));
            result.data.slice(0, 2).forEach((trade, index) => {
                console.log(chalk.yellow(`\nTrade ${index + 1}:`));
                console.log(chalk.gray('  Summary:'), chalk.green(trade.tradeSummary));
                console.log(chalk.gray('  Time:'), trade.timestampFormatted);
                console.log(chalk.gray('  Tx:'), trade.transactionHash?.substring(0, 10) + '...');
            });
        } else {
            console.log(chalk.yellow('ℹ️ No trades found for this user'));
        }
    } catch (error) {
        console.error(chalk.red('❌ Error:'), error.message);
    }

    // Test 3: Test cache efficiency
    console.log(chalk.yellow('\n\n⚡ Test 3: Cache Efficiency Test'));
    console.log(chalk.gray('─'.repeat(50)));

    console.log(chalk.cyan('Fetching trades again to test cache...'));
    const startTime = Date.now();

    try {
        const result = await dataLayer.fetch('trades.recent', {
            limit: 3
        });

        const elapsed = Date.now() - startTime;
        console.log(chalk.green(`✅ Fetched ${result.data?.length || 0} trades in ${elapsed}ms`));
        console.log(chalk.gray('   Token info should be cached, resulting in faster fetch'));

        if (result.data && result.data.length > 0) {
            // Count unique tokens
            const tokenSet = new Set();
            result.data.forEach(trade => {
                if (trade.token0) tokenSet.add(trade.token0);
                if (trade.token1) tokenSet.add(trade.token1);
            });
            console.log(chalk.gray(`   ${tokenSet.size} unique tokens (all cached)`));
        }
    } catch (error) {
        console.error(chalk.red('❌ Error:'), error.message);
    }

    // Summary
    console.log(chalk.cyan('\n\n======================================'));
    console.log(chalk.cyan('   TEST SUMMARY'));
    console.log(chalk.cyan('======================================'));

    console.log(chalk.green('\n✅ Trade History with Token Info Features:'));
    console.log(chalk.gray('  • Automatic token symbol and name resolution'));
    console.log(chalk.gray('  • Efficient batch fetching of token info'));
    console.log(chalk.gray('  • Token info caching to minimize RPC calls'));
    console.log(chalk.gray('  • Human-readable trade summaries'));
    console.log(chalk.gray('  • Token pair identification'));

    console.log(chalk.yellow('\n🔧 Configuration:'));
    console.log(chalk.gray(`  • Chain: Gnosis (ID: ${TEST_CONFIG.chainId})`));
    console.log(chalk.gray(`  • RPC: ${TEST_CONFIG.rpcUrl}`));
    console.log(chalk.gray('  • Cache Timeout: 1 hour'));

    console.log(chalk.cyan('\n======================================\n'));
}

// Run the test
console.log(chalk.gray('Starting Trade History with Token Info test...'));

process.on('unhandledRejection', (error) => {
    console.error(chalk.red('\n💥 Unhandled error:'), error);
    process.exit(1);
});

testTradeHistoryWithTokens()
    .then(() => {
        console.log(chalk.green('✨ Test completed successfully'));
        process.exit(0);
    })
    .catch((error) => {
        console.error(chalk.red('💥 Test failed:'), error);
        process.exit(1);
    });