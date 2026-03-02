/**
 * Test script for multihop spot price
 * Run: node scripts/test-multihop.js
 */

const fetch = require('node-fetch');

const GRAPH_API_KEY = '1f3de4a47d9dfb2a32e1890f63858fff';
const SUBGRAPH_URL = `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg`;

const HOPS = [
    {
        name: 'GNO/WXDAI',
        poolId: '0x8189c4c96826d016a99986394103dfa9ae41e7ee0002000000000000000000aa',
        tokenIn: '0x9c58bacc331c9aa871afd802db6379a98e80cedb',
        tokenOut: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d'
    },
    {
        name: 'WXDAI/USDC',
        poolId: '0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f',
        tokenIn: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d',
        tokenOut: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83'
    },
    {
        name: 'USDC/sDAI',
        poolId: '0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655000000000000000000000066',
        tokenIn: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83',
        tokenOut: '0xaf204776c7245bf4147c2612bf6e5972ee483701'
    }
];

async function querySubgraph(query, variables) {
    const response = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
    });
    const result = await response.json();
    if (result.errors) throw new Error(result.errors[0].message);
    return result.data;
}

async function getPoolSwaps(poolId, fromTimestamp) {
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
    return querySubgraph(query, { poolId, from: fromTimestamp });
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
        ohlc[ts] = { open: data.first, high: Math.max(...data.prices), low: Math.min(...data.prices), close: data.last };
    }
    return ohlc;
}

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
            return { open: prevPrices[i], high: prevPrices[i], low: prevPrices[i], close: prevPrices[i] };
        });

        const close = currentPrices.reduce((acc, p) => acc * p.close, 1);
        combined.push({ time: parseInt(ts), value: close });
    }

    return combined.sort((a, b) => a.time - b.time);
}

async function main() {
    console.log('🔍 Testing Multihop GNO/sDAI Price Fetch');
    console.log('='.repeat(60));

    const now = Math.floor(Date.now() / 1000);
    const hoursToFetch = 72; // Last 3 days
    const fromTimestamp = now - (hoursToFetch * 60 * 60);

    console.log(`\n📅 Time range: last ${hoursToFetch} hours`);
    console.log(`   From: ${new Date(fromTimestamp * 1000).toISOString()}`);
    console.log(`   To:   ${new Date(now * 1000).toISOString()}`);

    // Fetch swaps for each hop
    console.log('\n📊 Fetching swaps for each hop...');
    const swapResults = [];
    for (const hop of HOPS) {
        try {
            const result = await getPoolSwaps(hop.poolId, fromTimestamp);
            swapResults.push(result);
            console.log(`   ✅ ${hop.name}: ${result.swaps?.length || 0} swaps`);
        } catch (e) {
            console.log(`   ❌ ${hop.name}: ${e.message}`);
            swapResults.push({ swaps: [] });
        }
    }

    // Calculate hourly prices for each hop
    console.log('\n💹 Calculating hourly prices per hop...');
    const hopPrices = HOPS.map((hop, i) => {
        const ohlc = calculateHopPrice(swapResults[i].swaps || [], hop.tokenIn, hop.tokenOut);
        const hours = Object.keys(ohlc).length;
        const lastPrice = hours > 0 ? Object.values(ohlc).pop().close : null;
        console.log(`   ${hop.name}: ${hours} hourly candles, last price: ${lastPrice?.toFixed(6) || 'N/A'}`);
        return ohlc;
    });

    // Combine into composite price
    console.log('\n🔗 Combining into composite GNO/sDAI price...');
    const candles = combineHopPrices(hopPrices);

    console.log(`   Total candles: ${candles.length}`);
    if (candles.length > 0) {
        const first = candles[0];
        const last = candles[candles.length - 1];
        console.log(`   First: ${new Date(first.time * 1000).toISOString()} = ${first.value.toFixed(4)} sDAI`);
        console.log(`   Last:  ${new Date(last.time * 1000).toISOString()} = ${last.value.toFixed(4)} sDAI`);

        console.log('\n📈 Last 10 candles:');
        console.log('-'.repeat(50));
        for (const candle of candles.slice(-10)) {
            const date = new Date(candle.time * 1000);
            console.log(`   ${date.toISOString().slice(0, 16)} | ${candle.value.toFixed(4)} sDAI`);
        }
    }

    // Show format for chart consumption
    console.log('\n📦 Sample output format (for SubgraphChart):');
    console.log(JSON.stringify(candles.slice(-3), null, 2));
}

main().catch(console.error);
