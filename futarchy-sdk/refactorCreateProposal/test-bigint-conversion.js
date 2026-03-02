#!/usr/bin/env node

const PriceCalculator = require('./utils/priceCalculations');

console.log('Testing BigInt Conversion');
console.log('=' .repeat(60));

// Test sqrtPriceX96 with different input types
const testCases = [
  { amount0: 83671506n, amount1: 1000000n, label: 'BigInt inputs' },
  { amount0: '83671506', amount1: '1000000', label: 'String inputs' },
  { amount0: 83671506, amount1: 1000000, label: 'Number inputs' },
  { amount0: BigInt('83671506'), amount1: BigInt('1000000'), label: 'BigInt constructor' }
];

console.log('\nTesting sqrtPriceX96 with various input types:');
testCases.forEach(test => {
  try {
    const result = PriceCalculator.sqrtPriceX96(test.amount0, test.amount1);
    console.log(`✅ ${test.label}: ${result.toString()}`);
  } catch (error) {
    console.log(`❌ ${test.label}: ${error.message}`);
  }
});

// Test liquidity amount calculations
console.log('\nTesting calculateLiquidityAmounts:');
const amounts = PriceCalculator.calculateLiquidityAmounts(
  18, // token0Decimals
  18, // token1Decimals
  0.011952, // targetPrice
  0.000000000001 // liquidityAmount1
);

console.log('Result:');
console.log(`  amount0: ${amounts.amount0}`);
console.log(`  amount1: ${amounts.amount1}`);
console.log(`  amount0Wei: ${amounts.amount0Wei.toString()} (type: ${typeof amounts.amount0Wei})`);
console.log(`  amount1Wei: ${amounts.amount1Wei.toString()} (type: ${typeof amounts.amount1Wei})`);

// Verify the Wei amounts are BigInt
if (typeof amounts.amount0Wei === 'bigint' && typeof amounts.amount1Wei === 'bigint') {
  console.log('\n✅ All Wei amounts are proper BigInts');
} else {
  console.log('\n❌ Wei amounts are not BigInts!');
}

// Test mixing BigInt with the pool creation calculation
console.log('\nTesting mixed BigInt calculation (simulating pool creation):');
try {
  const amount0Wei = 83671506n;
  const amount1Wei = 1000000n;
  
  // This is what was causing the error - mixing BigInt with other types
  const sqrtPrice = PriceCalculator.sqrtPriceX96(amount0Wei, amount1Wei);
  console.log(`✅ Can handle BigInt amounts: sqrtPrice = ${sqrtPrice}`);
  
  // Test the reverse calculation that happens in pools
  const needsReorder = false;
  const ammAmount0 = needsReorder ? amount1Wei : amount0Wei;
  const ammAmount1 = needsReorder ? amount0Wei : amount1Wei;
  
  console.log(`✅ AMM amounts: ${ammAmount0} / ${ammAmount1}`);
  
  // This would fail if we tried to do: ammAmount0 + 1 (mixing BigInt and number)
  // But this works:
  const adjustedAmount = ammAmount0 + 1n;
  console.log(`✅ Can add to BigInt: ${adjustedAmount}`);
  
} catch (error) {
  console.log(`❌ Error: ${error.message}`);
}

console.log('\n' + '=' .repeat(60));
console.log('All BigInt handling tests complete!');