/**
 * Candle Sync - Cron Job
 * 
 * Fetches candles from subgraph and stores in SQLite.
 * Runs every minute via node-cron.
 */

const cron = require('node-cron');
const fetch = require('node-fetch');
const db = require('../db/database');

// ============================================================
// CONFIGURATION
// ============================================================

const GRAPH_API_KEY = 'd602eb37aafab6bedd1b4f2e77405e59';

const SUBGRAPH_ENDPOINTS = {
    balancer_v3_gnosis: 'https://api.studio.thegraph.com/query/75376/balancer-v3-gnosis/version/latest',
};

const POOLS = {
    GNO_SDAI: {
        address: '0xd1d7fa8871d84d0e77020fc28b7cd5718c446522',
        subgraph: 'balancer_v3_gnosis',
    },
};

const CONTRACTS = {
    sDAI: '0xaf204776c7245bf4147c2612bf6e5972ee483701',
    GNO: '0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb',
    aGNO_RATE_PROVIDER: '0xbbb4966335677ea24f7b86dc19a423412390e1fb',
};

const GNOSIS_RPC = 'https://rpc.gnosischain.com';

// ============================================================
// GRAPHQL QUERIES
// ============================================================

const QUERIES = {
    BALANCER_V3_SWAPS: `
        query GetV3Swaps($poolAddress: String!, $first: Int!, $timestampGt: Int) {
            swaps(
                where: { 
                    pool: $poolAddress,
                    blockTimestamp_gt: $timestampGt
                }
                first: $first
                orderBy: blockTimestamp
                orderDirection: desc
            ) {
                id
                blockTimestamp
                tokenIn
                tokenOut
                tokenAmountIn
                tokenAmountOut
                valueUSD
            }
        }
    `,
};

// ============================================================
// HELPERS
// ============================================================

async function querySubgraph(endpoint, query, variables = {}) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        throw new Error(`Subgraph error: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
        throw new Error(`GraphQL: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
}

async function getAGnoRate() {
    const data = '0x679aefce'; // getRate()

    const response = await fetch(GNOSIS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [{ to: CONTRACTS.aGNO_RATE_PROVIDER, data }, 'latest']
        }),
    });

    const result = await response.json();
    if (result.error) throw new Error(result.error.message);

    return Number(BigInt(result.result)) / 1e18;
}

function swapsToCandles(swaps, gnoAddress, sdaiAddress) {
    if (!swaps || swaps.length === 0) return [];

    const hourBuckets = new Map();

    for (const swap of swaps) {
        const ts = parseInt(swap.blockTimestamp || swap.timestamp, 10);
        const hourKey = Math.floor(ts / 3600) * 3600;

        const tokenIn = swap.tokenIn.toLowerCase();
        const tokenOut = swap.tokenOut.toLowerCase();
        const amountIn = parseFloat(swap.tokenAmountIn);
        const amountOut = parseFloat(swap.tokenAmountOut);

        let gnoAmount = 0, sdaiAmount = 0;

        if (tokenIn === gnoAddress && tokenOut === sdaiAddress) {
            gnoAmount = amountIn;
            sdaiAmount = amountOut;
        } else if (tokenIn === sdaiAddress && tokenOut === gnoAddress) {
            gnoAmount = amountOut;
            sdaiAmount = amountIn;
        }

        if (gnoAmount > 0 && sdaiAmount > 0) {
            const price = sdaiAmount / gnoAmount;

            if (!hourBuckets.has(hourKey)) {
                hourBuckets.set(hourKey, { prices: [], volume: 0 });
            }

            hourBuckets.get(hourKey).prices.push(price);
            hourBuckets.get(hourKey).volume += parseFloat(swap.valueUSD || 0);
        }
    }

    const candles = [];
    for (const [time, bucket] of hourBuckets) {
        if (bucket.prices.length === 0) continue;

        const prices = bucket.prices;
        candles.push({
            time,
            value: prices[prices.length - 1],
            open: prices[0],
            high: Math.max(...prices),
            low: Math.min(...prices),
            close: prices[prices.length - 1],
            volumeUSD: bucket.volume,
        });
    }

    return candles.sort((a, b) => a.time - b.time);
}

// ============================================================
// SYNC FUNCTION
// ============================================================

