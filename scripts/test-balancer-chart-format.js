/**
 * Balancer V2 Multihop - SubgraphChart Format (FIXED v3)
 * 
 * FIX: Use combineHopPrices logic from balancerHopClient.js which properly
 * initializes with 1 and only updates when we have actual swap data.
 * 
 * Usage: node scripts/test-balancer-chart-format.js
 */

const fs = require('fs');
const path = require('path');

const GRAPH_API_KEY = process.env.GRAPH_API_KEY || '1f3de4a47d9dfb2a32e1890f63858fff';
const SUBGRAPH_URL = `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg`;

const HOPS = [
    { name: 'GNO/WXDAI', poolId: '0x8189c4c96826d016a99986394103dfa9ae41e7ee0002000000000000000000aa', tokenIn: '0x9c58bacc331c9aa871afd802db6379a98e80cedb', tokenOut: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d' },
    { name: 'WXDAI/USDC', poolId: '0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f', tokenIn: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d', tokenOut: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83' },
    { name: 'USDC/sDAI', poolId: '0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655000000000000000000000066', tokenIn: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83', tokenOut: '0xaf204776c7245bf4147c2612bf6e5972ee483701' },
];

async function querySubgraph(query, variables = {}) {
    const response = await fetch(SUBGRAPH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
    const result = await response.json();
    if (result.errors) throw new Error(result.errors[0].message);
    return result.data;
}

async function fetchSwaps(poolId, fromTimestamp, limit = 1000) {
    const query = `query GetSwaps($poolId: String!, $from: Int!, $limit: Int!) { swaps(where: { poolId: $poolId, timestamp_gte: $from }, orderBy: timestamp, orderDirection: asc, first: $limit) { timestamp tokenIn tokenOut tokenAmountIn tokenAmountOut } }`;
    const data = await querySubgraph(query, { poolId, from: fromTimestamp, limit });
    return data.swaps || [];
}

function calculateHopPrice(swaps, tokenIn, tokenOut) {
    const hourlyPrices = {};

    for (const swap of swaps) {
        const hourTs = Math.floor(swap.timestamp / 3600) * 3600;
        const amtIn = parseFloat(swap.tokenAmountIn);
        const amtOut = parseFloat(swap.tokenAmountOut);

        if (amtIn === 0 || amtOut === 0) continue;

        let price;
        if (swap.tokenIn.toLowerCase() === tokenIn.toLowerCase()) {
            price = amtOut / amtIn;
        } else if (swap.tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
            price = amtIn / amtOut;
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

    const ohlc = {};
    for (const [ts, data] of Object.entries(hourlyPrices)) {
        if (data.prices.length === 0) continue;
        ohlc[ts] = { close: data.last };
    }
    return ohlc;
}

/**
 * Combine hop prices - EXACTLY like balancerHopClient.js
 */
function combineHopPrices(hopPrices) {
    const allTimestamps = new Set();
    for (const hop of hopPrices) {
        Object.keys(hop).forEach(ts => allTimestamps.add(ts));
    }

    const combined = [];
    const prevPrices = hopPrices.map(() => 1);

    for (const ts of [...allTimestamps].sort()) {
        const currentPrices = hopPrices.map((hop, i) => {
            if (hop[ts]) {
                prevPrices[i] = hop[ts].close;
                return hop[ts];
            }
            return { close: prevPrices[i] };
        });

        const close = currentPrices.reduce((acc, p) => acc * p.close, 1);

        combined.push({
            time: parseInt(ts),
            value: close,
        });
    }

    return combined.sort((a, b) => a.time - b.time);
}

async function main() {
    console.log('Fetching Balancer V2 multihop candles (FIXED v3)...');

    const hoursBack = 168;
    const now = Math.floor(Date.now() / 1000);
    const fromTs = now - (hoursBack * 3600);

    // Fetch swaps
    console.log('Fetching swaps...');
    const swapPromises = HOPS.map(hop => fetchSwaps(hop.poolId, fromTs));
    const swapResults = await Promise.all(swapPromises);
    HOPS.forEach((hop, i) => console.log('  ' + hop.name + ': ' + swapResults[i].length + ' swaps'));

    // Build hourly prices per hop
    console.log('');
    console.log('Building hourly candles...');
    const hopPrices = HOPS.map((hop, i) => {
        const prices = calculateHopPrice(swapResults[i], hop.tokenIn, hop.tokenOut);
        console.log('  ' + hop.name + ': ' + Object.keys(prices).length + ' hours with data');
        return prices;
    });

    // Combine using the same logic as balancerHopClient.js
    const candles = combineHopPrices(hopPrices);
    console.log('');
    console.log('Composite candles: ' + candles.length);

    const output = {
        _meta: {
            source: 'Balancer V2 Subgraph',
            preset: 'GNO_SDAI',
            description: 'GNO -> WXDAI -> USDC -> sDAI (3-hop)',
            hoursBack,
            generatedAt: new Date().toISOString(),
            candleCount: candles.length,
            latestPrice: candles[candles.length - 1]?.value,
        },
        candles,
        candlesReadable: candles.map(c => ({
            time: c.time,
            datetime: new Date(c.time * 1000).toISOString(),
            value: c.value,
            priceFormatted: c.value.toFixed(4) + ' sDAI'
        }))
    };

    const outputPath = path.join(__dirname, 'balancer-chart-candles.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    console.log('');
    console.log('Output: ' + outputPath);
    console.log('');
    console.log('LAST 5 CANDLES:');
    output.candlesReadable.slice(-5).forEach(c => console.log('  ' + c.datetime + ' | ' + c.priceFormatted));
    console.log('');
    console.log('Latest: ' + output._meta.latestPrice?.toFixed(4) + ' sDAI per GNO');
}

main().catch(console.error);
