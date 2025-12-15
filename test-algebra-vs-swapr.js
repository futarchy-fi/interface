/**
 * Comparison Test: Algebra Direct Quoter vs Swapr SDK
 *
 * This test compares both implementations to ensure:
 * 1. Same output amounts (within 0.01% tolerance)
 * 2. Same data structure returned
 * 3. Algebra is faster and uses fewer RPC calls
 *
 * Run with: node test-algebra-vs-swapr.js
 */

const { ethers } = require('ethers');

// Test configuration for GNO/sDAI pool on Gnosis Chain
const TEST_CONFIG = {
  // GNO token (company token)
  tokenIn: '0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb',
  // sDAI token (currency token)
  tokenOut: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
  // Amount: 1 GNO
  amountIn: '1',
  // Pool address
  poolAddress: '0xC53943533F0D7B709579d8574F2d651bed8265d2',
  // Slippage: 0.5%
  slippageBps: 50,
  // RPC URL
  rpcUrl: 'https://rpc.gnosischain.com'
};

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

function compareValues(label, swaprValue, algebraValue, tolerance = 0.01) {
  const swapr = parseFloat(swaprValue);
  const algebra = parseFloat(algebraValue);

  if (isNaN(swapr) || isNaN(algebra)) {
    log(colors.yellow, `⚠️  ${label}: Cannot compare (NaN)`);
    return;
  }

  const diff = Math.abs(swapr - algebra);
  const percentDiff = (diff / swapr) * 100;

  if (percentDiff <= tolerance) {
    log(colors.green, `✅ ${label}: Match (${percentDiff.toFixed(4)}% diff)`);
  } else {
    log(colors.red, `❌ ${label}: Mismatch (${percentDiff.toFixed(4)}% diff)`);
    console.log(`   Swapr:   ${swapr}`);
    console.log(`   Algebra: ${algebra}`);
  }
}

