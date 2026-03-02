#!/usr/bin/env node

const { ethers } = require('ethers');
const PriceCalculator = require('./utils/priceCalculations');

console.log('Testing Pool Creation Flow');
console.log('=' .repeat(60));

// Simulate the exact flow from liquidityOrchestrator
const config = {
  spotPrice: 0.02173,
  eventProbability: 0.5,
  impact: 10,
  liquidityAmounts: [0.000000000001]
};

// Calculate pool configuration (simulating what happens in liquidityOrchestrator)
const poolConfigs = PriceCalculator.calculatePoolConfigurations({
  spotPrice: config.spotPrice,
  eventProbability: config.eventProbability,
  impactPercentage: config.impact,
  liquidityAmounts: config.liquidityAmounts,
  companyTokenDecimals: 18,
  currencyTokenDecimals: 18
});

const pool1Config = poolConfigs[0];

console.log('\nPool 1 Configuration:');
console.log(`  amount0Wei: ${pool1Config.amount0Wei} (type: ${typeof pool1Config.amount0Wei})`);
console.log(`  amount1Wei: ${pool1Config.amount1Wei} (type: ${typeof pool1Config.amount1Wei})`);

// Simulate what poolManager.createPoolAndAddLiquidity receives
console.log('\nSimulating poolManager.createPoolAndAddLiquidity:');

// This is what gets passed to createPoolAndAddLiquidity
const params = {
  token0Address: '0x123...',  // dummy address
  token1Address: '0x456...',  // dummy address
  amount0: pool1Config.amount0Wei,
  amount1: pool1Config.amount1Wei
};

console.log('Input params:');
console.log(`  amount0: ${params.amount0} (type: ${typeof params.amount0})`);
console.log(`  amount1: ${params.amount1} (type: ${typeof params.amount1})`);

// Test toBigInt conversion as it happens in poolManager
const toBigInt = (value) => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'string') return BigInt(value);
  if (typeof value === 'number') return BigInt(Math.floor(value));
  return BigInt(value.toString());
};

try {
  const amt0 = toBigInt(params.amount0);
  const amt1 = toBigInt(params.amount1);
  console.log('\n✅ toBigInt conversion successful:');
  console.log(`  amt0: ${amt0} (type: ${typeof amt0})`);
  console.log(`  amt1: ${amt1} (type: ${typeof amt1})`);
} catch (error) {
  console.log(`\n❌ toBigInt conversion failed: ${error.message}`);
}

// Test sqrtPriceX96 calculation
try {
  const sqrtPrice = PriceCalculator.sqrtPriceX96(params.amount0, params.amount1);
  console.log(`\n✅ sqrtPriceX96 calculation successful: ${sqrtPrice}`);
} catch (error) {
  console.log(`\n❌ sqrtPriceX96 calculation failed: ${error.message}`);
}

// Test deadline handling
const deadline = Math.floor(Date.now() / 1000) + (20 * 60);
console.log(`\nDeadline: ${deadline} (type: ${typeof deadline})`);

// Test if deadline might accidentally become BigInt
const deadlineBigInt = BigInt(deadline);
const deadlineNum = typeof deadlineBigInt === 'bigint' ? Number(deadlineBigInt) : deadlineBigInt;
console.log(`Converted deadline: ${deadlineNum} (type: ${typeof deadlineNum})`);

// Test mint params structure
const mintParams = {
  token0: '0x123',
  token1: '0x456',
  tickLower: -887272,
  tickUpper: 887272,
  amount0Desired: toBigInt(params.amount0),
  amount1Desired: toBigInt(params.amount1),
  amount0Min: 0n,
  amount1Min: 0n,
  recipient: '0x789',
  deadline: deadlineNum
};

console.log('\nMint params structure:');
for (const [key, value] of Object.entries(mintParams)) {
  console.log(`  ${key}: ${value} (type: ${typeof value})`);
}

// Check if we can JSON stringify (this might fail with BigInt)
try {
  // This will fail if BigInt is not properly handled
  const jsonStr = JSON.stringify(mintParams, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
  console.log('\n✅ Can serialize mint params to JSON');
} catch (error) {
  console.log(`\n❌ Cannot serialize mint params: ${error.message}`);
}

console.log('\n' + '=' .repeat(60));
console.log('Flow test complete!');