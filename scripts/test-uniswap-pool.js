/**
 * Test spotClient with Uniswap V3 Ethereum pool
 * Supports: 0xPOOL-hour-100-eth[-invert]
 * 
 * Run: node scripts/test-uniswap-pool.js
 */

const GECKO_API = 'https://api.geckoterminal.com/api/v2';

async function fetchSpotCandles(configString) {
    const parts = configString.split('-');

    // Check for -invert at end
    const invert = parts[parts.length - 1]?.toLowerCase() === 'invert';
    const cleanParts = invert ? parts.slice(0, -1) : parts;

    const poolAddress = cleanParts[0];
    const interval = cleanParts[1] || 'hour';
    const limit = parseInt(cleanParts[2] || '100');
    const network = cleanParts[3] || 'eth';

    console.log('Config:', { poolAddress, interval, limit, network, invert });

    // Fetch OHLCV candles
    const url = `${GECKO_API}/networks/${network}/pools/${poolAddress}/ohlcv/${interval}?aggregate=1&limit=${limit}&currency=token`;
    console.log('URL:', url);

    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);

    const data = await res.json();
    const ohlcv = data.data?.attributes?.ohlcv_list || [];

    // Transform to { time, value } format
    let candles = ohlcv.map(c => ({
        time: c[0],
        close: c[4],
        volume: c[5]
    })).reverse();

    // Apply invert if specified
    if (invert) {
        candles = candles.map(c => ({ ...c, close: 1 / c.close }));
        console.log('[Inverted prices: 1/price]');
    }

    const latestPrice = candles.length > 0 ? candles[candles.length - 1].close : null;

    return { candles, price: latestPrice, invert };
}

// ==================== TEST ====================
async function test() {
    const ticker = '0xaa7a70070e7495fe86c67225329dbd39baa2f63b-hour-100-eth';

    console.log('='.repeat(60));
    console.log('Testing:', ticker);
    console.log('='.repeat(60));

    const result = await fetchSpotCandles(ticker);

    console.log('\n✅ Latest Price:', result.price);
    console.log('Inverted:', result.invert);
    console.log('Total Candles:', result.candles.length);

    console.log('\nLast 3 candles:');
    result.candles.slice(-3).forEach(c => {
        const date = new Date(c.time * 1000).toLocaleString();
        console.log(`  ${date} | Close: ${c.close}`);
    });

    return result;
}

test().catch(e => console.error('Error:', e.message));
