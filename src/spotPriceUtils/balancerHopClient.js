'use client';

/**
 * Balancer Multi-Hop Spot Price Client
 * 
 * Fetches composite prices from Balancer V2 pools via multi-hop swaps.
 * Example: GNO → WXDAI → USDC → sDAI
 * 
 * Usage:
 *   import { fetchBalancerHopCandles } from '@/spotPriceUtils/balancerHopClient';
 *   const result = await fetchBalancerHopCandles('multihop::GNO_SDAI-hour-500-xdai');
 */

// ==============================================================
// CONFIG
// ==============================================================

const GRAPH_API_KEY = '1f3de4a47d9dfb2a32e1890f63858fff';

const SUBGRAPH_URLS = {
    xdai: `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg`,
    gnosis: `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg`,
};

// Preset hop configurations
const PRESETS = {
    'GNO_SDAI': {
        description: 'GNO → WXDAI → USDC → sDAI (3-hop)',
        hops: [
            {
                name: 'GNO/WXDAI',
                poolId: '0x8189c4c96826d016a99986394103dfa9ae41e7ee0002000000000000000000aa',
                tokenIn: '0x9c58bacc331c9aa871afd802db6379a98e80cedb',  // GNO
                tokenOut: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d'  // WXDAI
            },
            {
                name: 'WXDAI/USDC',
                poolId: '0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f',
                tokenIn: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d',  // WXDAI
                tokenOut: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83'  // USDC
            },
            {
                name: 'USDC/sDAI',
                poolId: '0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655000000000000000000000066',
                tokenIn: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83',  // USDC
                tokenOut: '0xaf204776c7245bf4147c2612bf6e5972ee483701'  // sDAI
            }
        ]
    }
};

// ==============================================================
// SUBGRAPH QUERIES
// ==============================================================

