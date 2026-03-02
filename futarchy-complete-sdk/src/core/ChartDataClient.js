// src/core/ChartDataClient.js
/**
 * Self-contained Chart Data Client for futarchy-complete-sdk
 * Fetches candles and trades from subgraph (no external dependencies)
 */

import { CANDLE_SUBGRAPHS, EXPLORERS } from '../config/subgraphEndpoints.js';

// Use unified config
const SUBGRAPH_ENDPOINTS = CANDLE_SUBGRAPHS;

/**
 * Fetch pools for a proposal
 */
export async function fetchPools(chainId, proposalId) {
    const endpoint = SUBGRAPH_ENDPOINTS[chainId];
    if (!endpoint) {
        return { pools: [], error: `Unsupported chain: ${chainId}` };
    }

    const query = `{
        pools(where: { proposal: "${proposalId.toLowerCase()}", type: "CONDITIONAL" }) {
            id
            name
            type
            outcomeSide
            price
        }
    }`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        const result = await response.json();
        if (result.errors) {
            return { pools: [], error: result.errors[0]?.message };
        }

        const pools = result.data?.pools || [];
        const yesPool = pools.find(p => p.outcomeSide === 'YES');
        const noPool = pools.find(p => p.outcomeSide === 'NO');

        return { yesPool, noPool, error: null };
    } catch (error) {
        return { yesPool: null, noPool: null, error: error.message };
    }
}

/**
 * Fetch candles from subgraph
 */
export async function fetchCandles(chainId, proposalId, limit = 500, startTime = null) {
    const endpoint = SUBGRAPH_ENDPOINTS[chainId];
    if (!endpoint) {
        return { yesData: [], noData: [], error: `Unsupported chain: ${chainId}` };
    }

    const query = `{
        pools(where: { proposal: "${proposalId.toLowerCase()}", type: "CONDITIONAL" }) {
            id
            name
            type
            outcomeSide
            price
            candles(first: ${limit}, orderBy: periodStartUnix, orderDirection: desc, where: { period: "3600" }) {
                periodStartUnix
                period
                open
                high
                low
                close
                volumeToken0
                volumeToken1
            }
        }
    }`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        const result = await response.json();
        if (result.errors) {
            return { yesData: [], noData: [], error: result.errors[0]?.message };
        }

        const pools = result.data?.pools || [];
        const yesPool = pools.find(p => p.outcomeSide === 'YES');
        const noPool = pools.find(p => p.outcomeSide === 'NO');

        const adaptCandles = (candles, startTime) => {
            if (!candles || candles.length === 0) return [];
            let data = candles
                .map(c => ({
                    time: parseInt(c.periodStartUnix, 10),
                    open: parseFloat(c.open),
                    high: parseFloat(c.high),
                    low: parseFloat(c.low),
                    close: parseFloat(c.close),
                    volumeToken0: parseFloat(c.volumeToken0),
                    volumeToken1: parseFloat(c.volumeToken1)
                }))
                .filter(c => !isNaN(c.time) && !isNaN(c.close))
                .sort((a, b) => a.time - b.time);

            if (startTime) {
                data = data.filter(c => c.time >= startTime);
            }
            return data;
        };

        return {
            yesData: yesPool ? adaptCandles(yesPool.candles, startTime) : [],
            noData: noPool ? adaptCandles(noPool.candles, startTime) : [],
            yesPool: yesPool ? { id: yesPool.id, name: yesPool.name, price: parseFloat(yesPool.price) } : null,
            noPool: noPool ? { id: noPool.id, name: noPool.name, price: parseFloat(noPool.price) } : null,
            error: null
        };
    } catch (error) {
        return { yesData: [], noData: [], error: error.message };
    }
}

/**
 * Fetch trades/swaps from subgraph
 */
