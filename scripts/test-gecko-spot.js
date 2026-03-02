/**
 * Test GeckoTerminal Spot Price Fetcher
 * 
 * Fetches candle data from GeckoTerminal API using the same config format
 * as spotClient.js and MarketPageShowcase.
 * 
 * Current config in MarketPageShowcase for 0x45e...:
 *   'waGnoGNO/sDAI-hour-500-xdai'
 * 
 * Usage: node scripts/test-gecko-spot.js
 * Output: scripts/test-gecko-output.json
 */

const fs = require('fs');
const path = require('path');

const GECKO_API = 'https://api.geckoterminal.com/api/v2';

// Config from MarketPageShowcase for 0x45e1064348fD8A407D6D1F59Fc64B05F633b28FC
const SPOT_CONFIG = 'waGnoGNO/sDAI-hour-500-xdai';

// ============================================================
// CONFIG PARSER (same logic as spotClient.js)
// ============================================================
function parseConfig(input) {
    if (!input) return null;

    const decoded = input.includes('%') ? decodeURIComponent(input) : input;
    const parts = decoded.split('-');
    const tokenPart = parts[0];

    // Check for invert flag
    const invert = parts[parts.length - 1]?.toLowerCase() === 'invert';
    const partsWithoutInvert = invert ? parts.slice(0, -1) : parts;

    // Check if direct pool address
    if (tokenPart.toLowerCase().startsWith('0x') && !tokenPart.includes('/')) {
        return {
            poolAddress: tokenPart,
            base: null,
            quote: null,
            rateProvider: null,
            interval: partsWithoutInvert[1] || 'hour',
            limit: parseInt(partsWithoutInvert[2] || '100'),
            network: partsWithoutInvert[3] || 'xdai',
            invert,
        };
    }

    // Parse base::rate/quote or base/quote
    const [baseWithRate, quote] = tokenPart.split('/');
    let base = baseWithRate;
    let rateProvider = null;

    if (baseWithRate.includes('::')) {
        [base, rateProvider] = baseWithRate.split('::');
    }

    return {
        poolAddress: null,
        base,
        quote,
        rateProvider,
        interval: partsWithoutInvert[1] || 'hour',
        limit: parseInt(partsWithoutInvert[2] || '100'),
        network: partsWithoutInvert[3] || 'xdai',
        invert,
    };
}

// ============================================================
// GECKO API FUNCTIONS
// ============================================================
async function searchPool(network, base, quote) {
    const query = `${base} ${quote}`;
    const url = `${GECKO_API}/search/pools?query=${encodeURIComponent(query)}&network=${network}`;

    console.log('Searching pools:', url);

    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);

    const data = await res.json();
    const pools = data.data || [];

    console.log('Found', pools.length, 'pools matching', query);

    // Log all matching pools
    const matching = pools.filter(p => {
        const name = p.attributes?.name?.toLowerCase() || '';
        return name.includes(base.toLowerCase()) && name.includes(quote.toLowerCase());
    });

    console.log('Filtered to', matching.length, 'pools with both tokens');

    if (matching.length > 0) {
        console.log('');
        console.log('Matching pools:');
        matching.slice(0, 5).forEach((p, i) => {
            console.log(`  ${i + 1}. ${p.attributes?.name}`);
            console.log(`     Address: ${p.attributes?.address}`);
            console.log(`     TVL: $${parseFloat(p.attributes?.reserve_in_usd || 0).toFixed(2)}`);
        });
    }

    const best = matching[0];
    if (!best) throw new Error(`Pool not found: ${base}/${quote}`);

    return {
        address: best.attributes?.address,
        name: best.attributes?.name,
        network: best.relationships?.network?.data?.id || network,
    };
}