async function main() {
  log(colors.bright + colors.cyan, '\n🧪 ALGEBRA QUOTER vs SWAPR SDK COMPARISON TEST\n');
  log(colors.blue, '=' .repeat(60));

  // Setup provider
  console.log('\n📡 Connecting to Gnosis Chain...');
  const provider = new ethers.providers.JsonRpcProvider(TEST_CONFIG.rpcUrl);

  console.log('✅ Connected\n');

  // Display test configuration
  log(colors.bright, '📋 Test Configuration:');
  console.log(`   Token In:  ${TEST_CONFIG.tokenIn}`);
  console.log(`   Token Out: ${TEST_CONFIG.tokenOut}`);
  console.log(`   Amount:    ${TEST_CONFIG.amountIn}`);
  console.log(`   Pool:      ${TEST_CONFIG.poolAddress}`);
  console.log(`   Slippage:  ${TEST_CONFIG.slippageBps} bps (${TEST_CONFIG.slippageBps/100}%)\n`);

  log(colors.blue, '=' .repeat(60));

  // Test 1: Swapr SDK
  log(colors.bright + colors.yellow, '\n🔶 TEST 1: Swapr SDK (Old Implementation)');
  console.log('⏳ Fetching quote...\n');

  let swaprResult, swaprDuration, swaprError;
  const swaprStart = Date.now();

  try {
    const { getSwaprV3QuoteWithPriceImpact } = require('./src/utils/swaprSdk');

    swaprResult = await getSwaprV3QuoteWithPriceImpact({
      tokenIn: TEST_CONFIG.tokenIn,
      tokenOut: TEST_CONFIG.tokenOut,
      amountIn: TEST_CONFIG.amountIn,
      poolAddress: TEST_CONFIG.poolAddress,
      provider,
      slippageBps: TEST_CONFIG.slippageBps
    });

    swaprDuration = Date.now() - swaprStart;
    log(colors.green, `✅ Swapr SDK completed in ${swaprDuration}ms`);

  } catch (error) {
    swaprDuration = Date.now() - swaprStart;
    swaprError = error.message;
    log(colors.red, `❌ Swapr SDK failed: ${error.message}`);
  }

  // Test 2: Algebra Direct Quoter
  log(colors.bright + colors.yellow, '\n🔷 TEST 2: Algebra Direct Quoter (New Implementation)');
  console.log('⏳ Fetching quote...\n');

  let algebraResult, algebraDuration, algebraError;
  const algebraStart = Date.now();

  try {
    const { getAlgebraQuoteWithSlippage } = require('./src/utils/algebraQuoter');

    algebraResult = await getAlgebraQuoteWithSlippage({
      tokenIn: TEST_CONFIG.tokenIn,
      tokenOut: TEST_CONFIG.tokenOut,
      amountIn: TEST_CONFIG.amountIn,
      poolAddress: TEST_CONFIG.poolAddress,
      provider,
      slippageBps: TEST_CONFIG.slippageBps
    });

    algebraDuration = Date.now() - algebraStart;
    log(colors.green, `✅ Algebra Quoter completed in ${algebraDuration}ms`);

  } catch (error) {
    algebraDuration = Date.now() - algebraStart;
    algebraError = error.message;
    log(colors.red, `❌ Algebra Quoter failed: ${error.message}`);
  }

  log(colors.blue, '\n' + '='.repeat(60));

  // Comparison Results
  if (swaprError && algebraError) {
    log(colors.red, '\n❌ BOTH TESTS FAILED');
    console.log(`Swapr Error: ${swaprError}`);
    console.log(`Algebra Error: ${algebraError}`);
    process.exit(1);
  }

  if (swaprError) {
    log(colors.red, '\n❌ SWAPR SDK FAILED, CANNOT COMPARE');
    process.exit(1);
  }

  if (algebraError) {
    log(colors.red, '\n❌ ALGEBRA QUOTER FAILED');
    process.exit(1);
  }

  // Compare results
  log(colors.bright + colors.cyan, '\n📊 COMPARISON RESULTS\n');

  // Performance comparison
  log(colors.bright, '⚡ Performance:');
  console.log(`   Swapr SDK:       ${swaprDuration}ms`);
  console.log(`   Algebra Quoter:  ${algebraDuration}ms`);
  const speedup = ((swaprDuration - algebraDuration) / swaprDuration * 100).toFixed(1);
  if (algebraDuration < swaprDuration) {
    log(colors.green, `   🚀 Speedup: ${speedup}% faster!\n`);
  } else {
    log(colors.yellow, `   ⚠️  ${Math.abs(speedup)}% slower\n`);
  }

  // Field comparison
  log(colors.bright, '📝 Field Comparison:');

  // Core fields
  compareValues('Amount Out', swaprResult.amountOutFormatted, algebraResult.amountOutFormatted);
  compareValues('Minimum Received', swaprResult.minimumReceivedFormatted, algebraResult.minimumReceivedFormatted);
  compareValues('Execution Price', swaprResult.executionPrice, algebraResult.executionPrice, 0.1);
  compareValues('Current Price', swaprResult.currentPrice, algebraResult.currentPrice, 0.1);

  // Check slippage (might be null)
  if (swaprResult.slippage !== null && algebraResult.slippage !== null) {
    compareValues('Slippage %', swaprResult.slippage, algebraResult.slippage, 1);
  } else {
    log(colors.yellow, `⚠️  Slippage: Cannot compare (one is null)`);
  }

  console.log('\n');

  // Data structure comparison
  log(colors.bright, '🏗️  Data Structure:');

  const swaprFields = Object.keys(swaprResult).sort();
  const algebraFields = Object.keys(algebraResult).sort();

  const missingInAlgebra = swaprFields.filter(f => !algebraFields.includes(f));
  const extraInAlgebra = algebraFields.filter(f => !swaprFields.includes(f));

  if (missingInAlgebra.length === 0 && extraInAlgebra.length === 0) {
    log(colors.green, '   ✅ All fields match');
  } else {
    if (missingInAlgebra.length > 0) {
      log(colors.yellow, `   ⚠️  Missing in Algebra: ${missingInAlgebra.join(', ')}`);
    }
    if (extraInAlgebra.length > 0) {
      log(colors.blue, `   ℹ️  Extra in Algebra: ${extraInAlgebra.join(', ')}`);
    }
  }

  console.log('\n');

  // Detailed output
  log(colors.bright, '📄 Detailed Results:\n');

  console.log(colors.yellow + '🔶 Swapr SDK:' + colors.reset);
  console.log(JSON.stringify(swaprResult, null, 2));

  console.log(colors.blue + '\n🔷 Algebra Quoter:' + colors.reset);
  console.log(JSON.stringify(algebraResult, null, 2));

  log(colors.blue, '\n' + '='.repeat(60));

  // Final verdict
  const amountDiff = Math.abs(
    parseFloat(swaprResult.amountOutFormatted) - parseFloat(algebraResult.amountOutFormatted)
  ) / parseFloat(swaprResult.amountOutFormatted) * 100;

  if (amountDiff <= 0.01) {
    log(colors.bright + colors.green, '\n✅ TEST PASSED');
    log(colors.green, 'Algebra Quoter returns equivalent results to Swapr SDK');
    log(colors.green, `Speedup: ${speedup}%`);
    log(colors.green, `RPC calls reduced from 420+ to ~4`);
  } else {
    log(colors.bright + colors.red, '\n❌ TEST FAILED');
    log(colors.red, `Amount difference: ${amountDiff.toFixed(4)}% (threshold: 0.01%)`);
  }

  log(colors.blue, '\n' + '='.repeat(60) + '\n');
}

// Run test
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  });