export async function fetchTrades(chainId, poolAddresses, limit = 50, startTime = null) {
    const endpoint = SUBGRAPH_ENDPOINTS[chainId];
    if (!endpoint) {
        return { trades: [], error: `Unsupported chain: ${chainId}` };
    }

    if (!poolAddresses || poolAddresses.length === 0) {
        return { trades: [], error: 'No pool addresses provided' };
    }

    const poolIds = poolAddresses.map(p => p.toLowerCase());
    const explorerBase = EXPLORERS[chainId] || EXPLORERS[100];

    const query = `{
        swaps(
            where: { pool_in: ${JSON.stringify(poolIds)} }
            first: ${limit}
            orderBy: timestamp
            orderDirection: desc
        ) {
            id
            transactionHash
            timestamp
            origin
            amountIn
            amountOut
            price
            tokenIn {
                id
                symbol
                decimals
                role
            }
            tokenOut {
                id
                symbol
                decimals
                role
            }
            pool {
                id
                name
                type
                outcomeSide
            }
        }
    }`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        const result = await response.json();
        if (result.errors) {
            return { trades: [], error: result.errors[0]?.message };
        }

        const swaps = result.data?.swaps || [];

        // Convert to trade format
        const trades = swaps.map(swap => {
            const timestamp = parseInt(swap.timestamp);

            // Determine buy/sell from token roles
            const tOutRole = swap.tokenOut?.role || '';
            const isCompanyRole = (r) => r === 'YES_COMPANY' || r === 'NO_COMPANY' || r === 'COMPANY';
            const isBuy = isCompanyRole(tOutRole);

            return {
                id: swap.id,
                txHash: swap.transactionHash,
                txLink: `${explorerBase}${swap.transactionHash}`,
                timestamp: timestamp,
                timestampISO: new Date(timestamp * 1000).toISOString(),
                origin: swap.origin,
                amountIn: parseFloat(swap.amountIn),
                amountOut: parseFloat(swap.amountOut),
                price: parseFloat(swap.price),
                tokenInSymbol: swap.tokenIn?.symbol,
                tokenOutSymbol: swap.tokenOut?.symbol,
                tokenInRole: swap.tokenIn?.role,
                tokenOutRole: swap.tokenOut?.role,
                poolId: swap.pool?.id,
                poolName: swap.pool?.name,
                poolType: swap.pool?.type,
                outcomeSide: swap.pool?.outcomeSide,
                operationSide: isBuy ? 'buy' : 'sell'
            };
        }).filter(t => !startTime || t.timestamp >= startTime);

        return { trades, error: null };
    } catch (error) {
        return { trades: [], error: error.message };
    }
}

/**
 * Gap-fill candles (forward-fill missing hours)
 */
export function gapFillCandles(candles) {
    if (!candles || candles.length < 2) return candles;

    const filled = [];
    const sorted = [...candles].sort((a, b) => a.time - b.time);
    const hourInSeconds = 3600;

    for (let i = 0; i < sorted.length; i++) {
        filled.push(sorted[i]);

        if (i < sorted.length - 1) {
            const currentTime = sorted[i].time;
            const nextTime = sorted[i + 1].time;
            const gap = nextTime - currentTime;

            if (gap > hourInSeconds) {
                const numMissing = Math.floor(gap / hourInSeconds) - 1;
                for (let j = 1; j <= numMissing; j++) {
                    filled.push({
                        time: currentTime + (j * hourInSeconds),
                        close: sorted[i].close,
                        _gapFilled: true
                    });
                }
            }
        }
    }
    return filled;
}

/**
 * Export full chart data for a proposal
 */
export async function exportChartData(chainId, proposalId, options = {}) {
    const {
        candleLimit = 500,
        tradeLimit = 100,
        startTime = null,
        gapFill = true
    } = options;

    // Fetch candles
    const candleResult = await fetchCandles(chainId, proposalId, candleLimit, startTime);
    if (candleResult.error) {
        return { success: false, error: `Candles: ${candleResult.error}` };
    }

    let { yesData, noData, yesPool, noPool } = candleResult;

    // Gap-fill if requested
    if (gapFill) {
        yesData = gapFillCandles(yesData);
        noData = gapFillCandles(noData);

        // Sync start times: filter both to start where BOTH have data
        if (yesData.length > 0 && noData.length > 0) {
            const syncStart = Math.max(yesData[0].time, noData[0].time);
            const syncEnd = Math.min(yesData[yesData.length - 1].time, noData[noData.length - 1].time);

            yesData = yesData.filter(c => c.time >= syncStart && c.time <= syncEnd);
            noData = noData.filter(c => c.time >= syncStart && c.time <= syncEnd);

            console.log(`[ChartDataClient] Synced: YES=${yesData.length}, NO=${noData.length} candles (${new Date(syncStart * 1000).toISOString()} → ${new Date(syncEnd * 1000).toISOString()})`);
        }
    }

    // Fetch trades
    const poolAddresses = [yesPool?.id, noPool?.id].filter(Boolean);
    const tradeResult = await fetchTrades(chainId, poolAddresses, tradeLimit, startTime);

    return {
        success: true,
        proposal: proposalId,
        chainId: chainId,
        exportedAt: new Date().toISOString(),
        options: { candleLimit, tradeLimit, startTime, gapFill },
        pools: { yes: yesPool, no: noPool },
        candles: {
            yes: yesData,
            no: noData
        },
        trades: tradeResult.trades || [],
        tradesError: tradeResult.error
    };
}

