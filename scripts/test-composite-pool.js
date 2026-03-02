/**
 * Test spotClient composite with encoded ticker format
 * 
 * Composite: 0xaa7a + 0xc8cf(inv) + 0x3de2(inv)
 * 
 * Run: node scripts/test-composite-pool.js
 */

// Simulate spotClient's fetchCompositeCandles
const GECKO_API = 'https://api.geckoterminal.com/api/v2';
const NETWORK_MAP = { eth: { gecko: 'eth' }, xdai: { gecko: 'xdai' } };

async function fetchRawPoolCandles(poolAddress, network, interval, limit) {
    const geckoNetwork = NETWORK_MAP[network]?.gecko || network;
    const url = `${GECKO_API}/networks/${geckoNetwork}/pools/${poolAddress}/ohlcv/${interval}?aggregate=1&limit=${limit}&currency=token`;
    console.log('Fetching:', poolAddress.slice(0, 10) + '...');

    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);

    const data = await res.json();
    const ohlcv = data.data?.attributes?.ohlcv_list || [];

    const candleMap = new Map();
    ohlcv.forEach(c => candleMap.set(c[0], parseFloat(c[4])));
    return candleMap;
}

function forwardFill(candleMap, allTimes) {
    const filled = new Map();
    let lastValue = null;
    const sortedTimes = [...allTimes].sort((a, b) => a - b);
    for (const time of sortedTimes) {
        if (candleMap.has(time)) lastValue = candleMap.get(time);
        if (lastValue !== null) filled.set(time, lastValue);
    }
    return filled;
}

function parseCompositeConfig(configString) {
    // URL decode first
    const decoded = configString.includes('%') ? decodeURIComponent(configString) : configString;
    const content = decoded.replace('composite::', '');

    // Split by + to get pools
    const poolStrings = content.split('+');
    const pools = [];

    for (const ps of poolStrings) {
        // Each pool string could be: 0xADDR or 0xADDRinvert-hour-100-eth
        const parts = ps.split('-');
        let address = parts[0];
        const isInvert = address.toLowerCase().endsWith('invert');
        if (isInvert) address = address.slice(0, -6);
        pools.push({ address, invert: isInvert });
    }

    // Get interval, limit, network from last pool's parts
    const lastParts = poolStrings[poolStrings.length - 1].split('-');
    return {
        pools,
        interval: lastParts.find(p => ['hour', 'minute', 'day'].includes(p)) || 'hour',
        limit: parseInt(lastParts.find(p => /^\d+$/.test(p)) || '100'),
        network: lastParts[lastParts.length - 1] || 'eth'
    };
}

async function fetchCompositeCandles(configString) {
    const config = parseCompositeConfig(configString);
    console.log('Parsed config:', JSON.stringify(config, null, 2));

    const poolMaps = await Promise.all(
        config.pools.map(p => fetchRawPoolCandles(p.address, config.network, config.interval, config.limit))
    );

    const allTimes = new Set();
    poolMaps.forEach(m => m.forEach((_, time) => allTimes.add(time)));

    const filledMaps = poolMaps.map(m => forwardFill(m, allTimes));

    const commonTimes = [...allTimes].filter(time =>
        filledMaps.every(m => m.has(time))
    ).sort((a, b) => a - b);

    const candles = commonTimes.map(time => {
        let compositeValue = 1;
        config.pools.forEach((poolConfig, i) => {
            let value = filledMaps[i].get(time);
            if (poolConfig.invert) value = 1 / value;
            compositeValue *= value;
        });
        return { time, value: compositeValue };
    });

    return { candles, price: candles[candles.length - 1]?.value };
}

// ==================== TEST ====================
async function test() {
    // Encoded ticker: 0xaa7a + 0xc8cf(inv) + 0x3de2(inv)
    const encodedTicker = 'composite%3A%3A0xaa7a70070e7495fe86c67225329dbd39baa2f63b%2B0xc8cf54b0b70899ea846b70361e62f3f5b22b1f4binvert%2B0x3de27efa2f1aa663ae5d458857e731c129069f29invert-hour-100-eth';

    console.log('='.repeat(60));
    console.log('Testing ENCODED composite ticker:');
    console.log(encodedTicker);
    console.log('='.repeat(60));

    const result = await fetchCompositeCandles(encodedTicker);

    console.log('\n=== RESULTS ===');
    console.log('Total candles:', result.candles.length);
    console.log('✅ Latest composite price:', result.price);

    console.log('\nLast 3 candles:');
    result.candles.slice(-3).forEach(c => {
        console.log(`  ${new Date(c.time * 1000).toLocaleString()} | ${c.value}`);
    });
}

test().catch(e => console.error('Error:', e.message));
