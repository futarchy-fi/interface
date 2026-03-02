#!/usr/bin/env node

// test-trade-history.js - Test TradeHistoryFetcher with DataLayer

import 'dotenv/config';
import { DataLayer } from './DataLayer.js';
import { createTradeHistoryFetcher } from './fetchers/TradeHistoryFetcher.js';
import chalk from 'chalk';

// Test configuration
const TEST_CONFIG = {
    // Specific user and proposal from the query
    userAddress: '0xea820f6fea20a06af94b291c393c68956199cbe9',
    proposalId: '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF',

    // Supabase configuration
    supabaseUrl: process.env.SUPABASE_URL || 'https://nvhqdqtlsdboctqjcelq.supabase.co',
    supabaseKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aHFkcXRsc2Rib2N0cWpjZWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDU3ODEsImV4cCI6MjA1NzcyMTc4MX0.6kjpxGVqSQNMz3DqycuNPv_ug8sdBNKeJsN0Z3X7oLg'
};

// =============================================================================
// TEST FUNCTIONS
// =============================================================================

async function testTradeHistory() {
    console.log(chalk.cyan.bold('\n======================================'));
    console.log(chalk.cyan.bold('   TRADE HISTORY FETCHER TEST'));
    console.log(chalk.cyan.bold('======================================\n'));

    // Step 1: Initialize DataLayer
    console.log(chalk.yellow('📊 Initializing DataLayer...'));
    const dataLayer = new DataLayer();

    // Step 2: Create and register TradeHistoryFetcher
    console.log(chalk.yellow('🔌 Creating TradeHistoryFetcher...'));
    try {
        const tradeHistoryFetcher = createTradeHistoryFetcher(
            TEST_CONFIG.supabaseUrl,
            TEST_CONFIG.supabaseKey
        );
        dataLayer.registerFetcher(tradeHistoryFetcher);
        console.log(chalk.green('✅ TradeHistoryFetcher registered successfully'));
    } catch (error) {
        console.error(chalk.red('❌ Failed to create TradeHistoryFetcher:'), error.message);
        process.exit(1);
    }

    // Step 3: Display available operations
    console.log(chalk.cyan('\n📋 Available Operations:'));
    const operations = dataLayer.getAvailableOperations();
    operations.forEach(op => {
        console.log(chalk.gray(`  • ${op}`));
    });

    // Step 4: Test fetching trade history with specific user and proposal
    console.log(chalk.yellow('\n\n📜 Test 1: Fetch Trade History (User + Proposal)'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.gray(`User: ${TEST_CONFIG.userAddress}`));
    console.log(chalk.gray(`Proposal: ${TEST_CONFIG.proposalId}`));

    try {
        const result = await dataLayer.fetch('trades.history', {
            userAddress: TEST_CONFIG.userAddress,
            proposalId: TEST_CONFIG.proposalId,
            limit: 10
        });

        if (result.status === 'success') {
            console.log(chalk.green(`\n✅ Fetched ${result.count} trade records`));

            if (result.data.length > 0) {
                console.log(chalk.cyan('\n📊 Trade Records:'));
                result.data.forEach((trade, index) => {
                    console.log(chalk.yellow(`\n  Trade #${index + 1}:`));
                    console.log(chalk.gray('  ├─ Time:'), trade.timestampFormatted || 'N/A');
                    console.log(chalk.gray('  ├─ Type:'), chalk.cyan(trade.tradeType || 'N/A'));
                    console.log(chalk.gray('  ├─ Token0:'), trade.token0 ? `${trade.token0.substring(0, 10)}...` : 'N/A');
                    console.log(chalk.gray('  ├─ Token1:'), trade.token1 ? `${trade.token1.substring(0, 10)}...` : 'N/A');
                    console.log(chalk.gray('  ├─ Amount0:'), chalk.green(trade.amount0Formatted));
                    console.log(chalk.gray('  ├─ Amount1:'), chalk.blue(trade.amount1Formatted));
                    console.log(chalk.gray('  ├─ Price:'), chalk.green(trade.priceFormatted || 'N/A'));
                    console.log(chalk.gray('  ├─ Side:'), trade.side === 'buy' ? chalk.green('BUY') : chalk.red('SELL'));
                    console.log(chalk.gray('  └─ Tx:'), trade.transactionHash ?
                        `${trade.transactionHash.substring(0, 10)}...` : 'N/A');
                });
            } else {
                console.log(chalk.yellow('ℹ️ No trades found for this user/proposal combination'));
            }
        } else {
            console.error(chalk.red(`❌ Failed: ${result.reason}`));
        }
    } catch (error) {
        console.error(chalk.red('💥 Error:'), error.message);
    }

    // Step 5: Test fetching user trades only
    console.log(chalk.yellow('\n\n💼 Test 2: Fetch User Trades (All Proposals)'));
    console.log(chalk.gray('─'.repeat(50)));

    try {
        const result = await dataLayer.fetch('trades.user', {
            userAddress: TEST_CONFIG.userAddress,
            limit: 5
        });

        if (result.status === 'success') {
            console.log(chalk.green(`\n✅ Fetched ${result.count} trades for user`));

            // Show unique proposals traded
            const uniqueProposals = [...new Set(result.data.map(t => t.proposalId))];
            console.log(chalk.cyan(`\n📋 Proposals traded: ${uniqueProposals.length}`));
            uniqueProposals.slice(0, 3).forEach(proposal => {
                console.log(chalk.gray(`  • ${proposal}`));
            });
        } else {
            console.error(chalk.red(`❌ Failed: ${result.reason}`));
        }
    } catch (error) {
        console.error(chalk.red('💥 Error:'), error.message);
    }

    // Step 6: Test trade summary
    console.log(chalk.yellow('\n\n📈 Test 3: Trade Summary Statistics'));
    console.log(chalk.gray('─'.repeat(50)));

    try {
        const result = await dataLayer.fetch('trades.summary', {
            userAddress: TEST_CONFIG.userAddress,
            proposalId: TEST_CONFIG.proposalId
        });

        if (result.status === 'success') {
            const summary = result.data;
            console.log(chalk.green('\n✅ Trade Summary:'));
            console.log(chalk.gray('  ├─ Total Trades:'), chalk.cyan(summary.totalTrades));
            console.log(chalk.gray('  ├─ Unique Tokens:'), chalk.cyan(summary.uniqueTokens));
            console.log(chalk.gray('  ├─ Total Volume:'), chalk.green(`$${summary.totalVolume.toFixed(2)}`));
            console.log(chalk.gray('  └─ Avg Price:'), chalk.green(`$${summary.averagePrice.toFixed(4)}`));

            if (summary.tradesByType) {
                console.log(chalk.cyan('\n  Trades by Type:'));
                Object.entries(summary.tradesByType).forEach(([type, data]) => {
                    console.log(chalk.gray(`    • ${type}:`), `${data.count} trades, $${data.volume.toFixed(2)} volume`);
                });
            }

            if (summary.tradesByToken) {
                console.log(chalk.cyan('\n  Trades by Token:'));
                Object.entries(summary.tradesByToken).forEach(([token, data]) => {
                    console.log(chalk.gray(`    • ${token}:`), `${data.count} trades, avg $${data.averagePrice.toFixed(4)}`);
                });
            }
        } else {
            console.error(chalk.red(`❌ Failed: ${result.reason}`));
        }
    } catch (error) {
        console.error(chalk.red('💥 Error:'), error.message);
    }

    // Step 7: Test recent trades
    console.log(chalk.yellow('\n\n🕐 Test 4: Recent Trades (All Users)'));
    console.log(chalk.gray('─'.repeat(50)));

    try {
        const result = await dataLayer.fetch('trades.recent', {
            limit: 5
        });

        if (result.status === 'success') {
            console.log(chalk.green(`\n✅ Fetched ${result.count} recent trades`));

            if (result.data.length > 0) {
                console.log(chalk.cyan('\n🔄 Latest Trades:'));
                result.data.slice(0, 3).forEach((trade, index) => {
                    console.log(chalk.gray(`  ${index + 1}. ${trade.timestampFormatted || 'Unknown time'}`));
                    console.log(chalk.gray(`     User: ${trade.userAddress.substring(0, 10)}...`));
                    console.log(chalk.gray(`     ${trade.side === 'buy' ? '🟢' : '🔴'} ${trade.amountFormatted} ${trade.tokenSymbol || 'tokens'} @ ${trade.priceFormatted || 'N/A'}`));
                });
            }
        } else {
            console.error(chalk.red(`❌ Failed: ${result.reason}`));
        }
    } catch (error) {
        console.error(chalk.red('💥 Error:'), error.message);
    }

    // Step 8: Test proposal trades
    console.log(chalk.yellow('\n\n🎯 Test 5: Proposal Trades (All Users)'));
    console.log(chalk.gray('─'.repeat(50)));

    try {
        const result = await dataLayer.fetch('trades.proposal', {
            proposalId: TEST_CONFIG.proposalId,
            limit: 5
        });

        if (result.status === 'success') {
            console.log(chalk.green(`\n✅ Fetched ${result.count} trades for proposal`));

            // Show unique users who traded
            const uniqueUsers = [...new Set(result.data.map(t => t.userAddress))];
            console.log(chalk.cyan(`\n👥 Unique traders: ${uniqueUsers.length}`));
            uniqueUsers.slice(0, 3).forEach(user => {
                console.log(chalk.gray(`  • ${user.substring(0, 10)}...${user.substring(user.length - 8)}`));
            });
        } else {
            console.error(chalk.red(`❌ Failed: ${result.reason}`));
        }
    } catch (error) {
        console.error(chalk.red('💥 Error:'), error.message);
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

// Parse command line arguments
const args = process.argv.slice(2);
if (args.includes('--help')) {
    console.log(chalk.cyan('Trade History Fetcher Test'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log('Usage: node test-trade-history.js [options]');
    console.log('\nOptions:');
    console.log('  --help           Show this help message');
    console.log('  --user ADDRESS   Override test user address');
    console.log('  --proposal ID    Override test proposal ID');
    console.log('\nEnvironment variables:');
    console.log('  SUPABASE_URL     Supabase project URL');
    console.log('  SUPABASE_ANON_KEY Supabase anonymous key');
    process.exit(0);
}

// Override config from command line
const userIndex = args.indexOf('--user');
if (userIndex !== -1 && args[userIndex + 1]) {
    TEST_CONFIG.userAddress = args[userIndex + 1];
    console.log(chalk.yellow(`Using custom user: ${TEST_CONFIG.userAddress}`));
}

const proposalIndex = args.indexOf('--proposal');
if (proposalIndex !== -1 && args[proposalIndex + 1]) {
    TEST_CONFIG.proposalId = args[proposalIndex + 1];
    console.log(chalk.yellow(`Using custom proposal: ${TEST_CONFIG.proposalId}`));
}

// Run the test
console.log(chalk.gray('Starting Trade History Fetcher test...'));
testTradeHistory()
    .then(() => {
        console.log(chalk.green('✨ All tests completed successfully'));
        process.exit(0);
    })
    .catch((error) => {
        console.error(chalk.red('💥 Test failed:'), error);
        process.exit(1);
    });