#!/usr/bin/env node
/**
 * SUPER GENERIC Spot Price Fetcher
 * 
 * Single argument format:
 *   <tokens-or-pool>-<interval>-<limit>-<network>
 * 
 * Token with rate provider:
 *   BASE::0xRATEPROVIDER/QUOTE-interval-limit-network
 * 
 * Examples:
 *   VLR/USDC-hour-50-eth
 *   waGnoGNO::0xbbb4966335677ea24f7b86dc19a423412390e1fb/sDAI-4hour-100-xdai
 *   0xd1d7fa8871d84d0e77020fc28b7cd5718c446522-day-200-xdai
 * 
 * Intervals: minute, 5min, 15min, hour, 4hour, 12hour, day
 */

const { fetchCandles, findPool, fetchPoolInfo } = require('./geckoFetcher');
const { getRate, getRateBySymbol } = require('./rateProvider');

// URL decode if needed
function decodeInput(input) {
    if (input.includes('%')) {
        return decodeURIComponent(input);
    }
    return input;
}

// Network to chainId mapping for RPC calls
const NETWORK_CHAIN_ID = {
    'xdai': 100,
    'gnosis': 100,
    'eth': 1,
    'ethereum': 1,
    'mainnet': 1,
    'base': 8453,
    'arbitrum': 42161,
    'polygon': 137,
};

// Parse interval string to GeckoTerminal format
function parseInterval(interval) {
    const map = {
        'minute': { timeframe: 'minute', aggregate: 1 },
        '1min': { timeframe: 'minute', aggregate: 1 },
        '5min': { timeframe: 'minute', aggregate: 5 },
        '15min': { timeframe: 'minute', aggregate: 15 },
        'hour': { timeframe: 'hour', aggregate: 1 },
        '1hour': { timeframe: 'hour', aggregate: 1 },
        '4hour': { timeframe: 'hour', aggregate: 4 },
        '12hour': { timeframe: 'hour', aggregate: 12 },
        'day': { timeframe: 'day', aggregate: 1 },
        '1day': { timeframe: 'day', aggregate: 1 },
    };

    return map[interval.toLowerCase()] || { timeframe: 'hour', aggregate: 1 };
}

// Parse token with optional rate provider: TOKEN::0xRATE or just TOKEN
function parseTokenWithRate(tokenStr) {
    if (tokenStr.includes('::')) {
        const [symbol, rateProvider] = tokenStr.split('::');
        return { symbol, rateProvider };
    }
    return { symbol: tokenStr, rateProvider: null };
}

// Parse the shortcut format
function parseShortcut(input) {
    const isPoolAddress = input.startsWith('0x') && !input.includes('/');

    if (isPoolAddress) {
        // Pool format: 0xabc...-interval-limit-network
        const match = input.match(/^(0x[a-fA-F0-9]+)-([^-]+)-(\d+)-(\w+)$/);
        if (match) {
            return {
                poolAddress: match[1],
                interval: match[2],
                limit: parseInt(match[3], 10),
                network: match[4],
            };
        }
        // Minimal: 0xabc...-network
        const minMatch = input.match(/^(0x[a-fA-F0-9]+)-(\w+)$/);
        if (minMatch) {
            return {
                poolAddress: minMatch[1],
                interval: 'hour',
                limit: 100,
                network: minMatch[2],
            };
        }
    } else {
        // Token format: BASE::RATE/QUOTE-interval-limit-network
        const parts = input.split('-');
        const tokenPart = parts[0]; // e.g., "waGnoGNO::0xabc.../sDAI"

        // Parse BASE::RATE/QUOTE
        const [baseWithRate, quote] = tokenPart.split('/');
        const { symbol: baseSymbol, rateProvider } = parseTokenWithRate(baseWithRate);
        const tokens = `${baseSymbol}/${quote}`;

        if (parts.length >= 4) {
            return {
                tokens,
                baseSymbol,
                quoteSymbol: quote,
                rateProvider,
                interval: parts[1],
                limit: parseInt(parts[2], 10),
                network: parts[3],
            };
        }
        if (parts.length === 3) {
            if (isNaN(parseInt(parts[1], 10))) {
                return { tokens, baseSymbol, quoteSymbol: quote, rateProvider, interval: parts[1], limit: 100, network: parts[2] };
            } else {
                return { tokens, baseSymbol, quoteSymbol: quote, rateProvider, interval: 'hour', limit: parseInt(parts[1], 10), network: parts[2] };
            }
        }
        if (parts.length === 2) {
            return { tokens, baseSymbol, quoteSymbol: quote, rateProvider, interval: 'hour', limit: 100, network: parts[1] };
        }
    }

    throw new Error(`Invalid format. Use: BASE::0xRATE/QUOTE-interval-limit-network or 0xpool-interval-limit-network`);
}

