/**
 * Test: Candles Endpoint
 * Run: node tests/test-candles.js
 */

const fetch = require('node-fetch');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3456';
const PRESET = process.argv[2] || 'GNO_SDAI';

async function testCandles() {
    console.log('🧪 Testing Candles Endpoint');
    console.log('═'.repeat(50));
    console.log(`   Server: ${SERVER_URL}`);
    console.log(`   Preset: ${PRESET}`);

    try {
        // Test 1: Get candles without params
        console.log(`\n📊 Test 1: Default candles (7 days)`);
        const response1 = await fetch(`${SERVER_URL}/candles/${PRESET}`);

        if (!response1.ok) {
            const err = await response1.json();
            console.log(`   ❌ Error: ${err.error}`);
            return false;
        }

        const data1 = await response1.json();
        console.log(`   ✅ Got ${data1.count} candles`);
        console.log(`   Range: ${data1.from} → ${data1.to}`);
        console.log(`   Latest price: ${data1.latestPrice?.toFixed(4)}`);

        if (data1.candles.length > 0) {
            const first = data1.candles[0];
            const last = data1.candles[data1.candles.length - 1];
            console.log(`   First candle: ${new Date(first.time * 1000).toISOString()} = ${first.close.toFixed(4)}`);
            console.log(`   Last candle: ${new Date(last.time * 1000).toISOString()} = ${last.close.toFixed(4)}`);
        }

        // Test 2: Get candles with time range
        console.log(`\n📊 Test 2: Last 24 hours`);
        const now = Math.floor(Date.now() / 1000);
        const from = now - 24 * 60 * 60;

        const response2 = await fetch(`${SERVER_URL}/candles/${PRESET}?from=${from}&to=${now}`);
        const data2 = await response2.json();

        console.log(`   ✅ Got ${data2.count} hourly candles`);

        // Test 3: Get latest price only
        console.log(`\n📊 Test 3: Latest price endpoint`);
        const response3 = await fetch(`${SERVER_URL}/price/${PRESET}`);
        const data3 = await response3.json();

        console.log(`   ✅ Price: ${data3.price?.toFixed(4)}`);
        console.log(`   Timestamp: ${data3.timestamp}`);

        // Show sample candles
        console.log(`\n📈 Last 5 candles:`);
        const lastFive = data1.candles.slice(-5);
        for (const c of lastFive) {
            const time = new Date(c.time * 1000).toISOString().slice(0, 16);
            console.log(`   ${time} | O:${c.open.toFixed(2)} H:${c.high.toFixed(2)} L:${c.low.toFixed(2)} C:${c.close.toFixed(2)}`);
        }

        console.log(`\n✅ All tests passed!`);
        return true;
    } catch (err) {
        console.log(`\n❌ Test failed: ${err.message}`);
        return false;
    }
}

testCandles().then(ok => process.exit(ok ? 0 : 1));