async function syncPool(poolKey) {
    const pool = POOLS[poolKey];
    if (!pool) {
        console.error(`[Sync] Unknown pool: ${poolKey}`);
        return;
    }

    const poolAddress = pool.address.toLowerCase();
    const endpoint = SUBGRAPH_ENDPOINTS[pool.subgraph];

    console.log(`[Sync] Starting sync for ${poolKey}...`);
    db.updateSyncStatus(poolAddress, 'syncing');

    try {
        // 1. Get last synced timestamp
        const lastTimestamp = db.getLatestCandleTimestamp(poolAddress);
        console.log(`[Sync] Last timestamp: ${lastTimestamp} (${new Date(lastTimestamp * 1000).toISOString()})`);

        // 2. Fetch new swaps since last sync
        const data = await querySubgraph(endpoint, QUERIES.BALANCER_V3_SWAPS, {
            poolAddress,
            first: 1000,
            timestampGt: lastTimestamp || 0,
        });

        const swaps = data.swaps || [];
        console.log(`[Sync] Fetched ${swaps.length} new swaps`);

        if (swaps.length === 0) {
            db.updateSyncStatus(poolAddress, 'synced', lastTimestamp);
            return;
        }

        // 3. Convert to candles
        const gnoAddress = CONTRACTS.GNO.toLowerCase();
        const sdaiAddress = CONTRACTS.sDAI.toLowerCase();
        const rawCandles = swapsToCandles(swaps, gnoAddress, sdaiAddress);

        // 4. Apply aGNO rate
        const agnoRate = await getAGnoRate();
        const candles = rawCandles.map(c => ({
            ...c,
            value: c.value * agnoRate,
            open: c.open * agnoRate,
            high: c.high * agnoRate,
            low: c.low * agnoRate,
            close: c.close * agnoRate,
        }));

        // 5. Store in database
        const inserted = db.upsertCandles(poolAddress, candles);
        console.log(`[Sync] Inserted ${inserted} candles`);

        // 6. Store rate
        const nowTs = Math.floor(Date.now() / 1000);
        db.insertRate('agno', agnoRate, nowTs);

        // 7. Update status
        const latestTs = candles.length > 0 ? candles[candles.length - 1].time : lastTimestamp;
        db.updateSyncStatus(poolAddress, 'synced', latestTs);

        console.log(`[Sync] ✅ ${poolKey} synced. Total candles: ${db.getCandleCount(poolAddress)}`);

    } catch (err) {
        console.error(`[Sync] ❌ Error syncing ${poolKey}:`, err.message);
        db.updateSyncStatus(poolAddress, 'error');
    }
}

async function syncAllPools() {
    console.log(`\n[Sync] === Sync started at ${new Date().toISOString()} ===`);

    for (const poolKey of Object.keys(POOLS)) {
        await syncPool(poolKey);
    }

    console.log(`[Sync] === Sync complete ===\n`);
}

// ============================================================
// BACKFILL (for gap recovery)
// ============================================================

async function backfillPool(poolKey, fromTimestamp = 0) {
    const pool = POOLS[poolKey];
    const poolAddress = pool.address.toLowerCase();
    const endpoint = SUBGRAPH_ENDPOINTS[pool.subgraph];

    console.log(`[Backfill] Starting backfill for ${poolKey} from timestamp ${fromTimestamp}...`);

    let cursor = fromTimestamp;
    let totalSwaps = 0;

    while (true) {
        const data = await querySubgraph(endpoint, QUERIES.BALANCER_V3_SWAPS, {
            poolAddress,
            first: 1000,
            timestampGt: cursor,
        });

        const swaps = data.swaps || [];
        if (swaps.length === 0) break;

        totalSwaps += swaps.length;

        // Get max timestamp
        const maxTs = Math.max(...swaps.map(s => parseInt(s.blockTimestamp, 10)));
        cursor = maxTs;

        // Convert and store
        const gnoAddress = CONTRACTS.GNO.toLowerCase();
        const sdaiAddress = CONTRACTS.sDAI.toLowerCase();
        const candles = swapsToCandles(swaps, gnoAddress, sdaiAddress);

        if (candles.length > 0) {
            // Apply current aGNO rate (approximate for historical)
            const agnoRate = await getAGnoRate();
            const adjustedCandles = candles.map(c => ({
                ...c,
                value: c.value * agnoRate,
                open: c.open * agnoRate,
                high: c.high * agnoRate,
                low: c.low * agnoRate,
                close: c.close * agnoRate,
            }));

            db.upsertCandles(poolAddress, adjustedCandles);
        }

        console.log(`[Backfill] Processed ${swaps.length} swaps, cursor at ${new Date(cursor * 1000).toISOString()}`);

        // Rate limit
        await new Promise(r => setTimeout(r, 500));
    }

    console.log(`[Backfill] ✅ Complete. Total swaps processed: ${totalSwaps}`);
}

// ============================================================
// CRON SCHEDULE
// ============================================================

function startCron() {
    // Initialize database
    db.initDatabase();

    console.log('[Cron] Starting cron job scheduler...');

    // Run initial sync
    syncAllPools();

    // Schedule: Every minute
    cron.schedule('*/1 * * * *', () => {
        syncAllPools();
    });

    console.log('[Cron] ✅ Cron job scheduled: every 1 minute');
}

// ============================================================
// EXPORTS / CLI
// ============================================================

module.exports = {
    syncPool,
    syncAllPools,
    backfillPool,
    startCron,
};

// Run directly: node sync/syncCandles.js
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args[0] === 'backfill') {
        db.initDatabase();
        backfillPool('GNO_SDAI', 0).then(() => process.exit(0));
    } else if (args[0] === 'once') {
        db.initDatabase();
        syncAllPools().then(() => process.exit(0));
    } else {
        startCron();
    }
}
