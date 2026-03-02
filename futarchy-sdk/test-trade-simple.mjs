#!/usr/bin/env node

// Quick test of TradeHistoryFetcher

import { DataLayer } from './DataLayer.js';
import { createTradeHistoryFetcher } from './fetchers/TradeHistoryFetcher.js';

const dl = new DataLayer();
const fetcher = createTradeHistoryFetcher(
    'https://nvhqdqtlsdboctqjcelq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aHFkcXRsc2Rib2N0cWpjZWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDU3ODEsImV4cCI6MjA1NzcyMTc4MX0.6kjpxGVqSQNMz3DqycuNPv_ug8sdBNKeJsN0Z3X7oLg'
);

dl.registerFetcher(fetcher);

console.log('\n📊 Fetching trades for user 0xea820f6f...\n');

const result = await dl.fetch('trades.user', {
    userAddress: '0xea820f6fea20a06af94b291c393c68956199cbe9',
    limit: 3
});

if (result.status === 'success' && result.data.length > 0) {
    console.log(`✅ Successfully fetched ${result.count} trades\n`);

    result.data.forEach((trade, i) => {
        console.log(`Trade ${i + 1}:`);
        console.log(`  Time: ${trade.timestampFormatted}`);
        console.log(`  Type: ${trade.tradeType}`);
        console.log(`  Side: ${trade.side}`);
        console.log(`  Token0: ${trade.token0?.substring(0, 10)}...`);
        console.log(`  Token1: ${trade.token1?.substring(0, 10)}...`);
        console.log(`  Amount0: ${trade.amount0Formatted}`);
        console.log(`  Amount1: ${trade.amount1Formatted}`);
        console.log(`  Price: ${trade.priceFormatted}`);
        console.log(`  Pool: ${trade.poolId?.substring(0, 10)}...`);
        console.log(`  Tx: ${trade.transactionHash?.substring(0, 10)}...\n`);
    });
} else {
    console.log('❌ No trades found or error occurred');
    if (result.reason) console.log(`Reason: ${result.reason}`);
}