/**
 * Test: Using mock startCandleUnix (3 hours ago)
 * 
 * Run: node scripts/test-mock-startcandle.js
 */

const fetch = require('node-fetch');

const GRAPH_API_KEY = '1f3de4a47d9dfb2a32e1890f63858fff';
const BALANCER_SUBGRAPH = `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg`;

const HOPS = [
    { name: 'GNO/WXDAI', poolId: '0x8189c4c96826d016a99986394103dfa9ae41e7ee0002000000000000000000aa', tokenIn: '0x9c58bacc331c9aa871afd802db6379a98e80cedb', tokenOut: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d' },
    { name: 'WXDAI/USDC', poolId: '0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f', tokenIn: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d', tokenOut: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83' },
    { name: 'USDC/sDAI', poolId: '0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655000000000000000000000066', tokenIn: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83', tokenOut: '0xaf204776c7245bf4147c2612bf6e5972ee483701' }
];

async function querySubgraph(query, variables) {
    const response = await fetch(BALANCER_SUBGRAPH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
    });
    const result = await response.json();
    if (result.errors) throw new Error(result.errors[0].message);
    return result.data;
}

async function getSwapsFromTimestamp(poolId, fromTimestamp) {
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

function buildHourlyCandles(swaps, tokenIn, tokenOut) {
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

function combineHops(hopCandles) {
    const allTimestamps = new Set();
    for (const hop of hopCandles) {
        Object.keys(hop).forEach(ts => allTimestamps.add(ts));
    }

    const combined = [];
    const prevPrices = hopCandles.map(() => 1);

    for (const ts of [...allTimestamps].sort()) {
        const currentPrices = hopCandles.map((hop, i) => {
            if (hop[ts]) {
                prevPrices[i] = hop[ts].close;
                return hop[ts].close;
            }
            return prevPrices[i];
        });

        const composite = currentPrices.reduce((a, b) => a * b, 1);
        combined.push({ time: parseInt(ts), value: composite });
    }

    return combined.sort((a, b) => a.time - b.time);
}

async function main() {
    console.log('🧪 TEST: Mock startCandleUnix (3 hours ago)');
    console.log('='.repeat(60));

    // Mock startCandleUnix = 3 hours ago
    const now = Math.floor(Date.now() / 1000);
    const mockStartCandleUnix = now - (3 * 60 * 60); // 3 hours ago

    console.log(`\n📅 Mock startCandleUnix: ${new Date(mockStartCandleUnix * 1000).toISOString()}`);
    console.log(`   Now: ${new Date(now * 1000).toISOString()}`);

    // Fetch swaps for each hop
    console.log('\n📊 Fetching swaps from startCandleUnix...');
    const hopSwaps = [];
    for (const hop of HOPS) {
        try {
            const data = await getSwapsFromTimestamp(hop.poolId, mockStartCandleUnix);
            hopSwaps.push(data.swaps || []);
            console.log(`   ${hop.name}: ${data.swaps?.length || 0} swaps`);
        } catch (e) {
            console.log(`   ${hop.name}: ERROR - ${e.message}`);
            hopSwaps.push([]);
        }
    }

    // Build hourly candles
    console.log('\n🕐 Building hourly candles...');
    const hopCandles = HOPS.map((hop, i) =>
        buildHourlyCandles(hopSwaps[i], hop.tokenIn, hop.tokenOut)
    );

    for (let i = 0; i < HOPS.length; i++) {
        const candleCount = Object.keys(hopCandles[i]).length;
        console.log(`   ${HOPS[i].name}: ${candleCount} hourly candles`);
    }

    // Combine into composite
    const spotCandles = combineHops(hopCandles);
    console.log(`\n🔗 Composite candles: ${spotCandles.length}`);

    if (spotCandles.length > 0) {
        console.log('\n📈 SPOT candles:');
        for (const c of spotCandles) {
            const time = new Date(c.time * 1000);
            console.log(`   ${time.toISOString().slice(0, 16)} | ${c.value.toFixed(4)} sDAI`);
        }

        console.log(`\n💰 Latest SPOT price: ${spotCandles[spotCandles.length - 1].value.toFixed(4)} sDAI`);
    }

    console.log('\n✅ Done!');
}

main().catch(console.error);
