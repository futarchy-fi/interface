// Test the getBestRpc module
const { getBestRpc, getBestRpcProvider, clearRpcCache } = require('./src/utils/getBestRpc');

async function test() {
    console.log('\n=== Testing getBestRpc Module ===\n');

    // Test Ethereum mainnet
    console.log('Testing Ethereum (chainId 1)...');
    const ethRpc = await getBestRpc(1);
    console.log(`✅ Best Ethereum RPC: ${ethRpc}\n`);

    // Test Gnosis Chain
    console.log('Testing Gnosis Chain (chainId 100)...');
    const gnosisRpc = await getBestRpc(100);
    console.log(`✅ Best Gnosis RPC: ${gnosisRpc}\n`);

    // Test caching
    console.log('Testing cache (should be instant)...');
    const startTime = Date.now();
    const cachedEthRpc = await getBestRpc(1);
    const cacheTime = Date.now() - startTime;
    console.log(`✅ Cached result returned in ${cacheTime}ms: ${cachedEthRpc}\n`);

    // Test provider
    console.log('Testing getBestRpcProvider...');
    const provider = await getBestRpcProvider(1);
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ Provider works! Current block: ${blockNumber}\n`);

    console.log('=== All tests passed! ===\n');
}

test().catch(console.error);
