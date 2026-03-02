/**
 * Test composite VLR/USD spot price ticker
 * VLR → WETH (Balancer) × WETH → USDC (Uniswap V3)
 */

const GECKO_API = 'https://api.geckoterminal.com/api/v2';

async function fetchRawPoolCandles(poolAddress, network, interval, limit) {
    const timeframe = interval.includes('hour') ? 'hour' : interval.includes('min') ? 'minute' : 'day';
    const url = `${GECKO_API}/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}?aggregate=1&limit=${limit}&currency=token`;

    console.log('[Fetching]', poolAddress.slice(0, 12) + '...');
    console.log('  URL:', url);

    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`Pool ${poolAddress.slice(0, 10)} fetch failed: ${res.status}`);

    const data = await res.json();
    const ohlcv = data.data?.attributes?.ohlcv_list || [];
    const meta = data.meta;

    console.log('  Meta:', meta?.base?.symbol, '/', meta?.quote?.symbol);
    console.log('  Candles:', ohlcv.length);

    if (ohlcv.length > 0) {
        console.log('  Latest close:', ohlcv[0][4]);
    }

    // Return as Map for easy lookup
    const candleMap = new Map();
    ohlcv.forEach(c => {
        candleMap.set(c[0], parseFloat(c[4])); // time -> close price
    });
    return { candleMap, meta };
}

function forwardFill(candleMap, allTimes) {
    const filled = new Map();
    let lastValue = null;

    const sortedTimes = [...allTimes].sort((a, b) => a - b);

    for (const time of sortedTimes) {
        if (candleMap.has(time)) {
            lastValue = candleMap.get(time);
        }
        if (lastValue !== null) {
            filled.set(time, lastValue);
        }
    }
    return filled;
}

async function testComposite() {
    console.log('='.repeat(60));
    console.log('Testing VLR/USD Composite Ticker');
    console.log('='.repeat(60));
    console.log('');

    const pools = [
        { address: '0x4446d101e91d042b5d08b62fde126e307f1acd57', invert: false, name: 'VLR/WETH (Balancer)' },
        { address: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', invert: false, name: 'WETH/USDC (UniV3)' }
    ];

    const network = 'eth';
    const interval = 'hour';
    const limit = 10;

    // Fetch all pools
    console.log('Step 1: Fetching individual pools...');
    console.log('');

    const poolResults = [];
    for (const pool of pools) {
        console.log(`[${pool.name}]`);
        try {
            const result = await fetchRawPoolCandles(pool.address, network, interval, limit);
            poolResults.push({ ...pool, ...result });
        } catch (e) {
            console.log('  ERROR:', e.message);
            poolResults.push({ ...pool, candleMap: new Map(), error: e.message });
        }
        console.log('');
    }

    // Collect all unique timestamps
    const allTimes = new Set();
    poolResults.forEach(p => p.candleMap.forEach((_, time) => allTimes.add(time)));
    console.log('Step 2: Total unique timestamps:', allTimes.size);

    // Forward-fill each pool
    const filledMaps = poolResults.map(p => forwardFill(p.candleMap, allTimes));

    // Find common timestamps
    const commonTimes = [...allTimes].filter(time =>
        filledMaps.every(m => m.has(time))
    ).sort((a, b) => a - b);
    console.log('Step 3: Common timestamps after fill:', commonTimes.length);
    console.log('');

    if (commonTimes.length === 0) {
        console.log('❌ No common timestamps - pools may have no overlapping data');
        return;
    }

    // Build composite
    console.log('Step 4: Building composite...');
    const latestTime = commonTimes[commonTimes.length - 1];

    let compositeValue = 1;
    for (let i = 0; i < pools.length; i++) {
        let value = filledMaps[i].get(latestTime);
        console.log(`  Pool ${i + 1} (${pools[i].name}): ${value}${pools[i].invert ? ' (inverted)' : ''}`);
        if (pools[i].invert) {
            value = 1 / value;
            console.log(`    → After invert: ${value}`);
        }
        compositeValue *= value;
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('RESULT');
    console.log('='.repeat(60));
    console.log('  Composite VLR/USD price:', compositeValue);
    console.log('  Time:', new Date(latestTime * 1000).toISOString());
    console.log('');

    if (compositeValue > 0.0001 && compositeValue < 0.01) {
        console.log('✅ Price looks correct for VLR (~$0.0015)');
        console.log('   NO INVERT NEEDED');
    } else if (compositeValue > 100) {
        console.log('⚠️ Price is inverted! Need -invert on pools');
    } else {
        console.log('⚠️ Unexpected price, check pool order');
    }
}

testComposite().catch(console.error);
