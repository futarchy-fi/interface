#!/usr/bin/env node

// Fetch trade history for specific user and proposal

import { DataLayer } from './DataLayer.js';
import { createTradeHistoryFetcher } from './fetchers/TradeHistoryFetcher.js';
import { createERC20Fetcher } from './fetchers/ERC20Fetcher.js';
import chalk from 'chalk';

const CONFIG = {
    userAddress: '0x645A3D9208523bbFEE980f7269ac72C61Dd3b552',
    proposalId: '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF',
    supabaseUrl: 'https://nvhqdqtlsdboctqjcelq.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aHFkcXRsc2Rib2N0cWpjZWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDU3ODEsImV4cCI6MjA1NzcyMTc4MX0.6kjpxGVqSQNMz3DqycuNPv_ug8sdBNKeJsN0Z3X7oLg',
    rpcUrl: 'https://rpc.gnosischain.com',
    chainId: 100
};

async function fetchUserTrades() {
    console.log(chalk.cyan.bold('\n======================================'));
    console.log(chalk.cyan.bold('   FETCHING USER TRADE HISTORY'));
    console.log(chalk.cyan.bold('======================================\n'));

    console.log(chalk.yellow('User Address:'), CONFIG.userAddress);
    console.log(chalk.yellow('Proposal ID:'), CONFIG.proposalId);
    console.log(chalk.gray('─'.repeat(50)) + '\n');

    // Initialize DataLayer
    const dataLayer = new DataLayer();

    // Create ERC20Fetcher for token info
    const erc20Fetcher = createERC20Fetcher(CONFIG.rpcUrl, CONFIG.chainId);

    // Create TradeHistoryFetcher with token support
    const tradeHistoryFetcher = createTradeHistoryFetcher(
        CONFIG.supabaseUrl,
        CONFIG.supabaseKey,
        {
            rpcUrl: CONFIG.rpcUrl,
            chainId: CONFIG.chainId,
            erc20Fetcher: erc20Fetcher
        }
    );

    dataLayer.registerFetcher(tradeHistoryFetcher);

    // Fetch the last 50 trades
    console.log(chalk.yellow('📊 Fetching last 50 trades...\n'));

    // First try with proposal ID
    let result = await dataLayer.fetch('trades.history', {
        userAddress: CONFIG.userAddress,
        proposalId: CONFIG.proposalId,
        limit: 50,
        orderBy: 'evt_block_time',
        ascending: false
    });

    // If no trades with proposal, fetch without proposal filter
    if (result.data && result.data.length === 0) {
        console.log(chalk.yellow('No trades found with proposal ID, fetching all user trades...\n'));
        result = await dataLayer.fetch('trades.user', {
            userAddress: CONFIG.userAddress,
            limit: 50
        });
    }

    if (result.status === 'success') {
        console.log(chalk.green(`✅ Found ${result.count} trades\n`));

        if (result.data.length > 0) {
            // Display trades
            result.data.forEach((trade, index) => {
                const tradeNum = index + 1;
                const side = trade.side === 'buy' ? chalk.green('BUY ') : chalk.red('SELL');

                // Outcome coloring
                const outcomeColor = trade.outcome === 'YES' ? chalk.green :
                                    trade.outcome === 'NO' ? chalk.red :
                                    chalk.gray;
                const outcomeDisplay = trade.outcome ? outcomeColor(`[${trade.outcome}]`) : '';

                console.log(chalk.cyan(`Trade #${tradeNum}: ${outcomeDisplay}`));
                console.log(`  ${side} ${chalk.yellow(trade.tradeSummary)}`);
                console.log(chalk.gray(`  Time: ${trade.timestampFormatted}`));
                console.log(chalk.gray(`  Token0: ${trade.token0Symbol} (${trade.token0Outcome || 'NEUTRAL'})`));
                console.log(chalk.gray(`  Token1: ${trade.token1Symbol} (${trade.token1Outcome || 'NEUTRAL'})`));
                console.log(chalk.gray(`  Amount0: ${trade.amount0Formatted}`));
                console.log(chalk.gray(`  Amount1: ${trade.amount1Formatted}`));
                console.log(chalk.gray(`  Price: ${trade.priceFormatted}`));
                console.log(chalk.gray(`  Outcome: ${trade.outcome || 'N/A'}`));
                console.log(chalk.gray(`  Tx: ${trade.transactionHash?.substring(0, 10)}...`));
                console.log(chalk.gray(`  Pool: ${trade.poolId?.substring(0, 10)}...`));
                console.log();
            });

            // Summary statistics
            console.log(chalk.cyan('\n📈 Trade Summary:'));
            console.log(chalk.gray('─'.repeat(50)));

            // Unique tokens traded
            const uniqueTokens = new Set();
            const tokenPairs = new Map();

            result.data.forEach(trade => {
                uniqueTokens.add(`${trade.token0Symbol} (${trade.token0})`);
                uniqueTokens.add(`${trade.token1Symbol} (${trade.token1})`);

                const pair = `${trade.token0Symbol}/${trade.token1Symbol}`;
                tokenPairs.set(pair, (tokenPairs.get(pair) || 0) + 1);
            });

            console.log(chalk.yellow('\n🪙 Unique Tokens:'));
            uniqueTokens.forEach(token => {
                console.log(chalk.gray('  • ') + token.substring(0, 60) + '...');
            });

            console.log(chalk.yellow('\n🔄 Token Pairs Traded:'));
            tokenPairs.forEach((count, pair) => {
                console.log(chalk.gray(`  • ${pair}: ${count} trade(s)`));
            });

            // Trade type breakdown
            const buyCount = result.data.filter(t => t.side === 'buy').length;
            const sellCount = result.data.filter(t => t.side === 'sell').length;

            console.log(chalk.yellow('\n📊 Trade Breakdown:'));
            console.log(chalk.green(`  • Buys: ${buyCount}`));
            console.log(chalk.red(`  • Sells: ${sellCount}`));

            // Outcome breakdown
            const yesCount = result.data.filter(t => t.outcome === 'YES').length;
            const noCount = result.data.filter(t => t.outcome === 'NO').length;
            const neutralCount = result.data.filter(t => !t.outcome).length;

            console.log(chalk.yellow('\n🎯 Outcome Breakdown:'));
            console.log(chalk.green(`  • YES trades: ${yesCount}`));
            console.log(chalk.red(`  • NO trades: ${noCount}`));
            if (neutralCount > 0) {
                console.log(chalk.gray(`  • Neutral/Unknown: ${neutralCount}`));
            }

            // Time range
            const firstTrade = result.data[result.data.length - 1];
            const lastTrade = result.data[0];
            console.log(chalk.yellow('\n⏱️ Time Range:'));
            console.log(chalk.gray(`  • First: ${firstTrade.timestampFormatted}`));
            console.log(chalk.gray(`  • Last: ${lastTrade.timestampFormatted}`));

        } else {
            console.log(chalk.yellow('No trades found for this user/proposal combination'));
        }
    } else {
        console.error(chalk.red(`❌ Failed to fetch trades: ${result.reason}`));
    }

    console.log(chalk.cyan('\n======================================\n'));
}

// Run the fetch
fetchUserTrades()
    .then(() => {
        console.log(chalk.green('✨ Done'));
        process.exit(0);
    })
    .catch(error => {
        console.error(chalk.red('💥 Error:'), error);
        process.exit(1);
    });