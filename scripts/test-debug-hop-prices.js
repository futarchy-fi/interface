/**
 * Debug Hop Prices - Compare GeckoTerminal vs Balancer Subgraph
 * 
 * Checks individual hop prices from both sources to find the discrepancy.
 * 
 * Usage: node scripts/test-debug-hop-prices.js
 */

const GECKO_API = 'https://api.geckoterminal.com/api/v2';
const GRAPH_API_KEY = '1f3de4a47d9dfb2a32e1890f63858fff';
const SUBGRAPH_URL = `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg`;
const NETWORK = 'xdai';

const HOPS = [
    {
        name: 'GNO/WXDAI',
        address: '0x8189c4c96826d016a99986394103dfa9ae41e7ee',
        poolId: '0x8189c4c96826d016a99986394103dfa9ae41e7ee0002000000000000000000aa',
        tokenIn: '0x9c58bacc331c9aa871afd802db6379a98e80cedb',
        tokenOut: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d',
    },
    {
        name: 'WXDAI/USDC',
        address: '0x2086f52651837600180de173b09470f54ef74910',
        poolId: '0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f',
        tokenIn: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d',
        tokenOut: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83',
    },
    {
        name: 'USDC/sDAI',
        address: '0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655',
        poolId: '0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655000000000000000000000066',
        tokenIn: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83',
        tokenOut: '0xaf204776c7245bf4147c2612bf6e5972ee483701',
    },
];

// ============================================================
// GECKO API
// ============================================================
async function getGeckoPrice(poolAddress) {
    const url = `${GECKO_API}/networks/${NETWORK}/pools/${poolAddress}/ohlcv/hour?aggregate=1&limit=1&currency=token`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;

    const data = await res.json();
    const ohlcv = data.data?.attributes?.ohlcv_list || [];
    return ohlcv[0] ? parseFloat(ohlcv[0][4]) : null;
}

async function getGeckoPoolInfo(poolAddress) {
    const url = `${GECKO_API}/networks/${NETWORK}/pools/${poolAddress}`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;

    const data = await res.json();
    return {
        name: data.data?.attributes?.name,
        baseToken: data.data?.relationships?.base_token?.data?.id,
        quoteToken: data.data?.relationships?.quote_token?.data?.id,
    };
}

// ============================================================
// BALANCER SUBGRAPH
// ============================================================
async function getBalancerPrice(poolId, tokenIn, tokenOut) {
    const now = Math.floor(Date.now() / 1000);
    const fromTs = now - 3600; // last hour

    const query = `
        query GetSwaps($poolId: String!, $from: Int!) {
            swaps(
                where: { poolId: $poolId, timestamp_gte: $from }
                orderBy: timestamp
                orderDirection: desc
                first: 10
            ) {
                timestamp
                tokenIn
                tokenOut
                tokenAmountIn
                tokenAmountOut
            }
        }
    `;

    const res = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { poolId, from: fromTs } })
    });

    const data = await res.json();
    const swaps = data.data?.swaps || [];

    if (swaps.length === 0) return { price: null, swaps: 0 };

    // Calculate price from most recent swap
    const swap = swaps[0];
    const amtIn = parseFloat(swap.tokenAmountIn);
    const amtOut = parseFloat(swap.tokenAmountOut);

    let price;
    if (swap.tokenIn.toLowerCase() === tokenIn.toLowerCase()) {
        price = amtOut / amtIn;
    } else if (swap.tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
        price = amtIn / amtOut;
    } else {
        price = null;
    }

    return { price, swaps: swaps.length, lastSwap: swap };
}

// ============================================================
// MAIN
// ============================================================
async function main() {
    console.log('Debug Hop Prices: GeckoTerminal vs Balancer Subgraph');
    console.log('====================================================');
    console.log('');

    const geckoprices = [];
    const balancerPrices = [];

    for (const hop of HOPS) {
        console.log('HOP: ' + hop.name);
        console.log('  Pool: ' + hop.address);
        console.log('');

        // Get GeckoTerminal pool info
        const poolInfo = await getGeckoPoolInfo(hop.address);
        if (poolInfo) {
            console.log('  GeckoTerminal pool name: ' + poolInfo.name);
            console.log('  Base token: ' + poolInfo.baseToken);
            console.log('  Quote token: ' + poolInfo.quoteToken);
        }

        // Get GeckoTerminal price
        const geckoPrice = await getGeckoPrice(hop.address);
        console.log('  GeckoTerminal price: ' + (geckoPrice !== null ? geckoPrice.toFixed(6) : 'N/A'));
        geckoprices.push(geckoPrice || 1);

        // Get Balancer subgraph price
        const balancer = await getBalancerPrice(hop.poolId, hop.tokenIn, hop.tokenOut);
        console.log('  Balancer price:      ' + (balancer.price !== null ? balancer.price.toFixed(6) : 'N/A'));
        console.log('  Balancer swaps (1h): ' + balancer.swaps);
        balancerPrices.push(balancer.price || 1);

        // Check if inverted
        if (geckoPrice && balancer.price) {
            const ratio = geckoPrice / balancer.price;
            const invRatio = geckoPrice * balancer.price;
            console.log('');
            console.log('  Ratio (gecko/balancer): ' + ratio.toFixed(4));
            if (ratio > 10 || ratio < 0.1) {
                console.log('  ** POSSIBLE INVERSION? Inverse ratio: ' + (1 / ratio).toFixed(4));
            }
        }

        console.log('');
        console.log('---');
    }

    // Calculate composites
    console.log('');
    console.log('====================================================');
    console.log('COMPOSITE PRICES:');
    console.log('');

    const geckoComposite = geckoprices.reduce((a, b) => a * b, 1);
    const balancerComposite = balancerPrices.reduce((a, b) => a * b, 1);

    console.log('  GeckoTerminal composite: ' + geckoComposite.toFixed(4));
    console.log('  Individual hops: ' + geckoprices.map(p => p.toFixed(4)).join(' x '));
    console.log('');
    console.log('  Balancer composite:      ' + balancerComposite.toFixed(4));
    console.log('  Individual hops: ' + balancerPrices.map(p => p.toFixed(4)).join(' x '));
    console.log('');
    console.log('====================================================');
}

main().catch(console.error);
