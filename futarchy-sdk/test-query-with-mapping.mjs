import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import TradeHistoryCartridge from './cartridges/TradeHistoryCartridge.js';
import { DataLayer } from './DataLayer.js';

// Load environment variables
dotenv.config();

// Token mapping for this specific proposal
// These are the actual tokens used in the futarchy market for proposal 0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF
const TOKEN_MAPPING = {
    '0x718be32688b615c2eb24560371ef332b892f69d8': { symbol: 'YES_sDAI', name: 'YES sDAI', decimals: 18 },
    '0x78d2c7da671fd4275836932a3b213b01177c6628': { symbol: 'YES_GNO', name: 'YES GNO', decimals: 18 },
    '0x4d67f9302cde3c4640a99f0908fdf6f32d3ddfb6': { symbol: 'NO_sDAI', name: 'NO sDAI', decimals: 18 },
    '0x72c185710775f307c9da20424910a1d3d27b8be0': { symbol: 'NO_GNO', name: 'NO GNO', decimals: 18 },
};

async function testWithMapping() {
    console.log('======================================');
    console.log('   TRADE HISTORY WITH TOKEN MAPPING');
    console.log('======================================');
    console.log();

    const userAddress = '0xea820f6fea20a06af94b291c393c68956199cbe9';
    const proposalId = '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF';

    console.log('Query Parameters:');
    console.log('  User Address:', userAddress);
    console.log('  Proposal ID:', proposalId);
    console.log();

    console.log('Token Mapping for this Proposal:');
    Object.entries(TOKEN_MAPPING).forEach(([addr, info]) => {
        console.log(`  ${info.symbol}: ${addr.slice(0, 10)}...`);
    });
    console.log('──────────────────────────────────────────────────\n');

    // Get Supabase credentials
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase credentials');
        return;
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    try {
        // Execute the query
        const { data: rawData, error: queryError } = await supabaseClient
            .from('trade_history')
            .select('*')
            .eq('user_address', userAddress.toLowerCase())
            .eq('proposal_id', proposalId)
            .order('evt_block_time', { ascending: false })
            .limit(10); // Get last 10 trades for demo

        if (queryError) {
            console.error('❌ Query Error:', queryError.message);
            return;
        }

        console.log(`✅ Found ${rawData?.length || 0} trades\n`);

        if (!rawData || rawData.length === 0) {
            console.log('No trades found');
            return;
        }

        // Initialize DataLayer and Cartridge
        const dataLayer = new DataLayer();
        const tradeHistoryCartridge = new TradeHistoryCartridge(dataLayer);

        // Format each trade with proper token mapping
        const formattedTrades = [];

        for (const trade of rawData) {
            // Add token info to the trade
            const enrichedTrade = {
                ...trade,
                token0Symbol: TOKEN_MAPPING[trade.token0.toLowerCase()]?.symbol || 'UNKNOWN',
                token0Name: TOKEN_MAPPING[trade.token0.toLowerCase()]?.name || 'Unknown',
                token0Decimals: TOKEN_MAPPING[trade.token0.toLowerCase()]?.decimals || 18,
                token1Symbol: TOKEN_MAPPING[trade.token1.toLowerCase()]?.symbol || 'UNKNOWN',
                token1Name: TOKEN_MAPPING[trade.token1.toLowerCase()]?.name || 'Unknown',
                token1Decimals: TOKEN_MAPPING[trade.token1.toLowerCase()]?.decimals || 18,

                // Parse amounts as BigInt for accurate conversion
                amount0Formatted: formatAmount(trade.amount0, 18),
                amount1Formatted: formatAmount(trade.amount1, 18),

                // Determine trade type
                tradeType: parseFloat(trade.amount0) > 0 ? 'buy' : 'sell',
                side: parseFloat(trade.amount0) > 0 ? 'buy' : 'sell',

                // Transaction info
                transactionHash: trade.evt_tx_hash,
                blockNumber: trade.evt_block_number,
                blockTime: trade.evt_block_time,
                timestampFormatted: trade.evt_block_time ? new Date(trade.evt_block_time).toISOString() : null,

                // Calculate price
                price: Math.abs(parseFloat(trade.amount1) / parseFloat(trade.amount0)),

                // Pool info
                poolId: trade.pool_id
            };

            // Format using cartridge
            const formatted = tradeHistoryCartridge.formatTrade(enrichedTrade);
            formattedTrades.push(formatted);
        }

        // Display formatted trades
        console.log('🔷 FORMATTED TRADES (Your Requested Format):');
        console.log('──────────────────────────────────────────────────\n');

        formattedTrades.forEach((trade, index) => {
            console.log(`Trade ${index + 1}:`);
            console.log(JSON.stringify({
                outcome: trade.outcome,
                amount: trade.amount,
                price: typeof trade.price === 'number' ? trade.price.toFixed(6) : trade.price,
                date: trade.date,
                transactionLink: trade.transactionLink
            }, null, 2));
            console.log();
        });

        // Display visual format
        console.log('──────────────────────────────────────────────────');
        console.log('🔷 VISUAL FORMAT:');
        console.log('──────────────────────────────────────────────────\n');

        formattedTrades.forEach((trade, index) => {
            const dateStr = trade.date ? new Date(trade.date).toLocaleString() : 'N/A';

            console.log(`Trade #${index + 1}:`);
            console.log('┌─ Outcome');
            console.log(`│  Event Side: ${trade.outcome.eventSide.toUpperCase()}`);
            console.log(`│  Operation: ${trade.outcome.operationSide.toUpperCase()}`);
            console.log('├─ Amount');
            console.log(`│  IN:  ${trade.amount.tokenIN.value} ${trade.amount.tokenIN.symbol}`);
            if (trade.amount.tokenIN.address) {
                console.log(`│       ${trade.amount.tokenIN.address}`);
            }
            console.log(`│  OUT: ${trade.amount.tokenOUT.value} ${trade.amount.tokenOUT.symbol}`);
            if (trade.amount.tokenOUT.address) {
                console.log(`│       ${trade.amount.tokenOUT.address}`);
            }
            console.log('├─ Details');
            console.log(`│  Price: ${typeof trade.price === 'number' ? trade.price.toFixed(6) : trade.price}`);
            console.log(`│  Date: ${dateStr}`);
            console.log(`│  Block: ${trade.blockNumber || 'N/A'}`);
            console.log(`└─ Tx: ${trade.transactionLink}`);
            console.log();
        });

        // Generate summary
        const summary = tradeHistoryCartridge.generateSummary(formattedTrades);
        console.log('──────────────────────────────────────────────────');
        console.log('📈 SUMMARY:');
        console.log('──────────────────────────────────────────────────\n');
        console.log(`Total Trades: ${summary.totalTrades}`);
        console.log(`Outcomes: YES(${summary.outcomes.yes}) NO(${summary.outcomes.no})`);
        console.log(`Operations: BUY(${summary.operations.buy}) SELL(${summary.operations.sell})`);

        if (summary.dateRange) {
            const startDate = new Date(summary.dateRange.start).toLocaleDateString();
            const endDate = new Date(summary.dateRange.end).toLocaleDateString();
            console.log(`Date Range: ${startDate} to ${endDate}`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }

    console.log('\n======================================');
    console.log('✨ Test Complete');
    console.log('======================================');
}

// Helper function to format amounts from raw (18 decimals) to human-readable
function formatAmount(amount, decimals = 18) {
    if (!amount) return '0';

    const isNegative = amount.toString().startsWith('-');
    const absAmount = amount.toString().replace('-', '');

    try {
        // Handle very small numbers in scientific notation
        if (absAmount.includes('e')) {
            return parseFloat(amount).toFixed(6);
        }

        // Convert from raw amount to decimal
        const divisor = Math.pow(10, decimals);
        const value = parseFloat(absAmount) / divisor;

        // Format based on magnitude
        let formatted;
        if (value < 0.000001) {
            formatted = value.toExponential(2);
        } else if (value < 0.01) {
            formatted = value.toFixed(6);
        } else if (value < 1) {
            formatted = value.toFixed(4);
        } else if (value < 1000) {
            formatted = value.toFixed(2);
        } else if (value < 1000000) {
            formatted = (value / 1000).toFixed(2) + 'K';
        } else {
            formatted = (value / 1000000).toFixed(2) + 'M';
        }

        return isNegative ? '-' + formatted : formatted;
    } catch (e) {
        console.error('Error formatting amount:', amount, e);
        return '0';
    }
}

// Run the test
testWithMapping().catch(console.error);