/**
 * Test GeckoTerminal with EXACT Balancer V2 Pool Addresses
 * 
 * Uses the exact same pool addresses from the Balancer V2 hops
 * to fetch candles from GeckoTerminal (if they track those pools).
 * 
 * Usage: node scripts/test-gecko-balancer-pools.js
 */

const fs = require('fs');
const path = require('path');

const GECKO_API = 'https://api.geckoterminal.com/api/v2';
const NETWORK = 'xdai';

// EXACT Balancer V2 pool addresses from our preset
const BALANCER_POOLS = [
    {
        name: 'GNO/WXDAI',
        poolId: '0x8189c4c96826d016a99986394103dfa9ae41e7ee0002000000000000000000aa',
        address: '0x8189c4c96826d016a99986394103dfa9ae41e7ee',
    },
    {
        name: 'WXDAI/USDC',
        poolId: '0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f',
        address: '0x2086f52651837600180de173b09470f54ef74910',
    },
    {
        name: 'USDC/sDAI',
        poolId: '0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655000000000000000000000066',
        address: '0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655',
    },
];

// ============================================================
// GECKO API - Direct Pool Address Lookup
// ============================================================
async function fetchPoolInfo(poolAddress) {
    const url = `${GECKO_API}/networks/${NETWORK}/pools/${poolAddress}`;
    console.log('  Checking: ' + url);

    try {
        const res = await fetch(url, { headers: { accept: 'application/json' } });
        if (!res.ok) {
            return { found: false, status: res.status };
        }

        const data = await res.json();
        if (data.data) {
            return {
                found: true,
                name: data.data.attributes?.name,
                address: data.data.attributes?.address,
                dex: data.data.relationships?.dex?.data?.id,
                tvl: data.data.attributes?.reserve_in_usd,
            };
        }
        return { found: false };
    } catch (e) {
        return { found: false, error: e.message };
    }
}

async function fetchPoolCandles(poolAddress, limit = 10) {
    const url = `${GECKO_API}/networks/${NETWORK}/pools/${poolAddress}/ohlcv/hour?aggregate=1&limit=${limit}&currency=token`;

    try {
        const res = await fetch(url, { headers: { accept: 'application/json' } });
        if (!res.ok) return null;

        const data = await res.json();
        const ohlcv = data.data?.attributes?.ohlcv_list || [];

        return ohlcv.map(c => ({
            time: c[0],
            close: parseFloat(c[4]),
        }));
    } catch (e) {
        return null;
    }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
    const output = { pools: [], tickers: [] };

    console.log('GeckoTerminal - Exact Balancer V2 Pool Lookup');
    console.log('=============================================');
    console.log('');
    console.log('Checking if GeckoTerminal tracks the exact Balancer V2 pools...');
    console.log('');

    for (const pool of BALANCER_POOLS) {
        console.log('Pool: ' + pool.name);
        console.log('  Balancer Address: ' + pool.address);

        const info = await fetchPoolInfo(pool.address);

        if (info.found) {
            console.log('  FOUND on GeckoTerminal!');
            console.log('  Name: ' + info.name);
            console.log('  DEX: ' + info.dex);
            console.log('  TVL: $' + parseFloat(info.tvl || 0).toFixed(2));

            // Build ticker for spotClient.js
            const ticker = `${pool.address}-hour-500-${NETWORK}`;
            console.log('  Ticker: ' + ticker);

            output.pools.push({
                hop: pool.name,
                balancerPoolId: pool.poolId,
                address: pool.address,
                geckoName: info.name,
                dex: info.dex,
                found: true
            });
            output.tickers.push({
                hop: pool.name,
                ticker: ticker
            });
        } else {
            console.log('  NOT FOUND on GeckoTerminal');
            console.log('  Status: ' + (info.status || info.error || 'unknown'));

            output.pools.push({
                hop: pool.name,
                balancerPoolId: pool.poolId,
                address: pool.address,
                found: false,
                error: info.status || info.error
            });
        }
        console.log('');
    }

    // Summary
    console.log('=============================================');
    console.log('TICKERS FOR spotClient.js:');
    console.log('');

    if (output.tickers.length > 0) {
        output.tickers.forEach(t => {
            console.log('  // ' + t.hop);
            console.log('  "' + t.ticker + '"');
            console.log('');
        });
    } else {
        console.log('  (No Balancer pools found on GeckoTerminal)');
        console.log('  GeckoTerminal only tracks pools from DEXs it supports.');
        console.log('  Balancer V2 might not be indexed on Gnosis.');
    }

    console.log('=============================================');

    // Write output
    const outputPath = path.join(__dirname, 'test-gecko-balancer-pools-output.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log('');
    console.log('Output: ' + outputPath);
}

main().catch(console.error);
