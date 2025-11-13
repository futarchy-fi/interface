import dotenv from 'dotenv';
import { DataLayer } from './DataLayer.js';
import { TradeHistoryFetcher } from './fetchers/TradeHistoryFetcher.js';
import { ERC20Fetcher } from './fetchers/ERC20Fetcher.js';
import { default as TradeHistoryCartridge } from './cartridges/TradeHistoryCartridge.js';

// Load environment variables
dotenv.config();

async function testTradeHistoryCartridge() {
    console.log('======================================');
    console.log('   TESTING TRADE HISTORY CARTRIDGE');
    console.log('======================================');
    console.log();

    const userAddress = '0xea820f6fea20a06af94b291c393c68956199cbe9';
    const proposalId = '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF';

    console.log('User Address:', userAddress);
    console.log('Proposal ID:', proposalId);
    console.log('──────────────────────────────────────────────────\n');

    // Initialize DataLayer
    const dataLayer = new DataLayer();
    console.log('🏗️  DataLayer initialized\n');

    // Initialize and register fetchers
    const erc20Fetcher = new ERC20Fetcher({
        chainId: 100,  // Gnosis Chain
        rpcUrl: 'https://rpc.gnosischain.com'
    });

    const tradeHistoryFetcher = new TradeHistoryFetcher({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_KEY,
        erc20Fetcher: erc20Fetcher  // Pass the ERC20 fetcher for token info
    });

    dataLayer.registerFetcher(tradeHistoryFetcher);
    console.log('✅ TradeHistoryFetcher registered\n');

    // Initialize and register the cartridge as an executor
    const tradeHistoryCartridge = new TradeHistoryCartridge(dataLayer);
    dataLayer.registerExecutor(tradeHistoryCartridge);
    console.log('✅ TradeHistoryCartridge registered\n');

    try {
        // Test 1: Fetch formatted trades
        console.log('📊 Test 1: Fetching formatted trades (last 10)...\n');
        let result;
        for await (const step of dataLayer.execute('trades.formatted', {
            userAddress: userAddress,
            limit: 10
        })) {
            if (step.status === 'success') {
                result = step.data;
            } else if (step.status === 'error') {
                console.error('Error:', step.message);
                return;
            }
        }

        if (result.trades && result.trades.length > 0) {
            console.log(`✅ Found ${result.count} trades\n`);

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
                console.log(`  Date Range: ${new Date(result.summary.dateRange.start).toLocaleDateString()} to ${new Date(result.summary.dateRange.end).toLocaleDateString()}`);
                console.log(`  Unique Tokens: ${result.summary.uniqueTokens.length}`);
                console.log(`  Unique Pools: ${result.summary.uniquePools.length}`);
            }
        } else {
            console.log('No trades found for this user');
        }

        console.log('\n──────────────────────────────────────────────────');

        // Test 2: Get just the summary
        console.log('\n📊 Test 2: Fetching trade summary (last 50 trades)...\n');
        let summary;
        for await (const step of dataLayer.execute('trades.summary', {
            userAddress: userAddress,
            limit: 50
        })) {
            if (step.status === 'success') {
                summary = step.data;
            } else if (step.status === 'error') {
                console.error('Error:', step.message);
                return;
            }
        }

        if (summary) {
            console.log('Trade Summary (Last 50):');
            console.log(JSON.stringify(summary, null, 2));
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }

    console.log('\n======================================');
    console.log('✨ Done');
}

// Run the test
testTradeHistoryCartridge().catch(console.error);