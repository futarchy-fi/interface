/**
 * Balancer V2 Multihop - FIXED sDAI RATE version
 * 
 * Uses the latest USDC/sDAI rate for ALL historical calculations
 * to remove yield noise and show pure GNO price movements.
 * 
 * Usage: node scripts/test-balancer-fixed-sdai.js
 */

const fs = require('fs');
const path = require('path');

const GRAPH_API_KEY = process.env.GRAPH_API_KEY || '1f3de4a47d9dfb2a32e1890f63858fff';
const SUBGRAPH_URL = `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg`;

const HOPS = [
    { name: 'GNO/WXDAI', poolId: '0x8189c4c96826d016a99986394103dfa9ae41e7ee0002000000000000000000aa', tokenIn: '0x9c58bacc331c9aa871afd802db6379a98e80cedb', tokenOut: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d' },
    { name: 'WXDAI/USDC', poolId: '0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f', tokenIn: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d', tokenOut: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83' },
];

// USDC/sDAI is handled separately with fixed rate
const SDAI_HOP = { name: 'USDC/sDAI', poolId: '0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655000000000000000000000066', tokenIn: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83', tokenOut: '0xaf204776c7245bf4147c2612bf6e5972ee483701' };

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

async function getLatestPrice(poolId, tokenIn, tokenOut) {
    const query = `query { swaps(where: { poolId: "${poolId}" }, orderBy: timestamp, orderDirection: desc, first: 1) { tokenIn tokenOut tokenAmountIn tokenAmountOut } }`;
    const data = await querySubgraph(query);
    const swap = data.swaps?.[0];
    if (!swap) return null;
    const amtIn = parseFloat(swap.tokenAmountIn);
    const amtOut = parseFloat(swap.tokenAmountOut);
    if (swap.tokenIn.toLowerCase() === tokenIn.toLowerCase()) return amtOut / amtIn;
    return amtIn / amtOut;
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

        if (!hourlyPrices[hourTs] || swap.timestamp > hourlyPrices[hourTs].ts) {
            hourlyPrices[hourTs] = { close: price, ts: swap.timestamp };
        }
    }
    return Object.fromEntries(Object.entries(hourlyPrices).map(([k, v]) => [k, { close: v.close }]));
}

function combineWithFixedSdai(hopPrices, fixedSdaiRate) {
    const allTimestamps = new Set();
    for (const hop of hopPrices) {
        Object.keys(hop).forEach(ts => allTimestamps.add(ts));
    }

    const combined = [];
    const prevPrices = hopPrices.map(() => 1);

    for (const ts of [...allTimestamps].sort()) {
        for (let i = 0; i < hopPrices.length; i++) {
            if (hopPrices[i][ts]) prevPrices[i] = hopPrices[i][ts].close;
        }
        // Multiply the 2 dynamic hops, then apply fixed sDAI rate
        const dynamicPrice = prevPrices.reduce((a, b) => a * b, 1);
        const composite = dynamicPrice * fixedSdaiRate;

        combined.push({ time: parseInt(ts), value: composite });
    }

    return combined.sort((a, b) => a.time - b.time);
}

async function main() {
    console.log('Balancer V2 Multihop - FIXED sDAI RATE');
    console.log('======================================');

    const hoursBack = 168;
    const now = Math.floor(Date.now() / 1000);
    const fromTs = now - (hoursBack * 3600);

    // Get FIXED sDAI rate (latest)
    console.log('Getting latest USDC/sDAI rate...');
    const fixedSdaiRate = await getLatestPrice(SDAI_HOP.poolId, SDAI_HOP.tokenIn, SDAI_HOP.tokenOut);
    console.log('  FIXED sDAI rate: ' + fixedSdaiRate.toFixed(6));
    console.log('');

    // Fetch swaps for dynamic hops only (GNO/WXDAI, WXDAI/USDC)
    console.log('Fetching swaps for dynamic hops...');
    const swapPromises = HOPS.map(hop => fetchSwaps(hop.poolId, fromTs));
    const swapResults = await Promise.all(swapPromises);
    HOPS.forEach((hop, i) => console.log('  ' + hop.name + ': ' + swapResults[i].length + ' swaps'));

    // Build hourly candles for dynamic hops
    const hopPrices = HOPS.map((hop, i) => calculateHopPrice(swapResults[i], hop.tokenIn, hop.tokenOut));

    // Combine with FIXED sDAI rate
    const candles = combineWithFixedSdai(hopPrices, fixedSdaiRate);
    console.log('');
    console.log('Composite candles: ' + candles.length);

    const output = {
        _meta: {
            source: 'Balancer V2 Subgraph (FIXED sDAI)',
            preset: 'GNO_SDAI',
            description: 'GNO -> WXDAI -> USDC -> sDAI (FIXED sDAI rate)',
            fixedSdaiRate,
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

    const outputPath = path.join(__dirname, 'balancer-chart-fixed-sdai.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    console.log('');
    console.log('Output: ' + outputPath);
    console.log('');
    console.log('FIRST 3 CANDLES:');
    output.candlesReadable.slice(0, 3).forEach(c => console.log('  ' + c.datetime + ' | ' + c.priceFormatted));
    console.log('');
    console.log('LAST 3 CANDLES:');
    output.candlesReadable.slice(-3).forEach(c => console.log('  ' + c.datetime + ' | ' + c.priceFormatted));
    console.log('');
    console.log('Latest: ' + output._meta.latestPrice?.toFixed(4) + ' sDAI per GNO');
}

main().catch(console.error);
