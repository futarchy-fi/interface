#!/usr/bin/env node

const { ethers } = require('ethers');
const PriceCalculator = require('./utils/priceCalculations');

// Test configuration matching the user's request
const config = {
  spotPrice: 0.02173,
  eventProbability: 0.5,
  impact: 10,
  liquidityAmounts: [
    0.000000000001,  // Pool 1: YES-PNK/YES-sDAI
    0.000000000001,  // Pool 2: NO-PNK/NO-sDAI
    0.000000000001,  // Pool 3: YES-PNK/sDAI
    0.000000000001,  // Pool 4: NO-PNK/sDAI
    0.000000000001,  // Pool 5: YES-sDAI/sDAI
    0.000000000001   // Pool 6: NO-sDAI/sDAI
  ]
};

console.log('Testing Minimal Liquidity Configuration');
console.log('=' .repeat(60));
console.log('\nInput Parameters:');
console.log(`  Spot Price: ${config.spotPrice}`);
console.log(`  Event Probability: ${config.eventProbability * 100}%`);
console.log(`  Impact: ${config.impact}%`);
console.log(`  Liquidity per pool: ${config.liquidityAmounts[0]}`);

// Calculate conditional prices
const conditionalPrices = PriceCalculator.calculateConditionalPrices(
  config.spotPrice,
  config.eventProbability,
  config.impact
);

console.log('\nCalculated Prices:');
console.log(`  YES Price: ${conditionalPrices.yesPriceFormatted}`);
console.log(`  NO Price: ${conditionalPrices.noPriceFormatted}`);

// Calculate pool configurations
const poolConfigs = PriceCalculator.calculatePoolConfigurations({
  spotPrice: config.spotPrice,
  eventProbability: config.eventProbability,
  impactPercentage: config.impact,
  liquidityAmounts: config.liquidityAmounts,
  companyTokenDecimals: 18,
  currencyTokenDecimals: 18
});

console.log('\n' + '=' .repeat(60));
console.log('POOL CONFIGURATIONS');
console.log('=' .repeat(60));

poolConfigs.forEach((pool, i) => {
  console.log(`\nPool ${i + 1}: ${pool.name}`);
  console.log(`  Target Price: ${pool.targetPrice.toFixed(6)}`);
  console.log(`  Liquidity Amount (token1): ${pool.liquidity}`);
  console.log(`  Calculated Amounts:`);
  console.log(`    token0: ${pool.amount0.toFixed(18)}`);
  console.log(`    token1: ${pool.amount1.toFixed(18)}`);
  console.log(`  Wei Amounts:`);
  console.log(`    token0Wei: ${pool.amount0Wei.toString()}`);
  console.log(`    token1Wei: ${pool.amount1Wei.toString()}`);
  
  // Verify the amounts
  const amt0 = ethers.formatEther(pool.amount0Wei);
  const amt1 = ethers.formatEther(pool.amount1Wei);
  console.log(`  Formatted:`);
  console.log(`    token0: ${amt0} ${pool.token0}`);
  console.log(`    token1: ${amt1} ${pool.token1}`);
  
  // Verify price calculation
  if (Number(amt0) > 0) {
    const impliedPrice = Number(amt1) / Number(amt0);
    console.log(`  Implied Price: ${impliedPrice.toFixed(6)}`);
    const deviation = Math.abs(impliedPrice - pool.targetPrice) / pool.targetPrice * 100;
    console.log(`  Price Deviation: ${deviation.toFixed(2)}%`);
  }
});

console.log('\n' + '=' .repeat(60));
console.log('VERIFICATION SUMMARY');
console.log('=' .repeat(60));

// Verify all amounts are non-zero
let allValid = true;
poolConfigs.forEach((pool, i) => {
  const isValid = pool.amount0Wei > 0n && pool.amount1Wei > 0n;
  console.log(`Pool ${i + 1}: ${isValid ? '✅ Valid' : '❌ Invalid (zero amount)'}`);
  if (!isValid) {
    allValid = false;
    console.log(`  amount0Wei: ${pool.amount0Wei}`);
    console.log(`  amount1Wei: ${pool.amount1Wei}`);
  }
});

if (allValid) {
  console.log('\n✅ All pool configurations are valid!');
} else {
  console.log('\n❌ Some pool configurations have issues!');
}

console.log('\nFormula Verification:');
console.log(`  YES price = spot × (1 + impact) × probability`);
console.log(`           = ${config.spotPrice} × ${1 + config.impact/100} × ${config.eventProbability}`);
console.log(`           = ${config.spotPrice * (1 + config.impact/100) * config.eventProbability}`);
console.log(`  NO price = spot × (1 - probability × impact)`);
console.log(`          = ${config.spotPrice} × (1 - ${config.eventProbability} × ${config.impact/100})`);
console.log(`          = ${config.spotPrice * (1 - config.eventProbability * config.impact/100)}`);