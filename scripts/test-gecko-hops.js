/**
 * Test GeckoTerminal Hop Pools
 * 
 * Tries to find equivalent pools on GeckoTerminal for each
 * Balancer V2 hop in the GNO_SDAI preset, then computes composite price.
 * 
 * Balancer V2 hops: GNO → WXDAI → USDC → sDAI
 * 
 * Usage: node scripts/test-gecko-hops.js
 */

const fs = require('fs');
const path = require('path');

const GECKO_API = 'https://api.geckoterminal.com/api/v2';

// The 3 hops we want to find on GeckoTerminal
const HOPS = [
    { name: 'GNO/WXDAI', base: 'GNO', quote: 'WXDAI' },
    { name: 'WXDAI/USDC', base: 'WXDAI', quote: 'USDC' },
    { name: 'USDC/sDAI', base: 'USDC', quote: 'sDAI' },
];

const NETWORK = 'xdai';

// ============================================================
// GECKO API
// ============================================================
async function searchPool(base, quote) {
    const query = `${base} ${quote}`;
    const url = `${GECKO_API}/search/pools?query=${encodeURIComponent(query)}&network=${NETWORK}`;

    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;

    const data = await res.json();
    const pools = data.data || [];

    // Find pools with both tokens
    const matching = pools.filter(p => {
        const name = p.attributes?.name?.toLowerCase() || '';
        return name.includes(base.toLowerCase()) && name.includes(quote.toLowerCase());
    });

    if (matching.length === 0) return null;

    // Return best by TVL
    matching.sort((a, b) => {
        return parseFloat(b.attributes?.reserve_in_usd || 0) - parseFloat(a.attributes?.reserve_in_usd || 0);
    });

    return {
        address: matching[0].attributes?.address,
        name: matching[0].attributes?.name,
        tvl: matching[0].attributes?.reserve_in_usd,
        dex: matching[0].relationships?.dex?.data?.id,
    };
}

async function fetchLatestPrice(poolAddress) {
    // Fetch just 1 candle to get latest price (currency=token for quote token price)
    const url = `${GECKO_API}/networks/${NETWORK}/pools/${poolAddress}/ohlcv/hour?aggregate=1&limit=1&currency=token`;

    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;

    const data = await res.json();
    const ohlcv = data.data?.attributes?.ohlcv_list || [];

    if (ohlcv.length === 0) return null;

    // [timestamp, open, high, low, close, volume]
    return {
        time: ohlcv[0][0],
        price: parseFloat(ohlcv[0][4]), // close
    };
}

// ============================================================
// MAIN
// ============================================================
async function main() {
    const output = { hops: [], composite: null };

    console.log('GeckoTerminal Hop Pool Finder');
    console.log('=============================');
    console.log('');
    console.log('Searching for pools matching Balancer V2 hops...');
    console.log('');

    // Search for each hop
    for (const hop of HOPS) {
        console.log('Hop: ' + hop.name);

        const pool = await searchPool(hop.base, hop.quote);

        if (pool) {
            console.log('  Found: ' + pool.name);
            console.log('  Address: ' + pool.address);
            console.log('  DEX: ' + pool.dex);
            console.log('  TVL: $' + parseFloat(pool.tvl || 0).toFixed(2));

            // Get latest price
            const priceData = await fetchLatestPrice(pool.address);
            if (priceData) {
                console.log('  Latest price: ' + priceData.price.toFixed(6));
                output.hops.push({
                    hop: hop.name,
                    pool: pool.name,
                    address: pool.address,
                    dex: pool.dex,
                    tvl: pool.tvl,
                    price: priceData.price,
                    timestamp: new Date(priceData.time * 1000).toISOString()
                });
            } else {
                console.log('  (no price data)');
                output.hops.push({
                    hop: hop.name,
                    pool: pool.name,
                    address: pool.address,
                    dex: pool.dex,
                    price: null
                });
            }
        } else {
            console.log('  NOT FOUND on GeckoTerminal');
            output.hops.push({
                hop: hop.name,
                pool: null,
                address: null,
                price: null
            });
        }
        console.log('');
    }

    // Calculate composite price if we have all hops
    const prices = output.hops.map(h => h.price).filter(p => p !== null);

    console.log('=============================');
    console.log('SUMMARY:');
    console.log('');

    output.hops.forEach(h => {
        const status = h.price !== null ? h.price.toFixed(6) : 'MISSING';
        console.log('  ' + h.hop + ': ' + status);
    });

    if (prices.length === 3) {
        const composite = prices.reduce((a, b) => a * b, 1);
        output.composite = composite;

        console.log('');
        console.log('  COMPOSITE GNO/sDAI: ' + composite.toFixed(4));
        console.log('  (calculated as: ' + prices.map(p => p.toFixed(4)).join(' x ') + ')');
    } else {
        console.log('');
        console.log('  Cannot compute composite - missing ' + (3 - prices.length) + ' hop(s)');
    }

    console.log('=============================');

    // Write output
    const outputPath = path.join(__dirname, 'test-gecko-hops-output.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log('');
    console.log('Output: ' + outputPath);
}

main().catch(console.error);