// ==============================================================
// SPOT PRICE (GeckoTerminal)
// ==============================================================

const GECKO_API = 'https://api.geckoterminal.com/api/v2';

const NETWORK_MAP = {
    100: { gecko: 'xdai', name: 'Gnosis' },
    1: { gecko: 'eth', name: 'Ethereum' },
    8453: { gecko: 'base', name: 'Base' },
    xdai: { gecko: 'xdai', name: 'Gnosis' },
    eth: { gecko: 'eth', name: 'Ethereum' },
};

/**
 * Parse spot config string
 * Format: 0xPOOL[::0xRATE]-interval-limit-network
 * Example: 0x8189c4c96826d016a99986394103dfa9ae41e7ee::0x89c80a4540a00b5270347e02e2e144c71da2eced-hour-500-xdai
 */
function parseSpotConfig(configString) {
    if (!configString) return null;

    // URL decode if needed
    const decoded = configString.includes('%') ? decodeURIComponent(configString) : configString;

    const parts = decoded.split('-');
    const tokenPart = parts[0];

    // Check for rate provider
    let poolAddress = tokenPart;
    let rateProvider = null;

    if (tokenPart.includes('::')) {
        [poolAddress, rateProvider] = tokenPart.split('::');
    }

    return {
        poolAddress,
        rateProvider,
        interval: parts[1] || 'hour',
        limit: parseInt(parts[2] || '500'),
        network: parts[3] || 'xdai'
    };
}

/**
 * Fetch SPOT candles from GeckoTerminal
 * @param {string} configString - "0xPOOL::0xRATE-interval-limit-network"
 * @returns {Promise<{spotData: Array, spotPrice: number, error: string|null}>}
 */
export async function fetchSpotCandles(configString) {
    try {
        const config = parseSpotConfig(configString);
        if (!config) {
            return { spotData: [], spotPrice: null, error: 'Invalid config' };
        }

        const networkInfo = NETWORK_MAP[config.network] || NETWORK_MAP.xdai;
        const timeframe = config.interval.includes('hour') ? 'hour' : config.interval.includes('min') ? 'minute' : 'day';

        // currency=token gets price in quote token, not USD
        const url = `${GECKO_API}/networks/${networkInfo.gecko}/pools/${config.poolAddress}/ohlcv/${timeframe}?aggregate=1&limit=${config.limit}&currency=token`;

        console.log('[spotClient] Fetching:', url);

        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            return { spotData: [], spotPrice: null, error: `GeckoTerminal error: ${response.status}` };
        }

        const data = await response.json();
        const ohlcvList = data.data?.attributes?.ohlcv_list || [];

        // Transform: [timestamp_sec, open, high, low, close, volume]
        let candles = ohlcvList.map(row => ({
            time: row[0], // Already in seconds
            open: row[1],
            high: row[2],
            low: row[3],
            close: row[4],
            value: row[4], // close price
            volume: row[5]
        })).sort((a, b) => a.time - b.time);

        // Apply rate provider if specified (e.g. sDAI -> DAI rate)
        let rateApplied = null;
        if (config.rateProvider) {
            try {
                const rpcUrl = networkInfo.gecko === 'xdai' ? 'https://rpc.gnosischain.com' : 'https://eth.llamarpc.com';
                const rateAbi = ['function getRate() view returns (uint256)'];

                // Use fetch to call eth_call directly
                const callData = {
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'eth_call',
                    params: [{
                        to: config.rateProvider,
                        data: '0x679aefce' // getRate() selector
                    }, 'latest']
                };

                const rateResp = await fetch(rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(callData)
                });

                const rateResult = await rateResp.json();
                if (rateResult.result) {
                    // Parse rate (18 decimals)
                    const rateWei = BigInt(rateResult.result);
                    const rate = Number(rateWei) / 1e18;
                    rateApplied = rate;

                    // Divide candle prices by rate (sDAI rate means 1 DAI = rate sDAI)
                    candles = candles.map(c => ({
                        ...c,
                        open: c.open / rate,
                        high: c.high / rate,
                        low: c.low / rate,
                        close: c.close / rate,
                        value: c.value / rate
                    }));

                    console.log(`[spotClient] Applied rate: ${rate.toFixed(6)} (divided prices)`);
                }
            } catch (e) {
                console.log(`[spotClient] Rate provider error: ${e.message}`);
            }
        }

        const latestPrice = candles.length > 0 ? candles[candles.length - 1].value : null;

        return {
            spotData: candles,
            spotPrice: latestPrice,
            pool: config.poolAddress,
            rateProvider: config.rateProvider,
            rateApplied,
            error: null
        };
    } catch (e) {
        return { spotData: [], spotPrice: null, error: e.message };
    }
}

