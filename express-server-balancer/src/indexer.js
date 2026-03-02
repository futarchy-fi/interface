/**
 * Indexer - Optimized for memory
 */

require('dotenv').config();
const { getIndexerState, updateIndexerState, saveCandles } = require('./db');
const { fetchSwaps } = require('./subgraph');
const { buildCompositeCandles, fillCandleGaps } = require('./candleBuilder');
const { PRESETS } = require('../config/presets');

const API_KEY = process.env.GRAPH_API_KEY;
const INDEX_DAYS_BACK = parseInt(process.env.INDEX_DAYS_BACK || '1');
const MAX_SWAPS_PER_HOP = 500; // Limit swaps to avoid memory issues

function getStartTimestamp(presetName) {
    const state = getIndexerState(presetName);
    if (state?.lastIndexedTimestamp) {
        return state.lastIndexedTimestamp;
    }
    return Math.floor(Date.now() / 1000) - (INDEX_DAYS_BACK * 24 * 60 * 60);
}

async function indexPreset(presetName) {
    const preset = PRESETS[presetName];
    if (!preset) {
        console.log(`❌ Unknown preset: ${presetName}`);
        return;
    }

    console.log(`\n📊 Indexing: ${presetName}`);

    const fromTimestamp = getStartTimestamp(presetName);
    console.log(`   From: ${new Date(fromTimestamp * 1000).toISOString()}`);

    updateIndexerState(presetName, { status: 'indexing' });

    const swapsByHop = [];
    let totalSwaps = 0;
    let latestTimestamp = fromTimestamp;

    for (let i = 0; i < preset.hops.length; i++) {
        const hop = preset.hops[i];
        try {
            const swaps = await fetchSwaps(API_KEY, hop.poolId, fromTimestamp, MAX_SWAPS_PER_HOP);
            console.log(`   ${hop.name}: ${swaps.length} swaps`);
            swapsByHop.push(swaps);
            totalSwaps += swaps.length;

            if (swaps.length > 0) {
                const lastTs = swaps[swaps.length - 1].timestamp;
                if (lastTs > latestTimestamp) latestTimestamp = lastTs;
            }
        } catch (err) {
            console.log(`   ${hop.name}: ERROR - ${err.message}`);
            swapsByHop.push([]);
        }
        await new Promise(r => setTimeout(r, 100));
    }

    console.log(`   Building candles...`);
    const candles = buildCompositeCandles(presetName, swapsByHop);
    const filled = fillCandleGaps(candles);
    console.log(`   Generated: ${filled.length} candles`);

    const total = saveCandles(presetName, filled);
    console.log(`   Total stored: ${total}`);

    updateIndexerState(presetName, {
        lastIndexedTimestamp: latestTimestamp,
        totalSwaps,
        status: 'idle'
    });

    console.log(`   ✅ Done!`);
    return { candles: filled.length, swaps: totalSwaps };
}

async function indexAll() {
    console.log('🚀 Indexer starting...');
    console.log(`   Days back: ${INDEX_DAYS_BACK}, Max swaps: ${MAX_SWAPS_PER_HOP}`);

    for (const presetName of Object.keys(PRESETS)) {
        try {
            await indexPreset(presetName);
        } catch (err) {
            console.log(`   ❌ ${presetName}: ${err.message}`);
        }
    }
    console.log('✅ Indexing complete!');
}

module.exports = { indexPreset, indexAll };

if (require.main === module) {
    indexAll().catch(console.error);
}
