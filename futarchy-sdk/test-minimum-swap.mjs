#!/usr/bin/env node

// Test minimum swap amounts for YES tokens

import 'dotenv/config';
import { parseUnits, formatUnits } from 'viem';

const amounts = [
    '0.000000000001',  // 1e-12 (your attempted amount)
    '0.00000001',      // 1e-8 (what we tested successfully)
    '0.0000001',       // 1e-7
    '0.000001',        // 1e-6
    '0.00001',         // 1e-5
    '0.0001',          // 1e-4
    '0.001',           // 1e-3
];

console.log('Testing amount conversions for 18 decimal tokens:\n');
console.log('Amount String'.padEnd(20) + ' | ' + 'Wei Value'.padEnd(25) + ' | ' + 'Scientific');
console.log('-'.repeat(70));

for (const amount of amounts) {
    const wei = parseUnits(amount, 18);
    const scientific = Number(amount).toExponential();
    console.log(
        amount.padEnd(20) + ' | ' + 
        wei.toString().padEnd(25) + ' | ' + 
        scientific
    );
}

console.log('\n📝 Notes:');
console.log('- Uniswap V3 typically has minimum swap amounts around 1000-10000 units');
console.log('- Your swap of 0.000000000001 = 1,000,000 wei might be too small');
console.log('- The successful test used 0.00000001 = 10,000,000,000 wei');
console.log('- Recommendation: Use at least 0.00000001 (1e-8) or larger');