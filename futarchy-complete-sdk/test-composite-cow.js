// Test composite ticker for COW
// node test-composite-cow.js

import { fetchSpotCandles, fetchCompositeCandles, fetchSpotCandlesWithComposite } from './src/core/ChartDataClient.js';

// Test COW/WXDAI direct
async function testDirect() {
    console.log('\n=== TEST 1: COW/WXDAI Direct ===');
    const ticker = '0x33d2dc4214725f4742ccd9fc3daf07b3cba66fc4-hour-100-xdai';
    console.log('Ticker:', ticker);

    const result = await fetchSpotCandles(ticker);
    console.log('Result:', {
        price: result.spotPrice?.toFixed(6),
        candleCount: result.spotData?.length,
        error: result.error
    });
}

// Test Composite: COW/GNO × GNO/sDAI 
async function testComposite() {
    console.log('\n=== TEST 2: COMPOSITE COW/GNO × GNO/sDAI ===');
    // COW/GNO gives COW in GNO
    // GNO/sDAI gives GNO in sDAI
    // Together: COW/GNO × GNO/sDAI = COW in sDAI (≈ USD)
    const ticker = 'composite::0x21d4c792ea7e38e0d0819c2011a2b1cb7252bd99+0x8189c4c96826d016a99986394103dfa9ae41e7ee-hour-100-xdai';
    console.log('Ticker:', ticker);

    const result = await fetchCompositeCandles(ticker);
    console.log('Result:', {
        price: result.spotPrice?.toFixed(6),
        candleCount: result.spotData?.length,
        poolCount: result.poolCount,
        error: result.error
    });
    console.log('Expected: ~$0.16 (COW price in sDAI ≈ USD)');
}

// Test with rate applied to convert sDAI → xDAI
async function testCompositeWithRate() {
    console.log('\n=== TEST 3: Compare with COW/ETH on Ethereum ===');
    // COW/WETH on Ethereum for comparison
    const ticker = '0xfcfdfc98062d13a11cec48c44e4613eb26a34293-hour-100-eth';
    console.log('Ticker:', ticker);

    const result = await fetchSpotCandles(ticker);
    console.log('Result:', {
        price: result.spotPrice?.toFixed(8),
        candleCount: result.spotData?.length,
        error: result.error
    });
    console.log('This gives COW/ETH ratio, not USD directly');
}

// Test unified entry point
async function testUnifiedEntry() {
    console.log('\n=== TEST 4: Unified fetchSpotCandlesWithComposite ===');

    // Simple ticker
    console.log('Testing simple ticker...');
    const simple = await fetchSpotCandlesWithComposite('0x33d2dc4214725f4742ccd9fc3daf07b3cba66fc4-hour-50-xdai');
    console.log('  Simple price:', simple.spotPrice?.toFixed(6));

    // Composite ticker
    console.log('Testing composite ticker...');
    const composite = await fetchSpotCandlesWithComposite('composite::0x21d4c792ea7e38e0d0819c2011a2b1cb7252bd99+0x8189c4c96826d016a99986394103dfa9ae41e7ee-hour-50-xdai');
    console.log('  Composite price:', composite.spotPrice?.toFixed(6));
}

async function main() {
    await testDirect();
    await testComposite();
    await testCompositeWithRate();
    await testUnifiedEntry();

    console.log('\n=== RECOMMENDED TICKER FOR COW DAO ===');
    console.log('composite::0x21d4c792ea7e38e0d0819c2011a2b1cb7252bd99+0x8189c4c96826d016a99986394103dfa9ae41e7ee-hour-500-xdai');
    console.log('This uses: COW/GNO ($89k liquidity) × GNO/sDAI (Balancer) = COW in sDAI ≈ USD');
}

main().catch(console.error);
