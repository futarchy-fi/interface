'use client';

import { useState, useCallback, useEffect } from 'react';

// Subgraph endpoints configuration
const SUBGRAPH_ENDPOINTS = {
    1: 'https://api.studio.thegraph.com/query/1718249/uniswap-proposal-candles/version/latest',
    100: 'https://api.studio.thegraph.com/query/1718249/algebra-proposals-candles/version/latest'
};

// GraphQL queries
const QUERIES = {
    GET_CONDITIONAL_POOLS: `
    query GetConditionalPools($proposalId: String!) {
      pools(where: { proposal: $proposalId, type: "CONDITIONAL" }) {
        id
        name
        type
        outcomeSide
        price
        isInverted
        proposal {
          id
          marketName
        }
      }
    }
  `,

    GET_CANDLES: `
    query GetCandles($poolId: String!, $limit: Int!) {
      candles(
        where: { pool: $poolId }
        first: $limit
        orderBy: periodStartUnix
        orderDirection: desc
      ) {
        periodStartUnix
        open
        high
        low
        close
        volumeUSD
      }
    }
  `
};

/**
 * Execute a GraphQL query against a subgraph
 */
async function executeQuery(endpoint, query, variables = {}) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
}

/**
 * Adapt candles to chart-compatible format
 * Output: { time: number, value: number }[]
 * IMPORTANT: Deduplicates timestamps - lightweight-charts requires unique ascending times
 */
function adaptCandlesToChartFormat(candles) {
    if (!candles || !Array.isArray(candles)) {
        return [];
    }

    // Map and filter
    const mapped = candles
        .map(candle => ({
            time: parseInt(candle.periodStartUnix, 10),
            value: parseFloat(candle.close)
        }))
        .filter(point => !isNaN(point.time) && !isNaN(point.value));

    // Sort ascending by time
    mapped.sort((a, b) => a.time - b.time);

    // Deduplicate - keep the LAST entry for each timestamp (most recent value)
    const uniqueByTime = new Map();
    for (const point of mapped) {
        uniqueByTime.set(point.time, point);
    }

    // Convert back to array and ensure ascending order
    const result = Array.from(uniqueByTime.values()).sort((a, b) => a.time - b.time);

    return result;
}

/**
 * Hook to fetch chart data from subgraph
 * 
 * @param {string} proposalId - The proposal address
 * @param {number} chainId - Chain ID (1 or 100)
 * @param {number} candleLimit - Maximum candles to fetch per pool
 */
export function useSubgraphData(proposalId, chainId, candleLimit = 500) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState({
        yesData: [],
        noData: [],
        yesPrice: null,
        noPrice: null,
        yesPool: null,
        noPool: null,
        hasData: false,
        lastUpdated: null
    });

    const endpoint = SUBGRAPH_ENDPOINTS[chainId];

    // fetchData accepts a 'silent' param - when true, doesn't show loading overlay (for auto-resync)
    const fetchData = useCallback(async (silent = false) => {
        if (!proposalId || !endpoint) {
            setError(proposalId ? `Chain ${chainId} is not supported` : 'No proposal ID provided');
            return;
        }

        // Only show loading for manual resync, not auto-resync
        if (!silent) {
            setLoading(true);
        }
        setError(null);

        try {
            // Step 1: Get CONDITIONAL pools
            const poolsData = await executeQuery(endpoint, QUERIES.GET_CONDITIONAL_POOLS, {
                proposalId: proposalId.toLowerCase()
            });

            const pools = poolsData.pools || [];
            const yesPool = pools.find(p => p.outcomeSide === 'YES') || null;
            const noPool = pools.find(p => p.outcomeSide === 'NO') || null;

            if (!yesPool && !noPool) {
                setData({
                    yesData: [],
                    noData: [],
                    yesPrice: null,
                    noPrice: null,
                    yesPool: null,
                    noPool: null,
                    hasData: false,
                    lastUpdated: new Date()
                });
                setLoading(false);
                return;
            }

            // Step 2: Fetch candles for each pool
            const [yesCandlesData, noCandlesData] = await Promise.all([
                yesPool
                    ? executeQuery(endpoint, QUERIES.GET_CANDLES, { poolId: yesPool.id.toLowerCase(), limit: candleLimit })
                    : Promise.resolve({ candles: [] }),
                noPool
                    ? executeQuery(endpoint, QUERIES.GET_CANDLES, { poolId: noPool.id.toLowerCase(), limit: candleLimit })
                    : Promise.resolve({ candles: [] })
            ]);

            // Step 3: Transform data
            const yesData = adaptCandlesToChartFormat(yesCandlesData.candles);
            const noData = adaptCandlesToChartFormat(noCandlesData.candles);

            // Step 4: Add "live candle" - current pool price at current timestamp
            // This extends the chart to "now" with the latest price
            const now = Math.floor(Date.now() / 1000);

            if (yesPool) {
                const liveYesPrice = parseFloat(yesPool.price);
                // Only add if it's newer than the last candle
                if (yesData.length === 0 || now > yesData[yesData.length - 1].time) {
                    yesData.push({ time: now, value: liveYesPrice });
                }
            }

            if (noPool) {
                const liveNoPrice = parseFloat(noPool.price);
                // Only add if it's newer than the last candle
                if (noData.length === 0 || now > noData[noData.length - 1].time) {
                    noData.push({ time: now, value: liveNoPrice });
                }
            }

            // Get latest prices (from the live candle we just added)
            const yesPrice = yesData.length > 0
                ? yesData[yesData.length - 1].value
                : (yesPool ? parseFloat(yesPool.price) : null);
            const noPrice = noData.length > 0
                ? noData[noData.length - 1].value
                : (noPool ? parseFloat(noPool.price) : null);

            setData({
                yesData,
                noData,
                yesPrice,
                noPrice,
                yesPool: yesPool ? {
                    address: yesPool.id,
                    name: yesPool.name,
                    outcomeSide: yesPool.outcomeSide,
                    price: parseFloat(yesPool.price)
                } : null,
                noPool: noPool ? {
                    address: noPool.id,
                    name: noPool.name,
                    outcomeSide: noPool.outcomeSide,
                    price: parseFloat(noPool.price)
                } : null,
                hasData: yesData.length > 0 || noData.length > 0,
                lastUpdated: new Date()
            });

        } catch (err) {
            console.error('[useSubgraphData] Error fetching data:', err);
            setError(err.message);
        } finally {
            // Only clear loading if we set it (non-silent mode)
            if (!silent) {
                setLoading(false);
            }
        }
    }, [proposalId, chainId, endpoint, candleLimit]);

    // Fetch on mount
    useEffect(() => {
        if (proposalId && endpoint) {
            fetchData();
        }
    }, [proposalId, endpoint, fetchData]);

    return {
        ...data,
        loading,
        error,
        refetch: fetchData
    };
}
