/**
 * Test Balancer V2 Multihop Composite Price Calculator
 * 
 * Fetches swap data directly from Balancer V2 subgraph and computes
 * composite GNO/sDAI price through the 3-hop route:
 *   GNO -> WXDAI -> USDC -> sDAI
 * 
 * Usage: node scripts/test-balancer-multihop.js
 * Output: scripts/test-balancer-output.json
 */

const fs = require('fs');
const path = require('path');

const GRAPH_API_KEY = process.env.GRAPH_API_KEY || '1f3de4a47d9dfb2a32e1890f63858fff';

const SUBGRAPH_URL = `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg`;

// ============================================================
// PRESET: GNO -> WXDAI -> USDC -> sDAI (3-hop)
// ============================================================
const HOPS = [
    {
        name: 'GNO/WXDAI',
        poolId: '0x8189c4c96826d016a99986394103dfa9ae41e7ee0002000000000000000000aa',
        tokenIn: '0x9c58bacc331c9aa871afd802db6379a98e80cedb',   // GNO
        tokenOut: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d',  // WXDAI
    },
    {
        name: 'WXDAI/USDC',
        poolId: '0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f',
        tokenIn: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d',   // WXDAI
        tokenOut: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83',  // USDC
    },
    {
        name: 'USDC/sDAI',
        poolId: '0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655000000000000000000000066',
        tokenIn: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83',   // USDC
        tokenOut: '0xaf204776c7245bf4147c2612bf6e5972ee483701',  // sDAI
    }
];

// ============================================================
// SUBGRAPH QUERY
// ============================================================
async function querySubgraph(query, variables = {}) {
    const response = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
    });

    const result = await response.json();

    if (result.errors) {
        throw new Error(`Subgraph error: ${result.errors[0].message}`);
    }

    return result.data;
}

async function fetchSwaps(poolId, fromTimestamp, limit = 1000) {
    const query = `
        query GetSwaps($poolId: String!, $from: Int!, $limit: Int!) {
            swaps(
                where: { poolId: $poolId, timestamp_gte: $from }
                orderBy: timestamp
                orderDirection: asc
                first: $limit
            ) {
                id
                timestamp
                tokenIn
                tokenOut
                tokenAmountIn
                tokenAmountOut
            }
        }
    `;

    const data = await querySubgraph(query, { poolId, from: fromTimestamp, limit });
    return data.swaps || [];
}

// ============================================================
// PRICE CALCULATION
// ============================================================

function calculateSwapPrice(swap, tokenIn, tokenOut) {
    const amtIn = parseFloat(swap.tokenAmountIn);
    const amtOut = parseFloat(swap.tokenAmountOut);

    if (amtIn === 0 || amtOut === 0) return null;

    if (swap.tokenIn.toLowerCase() === tokenIn.toLowerCase()) {
        return amtOut / amtIn;
    }
    if (swap.tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
        return amtIn / amtOut;
    }

    return null;
}

function buildHopCandles(swaps, tokenIn, tokenOut) {
    const hourlyData = {};

    for (const swap of swaps) {
        const price = calculateSwapPrice(swap, tokenIn, tokenOut);
        if (price === null) continue;

        const hourTs = Math.floor(swap.timestamp / 3600) * 3600;

        if (!hourlyData[hourTs]) {
            hourlyData[hourTs] = {
                open: price,
                high: price,
                low: price,
                close: price,
                swapCount: 1,
                firstTs: swap.timestamp,
                lastTs: swap.timestamp
            };
        } else {
            const c = hourlyData[hourTs];
            if (swap.timestamp < c.firstTs) {
                c.open = price;
                c.firstTs = swap.timestamp;
            }
            if (swap.timestamp > c.lastTs) {
                c.close = price;
                c.lastTs = swap.timestamp;
            }
            c.high = Math.max(c.high, price);
            c.low = Math.min(c.low, price);
            c.swapCount++;
        }
    }

    return hourlyData;
}

