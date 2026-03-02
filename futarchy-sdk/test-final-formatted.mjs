import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

// Token mapping for this specific proposal
const TOKEN_MAPPING = {
    '0x718be32688b615c2eb24560371ef332b892f69d8': { symbol: 'YES_sDAI', name: 'YES sDAI', decimals: 18 },
    '0x78d2c7da671fd4275836932a3b213b01177c6628': { symbol: 'YES_GNO', name: 'YES GNO', decimals: 18 },
    '0x4d67f9302cde3c4640a99f0908fdf6f32d3ddfb6': { symbol: 'NO_sDAI', name: 'NO sDAI', decimals: 18 },
    '0x72c185710775f307c9da20424910a1d3d27b8be0': { symbol: 'NO_GNO', name: 'NO GNO', decimals: 18 },
};

async function testFinalFormatted() {
    console.log('======================================');
    console.log('   FORMATTED TRADE HISTORY');
    console.log('======================================');
    console.log();

    const userAddress = '0xea820f6fea20a06af94b291c393c68956199cbe9';
    const proposalId = '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF';

    console.log('Query: select * from trade_history');
    console.log(`       where user_address = '${userAddress}'`);
    console.log(`       and proposal_id = '${proposalId}'`);
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
            .limit(5); // Get last 5 trades for demo

        if (queryError) {
            console.error('❌ Query Error:', queryError.message);
            return;
        }

        console.log(`✅ Found ${rawData?.length || 0} trades\n`);

        if (!rawData || rawData.length === 0) {
            console.log('No trades found');
            return;
        }

        // Format each trade according to the specified structure
        const formattedTrades = rawData.map((trade, index) => {
            // Get token info
            const token0Info = TOKEN_MAPPING[trade.token0.toLowerCase()] || { symbol: 'UNKNOWN', decimals: 18 };
            const token1Info = TOKEN_MAPPING[trade.token1.toLowerCase()] || { symbol: 'UNKNOWN', decimals: 18 };

            // Parse amounts
            const amount0 = parseFloat(trade.amount0);
            const amount1 = parseFloat(trade.amount1);

            // Determine if it's a buy or sell (based on token0)
            const isBuy = amount0 > 0;

            // Determine tokens and amounts
            let tokenIn, tokenOut, amountIn, amountOut;
            if (isBuy) {
                // Buying token0 with token1
                tokenIn = { ...token1Info, address: trade.token1 };
                tokenOut = { ...token0Info, address: trade.token0 };
                amountIn = Math.abs(amount1);
                amountOut = Math.abs(amount0);
            } else {
                // Selling token0 for token1
                tokenIn = { ...token0Info, address: trade.token0 };
                tokenOut = { ...token1Info, address: trade.token1 };
                amountIn = Math.abs(amount0);
                amountOut = Math.abs(amount1);
            }

            // Format amounts from raw (18 decimals)
            const formatAmount = (amt) => {
                const value = amt / Math.pow(10, 18);
                if (value < 0.000001) return value.toExponential(2);
                if (value < 0.01) return value.toFixed(6);
                if (value < 1) return value.toFixed(4);
                if (value < 1000) return value.toFixed(2);
                return value.toFixed(0);
            };

            const formattedAmountIn = formatAmount(amountIn);
            const formattedAmountOut = formatAmount(amountOut);

            // Calculate price
            const price = parseFloat(formattedAmountOut) / parseFloat(formattedAmountIn);

            // Determine outcome (YES/NO) from token symbols
            const determineOutcome = () => {
                const inSymbol = tokenIn.symbol.toUpperCase();
                const outSymbol = tokenOut.symbol.toUpperCase();

                // Check what's being bought/sold
                if (isBuy) {
                    // Buying tokenOut
                    if (outSymbol.includes('YES')) return 'yes';
                    if (outSymbol.includes('NO')) return 'no';
                } else {
                    // Selling tokenIn
                    if (inSymbol.includes('YES')) return 'yes';
                    if (inSymbol.includes('NO')) return 'no';
                }

                return 'neutral';
            };

            // Get timestamp
            const timestamp = trade.evt_block_time ? new Date(trade.evt_block_time).getTime() : Date.now();

            return {
                outcome: {
                    eventSide: determineOutcome(),
                    operationSide: isBuy ? 'buy' : 'sell'
                },
                amount: {
                    tokenIN: {
                        symbol: tokenIn.symbol,
                        value: formattedAmountIn,
                        address: tokenIn.address
                    },
                    tokenOUT: {
                        symbol: tokenOut.symbol,
                        value: formattedAmountOut,
                        address: tokenOut.address
                    }
                },
                price: price,
                date: timestamp,
                transactionLink: `https://gnosisscan.io/tx/${trade.evt_tx_hash}`
            };
        });

        // Display formatted trades in JSON format as requested
        console.log('🔷 JSON FORMAT (As Requested):');
        console.log('──────────────────────────────────────────────────\n');

        formattedTrades.forEach((trade, index) => {
            console.log(`Trade ${index + 1}:`);
            console.log(JSON.stringify(trade, null, 2));
            console.log();
        });

        // Display in visual format
        console.log('──────────────────────────────────────────────────');
        console.log('🔷 VISUAL FORMAT:');
        console.log('──────────────────────────────────────────────────\n');

        formattedTrades.forEach((trade, index) => {
            const dateStr = new Date(trade.date).toLocaleString();

            console.log(`Trade #${index + 1}:`);
            console.log('┌─ Outcome');
            console.log(`│  Event Side: ${trade.outcome.eventSide.toUpperCase()}`);
            console.log(`│  Operation: ${trade.outcome.operationSide.toUpperCase()}`);
            console.log('├─ Amount');
            console.log(`│  IN:  ${trade.amount.tokenIN.value} ${trade.amount.tokenIN.symbol}`);
            console.log(`│  OUT: ${trade.amount.tokenOUT.value} ${trade.amount.tokenOUT.symbol}`);
            console.log('├─ Details');
            console.log(`│  Price: ${trade.price.toFixed(4)}`);
            console.log(`│  Date: ${dateStr}`);
            console.log(`│  Unix: ${trade.date}`);
            console.log(`└─ Tx: ${trade.transactionLink}`);
            console.log();
        });

        // Generate summary
        const summary = {
            totalTrades: formattedTrades.length,
            outcomes: {
                yes: formattedTrades.filter(t => t.outcome.eventSide === 'yes').length,
                no: formattedTrades.filter(t => t.outcome.eventSide === 'no').length,
                neutral: formattedTrades.filter(t => t.outcome.eventSide === 'neutral').length
            },
            operations: {
                buy: formattedTrades.filter(t => t.outcome.operationSide === 'buy').length,
                sell: formattedTrades.filter(t => t.outcome.operationSide === 'sell').length
            }
        };

        console.log('──────────────────────────────────────────────────');
        console.log('📈 SUMMARY:');
        console.log('──────────────────────────────────────────────────\n');
        console.log(`Total Trades: ${summary.totalTrades}`);
        console.log(`Outcomes: YES(${summary.outcomes.yes}) NO(${summary.outcomes.no}) NEUTRAL(${summary.outcomes.neutral})`);
        console.log(`Operations: BUY(${summary.operations.buy}) SELL(${summary.operations.sell})`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }

    console.log('\n======================================');
    console.log('✨ Test Complete');
    console.log('======================================');
}

// Run the test
testFinalFormatted().catch(console.error);