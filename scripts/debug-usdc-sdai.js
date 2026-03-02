/**
 * Debug USDC/sDAI swap direction
 */
const GRAPH_API_KEY = '1f3de4a47d9dfb2a32e1890f63858fff';
const SUBGRAPH_URL = `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg`;
const poolId = '0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655000000000000000000000066';
const USDC = '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83';
const sDAI = '0xaf204776c7245bf4147c2612bf6e5972ee483701';

(async () => {
    const query = `query { swaps(where: { poolId: "${poolId}" }, orderBy: timestamp, orderDirection: desc, first: 3) { tokenIn tokenOut tokenAmountIn tokenAmountOut } }`;
    const res = await fetch(SUBGRAPH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
    const data = await res.json();

    console.log('USDC/sDAI Swap Analysis');
    console.log('=======================');
    console.log('We want: USDC -> sDAI (how many sDAI per USDC)');
    console.log('');

    data.data.swaps.forEach((s, i) => {
        const isUsdcIn = s.tokenIn.toLowerCase() === USDC.toLowerCase();
        const amtIn = parseFloat(s.tokenAmountIn);
        const amtOut = parseFloat(s.tokenAmountOut);

        console.log('Swap ' + (i + 1) + ':');
        console.log('  In: ' + amtIn.toFixed(6) + ' ' + (isUsdcIn ? 'USDC' : 'sDAI'));
        console.log('  Out: ' + amtOut.toFixed(6) + ' ' + (!isUsdcIn ? 'USDC' : 'sDAI'));

        // USDC/sDAI means: how many sDAI for 1 USDC
        // If USDC in, sDAI out: price = sDAI out / USDC in
        // If sDAI in, USDC out: price = USDC out / sDAI in (then invert for sDAI/USDC)

        let priceUSDCtoSDAI;
        if (isUsdcIn) {
            priceUSDCtoSDAI = amtOut / amtIn; // sDAI per USDC
        } else {
            priceUSDCtoSDAI = amtIn / amtOut; // invert
        }

        console.log('  USDC->sDAI price: ' + priceUSDCtoSDAI.toFixed(6) + ' sDAI per USDC');
        console.log('');
    });

    console.log('Expected: ~1.0-1.2 sDAI per USDC (sDAI is worth slightly less than USDC)');
})();
