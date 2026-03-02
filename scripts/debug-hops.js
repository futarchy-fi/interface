/**
 * Debug: Check individual hop prices
 */
const GRAPH_API_KEY = '1f3de4a47d9dfb2a32e1890f63858fff';
const SUBGRAPH_URL = `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg`;

const HOPS = [
    { name: 'GNO/WXDAI', poolId: '0x8189c4c96826d016a99986394103dfa9ae41e7ee0002000000000000000000aa', tokenIn: '0x9c58bacc331c9aa871afd802db6379a98e80cedb', tokenOut: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d' },
    { name: 'WXDAI/USDC', poolId: '0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f', tokenIn: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d', tokenOut: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83' },
    { name: 'USDC/sDAI', poolId: '0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655000000000000000000000066', tokenIn: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83', tokenOut: '0xaf204776c7245bf4147c2612bf6e5972ee483701' },
];

async function getLatestSwap(poolId, tokenIn, tokenOut) {
    const query = `query { swaps(where: { poolId: "${poolId}" }, orderBy: timestamp, orderDirection: desc, first: 1) { tokenIn tokenOut tokenAmountIn tokenAmountOut } }`;
    const res = await fetch(SUBGRAPH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
    const data = await res.json();
    const swap = data.data?.swaps?.[0];
    if (!swap) return { price: null };

    const amtIn = parseFloat(swap.tokenAmountIn);
    const amtOut = parseFloat(swap.tokenAmountOut);

    console.log('  Raw: ' + amtIn.toFixed(6) + ' in, ' + amtOut.toFixed(6) + ' out');
    console.log('  tokenIn match: ' + (swap.tokenIn.toLowerCase() === tokenIn.toLowerCase()));

    let price;
    if (swap.tokenIn.toLowerCase() === tokenIn.toLowerCase()) {
        price = amtOut / amtIn;
    } else {
        price = amtIn / amtOut;
    }
    return { price, amtIn, amtOut, swap };
}

(async () => {
    console.log('Checking individual hop prices...\n');

    let composite = 1;
    const prices = [];

    for (const hop of HOPS) {
        console.log('HOP: ' + hop.name);
        const result = await getLatestSwap(hop.poolId, hop.tokenIn, hop.tokenOut);
        console.log('  Price: ' + (result.price?.toFixed(6) || 'N/A'));
        console.log('');

        if (result.price) {
            composite *= result.price;
            prices.push(result.price);
        }
    }

    console.log('===================');
    console.log('Individual prices: ' + prices.map(p => p.toFixed(4)).join(' x '));
    console.log('COMPOSITE: ' + composite.toFixed(4));
    console.log('');
    console.log('Expected: ~137 x ~1.0 x ~0.82 = ~112');
})();
