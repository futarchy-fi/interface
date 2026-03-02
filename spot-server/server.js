/**
 * Spot Price Server
 * 
 * GNO/sDAI prices with SQLite caching and cron sync.
 * - Candles cached in SQLite for fast response (~5ms)
 * - Cron job syncs from The Graph every 1 min
 * - Automatic backfill for gaps on startup
 * 
 * Usage:
 *   GET /candles?pool=GNO_SDAI&limit=100
 *   GET /gno-sdai-price
 *   GET /sync-status
 */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

// Database and sync modules
const db = require('./db/database');
const { startCron, syncAllPools, backfillPool } = require('./sync/syncCandles');

const app = express();
const PORT = process.env.PORT || 3456;

// Your Graph API Key
const GRAPH_API_KEY = 'd602eb37aafab6bedd1b4f2e77405e59';

// ============================================================
// CONTRACT ADDRESSES (Gnosis Chain)
// ============================================================
const CONTRACTS = {
    // sDAI (Savings xDAI) - ERC-4626 vault
    sDAI: '0xaf204776c7245bf4147c2612bf6e5972ee483701',
    // WXDAI (Wrapped xDAI)
    WXDAI: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
    // GNO token
    GNO: '0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb',
    // aGNO (wrapped GNO used in Balancer v3 pools)
    aGNO: '0x0000000000000000000000000000000000000000', // Will be filled from rate provider
    // aGNO→GNO Rate Provider (ERC-4626 rate provider)
    // Returns the exchange rate between aGNO and GNO via getRate()
    aGNO_RATE_PROVIDER: '0xbbb4966335677ea24f7b86dc19a423412390e1fb',
};

// Gnosis Chain RPC
const GNOSIS_RPC = 'https://rpc.gnosischain.com';

// ============================================================
// SUBGRAPH ENDPOINTS
// ============================================================
const SUBGRAPH_ENDPOINTS = {
    // Uniswap v3 on Ethereum (for comparison)
    uniswap_v3_ethereum: `https://gateway.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV`,

    // Balancer v2 on Gnosis Chain
    balancer_v2_gnosis: `https://gateway.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDEd64bEudJwJbA4jpY0TdPnNCWgX`,

    // Balancer v3 on Gnosis Chain (has direct GNO/sDAI pool!)
    balancer_v3_gnosis: `https://api.studio.thegraph.com/query/75376/balancer-v3-gnosis/version/latest`,

    // Swapr (Algebra-based) on Gnosis Chain
    swapr_gnosis: `https://gateway.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/D1EktMpWp7Y3dCUFV7W3WPtXPb1zG57oxHVDkAtf1Fao`,
};

// ============================================================
// KNOWN POOLS
// ============================================================
const KNOWN_POOLS = {
    // ⭐ Balancer v3 GNO/sDAI on Gnosis - DIRECT POOL! ($96k TVL)
    // https://balancer.fi/pools/gnosis/v3/0xd1d7fa8871d84d0e77020fc28b7cd5718c446522
    GNO_SDAI: {
        subgraph: 'balancer_v3_gnosis',
        poolAddress: '0xd1d7fa8871d84d0e77020fc28b7cd5718c446522',
        token0Symbol: 'GNO',
        token1Symbol: 'sDAI',
        tvl: '$96,820',
        fee: '0.25%',
        version: 'v3',
    },
    // Balancer v2 GNO/WXDAI on Gnosis (50/50 weighted pool) - fallback
    GNO_WXDAI_BALANCER: {
        subgraph: 'balancer_v2_gnosis',
        poolId: '0x21d4c792ea7e38e0d0819c2011a2b1cb7252bd9900020000000000000000001b',
        token0Symbol: 'GNO',
        token1Symbol: 'WXDAI',
    },
    // Swapr GNO/WXDAI pair
    GNO_WXDAI_SWAPR: {
        subgraph: 'swapr_gnosis',
        pairAddress: '0x5a7e6b90c7d0d9b9c4a89c5d4f2a8b7c6d1e2f0a',
        token0Symbol: 'GNO',
        token1Symbol: 'WXDAI',
    },
    // Synthetic GNO/sDAI (computed via ratio) - fallback method
    GNO_SDAI_SYNTHETIC: {
        synthetic: true,
        basePool: 'GNO_WXDAI_BALANCER',
        description: 'GNO/sDAI computed via sDAI/wxDAI ratio',
    },
    // Uniswap WETH/USDC for testing
    WETH_USDC_UNISWAP: {
        subgraph: 'uniswap_v3_ethereum',
        poolAddress: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
        token0Symbol: 'USDC',
        token1Symbol: 'WETH',
    },
};

