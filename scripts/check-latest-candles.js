/**
 * Quick check: Latest candle timestamps
 * Run: node scripts/check-latest-candles.js
 */

const fetch = require('node-fetch');
const GRAPH_API_KEY = '1f3de4a47d9dfb2a32e1890f63858fff';
const BALANCER_URL = `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg`;

const POOLS = {
    'GNO/WXDAI': '0x8189c4c96826d016a99986394103dfa9ae41e7ee0002000000000000000000aa',
    'WXDAI/USDC': '0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f',
    'USDC/sDAI': '0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655000000000000000000000066'
};

async function main() {
    const now = Math.floor(Date.now() / 1000);
    console.log(`NOW: ${new Date(now * 1000).toISOString()}`);
    console.log('');

    for (const [name, poolId] of Object.entries(POOLS)) {
        const query = `
            query {
                swaps(where: { poolId: "${poolId}" }, orderBy: timestamp, orderDirection: desc, first: 1) {
                    timestamp
                }
            }
        `;

        try {
            const res = await fetch(BALANCER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            const data = await res.json();

            if (data.data?.swaps?.[0]) {
                const ts = parseInt(data.data.swaps[0].timestamp);
                const age = now - ts;
                console.log(`${name}:`);
                console.log(`  Latest: ${new Date(ts * 1000).toISOString()}`);
                console.log(`  Age: ${Math.round(age / 60)} minutes ago`);
                console.log('');
            }
        } catch (e) {
            console.log(`${name}: Error - ${e.message}`);
        }
    }
}

main();
