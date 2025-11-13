#!/usr/bin/env node
/**
 * Test script for swaprSdk.js module
 * Tests: 1 YES_SDAI -> YES_GNO with 20% slippage
 */

import { ethers } from "ethers";
import { getSwaprV3QuoteWithPriceImpact } from "./src/utils/swaprSdk.js";

const DEFAULT_GNOSIS_RPC = "https://rpc.gnosischain.com";

// Test parameters
const POOL_ADDRESS = "0xF1D0eF18f29b2Fe00C3ed17F7705F315cfF02Fb3"; // YES pool
const TOKEN_IN = "0xD724b3203D46b3fF71273A760b45A7c460f3c020"; // YES_SDAI
const TOKEN_OUT = "0xD356f0cEC8f2631eCE8C9316dc59433106D97f2d"; // YES_GNO
const AMOUNT_IN = "1"; // 1 YES_SDAI
const SLIPPAGE_BPS = 2000; // 20% slippage

async function testSwaprModule() {
  const startTime = Date.now();
  console.log('=== Testing swaprSdk.js Module ===');
  console.log('Pool:', POOL_ADDRESS);
  console.log('Token In:', TOKEN_IN, '(YES_SDAI)');
  console.log('Token Out:', TOKEN_OUT, '(YES_GNO)');
  console.log('Amount In:', AMOUNT_IN);
  console.log('Slippage:', SLIPPAGE_BPS / 100, '%');
  console.log('');

  try {
    // Create provider
    console.log('[TEST] Creating provider...');
    const provider = new ethers.providers.JsonRpcProvider(DEFAULT_GNOSIS_RPC);

    console.log('[TEST] Calling getSwaprV3QuoteWithPriceImpact...');

    const quoteResult = await getSwaprV3QuoteWithPriceImpact({
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      amountIn: AMOUNT_IN,
      poolAddress: POOL_ADDRESS,
      provider,
      rpcUrl: DEFAULT_GNOSIS_RPC,
      slippageBps: SLIPPAGE_BPS
    });

    const endTime = Date.now();
    const elapsedTime = ((endTime - startTime) / 1000).toFixed(2);

    console.log('');
    console.log('=== QUOTE RESULT ===');
    console.log('Amount Out:', quoteResult.amountOutFormatted, 'YES_GNO');
    console.log('Execution Price:', parseFloat(quoteResult.executionPrice).toFixed(6));
    console.log('Inverted Price:', parseFloat(quoteResult.invertedPrice).toFixed(6));
    console.log('Minimum Received:', quoteResult.minimumReceivedFormatted, 'YES_GNO');
    console.log('Current Pool Price:', quoteResult.currentPrice);
    console.log('Price Impact:', quoteResult.priceImpact !== null ? quoteResult.priceImpact.toFixed(4) + '%' : 'N/A');
    console.log('Route:', quoteResult.route);

    console.log('');
    console.log('=== FULL RESULT OBJECT ===');
    console.log(JSON.stringify({
      ...quoteResult,
      executionTimeSeconds: elapsedTime
    }, null, 2));

    console.log('');
    console.log(`⏱️  Total execution time: ${elapsedTime}s`);

  } catch (error) {
    console.error('');
    console.error('=== ERROR ===');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testSwaprModule().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
