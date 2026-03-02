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

async function queryEthereumWithMetadata() {
    console.log('======================================');
    console.log('   ETHEREUM MAINNET TRADES WITH METADATA');
    console.log('======================================');
    console.log();

    const userAddress = '0x645A3D9208523bbFEE980f7269ac72C61Dd3b552';
    const proposalId = '0x2A4b52B47625431Fdc6fE58CeD3086E76c1f6bbf'; // KEEP ORIGINAL CASE!

    // Ethereum mainnet RPC
    const ETHEREUM_RPC = 'https://eth-mainnet.g.alchemy.com/v2/demo'; // Public RPC endpoint
    console.log('🌐 Using Ethereum Mainnet RPC:', ETHEREUM_RPC);
    console.log();

    // Initialize Ethereum provider (ethers v5)
    const provider = new ethers.providers.JsonRpcProvider(ETHEREUM_RPC);

    // Get Supabase credentials
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    try {
        // Execute the query - DO NOT lowercase proposal_id!
        console.log('📊 Fetching trades from database...');
        const { data: rawData, error: queryError } = await supabaseClient
            .from('trade_history')
            .select('*')
            .eq('user_address', userAddress.toLowerCase())  // lowercase user address
            .eq('proposal_id', proposalId)  // KEEP ORIGINAL CASE for proposal
            .order('evt_block_time', { ascending: false })
            .limit(100);

        if (queryError) {
            console.error('❌ Query Error:', queryError.message);
            return;
        }

        console.log(`✅ Found ${rawData?.length || 0} trades\n`);

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

        // Get unique token addresses
        const uniqueTokens = new Set();
        rawData.forEach(trade => {
            uniqueTokens.add(trade.token0);
            uniqueTokens.add(trade.token1);
        });

        console.log('🔍 Fetching token metadata from Ethereum mainnet...');
        const tokenMetadata = {};

        // Fetch metadata for each token
        for (const tokenAddress of uniqueTokens) {
            try {
                console.log(`  Fetching metadata for ${tokenAddress}...`);
                const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

                // Fetch token info
                const [symbol, name, decimals] = await Promise.all([
                    contract.symbol().catch(() => 'UNKNOWN'),
                    contract.name().catch(() => 'Unknown Token'),
                    contract.decimals().catch(() => 18)
                ]);

                tokenMetadata[tokenAddress.toLowerCase()] = {
                    symbol: symbol,
                    name: name,
                    decimals: Number(decimals),
                    address: tokenAddress
                };

                console.log(`    ✅ ${symbol} (${name}) - ${decimals} decimals`);
            } catch (error) {
                console.log(`    ⚠️ Failed to fetch metadata: ${error.message}`);
                tokenMetadata[tokenAddress.toLowerCase()] = {
                    symbol: `TOKEN_${tokenAddress.slice(2, 8).toUpperCase()}`,
                    name: 'Unknown Token',
                    decimals: 18,
                    address: tokenAddress
                };
            }
        }

        console.log('\n📝 Formatting trades...\n');

        // Format each trade
        const formattedTrades = rawData.map((trade, index) => {
            // Get token info from fetched metadata
            const token0Info = tokenMetadata[trade.token0.toLowerCase()];
            const token1Info = tokenMetadata[trade.token1.toLowerCase()];

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

            console.log(`Trade ${index + 1}: ${tokenIn.symbol} → ${tokenOut.symbol} (${isBuy ? 'BUY' : 'SELL'})`);

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
        console.log('\n======================================');
        console.log('   JSON OUTPUT');
        console.log('======================================\n');
        console.log(JSON.stringify(response, null, 2));

    } catch (error) {
        console.error(JSON.stringify({
            error: error.message,
            stack: error.stack
        }, null, 2));
    }
}

// Run the query
queryEthereumWithMetadata().catch(error => {
    console.error(JSON.stringify({
        error: error.message
    }, null, 2));
});