// ==============================================================
// COMPOSITE CANDLES (multi-pool with forward-fill)
// ==============================================================

/**
 * Fetch raw candles for a single pool (no rate/invert applied)
 * Returns a Map of time -> close price for easy lookup
 */
async function fetchRawPoolCandles(poolAddress, network, interval, limit) {
    const networkInfo = NETWORK_MAP[network] || NETWORK_MAP.xdai;
    const timeframe = interval.includes('hour') ? 'hour' : interval.includes('min') ? 'minute' : 'day';
    const url = `${GECKO_API}/networks/${networkInfo.gecko}/pools/${poolAddress}/ohlcv/${timeframe}?aggregate=1&limit=${limit}&currency=token`;

    console.log('[spotClient] Fetching pool:', poolAddress.slice(0, 10) + '...');

    const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
        throw new Error(`Pool ${poolAddress.slice(0, 10)} fetch failed: ${response.status}`);
    }

    const data = await response.json();
    const ohlcvList = data.data?.attributes?.ohlcv_list || [];

    // Return as Map for easy lookup: time -> close price
    const candleMap = new Map();
    ohlcvList.forEach(c => {
        candleMap.set(c[0], parseFloat(c[4])); // [timestamp, o, h, l, close, volume]
    });
    return candleMap;
}

/**
 * Forward-fill gaps in candle data
 * For each timestamp in allTimes, carry forward the last known value
 */
