/**
 * Test: Indexer directly (no server needed)
 * Run: node tests/test-indexer.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { fetchSwaps } = require('../src/subgraph');
const { buildCompositeCandles, fillCandleGaps } = require('../src/candleBuilder');
const { saveCandles, getCandles } = require('../src/db');
const { PRESETS } = require('../config/presets');

const API_KEY = process.env.GRAPH_API_KEY;

async function testIndexer() {
    console.log('🧪 Testing Indexer Components');
    console.log('═'.repeat(50));

    // 1. Test subgraph fetch
    console.log('\n🌐 Test 1: Subgraph fetch');
    const preset = PRESETS.GNO_SDAI;
    const hop = preset.hops[0];
    const fromTimestamp = Math.floor(Date.now() / 1000) - 3 * 60 * 60; // 3 hours ago

    try {
        console.log(`   Fetching swaps from ${hop.name}...`);
        const swaps = await fetchSwaps(API_KEY, hop.poolId, fromTimestamp, 100);
        console.log(`   ✅ Got ${swaps.length} swaps`);

        if (swaps.length > 0) {
            console.log(`   First swap: ${new Date(swaps[0].timestamp * 1000).toISOString()}`);
            console.log(`   Last swap: ${new Date(swaps[swaps.length - 1].timestamp * 1000).toISOString()}`);
        }
    } catch (err) {
        console.log(`   ❌ Subgraph error: ${err.message}`);
        return;
    }

    // 2. Test candle building
    console.log('\n🕐 Test 2: Candle building');
    try {
        const swapsByHop = [];
        for (const h of preset.hops) {
            const swaps = await fetchSwaps(API_KEY, h.poolId, fromTimestamp, 500);
            swapsByHop.push(swaps);
            console.log(`   ${h.name}: ${swaps.length} swaps`);
        }

        const candles = buildCompositeCandles('GNO_SDAI', swapsByHop);
        const filled = fillCandleGaps(candles);

        console.log(`\n   ✅ Built ${filled.length} composite candles`);

        if (filled.length > 0) {
            console.log(`\n   📈 Candles:`);
            for (const c of filled) {
                const time = new Date(c.time * 1000).toISOString().slice(0, 16);
                const filledMark = c.isFilled ? ' (filled)' : '';
                console.log(`      ${time} | ${c.close.toFixed(4)}${filledMark}`);
            }
        }

        // 3. Test storage
        console.log('\n💾 Test 3: JSON Storage');
        saveCandles('GNO_SDAI', filled);
        console.log('   ✅ Candles saved');

        const loaded = getCandles('GNO_SDAI', fromTimestamp, Math.floor(Date.now() / 1000));
        console.log(`   ✅ Loaded ${loaded.length} candles from storage`);

    } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
        console.log(err.stack);
        return;
    }

    console.log('\n✅ All indexer tests passed!');
}

testIndexer().catch(console.error);
