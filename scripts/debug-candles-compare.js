/**
 * Debug script to compare YES/NO candles from futarchy subgraph
 * vs multihop spot candles from Balancer subgraph
 * 
 * Run: node scripts/debug-candles-compare.js
 */

const fetch = require('node-fetch');

// ==============================================================
// CONFIG
// ==============================================================

const GRAPH_API_KEY = '1f3de4a47d9dfb2a32e1890f63858fff';

// Futarchy subgraph (for YES/NO candles)
const FUTARCHY_SUBGRAPH = `https://gateway.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/6t88kq8tmAaX3ipTYVKPy1q5p4sC5hL3FWr2ypJT4rsZ`;

// Balancer V2 subgraph (for multihop spot)
const BALANCER_SUBGRAPH = `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg`;

const PROPOSAL_ID = '0x45e1064348fD8A407D6D1F59Fc64B05F633b28FC';

// Balancer hop pools
const HOPS = [
    { name: 'GNO/WXDAI', poolId: '0x8189c4c96826d016a99986394103dfa9ae41e7ee0002000000000000000000aa', tokenIn: '0x9c58bacc331c9aa871afd802db6379a98e80cedb', tokenOut: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d' },
    { name: 'WXDAI/USDC', poolId: '0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f', tokenIn: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d', tokenOut: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83' },
    { name: 'USDC/sDAI', poolId: '0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655000000000000000000000066', tokenIn: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83', tokenOut: '0xaf204776c7245bf4147c2612bf6e5972ee483701' }
];

// ==============================================================
// HELPERS
// ==============================================================

async function querySubgraph(url, query, variables = {}) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
    });
    const result = await response.json();
    if (result.errors) {
        console.error('GraphQL Errors:', result.errors);
        throw new Error(result.errors[0].message);
    }
    return result.data;
}

// ==============================================================
// FUTARCHY SUBGRAPH - YES/NO CANDLES
// ==============================================================

async function getFutarchyCandles() {
    console.log('\n📊 FUTARCHY SUBGRAPH - YES/NO POOLS');
    console.log('='.repeat(60));

    const query = `
        query GetPoolsWithCandles($proposalId: String!, $limit: Int!, $period: BigInt!) {
            pools(where: { proposal: $proposalId, type: "CONDITIONAL" }) {
                id
                name
                type
                outcomeSide
                price
                isInverted
                proposal {
                    id
                    marketName
                }
                candles(first: $limit, orderBy: periodStartUnix, orderDirection: desc, where: { period: $period }) {
                    periodStartUnix
                    period
                    open
                    high
                    low
                    close
                }
            }
        }
    `;

    try {
        const data = await querySubgraph(FUTARCHY_SUBGRAPH, query, {
            proposalId: PROPOSAL_ID.toLowerCase(),
            limit: 500,
            period: "3600" // 1 hour candles
        });

        const pools = data.pools || [];
        console.log(`Found ${pools.length} conditional pools`);

        for (const pool of pools) {
            const candles = pool.candles || [];
            console.log(`\n  ${pool.outcomeSide} Pool:`);
            console.log(`    Address: ${pool.id}`);
            console.log(`    Current price: ${parseFloat(pool.price).toFixed(4)}`);
            console.log(`    Candles: ${candles.length}`);

            if (candles.length > 0) {
                // candles are desc, so first is newest, last is oldest
                const newest = candles[0];
                const oldest = candles[candles.length - 1];

                console.log(`    Newest: ${new Date(parseInt(newest.periodStartUnix) * 1000).toISOString()} = ${parseFloat(newest.close).toFixed(4)}`);
                console.log(`    Oldest: ${new Date(parseInt(oldest.periodStartUnix) * 1000).toISOString()} = ${parseFloat(oldest.close).toFixed(4)}`);

                // Show last 5 candles
                console.log(`    Last 5 candles:`);
                for (const c of candles.slice(0, 5)) {
                    const time = new Date(parseInt(c.periodStartUnix) * 1000);
                    console.log(`      ${time.toISOString().slice(0, 16)} | ${parseFloat(c.close).toFixed(4)}`);
                }
            }
        }

        return pools;
    } catch (e) {
        console.error('Error:', e.message);
        return [];
    }
}

// ==============================================================
// BALANCER SUBGRAPH - MULTIHOP SPOT
// ==============================================================

async function getBalancerSpot() {
    console.log('\n📈 BALANCER SUBGRAPH - MULTIHOP SPOT');
    console.log('='.repeat(60));

    const hopPrices = [];

    for (const hop of HOPS) {
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

        try {
            const data = await querySubgraph(BALANCER_SUBGRAPH, query, {
                poolId: hop.poolId,
                limit: 100
            });

            const swaps = data.swaps || [];

            // Get latest price
            let latestPrice = null;
            let latestTime = null;
            for (const swap of swaps) {
                const amtIn = parseFloat(swap.tokenAmountIn);
                const amtOut = parseFloat(swap.tokenAmountOut);
                if (amtIn === 0 || amtOut === 0) continue;

                if (swap.tokenIn.toLowerCase() === hop.tokenIn.toLowerCase()) {
                    latestPrice = amtOut / amtIn;
                } else if (swap.tokenIn.toLowerCase() === hop.tokenOut.toLowerCase()) {
                    latestPrice = amtIn / amtOut;
                } else {
                    continue;
                }
                latestTime = new Date(parseInt(swap.timestamp) * 1000);
                break;
            }

            hopPrices.push(latestPrice);

            console.log(`\n  ${hop.name}:`);
            console.log(`    Swaps: ${swaps.length}`);
            console.log(`    Latest price: ${latestPrice?.toFixed(6) || 'N/A'}`);
            console.log(`    Last swap: ${latestTime?.toISOString() || 'N/A'}`);

            // Show time range of swaps
            if (swaps.length > 0) {
                const newest = new Date(parseInt(swaps[0].timestamp) * 1000);
                const oldest = new Date(parseInt(swaps[swaps.length - 1].timestamp) * 1000);
                console.log(`    Time range: ${oldest.toISOString().slice(0, 16)} to ${newest.toISOString().slice(0, 16)}`);
            }

        } catch (e) {
            console.error(`  ${hop.name}: Error - ${e.message}`);
            hopPrices.push(null);
        }
    }

    // Calculate composite
    if (hopPrices.every(p => p !== null)) {
        const spotPrice = hopPrices.reduce((a, b) => a * b, 1);
        console.log(`\n  COMPOSITE SPOT: ${spotPrice.toFixed(4)} sDAI per GNO`);
    }

    return hopPrices;
}

// ==============================================================
// MAIN
// ==============================================================

async function main() {
    console.log('🔍 DEBUG: Candles Comparison');
    console.log(`Proposal: ${PROPOSAL_ID}`);
    console.log(`Time: ${new Date().toISOString()}`);

    // Get YES/NO candles
    await getFutarchyCandles();

    // Get multihop spot
    await getBalancerSpot();

    console.log('\n' + '='.repeat(60));
    console.log('✅ Done!');
}

main().catch(console.error);
