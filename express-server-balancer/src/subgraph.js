/**
 * Balancer Subgraph Client
 * Fetches swap data from Balancer V2 subgraph on Gnosis
 */

const fetch = require('node-fetch');

const SUBGRAPH_URL = (apiKey) =>
    `https://gateway-arbitrum.network.thegraph.com/api/${apiKey}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg`;

async function querySubgraph(apiKey, query, variables = {}) {
    const response = await fetch(SUBGRAPH_URL(apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
    });

    const result = await response.json();

    if (result.errors) {
        throw new Error(`Subgraph error: ${result.errors[0].message}`);
    }

    return result.data;
}

/**
 * Fetch swaps from a specific pool starting from a timestamp
 * Uses pagination via timestamp_gt to get all swaps
 */
async function fetchSwaps(apiKey, poolId, fromTimestamp, limit = 1000) {
    const query = `
        query GetSwaps($poolId: String!, $from: Int!, $limit: Int!) {
            swaps(
                where: { poolId: $poolId, timestamp_gte: $from }
                orderBy: timestamp
                orderDirection: asc
                first: $limit
            ) {
                id
                timestamp
                tokenIn
                tokenOut
                tokenAmountIn
                tokenAmountOut
            }
        }
    `;

    const data = await querySubgraph(apiKey, query, {
        poolId,
        from: fromTimestamp,
        limit
    });

    return data.swaps || [];
}

/**
 * Fetch swaps with pagination - gets ALL swaps from a timestamp
 * by repeatedly calling with timestamp_gt
 */
async function fetchAllSwaps(apiKey, poolId, fromTimestamp, maxPages = 10) {
    const allSwaps = [];
    let lastTimestamp = fromTimestamp;
    let page = 0;

    while (page < maxPages) {
        const swaps = await fetchSwaps(apiKey, poolId, lastTimestamp);

        if (swaps.length === 0) break;

        allSwaps.push(...swaps);

        // Get the last timestamp + 1 for next page
        lastTimestamp = swaps[swaps.length - 1].timestamp;

        // If we got less than 1000, we've reached the end
        if (swaps.length < 1000) break;

        page++;

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 100));
    }

    return allSwaps;
}

/**
 * Get the latest swap timestamp from a pool
 */
async function getLatestSwapTimestamp(apiKey, poolId) {
    const query = `
        query GetLatestSwap($poolId: String!) {
            swaps(
                where: { poolId: $poolId }
                orderBy: timestamp
                orderDirection: desc
                first: 1
            ) {
                timestamp
            }
        }
    `;

    const data = await querySubgraph(apiKey, query, { poolId });
    return data.swaps?.[0]?.timestamp || null;
}

module.exports = {
    querySubgraph,
    fetchSwaps,
    fetchAllSwaps,
    getLatestSwapTimestamp
};
