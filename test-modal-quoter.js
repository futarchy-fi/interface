// Test script that mimics ConfirmSwapModal's exact QuoterV2 flow
// Run with: node test-modal-quoter.js

const { ethers } = require('ethers');

// Exact tokens from the modal (Buy action, YES outcome)
const YES_USDS = '0x87f94FaBA3e8FD5fbb9f49F7e9Ab24E8fC6E7B7E';    // tokenIn (currency YES)
const YES_TSLAON = '0x192e4580d85dc767F81F8AD02428F042E3c1074e'; // tokenOut (company YES)

// Uniswap V3 addresses
const QUOTER_V2_ADDRESS = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';
const FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984';

// RPC endpoints from ConfirmSwapModal (after fix)
const ETHEREUM_RPCS = [
    'https://ethereum-rpc.publicnode.com',
    'https://eth-mainnet.public.blastapi.io',
    'https://1rpc.io/eth'
];

// ABIs
const QUOTER_V2_ABI = [
    "function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)"
];

const FACTORY_ABI = [
    "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
];

const POOL_ABI = [
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
];

const ERC20_ABI = [
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

// Test configuration - exact same as modal
const TEST_AMOUNT = '0.0001'; // Small amount like in screenshot
const FEE_TIER = 500; // 0.05%

async function testModalFlow() {
    console.log(`\n${'█'.repeat(80)}`);
    console.log(`[MODAL TEST] Simulating ConfirmSwapModal QuoterV2 Flow`);
    console.log(`[MODAL TEST] Action: Buy | Outcome: Event Will Occur (YES)`);
    console.log(`[MODAL TEST] tokenIn (currency): ${YES_USDS}`);
    console.log(`[MODAL TEST] tokenOut (company): ${YES_TSLAON}`);
    console.log(`[MODAL TEST] Amount: ${TEST_AMOUNT}`);
    console.log(`${'█'.repeat(80)}\n`);

    let quoteResult = null;
    let lastError = null;

    console.log(`[QUOTER] Starting RPC fallback chain for chainId: 1`);

    // Try each RPC endpoint (exactly like modal)
    for (const rpcUrl of ETHEREUM_RPCS) {
        try {
            console.log(`[QUOTER] 🔄 Attempting RPC: ${rpcUrl}`);

            const ethereumProvider = new ethers.providers.JsonRpcProvider(rpcUrl);

            // Get token decimals
            const tokenInContract = new ethers.Contract(YES_USDS, ERC20_ABI, ethereumProvider);
            const tokenOutContract = new ethers.Contract(YES_TSLAON, ERC20_ABI, ethereumProvider);

            const [decimalsIn, decimalsOut, symbolIn, symbolOut] = await Promise.all([
                tokenInContract.decimals(),
                tokenOutContract.decimals(),
                tokenInContract.symbol(),
                tokenOutContract.symbol()
            ]);

            console.log(`[QUOTER] Token info:`, {
                tokenIn: `${symbolIn} (${decimalsIn} decimals)`,
                tokenOut: `${symbolOut} (${decimalsOut} decimals)`
            });

            // Parse amount
            const amountInWei = ethers.utils.parseUnits(TEST_AMOUNT, decimalsIn);
            console.log(`[QUOTER] Amount in wei: ${amountInWei.toString()}`);

            // Get QuoterV2 quote
            const quoterContract = new ethers.Contract(QUOTER_V2_ADDRESS, QUOTER_V2_ABI, ethereumProvider);

            const params = {
                tokenIn: YES_USDS,
                tokenOut: YES_TSLAON,
                amountIn: amountInWei,
                fee: FEE_TIER,
                sqrtPriceLimitX96: 0
            };

            console.log(`[QUOTER] Calling QuoterV2 contract at ${QUOTER_V2_ADDRESS}`);
            console.log(`[QUOTER] Params:`, {
                tokenIn: params.tokenIn,
                tokenOut: params.tokenOut,
                amountIn: params.amountIn.toString(),
                fee: params.fee
            });

            const result = await quoterContract.callStatic.quoteExactInputSingle(params);
            const [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] = result;

            const amountOutFormatted = ethers.utils.formatUnits(amountOut, decimalsOut);
            const effectivePrice = parseFloat(amountOutFormatted) / parseFloat(TEST_AMOUNT);

            console.log(`[QUOTER] ✅ SUCCESS with RPC: ${rpcUrl}`);
            console.log(`[QUOTER] Quote result:`, {
                amountIn: `${TEST_AMOUNT} ${symbolIn}`,
                amountOut: `${amountOutFormatted} ${symbolOut}`,
                effectivePrice: effectivePrice.toFixed(6),
                sqrtPriceX96After: sqrtPriceX96After.toString(),
                ticksCrossed: initializedTicksCrossed.toString(),
                gasEstimate: gasEstimate.toString()
            });

            quoteResult = {
                amountOut: amountOut.toString(),
                amountOutFormatted,
                sqrtPriceX96After: sqrtPriceX96After.toString(),
                initializedTicksCrossed: initializedTicksCrossed.toString(),
                gasEstimate: gasEstimate.toString(),
                effectivePrice,
                decimalsIn,
                decimalsOut,
                feeTier: FEE_TIER
            };

            break; // Success! Exit the loop

        } catch (error) {
            console.warn(`[QUOTER] ❌ FAILED with RPC ${rpcUrl}:`, error.message);
            console.warn(`[QUOTER] Error details:`, {
                code: error.code,
                reason: error.reason,
                message: error.message
            });
            lastError = error;
            // Continue to next RPC
        }
    }

    // If all RPCs failed, throw the last error
    if (!quoteResult) {
        console.error('[QUOTER] ❌ ALL RPCs FAILED');
        console.error('[QUOTER] Last error:', lastError);
        throw lastError || new Error('All RPC endpoints failed');
    }

    // Get current pool sqrt price (like modal does)
    console.log(`\n[QUOTER] Getting pool sqrt price for fee tier ${FEE_TIER}`);

    const workingRpc = ETHEREUM_RPCS[0]; // Use first RPC since it should work now
    const provider = new ethers.providers.JsonRpcProvider(workingRpc);
    const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);

    const poolAddress = await factory.getPool(YES_USDS, YES_TSLAON, FEE_TIER);
    console.log(`[QUOTER] Pool address: ${poolAddress}`);

    const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
    const slot0 = await pool.slot0();

    console.log(`[QUOTER] ✅ Got pool sqrt price: ${slot0.sqrtPriceX96.toString()}`);

    // Calculate prices
    const Q96 = ethers.BigNumber.from(2).pow(96);
    const sqrtPrice = ethers.BigNumber.from(slot0.sqrtPriceX96);
    const sqrtPriceSquared = sqrtPrice.mul(sqrtPrice);
    const Q192 = Q96.mul(Q96);
    const currentPrice = parseFloat(sqrtPriceSquared.toString()) / parseFloat(Q192.toString());

    const sqrtPriceAfter = ethers.BigNumber.from(quoteResult.sqrtPriceX96After);
    const sqrtPriceAfterSquared = sqrtPriceAfter.mul(sqrtPriceAfter);
    const executionPrice = parseFloat(sqrtPriceAfterSquared.toString()) / parseFloat(Q192.toString());

    console.log(`\n[QUOTER] Price Analysis:`, {
        currentPrice: currentPrice.toFixed(6),
        executionPrice: executionPrice.toFixed(6),
        priceImpact: ((executionPrice - currentPrice) / currentPrice * 100).toFixed(4) + '%'
    });

    console.log(`\n${'█'.repeat(80)}`);
    console.log(`[MODAL TEST] ✅ TEST PASSED - QuoterV2 works exactly like in modal`);
    console.log(`${'█'.repeat(80)}\n`);

    return quoteResult;
}

// Run the test
testModalFlow()
    .then(() => {
        console.log('✅ All tests passed!');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
