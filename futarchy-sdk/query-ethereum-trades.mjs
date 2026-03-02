import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

async function queryEthereumTrades() {
    console.log('======================================');
    console.log('   ETHEREUM MAINNET TRADE QUERY');
    console.log('======================================');
    console.log();

    const userAddress = '0x645A3D9208523bbFEE980f7269ac72C61Dd3b552';
    const proposalId = '0x2A4b52B47625431Fdc6fE58CeD3086E76c1f6bbf';

    console.log('Query Parameters:');
    console.log('  Chain: Ethereum Mainnet (1)');
    console.log('  User Address:', userAddress);
    console.log('  Proposal ID:', proposalId);
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
        // First, let's check if there's any data for this proposal
        console.log('🔍 Checking for trades...\n');

        // Execute the query
        const { data: rawData, error: queryError } = await supabaseClient
            .from('trade_history')
            .select('*')
            .eq('user_address', userAddress.toLowerCase())
            .eq('proposal_id', proposalId.toLowerCase())
            .order('evt_block_time', { ascending: false })
            .limit(100); // Get up to 100 trades

        if (queryError) {
            console.error('❌ Query Error:', queryError.message);
            return;
        }

        console.log(`✅ Found ${rawData?.length || 0} trades\n`);

        if (!rawData || rawData.length === 0) {
            console.log('No trades found for this user/proposal combination on Ethereum mainnet');

            // Let's check if there are ANY trades for this proposal
            const { data: proposalCheck, error: checkError } = await supabaseClient
                .from('trade_history')
                .select('user_address')
                .eq('proposal_id', proposalId.toLowerCase())
                .limit(5);

            if (!checkError && proposalCheck && proposalCheck.length > 0) {
                console.log(`\nℹ️  This proposal has trades from other users:`);
                const uniqueUsers = [...new Set(proposalCheck.map(t => t.user_address))];
                uniqueUsers.forEach(addr => console.log(`  - ${addr}`));
            } else {
                console.log('\nℹ️  No trades found for this proposal from any user');
            }

            // Output empty JSON response
            const emptyResponse = {
                query: {
                    chain: 'ethereum',
                    user_address: userAddress,
                    proposal_id: proposalId
                },
                total_trades: 0,
                trades: [],
                message: "No trades found for this user/proposal combination"
            };

            console.log('\nJSON Output:');
            console.log('──────────────────────────────────────────────────');
            console.log(JSON.stringify(emptyResponse, null, 2));
            return;
        }

        // Analyze the tokens to determine their types
        console.log('📊 Analyzing tokens from trades...\n');

        // Get unique tokens from the trades
        const uniqueTokens = new Set();
        rawData.forEach(trade => {
            uniqueTokens.add(trade.token0);
            uniqueTokens.add(trade.token1);
        });

        console.log(`Found ${uniqueTokens.size} unique tokens:`);
        Array.from(uniqueTokens).forEach(token => {
            console.log(`  - ${token}`);
        });

        // For Ethereum mainnet, we'll need to determine the token mapping
        // This would typically come from token metadata, but for now we'll use placeholders
        const TOKEN_MAPPING = {};
        Array.from(uniqueTokens).forEach(token => {
            // This is a placeholder - in production, you'd fetch actual token metadata
            TOKEN_MAPPING[token.toLowerCase()] = {
                symbol: `TOKEN_${token.slice(2, 6).toUpperCase()}`,
                name: `Unknown Token`,
                decimals: 18
            };
        });

        console.log('\n⚠️  Note: Token symbols are placeholders. Implement ERC20 metadata fetching for accurate symbols.\n');

        // Format each trade
        const formattedTrades = rawData.map((trade) => {
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

            // Format amounts from raw (assuming 18 decimals)
            const formatAmount = (amt, decimals = 18) => {
                const value = amt / Math.pow(10, decimals);
                if (value < 0.000001) return value.toExponential(2);
                if (value < 0.01) return value.toFixed(6);
                if (value < 1) return value.toFixed(4);
                if (value < 1000) return value.toFixed(2);
                return value.toFixed(0);
            };

            const formattedAmountIn = formatAmount(amountIn, tokenIn.decimals);
            const formattedAmountOut = formatAmount(amountOut, tokenOut.decimals);

            // Calculate price
            const price = parseFloat(formattedAmountOut) / parseFloat(formattedAmountIn);

            // Determine outcome - for Ethereum mainnet, need actual token metadata
            const determineOutcome = () => {
                const inSymbol = tokenIn.symbol.toUpperCase();
                const outSymbol = tokenOut.symbol.toUpperCase();

                // Check for YES/NO patterns in token symbols
                if (isBuy) {
                    if (outSymbol.includes('YES')) return 'yes';
                    if (outSymbol.includes('NO')) return 'no';
                } else {
                    if (inSymbol.includes('YES')) return 'yes';
                    if (inSymbol.includes('NO')) return 'no';
                }

                return 'neutral';
            };

            // Get timestamp
            const timestamp = trade.evt_block_time ? new Date(trade.evt_block_time).getTime() : null;

            // Fix transaction link - use Etherscan for Ethereum mainnet
            const actualTxHash = trade.evt_tx_hash.split('_')[0];
            const transactionLink = `https://etherscan.io/tx/${actualTxHash}`;

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
                price: parseFloat(price.toFixed(6)),
                date: timestamp,
                transactionLink: transactionLink,
                blockNumber: trade.evt_block_number
            };
        });

        // Create the full response object
        const response = {
            query: {
                chain: 'ethereum',
                user_address: userAddress,
                proposal_id: proposalId
            },
            total_trades: formattedTrades.length,
            trades: formattedTrades
        };

        // Output as JSON
        console.log('JSON Output:');
        console.log('──────────────────────────────────────────────────');
        console.log(JSON.stringify(response, null, 2));

        // Also show a summary
        console.log('\n──────────────────────────────────────────────────');
        console.log('📈 SUMMARY:');
        console.log('──────────────────────────────────────────────────');
        console.log(`Total Trades: ${formattedTrades.length}`);

        const buyCount = formattedTrades.filter(t => t.outcome.operationSide === 'buy').length;
        const sellCount = formattedTrades.filter(t => t.outcome.operationSide === 'sell').length;
        console.log(`Operations: BUY(${buyCount}) SELL(${sellCount})`);

        if (formattedTrades.length > 0) {
            const firstTrade = formattedTrades[formattedTrades.length - 1];
            const lastTrade = formattedTrades[0];

            if (firstTrade.date && lastTrade.date) {
                console.log(`Date Range: ${new Date(firstTrade.date).toLocaleDateString()} to ${new Date(lastTrade.date).toLocaleDateString()}`);
            }
        }

    } catch (error) {
        console.error(JSON.stringify({
            error: error.message,
            stack: error.stack
        }, null, 2));
    }

    console.log('\n======================================');
    console.log('✨ Query Complete');
    console.log('======================================');
}

// Run the query
queryEthereumTrades().catch(error => {
    console.error(JSON.stringify({
        error: error.message
    }, null, 2));
});