/**
 * Compare GeckoTerminal Composite vs Direct waGnoGNO/sDAI
 * 
 * Fetches candles from:
 * 1. Three Balancer V2 hops (GNO->WXDAI->USDC->sDAI) via GeckoTerminal
 * 2. Direct waGnoGNO/sDAI pool via GeckoTerminal
 * 
 * Then computes and compares the composite price.
 * 
 * Usage: node scripts/test-gecko-composite-compare.js
 */

const fs = require('fs');
const path = require('path');

const GECKO_API = 'https://api.geckoterminal.com/api/v2';
const NETWORK = 'xdai';
const LIMIT = 24; // Last 24 hours

// Balancer V2 pool addresses
const HOP_POOLS = [
    { name: 'GNO/WXDAI', address: '0x8189c4c96826d016a99986394103dfa9ae41e7ee' },
    { name: 'WXDAI/USDC', address: '0x2086f52651837600180de173b09470f54ef74910' },
    { name: 'USDC/sDAI', address: '0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655' },
];

// Direct waGnoGNO/sDAI pool (search for it)
const DIRECT_SEARCH = { base: 'waGnoGNO', quote: 'sDAI' };

// ============================================================
// GECKO API
// ============================================================
async function fetchCandles(poolAddress, limit = LIMIT) {
    const url = `${GECKO_API}/networks/${NETWORK}/pools/${poolAddress}/ohlcv/hour?aggregate=1&limit=${limit}&currency=token`;

    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;

    const data = await res.json();
    const ohlcv = data.data?.attributes?.ohlcv_list || [];

    // Reverse to oldest-first, dedupe
    const raw = ohlcv.map(c => ({
        time: c[0],
        close: parseFloat(c[4]),
    })).reverse();

    const seen = new Set();
    return raw.filter(c => {
        if (seen.has(c.time)) return false;
        seen.add(c.time);
        return true;
    }).sort((a, b) => a.time - b.time);
}

async function searchPool(base, quote) {
    const query = `${base} ${quote}`;
    const url = `${GECKO_API}/search/pools?query=${encodeURIComponent(query)}&network=${NETWORK}`;

    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;

    const data = await res.json();
    const pools = data.data || [];

    const matching = pools.filter(p => {
        const name = p.attributes?.name?.toLowerCase() || '';
        return name.includes(base.toLowerCase()) && name.includes(quote.toLowerCase());
    });

    return matching[0]?.attributes?.address || null;
}

// ============================================================
// COMPOSITE CALCULATION
// ============================================================
function computeComposite(hopCandles) {
    // Get all unique timestamps
    const allTimes = new Set();
    hopCandles.forEach(candles => {
        candles.forEach(c => allTimes.add(c.time));
    });

    const sortedTimes = [...allTimes].sort((a, b) => a - b);
    const lastPrices = hopCandles.map(() => 1);
    const composite = [];

    for (const time of sortedTimes) {
        let price = 1;
        for (let i = 0; i < hopCandles.length; i++) {
            const candle = hopCandles[i].find(c => c.time === time);
            if (candle) {
                lastPrices[i] = candle.close;
            }
            price *= lastPrices[i];
        }
        composite.push({ time, close: price });
    }

    return composite;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
    console.log('GeckoTerminal: Composite vs Direct Comparison');
    console.log('==============================================');
    console.log('');

    // 1. Fetch candles for each hop
    console.log('Step 1: Fetching hop candles from Balancer V2 pools...');
    const hopCandles = [];

    for (const hop of HOP_POOLS) {
        const candles = await fetchCandles(hop.address, LIMIT);
        if (candles) {
            console.log('  ' + hop.name + ': ' + candles.length + ' candles');
            hopCandles.push(candles);
        } else {
            console.log('  ' + hop.name + ': FAILED');
            hopCandles.push([]);
        }
    }

    // 2. Compute composite
    console.log('');
    console.log('Step 2: Computing composite GNO/sDAI...');
    const compositeCandles = computeComposite(hopCandles);
    console.log('  Composite candles: ' + compositeCandles.length);

    // 3. Find and fetch direct waGnoGNO/sDAI pool
    console.log('');
    console.log('Step 3: Fetching direct waGnoGNO/sDAI pool...');
    const directAddress = await searchPool(DIRECT_SEARCH.base, DIRECT_SEARCH.quote);
    let directCandles = [];

    if (directAddress) {
        console.log('  Found pool: ' + directAddress);
        directCandles = await fetchCandles(directAddress, LIMIT) || [];
        console.log('  Direct candles: ' + directCandles.length);
    } else {
        console.log('  Pool not found!');
    }

    // 4. Compare latest prices
    console.log('');
    console.log('==============================================');
    console.log('COMPARISON (latest candle):');
    console.log('');

    const latestComposite = compositeCandles[compositeCandles.length - 1];
    const latestDirect = directCandles[directCandles.length - 1];

    if (latestComposite) {
        console.log('  COMPOSITE (3-hop Balancer V2): ' + latestComposite.close.toFixed(4) + ' sDAI');
    }
    if (latestDirect) {
        console.log('  DIRECT (waGnoGNO/sDAI pool):   ' + latestDirect.close.toFixed(4) + ' sDAI');
    }

    if (latestComposite && latestDirect) {
        const diff = latestDirect.close - latestComposite.close;
        const pctDiff = (diff / latestComposite.close) * 100;
        console.log('');
        console.log('  DIFFERENCE: ' + diff.toFixed(4) + ' sDAI (' + pctDiff.toFixed(2) + '%)');
    }

    // 5. Show last 5 candles comparison
    console.log('');
    console.log('==============================================');
    console.log('LAST 5 CANDLES:');
    console.log('');
    console.log('Time (UTC)              | Composite  | Direct     | Diff');
    console.log('----------------------- | ---------- | ---------- | ------');

    const last5Composite = compositeCandles.slice(-5);

    for (const comp of last5Composite) {
        const dir = directCandles.find(d => d.time === comp.time);
        const timeStr = new Date(comp.time * 1000).toISOString().replace('T', ' ').replace('.000Z', '');
        const dirVal = dir ? dir.close.toFixed(4) : 'N/A';
        const diff = dir ? (dir.close - comp.close).toFixed(2) : 'N/A';
        console.log(timeStr + ' | ' + comp.close.toFixed(4).padStart(10) + ' | ' + dirVal.padStart(10) + ' | ' + diff);
    }

    console.log('==============================================');

    // Write output
    const output = {
        composite: {
            method: 'GeckoTerminal 3-hop (Balancer V2 pools)',
            pools: HOP_POOLS.map(h => h.address),
            candles: compositeCandles.slice(-10),
            latestPrice: latestComposite?.close
        },
        direct: {
            method: 'GeckoTerminal direct pool',
            pool: directAddress,
            candles: directCandles.slice(-10),
            latestPrice: latestDirect?.close
        },
        difference: latestComposite && latestDirect ? {
            absolute: latestDirect.close - latestComposite.close,
            percent: ((latestDirect.close - latestComposite.close) / latestComposite.close) * 100
        } : null
    };

    const outputPath = path.join(__dirname, 'test-gecko-composite-compare-output.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log('');
    console.log('Output: ' + outputPath);
}

main().catch(console.error);
