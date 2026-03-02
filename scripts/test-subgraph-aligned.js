/**
 * Test: Generate composite candles from SubgraphChart's startCandleUnix (Jan 19)
 * This simulates what the chart expects
 * 
 * Run: node scripts/test-subgraph-aligned.js
 */

const fetch = require('node-fetch');
const GRAPH_API_KEY = '1f3de4a47d9dfb2a32e1890f63858fff';
const BALANCER_URL = `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg`;

const HOPS = [
    { name: 'GNO/WXDAI', poolId: '0x8189c4c96826d016a99986394103dfa9ae41e7ee0002000000000000000000aa', tokenIn: '0x9c58bacc331c9aa871afd802db6379a98e80cedb', tokenOut: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d' },
    { name: 'WXDAI/USDC', poolId: '0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f', tokenIn: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d', tokenOut: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83' },
    { name: 'USDC/sDAI', poolId: '0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655000000000000000000000066', tokenIn: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83', tokenOut: '0xaf204776c7245bf4147c2612bf6e5972ee483701' }
];

// SubgraphChart's startCandleUnix from the debug output
const SUBGRAPH_CHART_START = new Date('2026-01-19T22:00:00.000Z').getTime() / 1000;

async function getSwaps(poolId, fromTimestamp) {
    const query = `
        query getSwaps($poolId: String!, $from: Int!) {
            swaps(where: { poolId: $poolId, timestamp_gte: $from }, orderBy: timestamp, orderDirection: asc, first: 1000) {
                timestamp
                tokenIn
                tokenOut
                tokenAmountIn
                tokenAmountOut
            }
        }
    `;
    const res = await fetch(BALANCER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { poolId, from: fromTimestamp } })
    });
    const data = await res.json();
    return data.data?.swaps || [];
}

function buildHourly(swaps, tokenIn, tokenOut) {
    const hourly = {};
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
        } else continue;

        hourly[hourTs] = price;
    }
    return hourly;
}

function combine(hopPrices) {
    const allTs = new Set();
    hopPrices.forEach(h => Object.keys(h).forEach(t => allTs.add(t)));

    const prev = hopPrices.map(() => 1);
    const candles = [...allTs].sort().map(ts => {
        const prices = hopPrices.map((h, i) => h[ts] ? (prev[i] = h[ts]) : prev[i]);
        return { time: parseInt(ts), value: prices.reduce((a, b) => a * b, 1) };
    });
    return candles;
}

async function main() {
    const now = Math.floor(Date.now() / 1000);

    console.log('🔍 Testing with SubgraphChart startCandleUnix');
    console.log('='.repeat(60));
    console.log(`StartCandleUnix: ${new Date(SUBGRAPH_CHART_START * 1000).toISOString()}`);
    console.log(`Now: ${new Date(now * 1000).toISOString()}`);
    console.log(`Hours since start: ${Math.round((now - SUBGRAPH_CHART_START) / 3600)}`);
    console.log('');

    // Fetch swaps from SubgraphChart's startCandleUnix
    console.log('📊 Fetching swaps from startCandleUnix...');
    const hopSwaps = [];
    for (const hop of HOPS) {
        const swaps = await getSwaps(hop.poolId, SUBGRAPH_CHART_START);
        hopSwaps.push(swaps);
        console.log(`   ${hop.name}: ${swaps.length} swaps`);
    }

    // Build hourly candles
    console.log('\n🕐 Building hourly candles...');
    const hopCandles = HOPS.map((hop, i) => buildHourly(hopSwaps[i], hop.tokenIn, hop.tokenOut));
    hopCandles.forEach((h, i) => console.log(`   ${HOPS[i].name}: ${Object.keys(h).length} hourly candles`));

    // Combine
    const spotCandles = combine(hopCandles);
    console.log(`\n🔗 Composite candles: ${spotCandles.length}`);

    if (spotCandles.length > 0) {
        const first = spotCandles[0];
        const last = spotCandles[spotCandles.length - 1];
        console.log(`   First: ${new Date(first.time * 1000).toISOString()} = ${first.value.toFixed(4)}`);
        console.log(`   Last:  ${new Date(last.time * 1000).toISOString()} = ${last.value.toFixed(4)}`);

        console.log('\n📈 Last 5 candles:');
        spotCandles.slice(-5).forEach(c => {
            console.log(`   ${new Date(c.time * 1000).toISOString().slice(0, 16)} | ${c.value.toFixed(4)}`);
        });
    } else {
        console.log('\n❌ No candles generated!');
    }

    console.log('\n✅ Done!');
}

main().catch(console.error);