function combineHopCandles(hopCandlesArray) {
    const allTimestamps = new Set();
    for (const hopCandles of hopCandlesArray) {
        Object.keys(hopCandles).forEach(ts => allTimestamps.add(parseInt(ts)));
    }

    const sortedTimestamps = [...allTimestamps].sort((a, b) => a - b);
    const lastPrices = hopCandlesArray.map(() => ({ close: 1 }));
    const compositeCandles = [];

    for (const ts of sortedTimestamps) {
        let compositeClose = 1;
        let totalSwaps = 0;
        const hopPricesThisHour = [];

        for (let i = 0; i < hopCandlesArray.length; i++) {
            const hopCandle = hopCandlesArray[i][ts];
            if (hopCandle) {
                lastPrices[i] = hopCandle;
                compositeClose *= hopCandle.close;
                totalSwaps += hopCandle.swapCount || 0;
                hopPricesThisHour.push(hopCandle.close);
            } else {
                compositeClose *= lastPrices[i].close;
                hopPricesThisHour.push(lastPrices[i].close);
            }
        }

        compositeCandles.push({
            time: ts,
            timeHuman: new Date(ts * 1000).toISOString(),
            close: compositeClose,
            swapCount: totalSwaps,
            hopPrices: hopPricesThisHour
        });
    }

    return compositeCandles;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
    const output = { log: [], result: null };
    const log = (msg) => { output.log.push(msg); console.log(msg); };

    log('Balancer V2 Multihop Composite Price Calculator');
    log('================================================');

    const hoursBack = 24;
    const now = Math.floor(Date.now() / 1000);
    const fromTimestamp = now - (hoursBack * 60 * 60);

    log('Time range: ' + new Date(fromTimestamp * 1000).toISOString() + ' to now');
    log('Subgraph: Balancer V2 Gnosis');
    log('');
    log('Fetching swaps from subgraph...');

    const swapPromises = HOPS.map(hop => fetchSwaps(hop.poolId, fromTimestamp));
    const swapResults = await Promise.all(swapPromises);

    log('');
    log('Swaps fetched:');
    HOPS.forEach((hop, i) => {
        log('  ' + hop.name + ': ' + swapResults[i].length + ' swaps');
    });

    log('');
    log('Building hourly candles per hop...');

    const hopCandlesArray = HOPS.map((hop, i) => {
        const candles = buildHopCandles(swapResults[i], hop.tokenIn, hop.tokenOut);
        const hourCount = Object.keys(candles).length;
        log('  ' + hop.name + ': ' + hourCount + ' hourly candles');
        return candles;
    });

    log('');
    log('Computing composite GNO/sDAI price...');
    const compositeCandles = combineHopCandles(hopCandlesArray);
    log('Total composite candles: ' + compositeCandles.length);

    const last10 = compositeCandles.slice(-10);

    log('');
    log('LAST 10 HOURLY CANDLES:');
    log('Time (UTC)              | GNO/sDAI   | Swaps');
    log('----------------------- | ---------- | -----');

    for (const c of last10) {
        const timeStr = c.timeHuman.replace('T', ' ').replace('.000Z', '');
        log(timeStr + ' | ' + c.close.toFixed(4).padStart(10) + ' | ' + c.swapCount);
    }

    if (compositeCandles.length > 0) {
        const latest = compositeCandles[compositeCandles.length - 1];
        log('');
        log('================================================');
        log('LATEST GNO/sDAI PRICE: ' + latest.close.toFixed(4) + ' sDAI per GNO');
        log('  at: ' + latest.timeHuman);
        log('  Hop breakdown:');
        log('    GNO/WXDAI:  ' + (latest.hopPrices[0]?.toFixed(6) || 'N/A'));
        log('    WXDAI/USDC: ' + (latest.hopPrices[1]?.toFixed(6) || 'N/A'));
        log('    USDC/sDAI:  ' + (latest.hopPrices[2]?.toFixed(6) || 'N/A'));
        log('================================================');

        output.result = {
            latestPrice: latest.close,
            timestamp: latest.timeHuman,
            hopPrices: {
                'GNO_WXDAI': latest.hopPrices[0],
                'WXDAI_USDC': latest.hopPrices[1],
                'USDC_sDAI': latest.hopPrices[2]
            },
            last10Candles: last10
        };
    }

    // Write to JSON file
    const outputPath = path.join(__dirname, 'test-balancer-output.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    log('');
    log('Output written to: ' + outputPath);
}

main().catch(console.error);
