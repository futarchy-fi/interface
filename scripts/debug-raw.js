/**
 * Debug USDC/sDAI amounts - check raw values
 */
const GRAPH_API_KEY = '1f3de4a47d9dfb2a32e1890f63858fff';
const SUBGRAPH_URL = `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg`;
const poolId = '0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655000000000000000000000066';
const USDC = '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83';
const sDAI = '0xaf204776c7245bf4147c2612bf6e5972ee483701';

(async () => {
    const query = `query { swaps(where: { poolId: "${poolId}" }, orderBy: timestamp, orderDirection: desc, first: 5) { tokenIn tokenOut tokenAmountIn tokenAmountOut } }`;
    const res = await fetch(SUBGRAPH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
    const data = await res.json();

    console.log('USDC/sDAI Raw Swap Data');
    console.log('========================');
    console.log('USDC address:', USDC);
    console.log('sDAI address:', sDAI);
    console.log('');

    data.data.swaps.forEach((s, i) => {
        const isUsdcIn = s.tokenIn.toLowerCase() === USDC.toLowerCase();

        console.log('Swap ' + (i + 1) + ':');
        console.log('  tokenIn:  ' + s.tokenIn);
        console.log('  tokenOut: ' + s.tokenOut);
        console.log('  amountIn (raw):  ' + s.tokenAmountIn);
        console.log('  amountOut (raw): ' + s.tokenAmountOut);
        console.log('  isUsdcIn: ' + isUsdcIn);

        const amtIn = parseFloat(s.tokenAmountIn);
        const amtOut = parseFloat(s.tokenAmountOut);

        // If USDC in, sDAI out - we want sDAI per USDC
        // If sDAI in, USDC out - we want to invert
        let price;
        if (isUsdcIn) {
            price = amtOut / amtIn;
        } else {
            price = amtIn / amtOut;
        }
        console.log('  Calculated sDAI/USDC: ' + price.toFixed(6));
        console.log('');
    });
})();
