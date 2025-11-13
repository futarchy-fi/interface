import { createPublicClient, http, parseAbi } from 'viem';
import { gnosis } from 'viem/chains';

const client = createPublicClient({
    chain: gnosis,
    transport: http('https://rpc.gnosischain.com')
});

const poolAddress = '0xf811dc52684e828f52bbbb61d1e9a00eE7d185e1';

console.log('Checking pool type for:', poolAddress);

// Check if it has standard token0/token1 functions
try {
    const token0 = await client.readContract({
        address: poolAddress,
        abi: parseAbi(['function token0() view returns (address)']),
        functionName: 'token0'
    });
    console.log('  token0():', token0);
} catch (e) {
    console.log('  token0() failed:', e.message.split('\n')[0]);
}

try {
    const token1 = await client.readContract({
        address: poolAddress,
        abi: parseAbi(['function token1() view returns (address)']),
        functionName: 'token1'
    });
    console.log('  token1():', token1);
} catch (e) {
    console.log('  token1() failed:', e.message.split('\n')[0]);
}

// Try different price getter functions
const priceFunctions = [
    'function globalState() view returns (uint160, uint128, int24, uint16, bool, uint8, uint16)',
    'function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)',
    'function getReserves() view returns (uint112, uint112, uint32)',
    'function price0CumulativeLast() view returns (uint256)',
    'function getCurrentPrice() view returns (uint256)'
];

for (const func of priceFunctions) {
    const funcName = func.split('(')[0].split(' ').pop();
    try {
        const result = await client.readContract({
            address: poolAddress,
            abi: parseAbi([func]),
            functionName: funcName
        });
        console.log(`  ${funcName}(): SUCCESS`);
        console.log('    Result:', result);
        break;
    } catch (e) {
        console.log(`  ${funcName}(): ${e.message.split('\n')[0]}`);
    }
}

// Check bytecode size to understand what kind of contract it is
const bytecode = await client.getBytecode({ address: poolAddress });
console.log('\nBytecode size:', bytecode ? bytecode.length : 0, 'chars');

// Try to identify by checking for specific selectors
const selectors = {
    '0x0dfe1681': 'token0() - Uniswap V2/V3',
    '0xd21220a7': 'token1() - Uniswap V2/V3',
    '0xf4f11db4': 'globalState() - Algebra',
    '0x3850c7bd': 'slot0() - Uniswap V3',
    '0x0902f1ac': 'getReserves() - Uniswap V2'
};

console.log('\nChecking for known function selectors:');
for (const [selector, description] of Object.entries(selectors)) {
    try {
        const result = await client.call({
            to: poolAddress,
            data: selector
        });
        console.log(`  ${selector}: PRESENT (${description})`);
    } catch {
        // Function doesn't exist
    }
}