async function main(input) {
    // URL decode if needed
    const decodedInput = decodeInput(input);

    // Parse the shortcut
    const config = parseShortcut(decodedInput);
    const { timeframe, aggregate } = parseInterval(config.interval);
    const chainId = NETWORK_CHAIN_ID[config.network] || 100;

    // Resolve pool
    let pool;
    if (config.poolAddress) {
        pool = await fetchPoolInfo(config.poolAddress, config.network);
    } else {
        const found = await findPool(config.baseSymbol, config.quoteSymbol, config.network);
        if (!found) throw new Error(`No pool found for ${config.tokens} on ${config.network}`);
        pool = await fetchPoolInfo(found.address, config.network);
    }

    // Fetch candles
    const candles = await fetchCandles(pool.address, {
        network: config.network,
        timeframe,
        aggregate,
        limit: config.limit,
    });

    // Apply rate if specified or auto-detect
    let rate = 1;
    let rateInfo = null;

    if (config.rateProvider) {
        // Manual rate provider from input
        rate = await getRate(config.rateProvider, chainId);
        rateInfo = { provider: config.rateProvider, rate, token: config.baseSymbol, source: 'manual' };
    } else if (pool.baseToken) {
        // Auto-detect from known providers
        const detected = await getRateBySymbol(pool.baseToken, chainId);
        if (detected.needed) {
            rate = detected.rate;
            rateInfo = { provider: detected.provider, rate, token: detected.symbol, source: 'auto' };
        }
    }

    // Apply rate
    const finalCandles = candles.map(c => ({
        time: c.time,
        value: c.value * rate,
    }));

    const price = finalCandles.length > 0 ? finalCandles[finalCandles.length - 1].value : null;

    return {
        candles: finalCandles,
        pool: {
            address: pool.address,
            name: pool.name,
            baseToken: pool.baseToken,
            quoteToken: pool.quoteToken,
        },
        price,
        rate: rateInfo,
        params: {
            network: config.network,
            chainId,
            timeframe,
            aggregate,
            limit: config.limit,
        },
        count: finalCandles.length,
    };
}

// CLI
if (require.main === module) {
    const input = process.argv[2];

    if (!input || input === '--help') {
        console.log(`
SUPER GENERIC Spot Fetcher

Format: <tokens>-<interval>-<limit>-<network>

With Rate Provider:
  BASE::0xRATEPROVIDER/QUOTE-interval-limit-network

Intervals: minute, 5min, 15min, hour, 4hour, 12hour, day

Examples:
  node spot.js VLR/USDC-hour-50-eth
  node spot.js waGnoGNO::0xbbb4966335677ea24f7b86dc19a423412390e1fb/sDAI-4hour-100-xdai
  node spot.js GNO/WXDAI-day-200-xdai
  node spot.js 0xd1d7fa8871d84d0e77020fc28b7cd5718c446522-hour-100-xdai

Shortcuts:
  node spot.js VLR/USDC-eth           # defaults: hour, 100 candles
  node spot.js VLR/USDC-50-eth        # defaults: hour
  node spot.js VLR/USDC-4hour-eth     # defaults: 100 candles
        `);
        process.exit(0);
    }

    main(input)
        .then(result => {
            console.log(JSON.stringify(result, null, 2));
        })
        .catch(err => {
            console.error(JSON.stringify({ error: err.message }));
            process.exit(1);
        });
}

module.exports = { main, parseShortcut, NETWORK_CHAIN_ID };
