import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { DataLayer } from './DataLayer.js';
import { TradeHistoryFetcher } from './fetchers/TradeHistoryFetcher.js';
import { ERC20Fetcher } from './fetchers/ERC20Fetcher.js';
import TradeHistoryCartridge from './cartridges/TradeHistoryCartridge.js';

// Load environment variables
dotenv.config();

async function testSpecificQuery() {
    console.log('======================================');
    console.log('   TESTING SPECIFIC TRADE QUERY');
    console.log('======================================');
    console.log();

    const userAddress = '0xea820f6fea20a06af94b291c393c68956199cbe9';
    const proposalId = '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF';

    console.log('Query Parameters:');
    console.log('  User Address:', userAddress);
    console.log('  Proposal ID:', proposalId);
    console.log('──────────────────────────────────────────────────\n');

    // Get Supabase credentials
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase credentials in .env');
        console.error('   SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
        console.error('   SUPABASE_ANON_KEY:', supabaseKey ? '✓' : '✗');
        return;
    }

    // Create Supabase client
    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client initialized\n');

    try {
        // First, let's execute the raw query directly
        console.log('📊 Executing raw SQL query...\n');

        const { data: rawData, error: queryError } = await supabaseClient
            .from('trade_history')
            .select('*')
            .eq('user_address', userAddress.toLowerCase())
            .eq('proposal_id', proposalId); // Keep original case for proposal_id

        if (queryError) {
            console.error('❌ Query Error:', queryError.message);
            return;
        }

        console.log(`✅ Found ${rawData?.length || 0} trades from raw query\n`);

        if (!rawData || rawData.length === 0) {
            console.log('No trades found for this user/proposal combination');
            return;
        }

        // Now format using the TradeHistoryCartridge
        console.log('🎨 Formatting trades using TradeHistoryCartridge...\n');
        console.log('──────────────────────────────────────────────────\n');

        // Initialize DataLayer
        const dataLayer = new DataLayer();

        // Initialize ERC20Fetcher for token info
        const erc20Fetcher = new ERC20Fetcher({
            chainId: 100,  // Gnosis Chain
            rpcUrl: 'https://rpc.gnosischain.com'
        });

        // Create a custom TradeHistoryFetcher that uses our Supabase client
        const tradeHistoryFetcher = new TradeHistoryFetcher(supabaseClient, {
            erc20Fetcher: erc20Fetcher
        });

        dataLayer.registerFetcher(tradeHistoryFetcher);

        // Initialize and register the cartridge
        const tradeHistoryCartridge = new TradeHistoryCartridge(dataLayer);
        dataLayer.registerExecutor(tradeHistoryCartridge);

        // Instead of using the dataLayer fetch, let's directly format the raw data
        // First enrich with token info
        const formattedTrades = await tradeHistoryFetcher.formatTradeDataWithTokenInfo(rawData);

        // Now format using the cartridge
        const cartridgeFormattedTrades = [];
        for (const trade of formattedTrades) {
            const formatted = tradeHistoryCartridge.formatTrade(trade);
            cartridgeFormattedTrades.push(formatted);
        }

        const formattedResult = {
            trades: cartridgeFormattedTrades,
            summary: tradeHistoryCartridge.generateSummary(cartridgeFormattedTrades)
        };

        if (formattedResult && formattedResult.trades) {
            console.log(`📋 Formatted ${formattedResult.trades.length} trades\n`);

            // Display in the requested JSON format
            console.log('🔷 JSON FORMAT OUTPUT:');
            console.log('──────────────────────────────────────────────────\n');

            formattedResult.trades.forEach((trade, index) => {
                console.log(`Trade ${index + 1}:`);
                console.log(JSON.stringify({
                    outcome: trade.outcome,
                    amount: trade.amount,
                    price: trade.price,
                    date: trade.date,
                    transactionLink: trade.transactionLink
                }, null, 2));
                console.log();
            });

            console.log('──────────────────────────────────────────────────');
            console.log('🔷 VISUAL FORMAT OUTPUT:');
            console.log('──────────────────────────────────────────────────\n');

            // Display in visual format
            formattedResult.trades.forEach((trade, index) => {
                console.log(`Trade #${index + 1}:`);
                console.log('┌─ Outcome');
                console.log(`│  Event Side: ${trade.outcome.eventSide.toUpperCase()}`);
                console.log(`│  Operation: ${trade.outcome.operationSide.toUpperCase()}`);
                console.log('├─ Amount');
                console.log(`│  IN:  ${trade.amount.tokenIN.value} ${trade.amount.tokenIN.symbol}`);
                console.log(`│       Address: ${trade.amount.tokenIN.address}`);
                console.log(`│  OUT: ${trade.amount.tokenOUT.value} ${trade.amount.tokenOUT.symbol}`);
                console.log(`│       Address: ${trade.amount.tokenOUT.address}`);
                console.log('├─ Details');
                console.log(`│  Price: ${trade.price}`);
                console.log(`│  Date: ${new Date(trade.date).toISOString()}`);
                console.log(`│  Unix: ${trade.date}`);
                console.log(`│  Tx: ${trade.transactionLink}`);
                console.log(`└─ Pool: ${trade.poolAddress}`);
                console.log();
            });

            // Display summary
            if (formattedResult.summary) {
                console.log('──────────────────────────────────────────────────');
                console.log('📈 SUMMARY:');
                console.log('──────────────────────────────────────────────────\n');
                console.log(`Total Trades: ${formattedResult.summary.totalTrades}`);
                console.log(`Outcomes: YES(${formattedResult.summary.outcomes.yes}) NO(${formattedResult.summary.outcomes.no}) NEUTRAL(${formattedResult.summary.outcomes.neutral})`);
                console.log(`Operations: BUY(${formattedResult.summary.operations.buy}) SELL(${formattedResult.summary.operations.sell})`);

                if (formattedResult.summary.dateRange) {
                    const startDate = new Date(formattedResult.summary.dateRange.start);
                    const endDate = new Date(formattedResult.summary.dateRange.end);
                    console.log(`Date Range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
                }

                console.log(`Unique Tokens: ${formattedResult.summary.uniqueTokens.length}`);
                if (formattedResult.summary.uniqueTokens.length > 0) {
                    console.log(`  Tokens: ${formattedResult.summary.uniqueTokens.join(', ')}`);
                }

                console.log(`Unique Pools: ${formattedResult.summary.uniquePools.length}`);
                if (formattedResult.summary.uniquePools.length > 0) {
                    formattedResult.summary.uniquePools.forEach(pool => {
                        console.log(`  - ${pool}`);
                    });
                }
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }

    console.log('\n======================================');
    console.log('✨ Test Complete');
    console.log('======================================');
}

// Run the test
testSpecificQuery().catch(console.error);