// Test script to verify Uniswap V3 QuoterV2 calls for TSLA market tokens
// Run with: node test-quoter.js

const { ethers } = require('ethers');

// Token addresses from the TSLA market metadata
const YES_TSLAON = '0x192e4580d85dc767F81F8AD02428F042E3c1074e'; // Company YES token
const YES_USDS = '0x87f94FaBA3e8FD5fbb9f49F7e9Ab24E8fC6E7B7E';   // Currency YES token
const NO_TSLAON = '0x5e31218dC0696DE0F2432BD0021768e7acC13bF7';  // Company NO token
const NO_USDS = '0x03cBdbECDA0c93eE324F4900D1514bC2672fC51a';    // Currency NO token

// Uniswap V3 addresses on Ethereum mainnet
const QUOTER_V2_ADDRESS = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';
const FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984';

// RPC endpoints to test
const RPC_ENDPOINTS = [
    'https://cloudflare-eth.com',
    'https://ethereum-rpc.publicnode.com',
    'https://rpc.ankr.com/eth',
    'https://eth-mainnet.public.blastapi.io'
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
    "function symbol() view returns (string)",
    "function name() view returns (string)"
];

// Test configuration
const TEST_AMOUNT = '1.0'; // 1 token
const FEE_TIERS = [500, 3000, 10000]; // 0.05%, 0.3%, 1%

