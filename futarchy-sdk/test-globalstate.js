import { createPublicClient, http } from 'viem';
import { gnosis } from 'viem/chains';

const client = createPublicClient({
    chain: gnosis,
    transport: http('https://rpc.gnosischain.com')
});

// Test pool
const poolAddress = '0xf811dc52684e828f52bbbb61d1e9a00eE7d185e1';

console.log('Testing globalState on pool:', poolAddress);

// Try raw call to see what we get
const result = await client.call({
    to: poolAddress,
    data: '0xf4f11db4' // globalState() selector
});

console.log('Raw result:', result);

// Parse manually
if (result && result.data) {
    const data = result.data.slice(2); // Remove 0x
    
    // Split into 32-byte chunks
    const chunks = [];
    for (let i = 0; i < data.length; i += 64) {
        chunks.push('0x' + data.slice(i, i + 64));
    }
    
    console.log('\nParsed chunks:');
    chunks.forEach((chunk, i) => {
        console.log(`  [${i}]: ${chunk}`);
    });
    
    // Parse as expected types
    console.log('\nInterpreted values:');
    console.log('  price (uint160):', BigInt(chunks[0]));
    console.log('  liquidity (uint128):', chunks[1] ? BigInt(chunks[1]) : 'N/A');
    console.log('  tick (int24):', chunks[2] ? parseInt(chunks[2]) : 'N/A');
}