// ============================================================
// GRAPHQL QUERIES
// ============================================================
const QUERIES = {
    // Uniswap v3: Pool hour data
    UNISWAP_POOL_HOUR_DATA: `
    query GetPoolHourData($poolAddress: String!, $first: Int!, $skip: Int!) {
      poolHourDatas(
        where: { pool: $poolAddress }
        first: $first
        skip: $skip
        orderBy: periodStartUnix
        orderDirection: desc
      ) {
        periodStartUnix
        open
        high
        low
        close
        volumeUSD
        token0Price
        token1Price
      }
    }
  `,

    // Balancer v2: Pool snapshots (daily)
    BALANCER_POOL_SNAPSHOTS: `
    query GetPoolSnapshots($poolId: String!, $first: Int!) {
      poolSnapshots(
        where: { pool: $poolId }
        first: $first
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        timestamp
        totalShares
        swapVolume
        swapFees
        liquidity
        amounts
      }
    }
  `,

    // Balancer v2: Get pool token prices from swaps
    BALANCER_POOL_SWAPS: `
    query GetPoolSwaps($poolId: String!, $first: Int!) {
      swaps(
        where: { poolId: $poolId }
        first: $first
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        timestamp
        tokenIn
        tokenOut
        tokenAmountIn
        tokenAmountOut
        valueUSD
      }
    }
  `,

    // Balancer v2: Get pool info with tokens
    BALANCER_POOL_INFO: `
    query GetPoolInfo($poolId: ID!) {
      pool(id: $poolId) {
        id
        name
        poolType
        swapFee
        totalLiquidity
        totalSwapVolume
        tokens {
          address
          symbol
          balance
          weight
        }
      }
    }
  `,

    // Balancer v3: Get swaps for a pool (by pool address)
    BALANCER_V3_SWAPS: `
    query GetV3Swaps($poolAddress: String!, $first: Int!) {
      swaps(
        where: { pool: $poolAddress }
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

    // Balancer v3: Get pool info
    BALANCER_V3_POOL: `
    query GetV3Pool($poolAddress: ID!) {
      pool(id: $poolAddress) {
        id
        name
        symbol
        swapFee
        totalLiquidity
        poolTokens {
          address
          symbol
          balance
        }
      }
    }
  `,
};

// ============================================================
// HELPER: Query Subgraph
// ============================================================
async function querySubgraph(endpoint, query, variables = {}) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
}

// ============================================================
// HELPER: Query sDAI Contract via RPC
// ============================================================

/**
 * Get the sDAI→wxDAI conversion ratio by calling previewRedeem(1e18)
 * Returns how many wxDAI you get for 1 sDAI
 */
async function getSdaiRatio() {
    // previewRedeem(uint256 shares) selector: 0x4cdad506
    // Argument: 1e18 (1 sDAI in wei) padded to 32 bytes
    const oneSDai = '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000';
    const data = '0x4cdad506' + oneSDai.slice(2);

    const response = await fetch(GNOSIS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [{
                to: CONTRACTS.sDAI,
                data: data
            }, 'latest']
        }),
    });

    const result = await response.json();

    if (result.error) {
        throw new Error(`RPC error: ${result.error.message}`);
    }

    // Result is hex, convert to decimal and scale by 1e18
    const wxdaiWei = BigInt(result.result);
    const ratio = Number(wxdaiWei) / 1e18;

    return ratio;
}

/**
 * Get the aGNO→GNO conversion rate from the rate provider contract
 * Returns how many GNO you get for 1 aGNO (typically > 1 as aGNO accrues staking rewards)
 * Contract: 0xbbb4966335677ea24f7b86dc19a423412390e1fb
 */
async function getAGnoRate() {
    // getRate() selector: 0x679aefce
    const data = '0x679aefce';

    const response = await fetch(GNOSIS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [{
                to: CONTRACTS.aGNO_RATE_PROVIDER,
                data: data
            }, 'latest']
        }),
    });

    const result = await response.json();

    if (result.error) {
        throw new Error(`RPC error (aGNO rate): ${result.error.message}`);
    }

    // Result is hex, convert to decimal and scale by 1e18
    const rateWei = BigInt(result.result);
    const rate = Number(rateWei) / 1e18;

    return rate;
}

// ============================================================
// HELPER: Calculate GNO price from Balancer swaps
// ============================================================
function calculateGnoPriceFromSwaps(swaps, gnoAddress, wxdaiAddress) {
    if (!swaps || swaps.length === 0) return null;

    // Group by hour
    const hourBuckets = new Map();

    for (const swap of swaps) {
        const ts = parseInt(swap.timestamp, 10);
        const hourKey = Math.floor(ts / 3600) * 3600;

        let gnoAmount = 0;
        let wxdaiAmount = 0;

        const tokenIn = swap.tokenIn.toLowerCase();
        const tokenOut = swap.tokenOut.toLowerCase();
        const amountIn = parseFloat(swap.tokenAmountIn);
        const amountOut = parseFloat(swap.tokenAmountOut);

        // Determine GNO and WXDAI amounts
        if (tokenIn === gnoAddress.toLowerCase()) {
            gnoAmount = amountIn;
            wxdaiAmount = amountOut;
        } else if (tokenOut === gnoAddress.toLowerCase()) {
            gnoAmount = amountOut;
            wxdaiAmount = amountIn;
        }

        if (gnoAmount > 0 && wxdaiAmount > 0) {
            const price = wxdaiAmount / gnoAmount; // WXDAI per GNO

            if (!hourBuckets.has(hourKey)) {
                hourBuckets.set(hourKey, { prices: [], volume: 0 });
            }

            const bucket = hourBuckets.get(hourKey);
            bucket.prices.push(price);
            bucket.volume += parseFloat(swap.valueUSD || 0);
        }
    }

    // Convert to candles
    const candles = [];
    for (const [time, bucket] of hourBuckets) {
        if (bucket.prices.length === 0) continue;

        const prices = bucket.prices;
        candles.push({
            time,
            value: prices[prices.length - 1], // close
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
// HELPER: Adapt Uniswap data
// ============================================================
function adaptUniswapHourDataToCandles(hourData, useToken1Price = true) {
    if (!hourData || !Array.isArray(hourData)) return [];

    return hourData
        .map(h => ({
            time: parseInt(h.periodStartUnix, 10),
            value: parseFloat(useToken1Price ? h.token1Price : h.token0Price),
            open: parseFloat(h.open || h.token1Price),
            high: parseFloat(h.high || h.token1Price),
            low: parseFloat(h.low || h.token1Price),
            close: parseFloat(h.close || h.token1Price),
            volumeUSD: parseFloat(h.volumeUSD || 0),
        }))
        .filter(c => !isNaN(c.time) && !isNaN(c.value) && c.value > 0)
        .sort((a, b) => a.time - b.time);
}

// ============================================================
// HELPER: Calculate GNO/sDAI price from Balancer v3 swaps
// ============================================================
function calculateGnoSdaiPriceFromV3Swaps(swaps) {
    if (!swaps || swaps.length === 0) return [];

    const gnoAddress = CONTRACTS.GNO.toLowerCase();
    const sdaiAddress = CONTRACTS.sDAI.toLowerCase();

    // Group by hour
    const hourBuckets = new Map();

    for (const swap of swaps) {
        // v3 uses blockTimestamp instead of timestamp
        const ts = parseInt(swap.blockTimestamp || swap.timestamp, 10);
        const hourKey = Math.floor(ts / 3600) * 3600;

        let gnoAmount = 0;
        let sdaiAmount = 0;

        const tokenIn = swap.tokenIn.toLowerCase();
        const tokenOut = swap.tokenOut.toLowerCase();
        const amountIn = parseFloat(swap.tokenAmountIn);
        const amountOut = parseFloat(swap.tokenAmountOut);

        // Determine GNO and sDAI amounts
        if (tokenIn === gnoAddress && tokenOut === sdaiAddress) {
            gnoAmount = amountIn;
            sdaiAmount = amountOut;
        } else if (tokenIn === sdaiAddress && tokenOut === gnoAddress) {
            gnoAmount = amountOut;
            sdaiAmount = amountIn;
        }

        if (gnoAmount > 0 && sdaiAmount > 0) {
            const price = sdaiAmount / gnoAmount; // sDAI per GNO

            if (!hourBuckets.has(hourKey)) {
                hourBuckets.set(hourKey, { prices: [], volume: 0 });
            }

            const bucket = hourBuckets.get(hourKey);
            bucket.prices.push(price);
            bucket.volume += parseFloat(swap.valueUSD || 0);
        }
    }

    // Convert to candles
    const candles = [];
    for (const [time, bucket] of hourBuckets) {
        if (bucket.prices.length === 0) continue;

        const prices = bucket.prices;
        candles.push({
            time,
            value: prices[prices.length - 1], // close
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
// EXPRESS MIDDLEWARE
// ============================================================
app.use(cors());
app.use(express.json());

// ============================================================
// ROUTES
// ============================================================

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Spot Price Server - GNO/sDAI with SQLite cache',
        mode: 'cached',
        endpoints: {
            '/candles': 'GET - Candle data (from cache, ~5ms)',
            '/candles-live': 'GET - Candle data (direct from subgraph)',
            '/gno-sdai-price': 'GET - GNO/sDAI price',
            '/sync-status': 'GET - Database sync status',
            '/agno-rate': 'GET - Current aGNO→GNO rate',
            '/sdai-ratio': 'GET - Current sDAI/wxDAI ratio',
            '/known-pools': 'GET - List pools',
        },
    });
});

// List known pools
app.get('/known-pools', (req, res) => {
    res.json(KNOWN_POOLS);
});

/**
 * GET /sync-status
 * Returns database sync status for all pools
 */
app.get('/sync-status', (req, res) => {
    try {
        const statuses = db.getAllSyncStatus();
        const poolAddress = KNOWN_POOLS.GNO_SDAI.poolAddress.toLowerCase();

        const candleCount = db.getCandleCount(poolAddress);
        const latestTs = db.getLatestCandleTimestamp(poolAddress);
        const agnoRate = db.getLatestRate('agno');

        res.json({
            pools: statuses,
            gno_sdai: {
                candleCount,
                latestTimestamp: latestTs,
                latestTime: latestTs ? new Date(latestTs * 1000).toISOString() : null,
                ageSec: latestTs ? Math.floor(Date.now() / 1000) - latestTs : null,
            },
            latestAgnoRate: agnoRate,
            cronInterval: '1 minute',
            fetchedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error('[/sync-status] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /sdai-ratio
 * Returns the current sDAI→wxDAI conversion ratio
 */
app.get('/sdai-ratio', async (req, res) => {
    try {
        const ratio = await getSdaiRatio();

        res.json({
            ratio,
            description: `1 sDAI = ${ratio.toFixed(6)} wxDAI`,
            inverse: 1 / ratio,
            inverseDescription: `1 wxDAI = ${(1 / ratio).toFixed(6)} sDAI`,
            contract: CONTRACTS.sDAI,
            method: 'previewRedeem(1e18)',
            fetchedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error('[/sdai-ratio] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /agno-rate
 * Returns the current aGNO→GNO conversion rate
 * The Balancer v3 pool uses aGNO (interest-bearing GNO), not raw GNO
 */
app.get('/agno-rate', async (req, res) => {
    try {
        const rate = await getAGnoRate();

        res.json({
            rate,
            description: `1 aGNO = ${rate.toFixed(6)} GNO`,
            inverse: 1 / rate,
            inverseDescription: `1 GNO = ${(1 / rate).toFixed(6)} aGNO`,
            contract: CONTRACTS.aGNO_RATE_PROVIDER,
            method: 'getRate()',
            note: 'aGNO is interest-bearing GNO from StakeWise. Rate increases over time as staking rewards accrue.',
            fetchedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error('[/agno-rate] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /gno-wxdai-price
 * Get GNO/WXDAI price from Balancer swaps
 */
app.get('/gno-wxdai-price', async (req, res) => {
    try {
        const { limit = 100 } = req.query;
        const poolId = KNOWN_POOLS.GNO_WXDAI_BALANCER.poolId;
        const endpoint = SUBGRAPH_ENDPOINTS.balancer_v2_gnosis;

        // Get swaps
        const swapData = await querySubgraph(endpoint, QUERIES.BALANCER_POOL_SWAPS, {
            poolId: poolId.toLowerCase(),
            first: Math.min(parseInt(limit, 10) || 100, 1000),
        });

        const candles = calculateGnoPriceFromSwaps(
            swapData.swaps,
            CONTRACTS.GNO,
            CONTRACTS.WXDAI
        );

        const latestPrice = candles.length > 0 ? candles[candles.length - 1].value : null;

        res.json({
            data: candles.map(c => ({ time: c.time, value: c.value })),
            extended: candles,
            latestPrice,
            metadata: {
                pair: 'GNO/WXDAI',
                source: 'Balancer v2 Gnosis',
                poolId,
                count: candles.length,
                fetchedAt: new Date().toISOString(),
            },
        });
    } catch (err) {
        console.error('[/gno-wxdai-price] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /gno-sdai-price
 * Get GNO/sDAI price from Balancer v3 aGNO/sDAI pool
 * IMPORTANT: The pool uses aGNO (not raw GNO), so we apply the aGNO→GNO rate
 * 
 * Formula: GNO/sDAI = (aGNO/sDAI) × (aGNO→GNO rate)
 */
app.get('/gno-sdai-price', async (req, res) => {
    try {
        const { limit = 100, method = 'direct' } = req.query;

        // Direct method: Use Balancer v3 aGNO/sDAI pool + aGNO rate
        if (method === 'direct') {
            // 1. Get aGNO→GNO rate from rate provider
            const agnoRate = await getAGnoRate();

            // 2. Get aGNO/sDAI swaps from Balancer v3
            const poolAddress = KNOWN_POOLS.GNO_SDAI.poolAddress;
            const endpoint = SUBGRAPH_ENDPOINTS.balancer_v3_gnosis;

            const swapData = await querySubgraph(endpoint, QUERIES.BALANCER_V3_SWAPS, {
                poolAddress: poolAddress.toLowerCase(),
                first: Math.min(parseInt(limit, 10) || 100, 1000),
            });

            // 3. Calculate aGNO/sDAI prices from swaps
            const agnoSdaiCandles = calculateGnoSdaiPriceFromV3Swaps(swapData.swaps);

            // 4. Apply aGNO rate to get true GNO/sDAI prices
            // GNO/sDAI = aGNO/sDAI × agnoRate (since 1 aGNO = agnoRate GNO)
            const gnoSdaiCandles = agnoSdaiCandles.map(c => ({
                ...c,
                value: c.value * agnoRate,
                open: c.open * agnoRate,
                high: c.high * agnoRate,
                low: c.low * agnoRate,
                close: c.close * agnoRate,
            }));

            const latestPrice = gnoSdaiCandles.length > 0 ? gnoSdaiCandles[gnoSdaiCandles.length - 1].value : null;

            return res.json({
                // Adapter-compatible format
                data: gnoSdaiCandles.map(c => ({ time: c.time, value: c.value })),
                extended: gnoSdaiCandles,
                latestPrice,
                metadata: {
                    pair: 'GNO/sDAI',
                    source: 'Balancer v3 Gnosis (aGNO/sDAI × aGNO rate)',
                    poolAddress,
                    poolUrl: `https://balancer.fi/pools/gnosis/v3/${poolAddress}`,
                    agnoRate,
                    agnoRateDescription: `1 aGNO = ${agnoRate.toFixed(6)} GNO`,
                    tvl: KNOWN_POOLS.GNO_SDAI.tvl,
                    count: gnoSdaiCandles.length,
                    fetchedAt: new Date().toISOString(),
                },
            });
        }

        // Fallback: Synthetic method via sDAI ratio
        const sdaiRatio = await getSdaiRatio();

        const poolId = KNOWN_POOLS.GNO_WXDAI_BALANCER.poolId;
        const endpoint = SUBGRAPH_ENDPOINTS.balancer_v2_gnosis;

        const swapData = await querySubgraph(endpoint, QUERIES.BALANCER_POOL_SWAPS, {
            poolId: poolId.toLowerCase(),
            first: Math.min(parseInt(limit, 10) || 100, 1000),
        });

        const wxdaiCandles = calculateGnoPriceFromSwaps(
            swapData.swaps,
            CONTRACTS.GNO,
            CONTRACTS.WXDAI
        );

        const sdaiCandles = wxdaiCandles.map(c => ({
            time: c.time,
            value: c.value / sdaiRatio,
            open: c.open / sdaiRatio,
            high: c.high / sdaiRatio,
            low: c.low / sdaiRatio,
            close: c.close / sdaiRatio,
            volumeUSD: c.volumeUSD,
        }));

        const latestPrice = sdaiCandles.length > 0 ? sdaiCandles[sdaiCandles.length - 1].value : null;

        res.json({
            data: sdaiCandles.map(c => ({ time: c.time, value: c.value })),
            extended: sdaiCandles,
            latestPrice,
            metadata: {
                pair: 'GNO/sDAI',
                source: 'Balancer v2 Gnosis + sDAI ratio (SYNTHETIC)',
                sdaiRatio,
                sdaiRatioDescription: `1 sDAI = ${sdaiRatio.toFixed(6)} wxDAI`,
                poolId: KNOWN_POOLS.GNO_WXDAI_BALANCER.poolId,
                count: sdaiCandles.length,
                fetchedAt: new Date().toISOString(),
            },
        });
    } catch (err) {
        console.error('[/gno-sdai-price] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /candles
 * Main endpoint - reads from SQLite cache for fast response (~5ms)
 * Falls back to live query if cache is empty
 */
app.get('/candles', async (req, res) => {
    try {
        const { pool, limit = 500, source = 'cache' } = req.query;

        // Handle GNO_SDAI from cache
        if (pool === 'GNO_SDAI') {
            const poolAddress = KNOWN_POOLS.GNO_SDAI.poolAddress.toLowerCase();

            // Try cache first
            const cachedCandles = db.getCandles(poolAddress, parseInt(limit, 10) || 500);

            if (cachedCandles.length > 0 && source === 'cache') {
                const latestTs = cachedCandles[cachedCandles.length - 1]?.time || 0;
                const ageSec = Math.floor(Date.now() / 1000) - latestTs;

                return res.json({
                    data: cachedCandles.map(c => ({ time: c.time, value: c.close })),
                    source: 'cache',
                    responseTime: '~5ms',
                    metadata: {
                        pool: 'GNO_SDAI',
                        count: cachedCandles.length,
                        latestTimestamp: latestTs,
                        ageSec,
                        fetchedAt: new Date().toISOString(),
                    },
                });
            }

            // Fallback to live query (cache miss or source=live)
            console.log('[/candles] Cache miss, querying live...');
            const agnoRate = await getAGnoRate();
            const endpoint = SUBGRAPH_ENDPOINTS.balancer_v3_gnosis;

            const swapData = await querySubgraph(endpoint, QUERIES.BALANCER_V3_SWAPS, {
                poolAddress: poolAddress,
                first: Math.min(parseInt(limit, 10) || 100, 1000),
            });

            const agnoCandles = calculateGnoSdaiPriceFromV3Swaps(swapData.swaps);
            const candles = agnoCandles.map(c => ({
                time: c.time,
                value: c.value * agnoRate,
            }));

            return res.json({
                data: candles,
                source: 'live',
                metadata: {
                    pool: 'GNO_SDAI',
                    agnoRate,
                    count: candles.length,
                    fetchedAt: new Date().toISOString(),
                },
            });
        }

        // Handle GNO_WXDAI_BALANCER
        if (pool === 'GNO_WXDAI_BALANCER') {
            const poolId = KNOWN_POOLS.GNO_WXDAI_BALANCER.poolId;
            const endpoint = SUBGRAPH_ENDPOINTS.balancer_v2_gnosis;

            const swapData = await querySubgraph(endpoint, QUERIES.BALANCER_POOL_SWAPS, {
                poolId: poolId.toLowerCase(),
                first: Math.min(parseInt(limit, 10) || 100, 1000),
            });

            const candles = calculateGnoPriceFromSwaps(
                swapData.swaps,
                CONTRACTS.GNO,
                CONTRACTS.WXDAI
            );

            return res.json({
                data: candles.map(c => ({ time: c.time, value: c.value })),
                extended: candles,
                metadata: {
                    pool: 'GNO_WXDAI_BALANCER',
                    count: candles.length,
                    fetchedAt: new Date().toISOString(),
                },
            });
        }

        // Handle Uniswap pools (original logic)
        let targetPool = poolAddress;
        let targetSubgraph = subgraph;
        let poolMeta = null;

        if (pool && KNOWN_POOLS[pool]) {
            const known = KNOWN_POOLS[pool];
            targetPool = known.poolAddress || known.poolId;
            targetSubgraph = known.subgraph;
            poolMeta = known;
        }

        if (!targetPool) {
            return res.status(400).json({
                error: 'Missing pool. Provide "pool" (known pool key) or "poolAddress".',
                knownPools: Object.keys(KNOWN_POOLS),
            });
        }

        const endpoint = SUBGRAPH_ENDPOINTS[targetSubgraph];
        if (!endpoint) {
            return res.status(400).json({
                error: `Unknown subgraph: ${targetSubgraph}`,
                availableSubgraphs: Object.keys(SUBGRAPH_ENDPOINTS),
            });
        }

        const limitNum = Math.min(parseInt(limit, 10) || 100, 1000);

        const data = await querySubgraph(endpoint, QUERIES.UNISWAP_POOL_HOUR_DATA, {
            poolAddress: targetPool.toLowerCase(),
            first: limitNum,
            skip: 0,
        });

        const candles = adaptUniswapHourDataToCandles(
            data.poolHourDatas,
            priceField === 'token1Price'
        );

        res.json({
            data: candles.map(c => ({ time: c.time, value: c.value })),
            extended: candles,
            metadata: {
                pool: poolMeta || { poolAddress: targetPool },
                subgraph: targetSubgraph,
                count: candles.length,
                priceField,
                fetchedAt: new Date().toISOString(),
            },
        });
    } catch (err) {
        console.error('[/candles] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /pool-info
 * Get pool metadata from Balancer
 */
app.get('/pool-info', async (req, res) => {
    try {
        const { pool } = req.query;

        if (pool === 'GNO_WXDAI_BALANCER' || pool === 'GNO_SDAI') {
            const poolId = KNOWN_POOLS.GNO_WXDAI_BALANCER.poolId;
            const endpoint = SUBGRAPH_ENDPOINTS.balancer_v2_gnosis;

            const data = await querySubgraph(endpoint, QUERIES.BALANCER_POOL_INFO, {
                poolId: poolId.toLowerCase(),
            });

            if (pool === 'GNO_SDAI') {
                const sdaiRatio = await getSdaiRatio();
                data.sdaiRatio = sdaiRatio;
                data.synthetic = true;
            }

            return res.json(data);
        }

        res.status(400).json({ error: 'Use pool=GNO_WXDAI_BALANCER or pool=GNO_SDAI' });
    } catch (err) {
        console.error('[/pool-info] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, async () => {
    console.log(`\n🚀 Spot Price Server running at http://localhost:${PORT}`);
    console.log(`\nMode: CACHED (SQLite + Cron sync)`);
    console.log(`\nEndpoints:`);
    console.log(`  GET /                      - Server info`);
    console.log(`  GET /candles?pool=GNO_SDAI - Candles from cache (~5ms)`);
    console.log(`  GET /gno-sdai-price        - GNO/sDAI price`);
    console.log(`  GET /sync-status           - Database sync status`);
    console.log(`  GET /agno-rate             - Current aGNO→GNO rate`);

    // Initialize database
    console.log(`\n[Startup] Initializing database...`);
    db.initDatabase();

    // Check if we need initial sync
    const poolAddress = KNOWN_POOLS.GNO_SDAI.poolAddress.toLowerCase();
    const candleCount = db.getCandleCount(poolAddress);

    if (candleCount === 0) {
        console.log(`[Startup] No candles in cache. Running initial backfill...`);
        await backfillPool('GNO_SDAI', 0);
    } else {
        console.log(`[Startup] Cache has ${candleCount} candles.`);

        // Check for gaps
        const latestTs = db.getLatestCandleTimestamp(poolAddress);
        const gapHours = (Date.now() / 1000 - latestTs) / 3600;

        if (gapHours > 1) {
            console.log(`[Startup] Gap detected (${gapHours.toFixed(1)}h). Running backfill...`);
            await backfillPool('GNO_SDAI', latestTs);
        }
    }

    // Start cron job
    startCron();

    console.log(`\n✅ Server ready!`);
});
