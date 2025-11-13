import { DataLayer } from './DataLayer.js';
import { TradeHistoryFetcher } from './fetchers/TradeHistoryFetcher.js';
import { ERC20Fetcher } from './fetchers/ERC20Fetcher.js';
import { default as TradeHistoryCartridge } from './cartridges/TradeHistoryCartridge.js';

// Mock trade data for testing
const mockTrades = [
    {
        user_address: '0xea820f6fea20a06af94b291c393c68956199cbe9',
        proposal_id: '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF',
        token0: '0x4371297f5d7511eb47add4d693a511f7807387fc',
        token1: '0xe56b7ae18136c669f02ba08e75b5d21fed28d577',
        amount0: '-8784951037350000000000000', // Selling YES_GNO
        amount1: '1000000000000000000000',      // Receiving YES_sDAI
        evt_block_time: '2025-09-08T17:59:20.000Z',
        transactionHash: '0xdc75d59a',
        poolAddress: '0x13288883',
        blockNumber: 123456
    },
    {
        user_address: '0xea820f6fea20a06af94b291c393c68956199cbe9',
        proposal_id: '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF',
        token0: '0x2bca0042ca9a0432f1e1f1387d01494dcaba7ed4',
        token1: '0x37336fb39faf5968aac5949df96486bedba866fd',
        amount0: '79000000000000000000',        // Buying NO_sDAI
        amount1: '-3140525760340000000000000',  // Paying NO_PNK
        evt_block_time: '2025-08-22T16:00:30.000Z',
        transactionHash: '0x9ee8cd67',
        poolAddress: '0xabD38E58',
        blockNumber: 123457
    },
    {
        user_address: '0xea820f6fea20a06af94b291c393c68956199cbe9',
        proposal_id: '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF',
        token0: '0xcf2d888847d6d0d00c65505aaa18c9b4c05bdbbc',
        token1: '0xffb6fb4f5719340a050024ceb973dc699e8aa968',
        amount0: '-1702070793143099000000000', // Selling YES_PNK
        amount1: '50000000000000000000',        // Receiving YES_sDAI
        evt_block_time: '2025-08-22T15:55:30.000Z',
        transactionHash: '0x0d021ff7',
        poolAddress: '0xE0717A77',
        blockNumber: 123458
    }
];

// Mock token info
const mockTokenInfo = {
    '0x4371297f5d7511eb47add4d693a511f7807387fc': { symbol: 'YES_GNO', name: 'YES_GNO', decimals: 18 },
    '0xe56b7ae18136c669f02ba08e75b5d21fed28d577': { symbol: 'YES_sDAI', name: 'YES_sDAI', decimals: 18 },
    '0x2bca0042ca9a0432f1e1f1387d01494dcaba7ed4': { symbol: 'NO_sDAI', name: 'NO_sDAI', decimals: 18 },
    '0x37336fb39faf5968aac5949df96486bedba866fd': { symbol: 'NO_PNK', name: 'NO_PNK', decimals: 18 },
    '0xcf2d888847d6d0d00c65505aaa18c9b4c05bdbbc': { symbol: 'YES_PNK', name: 'YES_PNK', decimals: 18 },
    '0xffb6fb4f5719340a050024ceb973dc699e8aa968': { symbol: 'YES_sDAI', name: 'YES_sDAI', decimals: 18 }
};

// Create a mock fetcher for testing
class MockTradeHistoryFetcher {
    constructor() {
        this.name = 'MockTradeHistoryFetcher';
        this.supportedOperations = ['trades.history', 'trades.user'];
        this.operations = {
            'trades.history': this.getTradeHistory.bind(this),
            'trades.user': this.getTradeHistory.bind(this)
        };
    }

    async fetch(operation, args) {
        return this.getTradeHistory(args);
    }

    async getTradeHistory(args) {
        console.log(`📡 MockTradeHistoryFetcher handling trades request`);

        // Add token info to trades
        const tradesWithTokens = mockTrades.map(trade => ({
            ...trade,
            timestamp: trade.evt_block_time,
            token0: {
                address: trade.token0,
                ...mockTokenInfo[trade.token0]
            },
            token1: {
                address: trade.token1,
                ...mockTokenInfo[trade.token1]
            }
        }));

        return {
            trades: tradesWithTokens,
            status: 'success'
        };
    }
}

async function testTradeHistoryCartridge() {
    console.log('======================================');
    console.log('   TESTING TRADE HISTORY CARTRIDGE');
    console.log('        (With Mock Data)');
    console.log('======================================');
    console.log();

    // Initialize DataLayer
    const dataLayer = new DataLayer();
    console.log('🏗️  DataLayer initialized\n');

    // Register mock fetcher
    const mockFetcher = new MockTradeHistoryFetcher();
    dataLayer.registerFetcher(mockFetcher);
    console.log('✅ MockTradeHistoryFetcher registered\n');

    // Initialize and register the cartridge
    const tradeHistoryCartridge = new TradeHistoryCartridge(dataLayer);
    dataLayer.registerExecutor(tradeHistoryCartridge);
    console.log('✅ TradeHistoryCartridge registered\n');

    try {
        // Test formatted trades
        console.log('📊 Fetching formatted trades...\n');
        let result;
        for await (const step of dataLayer.execute('trades.formatted', {
            userAddress: '0xea820f6fea20a06af94b291c393c68956199cbe9',
            limit: 10
        })) {
            if (step.status === 'success') {
                result = step.data;
            } else if (step.status === 'error') {
                console.error('Error:', step.message);
                return;
            }
        }

        if (result && result.trades && result.trades.length > 0) {
            console.log(`✅ Found ${result.count} formatted trades\n`);

            // Display each formatted trade
            result.trades.forEach((trade, index) => {
                console.log(`Trade #${index + 1}:`);
                console.log('┌─ Outcome');
                console.log(`│  Event Side: ${trade.outcome.eventSide.toUpperCase()}`);
                console.log(`│  Operation: ${trade.outcome.operationSide.toUpperCase()}`);
                console.log('├─ Amount');
                console.log(`│  IN:  ${trade.amount.tokenIN.value} ${trade.amount.tokenIN.symbol}`);
                console.log(`│  OUT: ${trade.amount.tokenOUT.value} ${trade.amount.tokenOUT.symbol}`);
                console.log('├─ Details');
                console.log(`│  Price: ${trade.price}`);
                console.log(`│  Date: ${new Date(trade.date).toISOString()}`);
                console.log(`│  Tx: ${trade.transactionLink}`);
                console.log(`└─ Pool: ${trade.poolAddress}`);
                console.log();
            });

            // Display summary
            if (result.summary) {
                console.log('──────────────────────────────────────────────────');
                console.log('📈 Summary:');
                console.log(`  Total Trades: ${result.summary.totalTrades}`);
                console.log(`  Outcomes: YES(${result.summary.outcomes.yes}) NO(${result.summary.outcomes.no}) NEUTRAL(${result.summary.outcomes.neutral})`);
                console.log(`  Operations: BUY(${result.summary.operations.buy}) SELL(${result.summary.operations.sell})`);
                console.log(`  Unique Tokens: ${result.summary.uniqueTokens.join(', ')}`);
            }
        } else {
            console.log('No trades found');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    console.log('\n======================================');
    console.log('✨ Done');
}

// Run the test
testTradeHistoryCartridge().catch(console.error);