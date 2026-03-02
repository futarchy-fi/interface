#!/usr/bin/env node

// Check pool direction and token ordering

import 'dotenv/config';
import { createPublicClient, http } from 'viem';
import { polygon } from 'viem/chains';

const YES_DAI = '0xfaaD724286C3f774158a45a98B6F82Ae6e7F3E2D';
const YES_AAVE = '0xC558183b4cC78465A2C00a8598bD9f310455966E';

const publicClient = createPublicClient({
    chain: polygon,
    transport: http('https://polygon-rpc.com')
});

const erc20Abi = [
    {
        name: 'symbol',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'string' }]
    },
    {
        name: 'name',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'string' }]
    }
];

async function main() {
    console.log('Checking token details on Polygon...\n');
    
    const [symbolDai, nameDai, symbolAave, nameAave] = await Promise.all([
        publicClient.readContract({
            address: YES_DAI,
            abi: erc20Abi,
            functionName: 'symbol'
        }),
        publicClient.readContract({
            address: YES_DAI,
            abi: erc20Abi,
            functionName: 'name'
        }),
        publicClient.readContract({
            address: YES_AAVE,
            abi: erc20Abi,
            functionName: 'symbol'
        }),
        publicClient.readContract({
            address: YES_AAVE,
            abi: erc20Abi,
            functionName: 'name'
        })
    ]);
    
    console.log('Token 1:');
    console.log(`  Address: ${YES_DAI}`);
    console.log(`  Symbol: ${symbolDai}`);
    console.log(`  Name: ${nameDai}`);
    console.log('');
    
    console.log('Token 2:');
    console.log(`  Address: ${YES_AAVE}`);
    console.log(`  Symbol: ${symbolAave}`);
    console.log(`  Name: ${nameAave}`);
    console.log('');
    
    // Check token ordering for Uniswap
    const token0 = YES_DAI.toLowerCase() < YES_AAVE.toLowerCase() ? YES_DAI : YES_AAVE;
    const token1 = token0 === YES_DAI ? YES_AAVE : YES_DAI;
    
    console.log('Uniswap V3 Pool Ordering:');
    console.log(`  Token0: ${token0} (${token0 === YES_DAI ? symbolDai : symbolAave})`);
    console.log(`  Token1: ${token1} (${token1 === YES_DAI ? symbolDai : symbolAave})`);
    console.log('');
    
    console.log('Swap Directions:');
    console.log(`  ✅ ${symbolDai} → ${symbolAave}: This worked in our test`);
    console.log(`  ❌ ${symbolAave} → ${symbolDai}: This is failing now`);
    console.log('');
    
    console.log('Possible issues:');
    console.log('  1. Pool might have low liquidity in one direction');
    console.log('  2. The tick range might not support reverse swaps');
    console.log('  3. There might be a different fee tier for reverse direction');
}

main().catch(console.error);