async function testRpcEndpoint(rpcUrl) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[QUOTER TEST] Testing RPC: ${rpcUrl}`);
    console.log(`${'='.repeat(80)}`);

    try {
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

        // Test basic connectivity
        console.log(`[QUOTER TEST] 🔄 Testing basic connectivity...`);
        const blockNumber = await provider.getBlockNumber();
        console.log(`[QUOTER TEST] ✅ Connected! Current block: ${blockNumber}`);

        // Get token info
        console.log(`\n[QUOTER TEST] 🔄 Fetching token information...`);
        const yesCompanyContract = new ethers.Contract(YES_TSLAON, ERC20_ABI, provider);
        const yesCurrencyContract = new ethers.Contract(YES_USDS, ERC20_ABI, provider);

        const [companySymbol, companyName, companyDecimals, currencySymbol, currencyName, currencyDecimals] = await Promise.all([
            yesCompanyContract.symbol(),
            yesCompanyContract.name(),
            yesCompanyContract.decimals(),
            yesCurrencyContract.symbol(),
            yesCurrencyContract.name(),
            yesCurrencyContract.decimals()
        ]);

        console.log(`[QUOTER TEST] Company Token (YES): ${companySymbol} (${companyName}) - ${companyDecimals} decimals`);
        console.log(`[QUOTER TEST] Currency Token (YES): ${currencySymbol} (${currencyName}) - ${currencyDecimals} decimals`);

        // Check for pools at different fee tiers
        console.log(`\n[QUOTER TEST] 🔄 Checking for Uniswap V3 pools...`);
        const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);

        for (const feeTier of FEE_TIERS) {
            console.log(`\n[QUOTER TEST] Checking fee tier: ${feeTier} (${feeTier/10000}%)`);

            try {
                const poolAddress = await factory.getPool(YES_TSLAON, YES_USDS, feeTier);

                if (poolAddress === ethers.constants.AddressZero) {
                    console.log(`[QUOTER TEST] ❌ No pool found for fee tier ${feeTier}`);
                    continue;
                }

                console.log(`[QUOTER TEST] ✅ Pool found at: ${poolAddress}`);

                // Get pool state
                const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
                const slot0 = await pool.slot0();

                console.log(`[QUOTER TEST] Pool state:`, {
                    sqrtPriceX96: slot0.sqrtPriceX96.toString(),
                    tick: slot0.tick.toString(),
                    observationIndex: slot0.observationIndex,
                    observationCardinality: slot0.observationCardinality
                });

                // Try to get a quote
                console.log(`\n[QUOTER TEST] 🔄 Getting quote for ${TEST_AMOUNT} ${companySymbol}...`);
                const quoter = new ethers.Contract(QUOTER_V2_ADDRESS, QUOTER_V2_ABI, provider);

                const amountIn = ethers.utils.parseUnits(TEST_AMOUNT, companyDecimals);

                const params = {
                    tokenIn: YES_TSLAON,
                    tokenOut: YES_USDS,
                    amountIn: amountIn,
                    fee: feeTier,
                    sqrtPriceLimitX96: 0
                };

                console.log(`[QUOTER TEST] Quote params:`, {
                    tokenIn: params.tokenIn,
                    tokenOut: params.tokenOut,
                    amountIn: params.amountIn.toString(),
                    fee: params.fee
                });

                const result = await quoter.callStatic.quoteExactInputSingle(params);
                const [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] = result;

                const amountOutFormatted = ethers.utils.formatUnits(amountOut, currencyDecimals);

                console.log(`[QUOTER TEST] ✅ Quote successful!`);
                console.log(`[QUOTER TEST] Results:`, {
                    amountIn: TEST_AMOUNT + ' ' + companySymbol,
                    amountOut: amountOutFormatted + ' ' + currencySymbol,
                    price: (parseFloat(amountOutFormatted) / parseFloat(TEST_AMOUNT)).toFixed(6),
                    sqrtPriceX96After: sqrtPriceX96After.toString(),
                    ticksCrossed: initializedTicksCrossed.toString(),
                    gasEstimate: gasEstimate.toString()
                });

                return { success: true, rpcUrl, feeTier };
            } catch (error) {
                console.log(`[QUOTER TEST] ❌ Error with fee tier ${feeTier}:`, error.message);
                if (error.reason) console.log(`[QUOTER TEST] Reason:`, error.reason);
            }
        }

        console.log(`\n[QUOTER TEST] ⚠️ No working pools found for any fee tier`);
        return { success: false, rpcUrl, error: 'No pools found' };

    } catch (error) {
        console.error(`[QUOTER TEST] ❌ RPC Error:`, error.message);
        return { success: false, rpcUrl, error: error.message };
    }
}

async function runTests() {
    console.log(`\n${'█'.repeat(80)}`);
    console.log(`[QUOTER TEST] Starting Uniswap V3 QuoterV2 Tests`);
    console.log(`[QUOTER TEST] Testing TSLA market conditional tokens on Ethereum mainnet`);
    console.log(`${'█'.repeat(80)}`);

    const results = [];

    for (const rpcUrl of RPC_ENDPOINTS) {
        const result = await testRpcEndpoint(rpcUrl);
        results.push(result);
    }

    // Summary
    console.log(`\n\n${'█'.repeat(80)}`);
    console.log(`[QUOTER TEST] TEST SUMMARY`);
    console.log(`${'█'.repeat(80)}`);

    const successfulRpcs = results.filter(r => r.success);
    const failedRpcs = results.filter(r => !r.success);

    console.log(`\n✅ Successful RPCs: ${successfulRpcs.length}/${results.length}`);
    successfulRpcs.forEach(r => {
        console.log(`   - ${r.rpcUrl} (fee tier: ${r.feeTier})`);
    });

    console.log(`\n❌ Failed RPCs: ${failedRpcs.length}/${results.length}`);
    failedRpcs.forEach(r => {
        console.log(`   - ${r.rpcUrl} (${r.error})`);
    });

    if (successfulRpcs.length === 0) {
        console.log(`\n⚠️  WARNING: No Uniswap V3 pools found for YES_TSLAON <-> YES_USDS`);
        console.log(`   This suggests the liquidity might be on a different DEX (SushiSwap, etc.)`);
    }

    console.log(`\n${'█'.repeat(80)}\n`);
}

// Run the tests
runTests().catch(console.error);
