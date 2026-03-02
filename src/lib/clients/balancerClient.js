/**
 * Balancer Candle Client
 * Fetches hourly candles from the local Express Balancer server
 * Used by MarketPageShowcase for SPOT price data
 */

// Configurable server URL - defaults to localhost:3456
const BALANCER_SERVER_URL =
    (typeof window !== 'undefined' && window.BALANCER_SERVER_URL) ||
    'http://localhost:3456';

/**
 * Fetch hourly candles for a preset from the Balancer server
 * @param {string} preset - Preset name (e.g., 'GNO_SDAI')
 * @param {Object} options - Query options
 * @param {number} options.from - Start timestamp (Unix seconds)
 * @param {number} options.to - End timestamp (Unix seconds)
 * @param {boolean} options.fill - Whether to fill gaps (default: true)
 * @returns {Promise<{ candles: Array, price: number, error: string }>}
 */
export async function fetchBalancerCandles(preset, options = {}) {
    try {
        const params = new URLSearchParams();
        if (options.from) params.set('from', options.from.toString());
        if (options.to) params.set('to', options.to.toString());
        if (options.fill === false) params.set('fill', 'false');

        const url = `${BALANCER_SERVER_URL}/candles/${preset}?${params}`;

        const response = await fetch(url);

        if (!response.ok) {
            const err = await response.json();
            return { candles: [], price: null, error: err.error || 'Server error' };
        }

        const data = await response.json();

        // Transform to the format SubgraphChart expects
        // { time, open, high, low, close } → { time, value } for line chart
        // or keep OHLC for candlestick
        const candles = data.candles.map(c => ({
            time: c.time,
            value: c.close,  // Use close price for line chart
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close
        }));

        return {
            candles,
            price: data.latestPrice,
            preset: data.preset,
            name: data.name,
            error: null
        };
    } catch (err) {
        console.error('[balancerClient] Error:', err);
        return {
            candles: [],
            price: null,
            error: err.message || 'Connection failed'
        };
    }
}

/**
 * Fetch just the latest price for a preset
 * @param {string} preset - Preset name
 * @returns {Promise<{ price: number, timestamp: string, error: string }>}
 */
export async function fetchBalancerPrice(preset) {
    try {
        const url = `${BALANCER_SERVER_URL}/price/${preset}`;
        const response = await fetch(url);

        if (!response.ok) {
            const err = await response.json();
            return { price: null, error: err.error };
        }

        const data = await response.json();
        return {
            price: data.price,
            timestamp: data.timestamp,
            error: null
        };
    } catch (err) {
        return { price: null, error: err.message };
    }
}

/**
 * Check health of the Balancer server
 * @returns {Promise<{ ok: boolean, presets: Object, error: string }>}
 */
export async function checkBalancerHealth() {
    try {
        const url = `${BALANCER_SERVER_URL}/health`;
        const response = await fetch(url);

        if (!response.ok) {
            return { ok: false, presets: {}, error: 'Server not responding' };
        }

        const data = await response.json();
        return {
            ok: data.status === 'ok',
            presets: data.presets || {},
            uptime: data.uptime,
            error: null
        };
    } catch (err) {
        return {
            ok: false,
            presets: {},
            error: `Connection failed: ${err.message}`
        };
    }
}

/**
 * Parse a ticker string and return preset details
 * Format: balancer::PRESET
 * Example: balancer::GNO_SDAI
 * 
 * @param {string} ticker - Ticker string
 * @returns {{ isBalancer: boolean, preset: string }}
 */
export function parseBalancerTicker(ticker) {
    if (!ticker || typeof ticker !== 'string') {
        return { isBalancer: false, preset: null };
    }

    if (ticker.startsWith('balancer::')) {
        const preset = ticker.replace('balancer::', '');
        return { isBalancer: true, preset };
    }

    return { isBalancer: false, preset: null };
}

/**
 * Main entry point - fetch candles based on ticker
 * Handles both 'balancer::PRESET' format and direct preset names
 * 
 * @param {string} tickerOrPreset - Either 'balancer::GNO_SDAI' or 'GNO_SDAI'
 * @param {Object} options - Query options (from, to, fill)
 */
export async function fetchSpotFromBalancer(tickerOrPreset, options = {}) {
    const { isBalancer, preset } = parseBalancerTicker(tickerOrPreset);
    const presetName = isBalancer ? preset : tickerOrPreset;

    return fetchBalancerCandles(presetName, options);
}

export default {
    fetchBalancerCandles,
    fetchBalancerPrice,
    checkBalancerHealth,
    parseBalancerTicker,
    fetchSpotFromBalancer
};
