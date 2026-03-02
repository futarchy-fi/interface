/**
 * Balancer V2 Multi-Hop Spot Price Calculator
 * 
 * Computes GNO/sDAI spot price using 3-hop path:
 * GNO → WXDAI → USDC → sDAI
 * 
 * Run: node scripts/test-balancer-spot.js
 */

const fetch = require('node-fetch');

const GRAPH_API_KEY = '1f3de4a47d9dfb2a32e1890f63858fff';
const SUBGRAPH_URL = `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg`;

// Multi-hop configuration 
const HOPS = [
    {
        name: 'GNO → WXDAI',
        poolId: '0x8189c4c96826d016a99986394103dfa9ae41e7ee0002000000000000000000aa',
        tokenIn: '0x9c58bacc331c9aa871afd802db6379a98e80cedb',
        tokenOut: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d'
    },
    {
        name: 'WXDAI → USDC',
        poolId: '0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f',
        tokenIn: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d',
        tokenOut: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83'
    },
    {
        name: 'USDC → sDAI',
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

async function getLatestSwaps(poolId, limit = 50) {
    const query = `
        query getSwaps($poolId: String!, $limit: Int!) {
            swaps(
                where: { poolId: $poolId }
                orderBy: timestamp
                orderDirection: desc
                first: $limit
            ) {
                timestamp
                tokenIn
                tokenOut
                tokenAmountIn
                tokenAmountOut
            }
        }
    `;
    return querySubgraph(query, { poolId, limit });
}

function calculatePrice(swaps, tokenIn, tokenOut) {
    let prices = [];

    for (const swap of swaps) {
        const amtIn = parseFloat(swap.tokenAmountIn);
        const amtOut = parseFloat(swap.tokenAmountOut);

        if (amtIn === 0 || amtOut === 0) continue;

        let price;
        if (swap.tokenIn.toLowerCase() === tokenIn.toLowerCase()) {
            price = amtOut / amtIn; // Forward swap
        } else if (swap.tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
            price = amtIn / amtOut; // Reverse swap  
        } else {
            continue;
        }
        prices.push(price);
    }

    return prices;
}

async function main() {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('           BALANCER V2 MULTI-HOP SPOT PRICE');
    console.log('           GNO → WXDAI → USDC → sDAI');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    const hopPrices = [];
    const hopDetails = [];

    for (const hop of HOPS) {
        try {
            const data = await getLatestSwaps(hop.poolId, 50);
            const swaps = data.swaps || [];
            const prices = calculatePrice(swaps, hop.tokenIn, hop.tokenOut);

            if (prices.length === 0) {
                console.log(`❌ ${hop.name}: No valid swaps`);
                hopPrices.push(null);
                continue;
            }

            // Get latest price (from most recent swap)
            const latestPrice = prices[0];
            // Get average of last 10 swaps
            const avgPrice = prices.slice(0, 10).reduce((a, b) => a + b, 0) / Math.min(prices.length, 10);

            // Get time of most recent swap
            const latestTime = new Date(parseInt(swaps[0].timestamp) * 1000);
            const ageMinutes = Math.round((Date.now() - latestTime.getTime()) / 60000);

            hopPrices.push(latestPrice);
            hopDetails.push({
                name: hop.name,
                latestPrice,
                avgPrice,
                swapCount: swaps.length,
                latestTime,
                ageMinutes
            });

            console.log(`📊 ${hop.name}`);
            console.log(`   Latest Price: ${latestPrice.toFixed(6)}`);
            console.log(`   Avg (10 swaps): ${avgPrice.toFixed(6)}`);
            console.log(`   Swaps: ${swaps.length} | Last swap: ${ageMinutes}m ago`);
            console.log('');

        } catch (e) {
            console.log(`❌ ${hop.name}: ${e.message}`);
            hopPrices.push(null);
        }
    }

    // Calculate composite spot price
    console.log('───────────────────────────────────────────────────────────');

    if (hopPrices.every(p => p !== null)) {
        const spotPrice = hopPrices.reduce((a, b) => a * b, 1);
        const avgSpotPrice = hopDetails.map(h => h.avgPrice).reduce((a, b) => a * b, 1);

        console.log('');
        console.log('🔗 COMPOSITE CALCULATION:');
        console.log(`   ${hopPrices[0].toFixed(4)} × ${hopPrices[1].toFixed(6)} × ${hopPrices[2].toFixed(6)}`);
        console.log('');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');
        console.log(`   💰 SPOT PRICE (latest):   ${spotPrice.toFixed(4)} sDAI per GNO`);
        console.log(`   📈 SPOT PRICE (avg 10):   ${avgSpotPrice.toFixed(4)} sDAI per GNO`);
        console.log('');
        console.log('═══════════════════════════════════════════════════════════');

        // Show data freshness
        const oldestSwap = Math.max(...hopDetails.map(h => h.ageMinutes));
        console.log('');
        console.log(`⏱️  Data freshness: Most stale hop is ${oldestSwap} minutes old`);

    } else {
        console.log('');
        console.log('❌ Could not calculate composite price - missing hop data');
    }

    console.log('');
}

main().catch(console.error);