function forwardFillMap(candleMap, allTimes) {
    const filled = new Map();
    let lastValue = null;

    // Sort times ascending
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

/**
 * Parse composite config string
 * Format: composite::0xPOOL1[-invert]+0xPOOL2[-invert][::0xRATE]-interval-limit-network
 * Example: composite::0x21d4c792...+0x8189c4c9...::0x89c80a4...-hour-500-xdai
 */
function parseCompositeConfig(configString) {
    // Remove prefix
    const content = configString.replace('composite::', '');

    // Check for rate provider (last pool may have ::rate)
    let rateProvider = null;
    let contentWithoutRate = content;

    // Find if there's a ::0x pattern (rate provider)
    const rateMatch = content.match(/::0x([a-fA-F0-9]{40})/);
    if (rateMatch) {
        rateProvider = '0x' + rateMatch[1];
        // Remove rate from content
        contentWithoutRate = content.replace('::' + rateProvider, '');
    }

    const parts = contentWithoutRate.split('-');

    // Find the pools part (everything before interval)
    // Pools are separated by +
    const poolsPart = parts[0];
    const pools = poolsPart.split('+').map(p => {
        const isInvert = p.toLowerCase().endsWith('invert');
        const address = isInvert ? p.slice(0, -6) : p; // remove 'invert' suffix
        return { address: address.replace(/-$/, ''), invert: isInvert };
    });

    // Rest of parts: interval, limit, network
    return {
        pools,
        rateProvider,
        interval: parts.find(p => ['hour', 'minute', 'day'].includes(p)) || 'hour',
        limit: parseInt(parts.find(p => /^\d+$/.test(p)) || '100'),
        network: parts[parts.length - 1] || 'xdai'
    };
}

/**
 * Fetch composite candles from multiple pools
 * Multiplies prices together after forward-filling gaps
 * Optionally applies rate provider (divides by rate)
 * 
 * @param {string} configString - "composite::0xPOOL1[-invert]+0xPOOL2[-invert][::0xRATE]-interval-limit-network"
 * @returns {Promise<{spotData: Array, spotPrice: number, error: string|null}>}
 */
export async function fetchCompositeCandles(configString) {
    try {
        const config = parseCompositeConfig(configString);
        console.log('[spotClient] Composite config:', config);

        // Fetch all pools in parallel
        const poolMaps = await Promise.all(
            config.pools.map(p => fetchRawPoolCandles(p.address, config.network, config.interval, config.limit))
        );

        // Collect all unique timestamps
        const allTimes = new Set();
        poolMaps.forEach(m => m.forEach((_, time) => allTimes.add(time)));
        console.log('[spotClient] Total unique timestamps:', allTimes.size);

        // Forward-fill each pool
        const filledMaps = poolMaps.map(m => forwardFillMap(m, allTimes));

        // Find common timestamps (all pools have data after forward-fill)
        const commonTimes = [...allTimes].filter(time =>
            filledMaps.every(m => m.has(time))
        ).sort((a, b) => a - b);
        console.log('[spotClient] Common timestamps after fill:', commonTimes.length);

        // Fetch rate if rate provider specified
        let rateApplied = null;
        if (config.rateProvider) {
            try {
                const networkInfo = NETWORK_MAP[config.network] || NETWORK_MAP.xdai;
                const rpcUrl = networkInfo.gecko === 'xdai' ? 'https://rpc.gnosischain.com' : 'https://eth.llamarpc.com';

                const callData = {
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'eth_call',
                    params: [{
                        to: config.rateProvider,
                        data: '0x679aefce' // getRate() selector
                    }, 'latest']
                };

                const rateResp = await fetch(rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(callData)
                });

                const rateResult = await rateResp.json();
                if (rateResult.result) {
                    const rateWei = BigInt(rateResult.result);
                    rateApplied = Number(rateWei) / 1e18;
                    console.log(`[spotClient] Rate provider: ${rateApplied.toFixed(6)}`);
                }
            } catch (e) {
                console.log(`[spotClient] Rate provider error: ${e.message}`);
            }
        }

        // Build composite candles
        let candles = commonTimes.map(time => {
            let compositeValue = 1;

            config.pools.forEach((poolConfig, i) => {
                let value = filledMaps[i].get(time);
                if (poolConfig.invert) {
                    value = 1 / value;
                }
                compositeValue *= value;
            });

            return {
                time,
                open: compositeValue,
                high: compositeValue,
                low: compositeValue,
                close: compositeValue,
                value: compositeValue
            };
        });

        // Apply rate (divide by rate, same as simple spot)
        if (rateApplied) {
            candles = candles.map(c => ({
                ...c,
                open: c.open / rateApplied,
                high: c.high / rateApplied,
                low: c.low / rateApplied,
                close: c.close / rateApplied,
                value: c.value / rateApplied
            }));
            console.log(`[spotClient] Applied rate: ${rateApplied.toFixed(6)} (divided prices)`);
        }

        const latestPrice = candles.length > 0 ? candles[candles.length - 1].value : null;

        return {
            spotData: candles,
            spotPrice: latestPrice,
            pool: `Composite (${config.pools.length} pools)`,
            poolCount: config.pools.length,
            rateProvider: config.rateProvider,
            rateApplied,
            error: null
        };

    } catch (e) {
        console.error('[spotClient] Composite error:', e);
        return { spotData: [], spotPrice: null, error: e.message };
    }
}

/**
 * Main entry point - routes to appropriate handler
 * Supports: simple pool, pool::rate, and composite::
 */
export async function fetchSpotCandlesWithComposite(configString) {
    // Route to composite handler if composite:: prefix detected
    if (configString && configString.startsWith('composite::')) {
        console.log('[spotClient] Routing to composite handler');
        return fetchCompositeCandles(configString);
    }

    // Otherwise use standard handler
    return fetchSpotCandles(configString);
}

export default {
    fetchPools,
    fetchCandles,
    fetchTrades,
    gapFillCandles,
    exportChartData,
    fetchSpotCandles,
    fetchCompositeCandles,
    fetchSpotCandlesWithComposite,
    SUBGRAPH_ENDPOINTS,
    EXPLORERS
};
