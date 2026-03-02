import { createPublicClient, http } from 'viem';
import { gnosis } from 'viem/chains';

const client = createPublicClient({
    chain: gnosis,
    transport: http('https://rpc.gnosischain.com')
});

// Test pool
const poolAddress = '0x98a3ebD5c7033DE146950C09c3a96e28766d5d97'; // YES_COMPANY/sDAI pool

console.log('Getting price from pool:', poolAddress);

try {
    // Get token addresses
    const token0 = await client.readContract({
        address: poolAddress,
        abi: [{
            name: 'token0',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ type: 'address' }]
        }],
        functionName: 'token0'
    });
    
    const token1 = await client.readContract({
        address: poolAddress,
        abi: [{
            name: 'token1',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ type: 'address' }]
        }],
        functionName: 'token1'
    });
    
    console.log('Token0:', token0);
    console.log('Token1:', token1);
    
    // Try to get globalState without parsing return types
    const globalState = await client.readContract({
        address: poolAddress,
        abi: [{
            name: 'globalState',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [
                { type: 'uint160' },  // sqrtPriceX96
                { type: 'int24' },    // tick
                { type: 'uint16' },   // fee
                { type: 'uint16' },   // timepointIndex
                { type: 'uint8' },    // communityFeeToken0
                { type: 'uint8' },    // communityFeeToken1
                { type: 'bool' }      // unlocked
            ]
        }],
        functionName: 'globalState'
    });
    
    console.log('\nglobalState result:', globalState);
    
    if (globalState) {
        const sqrtPriceX96 = globalState[0];
        const tick = globalState[1];
        const fee = globalState[2];
        
        console.log('\nParsed values:');
        console.log('  sqrtPriceX96:', sqrtPriceX96.toString());
        console.log('  tick:', tick);
        console.log('  fee:', fee);
        
        // Calculate price
        const price = (Number(sqrtPriceX96) / (2 ** 96)) ** 2;
        console.log('\nPrice (token0 in terms of token1):', price);
        console.log('Price (token1 in terms of token0):', 1/price);
        
        // Get token symbols
        const [symbol0, symbol1] = await Promise.all([
            client.readContract({
                address: token0,
                abi: [{
                    name: 'symbol',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [],
                    outputs: [{ type: 'string' }]
                }],
                functionName: 'symbol'
            }).catch(() => token0.slice(0,6)),
            client.readContract({
                address: token1,
                abi: [{
                    name: 'symbol',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [],
                    outputs: [{ type: 'string' }]
                }],
                functionName: 'symbol'
            }).catch(() => token1.slice(0,6))
        ]);
        
        console.log(`\n💱 Final Prices:`);
        console.log(`  1 ${symbol0} = ${price.toFixed(6)} ${symbol1}`);
        console.log(`  1 ${symbol1} = ${(1/price).toFixed(6)} ${symbol0}`);
    }
} catch (error) {
    console.error('Error:', error.message);
}