async function fetchCandles(poolInfo, interval, limit) {
    const timeframe = interval.includes('hour') ? 'hour' : interval.includes('min') ? 'minute' : 'day';
    // currency=token gives price in quote token, not USD
    const url = `${GECKO_API}/networks/${poolInfo.network}/pools/${poolInfo.address}/ohlcv/${timeframe}?aggregate=1&limit=${limit}&currency=token`;

    console.log('');
    console.log('Fetching candles:', url);

    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`Candles failed: ${res.status}`);

    const data = await res.json();
    const ohlcv = data.data?.attributes?.ohlcv_list || [];

    console.log('Received', ohlcv.length, 'raw candles from API');

    // Transform: [timestamp, open, high, low, close, volume] -> { time, value }
    // GeckoTerminal returns timestamps in SECONDS already
    const raw = ohlcv.map(c => ({
        time: c[0],
        timeHuman: new Date(c[0] * 1000).toISOString(),
        open: parseFloat(c[1]),
        high: parseFloat(c[2]),
        low: parseFloat(c[3]),
        close: parseFloat(c[4]),
        volume: parseFloat(c[5]),
    })).reverse(); // Oldest first

    // Dedupe by time
    const seen = new Set();
    return raw.filter(c => {
        if (seen.has(c.time)) return false;
        seen.add(c.time);
        return true;
    }).sort((a, b) => a.time - b.time);
}

// ============================================================
// RATE PROVIDER (optional - for wrapped tokens)
// ============================================================
async function getRate(rateProviderAddress, rpcUrl) {
    // This would call getRate() on the contract
    // For now, just return 1 (no rate adjustment)
    console.log('');
    console.log('Rate provider specified:', rateProviderAddress);
    console.log('(Would call getRate() on contract - skipping for test)');
    return 1;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
    const output = { log: [], result: null };
    const log = (msg) => { output.log.push(msg); console.log(msg); };

    log('GeckoTerminal Spot Price Fetcher Test');
    log('=====================================');
    log('');
    log('Config string: ' + SPOT_CONFIG);
    log('');

    // Parse config
    const config = parseConfig(SPOT_CONFIG);
    log('Parsed config:');
    log('  Base: ' + config.base);
    log('  Quote: ' + config.quote);
    log('  Interval: ' + config.interval);
    log('  Limit: ' + config.limit);
    log('  Network: ' + config.network);
    log('  Rate Provider: ' + (config.rateProvider || 'none'));
    log('  Invert: ' + config.invert);
    log('');

    // Search for pool
    log('Step 1: Searching for pool on GeckoTerminal...');
    let pool;
    if (config.poolAddress) {
        pool = { address: config.poolAddress, name: 'Direct Pool', network: config.network };
        log('  Using direct pool address: ' + pool.address);
    } else {
        pool = await searchPool(config.network, config.base, config.quote);
        log('');
        log('Selected pool: ' + pool.name);
        log('  Address: ' + pool.address);
    }

    // Fetch candles
    log('');
    log('Step 2: Fetching OHLCV candles...');
    let candles = await fetchCandles(pool, config.interval, config.limit);
    log('Processed ' + candles.length + ' candles');

    // Apply rate if specified
    if (config.rateProvider) {
        const rate = await getRate(config.rateProvider, 'https://rpc.gnosischain.com');
        if (rate !== 1) {
            candles = candles.map(c => ({
                ...c,
                open: c.open * rate,
                high: c.high * rate,
                low: c.low * rate,
                close: c.close * rate,
            }));
            log('Applied rate: ' + rate);
        }
    }

    // Apply invert if specified
    if (config.invert) {
        candles = candles.map(c => ({
            ...c,
            open: 1 / c.open,
            high: 1 / c.low, // Note: high/low swap when inverting
            low: 1 / c.high,
            close: 1 / c.close,
        }));
        log('Inverted prices (1/price)');
    }

    // Show last 10 candles
    const last10 = candles.slice(-10);
    log('');
    log('LAST 10 HOURLY CANDLES:');
    log('Time (UTC)              | Close Price');
    log('----------------------- | -----------');

    for (const c of last10) {
        const timeStr = c.timeHuman.replace('T', ' ').replace('.000Z', '');
        log(timeStr + ' | ' + c.close.toFixed(4));
    }

    // Latest price
    if (candles.length > 0) {
        const latest = candles[candles.length - 1];
        log('');
        log('=====================================');
        log('POOL: ' + pool.name);
        log('LATEST ' + config.base + '/' + config.quote + ' PRICE: ' + latest.close.toFixed(4));
        log('  at: ' + latest.timeHuman);
        log('=====================================');

        output.result = {
            config: SPOT_CONFIG,
            pool: {
                name: pool.name,
                address: pool.address,
                network: pool.network
            },
            latestPrice: latest.close,
            timestamp: latest.timeHuman,
            candleCount: candles.length,
            last10Candles: last10
        };
    }

    // Write output
    const outputPath = path.join(__dirname, 'test-gecko-output.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    log('');
    log('Output written to: ' + outputPath);
}

main().catch(console.error);
