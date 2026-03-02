/**
 * Verify GNO/sDAI composite calculation manually
 */
const GRAPH_API_KEY = '1f3de4a47d9dfb2a32e1890f63858fff';
const SUBGRAPH_URL = `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg`;

// What we want: GNO -> sDAI
// Route: GNO -> WXDAI -> USDC -> sDAI
// 
// Hop 1: GNO/WXDAI - how many WXDAI per GNO? (~137)
// Hop 2: WXDAI/USDC - how many USDC per WXDAI? (~1.0)
// Hop 3: USDC/sDAI - how many sDAI per USDC? (should be ~1.2, NOT 0.8)
//
// sDAI is worth MORE than USDC because it accrues yield
// So 1 USDC buys LESS sDAI (like 0.82 sDAI)
// But we want sDAI OUT, so we need sDAI per USDC which is ~0.82
//
// WAIT - that means 1 GNO = 137 WXDAI = 137 USDC = 137 * 0.82 sDAI = 112 sDAI
// That's correct!

const HOPS = [
    { name: 'GNO/WXDAI', poolId: '0x8189c4c96826d016a99986394103dfa9ae41e7ee0002000000000000000000aa', tokenIn: '0x9c58bacc331c9aa871afd802db6379a98e80cedb', tokenOut: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d' },
    { name: 'WXDAI/USDC', poolId: '0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f', tokenIn: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d', tokenOut: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83' },
    { name: 'USDC/sDAI', poolId: '0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655000000000000000000000066', tokenIn: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83', tokenOut: '0xaf204776c7245bf4147c2612bf6e5972ee483701' },
];

async function getLatestSwapPrice(poolId, tokenIn, tokenOut, hopName) {
    const query = `query { swaps(where: { poolId: "${poolId}" }, orderBy: timestamp, orderDirection: desc, first: 1) { tokenIn tokenOut tokenAmountIn tokenAmountOut } }`;
    const res = await fetch(SUBGRAPH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
    const data = await res.json();
    const swap = data.data?.swaps?.[0];
    if (!swap) return null;

    const amtIn = parseFloat(swap.tokenAmountIn);
    const amtOut = parseFloat(swap.tokenAmountOut);

    console.log('  ' + hopName);
    console.log('    tokenIn match: ' + (swap.tokenIn.toLowerCase() === tokenIn.toLowerCase()));
    console.log('    amtIn: ' + amtIn.toFixed(6) + ', amtOut: ' + amtOut.toFixed(6));

    // If swap direction matches tokenIn->tokenOut, price = amtOut/amtIn
    // If reversed, price = amtIn/amtOut
    let price;
    if (swap.tokenIn.toLowerCase() === tokenIn.toLowerCase()) {
        price = amtOut / amtIn;
        console.log('    Price (out/in): ' + price.toFixed(6));
    } else {
        price = amtIn / amtOut;
        console.log('    Price (in/out, reversed): ' + price.toFixed(6));
    }

    return price;
}

(async () => {
    console.log('Manual Composite Verification');
    console.log('=============================');
    console.log('');

    let composite = 1;
    const prices = [];

    for (const hop of HOPS) {
        const price = await getLatestSwapPrice(hop.poolId, hop.tokenIn, hop.tokenOut, hop.name);
        if (price) {
            composite *= price;
            prices.push(price);
        }
        console.log('');
    }

    console.log('=============================');
    console.log('Prices: ' + prices.map(p => p.toFixed(4)).join(' x '));
    console.log('COMPOSITE: ' + composite.toFixed(4) + ' sDAI per GNO');
    console.log('');
    console.log('Expected: ~112 sDAI per GNO');
})();
