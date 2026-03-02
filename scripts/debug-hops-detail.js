/**
 * Debug: Check what prices are being used at each hour
 */
const GRAPH_API_KEY = '1f3de4a47d9dfb2a32e1890f63858fff';
const SUBGRAPH_URL = `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg`;

const HOPS = [
    { name: 'GNO/WXDAI', poolId: '0x8189c4c96826d016a99986394103dfa9ae41e7ee0002000000000000000000aa', tokenIn: '0x9c58bacc331c9aa871afd802db6379a98e80cedb', tokenOut: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d' },
    { name: 'WXDAI/USDC', poolId: '0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f', tokenIn: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d', tokenOut: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83' },
    { name: 'USDC/sDAI', poolId: '0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655000000000000000000000066', tokenIn: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83', tokenOut: '0xaf204776c7245bf4147c2612bf6e5972ee483701' },
];

async function fetchSwaps(poolId, fromTimestamp) {
    const query = `
        query GetSwaps($poolId: String!, $from: Int!) {
            swaps(where: { poolId: $poolId, timestamp_gte: $from }, orderBy: timestamp, orderDirection: asc, first: 100) {
                timestamp
                tokenIn
                tokenOut
                tokenAmountIn
                tokenAmountOut
            }
        }
    `;
    const res = await fetch(SUBGRAPH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { poolId, from: fromTimestamp } }) });
    const data = await res.json();
    return data.data?.swaps || [];
}

function calculatePrice(swap, tokenIn, tokenOut) {
    const amtIn = parseFloat(swap.tokenAmountIn);
    const amtOut = parseFloat(swap.tokenAmountOut);
    if (amtIn === 0 || amtOut === 0) return null;
    if (swap.tokenIn.toLowerCase() === tokenIn.toLowerCase()) return amtOut / amtIn;
    return amtIn / amtOut;
}

(async () => {
    const hoursBack = 24;
    const now = Math.floor(Date.now() / 1000);
    const fromTs = now - (hoursBack * 3600);

    console.log('Checking last ' + hoursBack + ' hours of swaps...\n');

    for (const hop of HOPS) {
        console.log('=== ' + hop.name + ' ===');
        const swaps = await fetchSwaps(hop.poolId, fromTs);
        console.log('Swaps in last 24h: ' + swaps.length);

        if (swaps.length > 0) {
            // Show first and last
            const first = swaps[0];
            const last = swaps[swaps.length - 1];

            const firstPrice = calculatePrice(first, hop.tokenIn, hop.tokenOut);
            const lastPrice = calculatePrice(last, hop.tokenIn, hop.tokenOut);

            console.log('First swap price: ' + firstPrice?.toFixed(6));
            console.log('Last swap price: ' + lastPrice?.toFixed(6));
            console.log('First swap time: ' + new Date(first.timestamp * 1000).toISOString());
            console.log('Last swap time: ' + new Date(last.timestamp * 1000).toISOString());
        } else {
            console.log('NO SWAPS in last 24h!');
        }
        console.log('');
    }

    // Also check the USDC/sDAI pool more carefully
    console.log('=== USDC/sDAI Recent Swaps Detail ===');
    const swaps = await fetchSwaps(HOPS[2].poolId, fromTs);
    swaps.slice(0, 5).forEach(s => {
        const price = calculatePrice(s, HOPS[2].tokenIn, HOPS[2].tokenOut);
        console.log(new Date(s.timestamp * 1000).toISOString() + ' | ' + (price?.toFixed(6) || 'N/A'));
    });
})();
