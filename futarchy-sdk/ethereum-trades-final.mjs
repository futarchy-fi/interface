import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import ethers from 'ethers';

// Load environment variables
dotenv.config();

// ERC20 ABI for token metadata
const ERC20_ABI = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)'
];

async function queryEthereumTrades() {
    const userAddress = '0x645A3D9208523bbFEE980f7269ac72C61Dd3b552';
    const proposalId = '0x2A4b52B47625431Fdc6fE58CeD3086E76c1f6bbf'; // KEEP ORIGINAL CASE!

    // Ethereum mainnet RPC
    const ETHEREUM_RPC = 'https://eth-mainnet.g.alchemy.com/v2/demo';

    // Initialize Ethereum provider (ethers v5)
    const provider = new ethers.providers.JsonRpcProvider(ETHEREUM_RPC);

    // Get Supabase credentials
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    try {
        // Execute the query - DO NOT lowercase proposal_id!
        const { data: rawData, error: queryError } = await supabaseClient
            .from('trade_history')
            .select('*')
            .eq('user_address', userAddress.toLowerCase())  // lowercase user address
            .eq('proposal_id', proposalId)  // KEEP ORIGINAL CASE for proposal
            .order('evt_block_time', { ascending: false })
            .limit(10);

        if (queryError) {
            console.error('❌ Query Error:', queryError.message);
            return;
        }

        if (!rawData || rawData.length === 0) {
            console.log(JSON.stringify({
                query: {
                    chain: 'ethereum',
                    chain_id: 1,
                    user_address: userAddress,
                    proposal_id: proposalId
                },
                total_trades: 0,
                trades: [],
                message: "No trades found"
            }, null, 2));
            return;
        }

        // Based on the successful fetch we saw, here are the actual token mappings
        // Token 0x03cbdbecda0c93ee324f4900d1514bc2672fc51a = NO_USDS (18 decimals)
        // We'll hardcode these to avoid timeout issues with RPC calls
        const tokenMetadata = {
            '0x03cbdbecda0c93ee324f4900d1514bc2672fc51a': {
                symbol: 'NO_USDS',
                name: 'NO_USDS',
                decimals: 18,
                address: '0x03cbdbecda0c93ee324f4900d1514bc2672fc51a'
            },
            '0x5e31218dc0696de0f2432bd0021768e7acc13bf7': {
                symbol: 'YES_USDS',
                name: 'YES_USDS',
                decimals: 18,
                address: '0x5e31218dc0696de0f2432bd0021768e7acc13bf7'
            },
            '0x192e4580d85dc767f81f8ad02428f042e3c1074e': {
                symbol: 'NO_SKY',
                name: 'NO_SKY',
                decimals: 18,
                address: '0x192e4580d85dc767F81F8AD02428F042E3c1074e'
            },
            '0x87f94faba3e8fd5fbb9f49f7e9ab24e8fc6e7b7e': {
                symbol: 'YES_SKY',
                name: 'YES_SKY',
                decimals: 18,
                address: '0x87f94FaBA3e8FD5fbb9f49F7e9Ab24E8fC6E7B7E'
            }
        };

        // Format each trade
        const formattedTrades = rawData.map((trade) => {
            // Get token info from our mapping
            const token0Info = tokenMetadata[trade.token0.toLowerCase()] || {
                symbol: `TOKEN_${trade.token0.slice(2, 8).toUpperCase()}`,
                name: 'Unknown Token',
                decimals: 18,
                address: trade.token0
            };
            const token1Info = tokenMetadata[trade.token1.toLowerCase()] || {
                symbol: `TOKEN_${trade.token1.slice(2, 8).toUpperCase()}`,
                name: 'Unknown Token',
                decimals: 18,
                address: trade.token1
            };

            // Parse amounts
            const amount0 = parseFloat(trade.amount0);
            const amount1 = parseFloat(trade.amount1);

            // Determine if it's a buy or sell (based on token0)
            const isBuy = amount0 > 0;

            // Determine tokens and amounts
            let tokenIn, tokenOut, amountIn, amountOut;
            if (isBuy) {
                // Buying token0 with token1
                tokenIn = token1Info;
                tokenOut = token0Info;
                amountIn = Math.abs(amount1);
                amountOut = Math.abs(amount0);
            } else {
                // Selling token0 for token1
                tokenIn = token0Info;
                tokenOut = token1Info;
                amountIn = Math.abs(amount0);
                amountOut = Math.abs(amount1);
            }

            // Format amounts based on actual decimals
            const formatAmount = (amt, decimals) => {
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

            // Determine outcome based on token symbols
            const determineOutcome = () => {
                const inSymbol = tokenIn.symbol.toUpperCase();
                const outSymbol = tokenOut.symbol.toUpperCase();

                // Check for YES/NO patterns in token symbols
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
                blockNumber: trade.evt_block_number,
                poolAddress: trade.pool_id
            };
        });

        // Create the full response object
        const response = {
            query: {
                chain: 'ethereum',
                chain_id: 1,
                rpc_endpoint: ETHEREUM_RPC,
                user_address: userAddress,
                proposal_id: proposalId
            },
            total_trades: formattedTrades.length,
            trades: formattedTrades
        };

        // Output as JSON
        console.log(JSON.stringify(response, null, 2));

    } catch (error) {
        console.error(JSON.stringify({
            error: error.message,
            stack: error.stack
        }, null, 2));
    }
}

// Run the query
queryEthereumTrades().catch(error => {
    console.error(JSON.stringify({
        error: error.message
    }, null, 2));
});