async function querySubgraph(endpoint, query, variables = {}) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.status}`);
    }

    const result = await response.json();
    if (result.errors) {
        throw new Error(result.errors[0].message);
    }
    return result.data;
}

async function getPoolSwaps(endpoint, poolId, fromTimestamp) {
    const query = `
        query getSwaps($poolId: String!, $from: Int!) {
            swaps(
                where: { poolId: $poolId, timestamp_gte: $from }
                orderBy: timestamp
                orderDirection: asc
                first: 1000
            ) {
                timestamp
                tokenIn
                tokenOut
                tokenAmountIn
                tokenAmountOut
            }
        }
    `;
    return querySubgraph(endpoint, query, { poolId, from: fromTimestamp });
}

// ==============================================================
// PRICE CALCULATION
// ==============================================================

/**
 * Calculate hourly OHLC prices for a single hop
 */
function calculateHopPrice(swaps, tokenIn, tokenOut) {
    const hourlyPrices = {};

    for (const swap of swaps) {
        const hourTs = Math.floor(swap.timestamp / 3600) * 3600;
        const amtIn = parseFloat(swap.tokenAmountIn);
        const amtOut = parseFloat(swap.tokenAmountOut);

        if (amtIn === 0 || amtOut === 0) continue;

        // Calculate price based on swap direction
        let price;
        if (swap.tokenIn.toLowerCase() === tokenIn.toLowerCase()) {
            price = amtOut / amtIn; // tokenIn → tokenOut
        } else if (swap.tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
            price = amtIn / amtOut; // tokenOut → tokenIn (inverse)
        } else {
            continue;
        }

        if (!hourlyPrices[hourTs]) {
            hourlyPrices[hourTs] = { prices: [], first: null, last: null };
        }
        hourlyPrices[hourTs].prices.push(price);
        if (!hourlyPrices[hourTs].first) hourlyPrices[hourTs].first = price;
        hourlyPrices[hourTs].last = price;
    }

    // Build OHLC for each hour
    const ohlc = {};
    for (const [ts, data] of Object.entries(hourlyPrices)) {
        if (data.prices.length === 0) continue;
        ohlc[ts] = {
            open: data.first,
            high: Math.max(...data.prices),
            low: Math.min(...data.prices),
            close: data.last
        };
    }
    return ohlc;
}

/**
 * Combine multiple hop prices into a composite price
 * Multiplies the prices from each hop for each timestamp
 */
function combineHopPrices(hopPrices) {
    // Get all unique timestamps across all hops
    const allTimestamps = new Set();
    for (const hop of hopPrices) {
        Object.keys(hop).forEach(ts => allTimestamps.add(ts));
    }

    const combined = [];
    const prevPrices = hopPrices.map(() => 1); // Default to 1 for each hop

    for (const ts of [...allTimestamps].sort()) {
        // Get price for each hop (or use previous)
        const currentPrices = hopPrices.map((hop, i) => {
            if (hop[ts]) {
                prevPrices[i] = hop[ts].close;
                return hop[ts];
            }
            return { open: prevPrices[i], high: prevPrices[i], low: prevPrices[i], close: prevPrices[i] };
        });

        // Multiply all hop prices
        const open = currentPrices.reduce((acc, p) => acc * p.open, 1);
        const high = currentPrices.reduce((acc, p) => acc * p.high, 1);
        const low = currentPrices.reduce((acc, p) => acc * p.low, 1);
        const close = currentPrices.reduce((acc, p) => acc * p.close, 1);

        combined.push({
            time: parseInt(ts),
            value: close, // Use close for line chart format (same as spotClient)
            open,
            high: Math.max(open, high, close),
            low: Math.min(open, low, close),
            close
        });
    }

    return combined.sort((a, b) => a.time - b.time);
}

// ==============================================================
// CONFIG PARSING
// ==============================================================

/**
 * Parse multihop config string:
 *   multihop::PRESET-interval-limit-network
 *   multihop::GNO_SDAI-hour-500-xdai
 */
function parseMultihopConfig(input) {
    if (!input || !input.startsWith('multihop::')) {
        return null;
    }

    // Remove prefix
    const configPart = input.replace('multihop::', '');
    const parts = configPart.split('-');

    const presetName = parts[0];
    const interval = parts[1] || 'hour';
    const limit = parseInt(parts[2] || '500');
    const network = parts[3] || 'xdai';

    // Calculate time range based on limit (hours)
    const hoursToFetch = limit;

    return {
        presetName,
        preset: PRESETS[presetName] || null,
        interval,
        limit,
        network,
        hoursToFetch
    };
}

// ==============================================================
// MAIN EXPORT
// ==============================================================

/**
 * Fetch composite spot price candles from Balancer multi-hop pools
 * 
 * @param {string} configString - "multihop::PRESET-interval-limit-network"
 * @returns {Promise<{candles, price, rate, pool, error}>}
 */
export async function fetchBalancerHopCandles(configString, closeTimestamp = null) {
    try {
        const config = parseMultihopConfig(configString);
        if (!config) {
            return { candles: [], price: null, rate: null, pool: null, error: 'Invalid config' };
        }

        if (!config.preset) {
            return { candles: [], price: null, rate: null, pool: null, error: `Unknown preset: ${config.presetName}` };
        }

        console.log('[balancerHopClient] Config:', config);
        console.log('[balancerHopClient] Preset:', config.preset.description);

        const endpoint = SUBGRAPH_URLS[config.network] || SUBGRAPH_URLS.xdai;
        // Use closeTimestamp if available to fetch historical data, otherwise use current time
        const endTime = (closeTimestamp && typeof closeTimestamp === 'number') ? closeTimestamp : Math.floor(Date.now() / 1000);
        const fromTimestamp = endTime - (config.hoursToFetch * 60 * 60);

        // Fetch swaps for all hops in parallel
        const hops = config.preset.hops;
        const swapPromises = hops.map(hop => getPoolSwaps(endpoint, hop.poolId, fromTimestamp));
        const swapResults = await Promise.all(swapPromises);

        console.log('[balancerHopClient] Swap counts:', swapResults.map((r, i) => `${hops[i].name}: ${r.swaps?.length || 0}`).join(', '));

        // Calculate hourly prices for each hop
        const hopPrices = hops.map((hop, i) =>
            calculateHopPrice(swapResults[i].swaps || [], hop.tokenIn, hop.tokenOut)
        );

        // Combine into composite price
        let candles = combineHopPrices(hopPrices);

        if (closeTimestamp && typeof closeTimestamp === 'number') {
            candles = candles.filter(c => c.time <= closeTimestamp);
            console.log(`[balancerHopClient] Filtered down to ${candles.length} candles using closeTimestamp ${closeTimestamp}`);
        }

        console.log('[balancerHopClient] Built', candles.length, 'composite candles');

        if (candles.length === 0) {
            return {
                candles: [],
                price: null,
                rate: null,
                pool: { name: config.preset.description, hops: hops.map(h => h.name) },
                error: 'No swap data found'
            };
        }

        const latestPrice = candles[candles.length - 1].value;

        return {
            candles,
            price: latestPrice,
            rate: null, // No rate provider for Balancer hops
            pool: {
                name: config.preset.description,
                hops: hops.map(h => h.name),
                network: config.network
            },
            error: null
        };

    } catch (e) {
        console.error('[balancerHopClient] Error:', e);
        return { candles: [], price: null, rate: null, pool: null, error: e.message };
    }
}

export default fetchBalancerHopCandles;
