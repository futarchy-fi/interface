/**
 * SubgraphPoolFetcher.js - Fetch pool prices directly from The Graph subgraph
 * 
 * Alternative to SupabasePoolFetcher.js that queries chain-specific subgraph endpoints
 * instead of the centralized Supabase pool_candles table.
 * 
 * Supports:
 * - Chain 1 (Ethereum Mainnet) - Uniswap V3 pools
 * - Chain 100 (Gnosis) - Algebra/Swapr pools
 */

import { SUBGRAPH_ENDPOINTS, getSubgraphEndpoint } from '../config/subgraphEndpoints';

/**
 * Fetch latest price for a single pool from subgraph
 * 
 * @param {string} poolAddress - The pool contract address
 * @param {number} chainId - Chain ID (1 or 100), defaults to 100 (Gnosis)
 * @returns {Promise<{ price: number, address: string, chainId: number } | null>}
 */
export async function fetchPoolPrice(poolAddress, chainId = 100) {
    const endpoint = getSubgraphEndpoint(chainId);

    if (!endpoint) {
        console.warn(`[SubgraphPoolFetcher] No endpoint for chain ${chainId}`);
        return null;
    }

    if (!poolAddress) {
        console.warn(`[SubgraphPoolFetcher] No pool address provided`);
        return null;
    }

    // Pool IDs in subgraph are lowercased
    const poolId = poolAddress.toLowerCase();

    const query = `{
        pool(id: "${poolId}") {
            id
            name
            price
            type
            outcomeSide
        }
    }`;

    try {
        console.log(`[SubgraphPoolFetcher] Fetching pool ${poolId} from chain ${chainId}`);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        const result = await response.json();

        if (result.errors) {
            console.error('[SubgraphPoolFetcher] GraphQL errors:', result.errors);
            return null;
        }

        const pool = result.data?.pool;

        if (!pool) {
            console.warn(`[SubgraphPoolFetcher] Pool ${poolId} not found in chain ${chainId}`);
            return null;
        }

        const price = parseFloat(pool.price);

        console.log(`[SubgraphPoolFetcher] ✅ Pool ${pool.name || poolId}: ${price}`);

        return {
            price: isNaN(price) ? null : price,
            address: pool.id,
            chainId,
            name: pool.name,
            type: pool.type,
            outcomeSide: pool.outcomeSide
        };

    } catch (error) {
        console.error(`[SubgraphPoolFetcher] Fetch error:`, error);
        return null;
    }
}

/**
 * Fetch prices for YES and NO pools in parallel
 * 
 * @param {Object} params
 * @param {string} params.yesAddress - YES pool address
 * @param {string} params.noAddress - NO pool address
 * @param {number} params.chainId - Chain ID (1 or 100), defaults to 100
 * @returns {Promise<{ yes: number|null, no: number|null, chainId: number }>}
 */
export async function fetchPoolPrices({ yesAddress, noAddress, chainId = 100 }) {
    console.log(`[SubgraphPoolFetcher] Fetching YES/NO prices for chain ${chainId}`);

    const [yesResult, noResult] = await Promise.all([
        yesAddress ? fetchPoolPrice(yesAddress, chainId) : Promise.resolve(null),
        noAddress ? fetchPoolPrice(noAddress, chainId) : Promise.resolve(null)
    ]);

    return {
        yes: yesResult?.price ?? null,
        no: noResult?.price ?? null,
        chainId,
        yesPool: yesResult,
        noPool: noResult
    };
}

/**
 * Batch fetch multiple pools in a single GraphQL query (more efficient)
 * 
 * @param {string[]} poolAddresses - Array of pool addresses
 * @param {number} chainId - Chain ID (1 or 100)
 * @returns {Promise<Map<string, { price: number, name: string }>>}
 */
export async function fetchPoolsBatch(poolAddresses, chainId = 100) {
    const endpoint = getSubgraphEndpoint(chainId);

    if (!endpoint || !poolAddresses || poolAddresses.length === 0) {
        return new Map();
    }

    // Lowercase all addresses for subgraph query
    const lowercasedAddresses = poolAddresses.map(a => a?.toLowerCase()).filter(Boolean);

    const query = `{
        pools(where: { id_in: [${lowercasedAddresses.map(a => `"${a}"`).join(', ')}] }) {
            id
            name
            price
            type
            outcomeSide
        }
    }`;

    try {
        console.log(`[SubgraphPoolFetcher] Batch fetching ${lowercasedAddresses.length} pools from chain ${chainId}`);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        const result = await response.json();

        if (result.errors) {
            console.error('[SubgraphPoolFetcher] Batch GraphQL errors:', result.errors);
            return new Map();
        }

        const pools = result.data?.pools || [];
        const poolMap = new Map();

        for (const pool of pools) {
            const price = parseFloat(pool.price);
            poolMap.set(pool.id, {
                price: isNaN(price) ? null : price,
                name: pool.name,
                type: pool.type,
                outcomeSide: pool.outcomeSide
            });
        }

        console.log(`[SubgraphPoolFetcher] ✅ Fetched ${poolMap.size}/${lowercasedAddresses.length} pools`);

        return poolMap;

    } catch (error) {
        console.error(`[SubgraphPoolFetcher] Batch fetch error:`, error);
        return new Map();
    }
}

/**
 * Fetch historical candles for a pool from the subgraph.
 *
 * Returns candles in `{ timestamp, price }` shape (same as the legacy
 * SupabasePoolFetcher pool_candles table) so call sites that consumed
 * Supabase candles can swap with minimal changes.
 *
 * @param {Object} params
 * @param {string} params.poolAddress - Pool contract address
 * @param {number} params.limit - Max candles to return (most-recent first, then sorted asc)
 * @param {number} params.periodSeconds - Candle period in seconds (3600 = 1h)
 * @param {number} params.chainId - Chain ID
 * @returns {Promise<Array<{ timestamp: number, price: number }>>}
 */
export async function fetchPoolCandles({ poolAddress, limit = 500, periodSeconds = 3600, chainId = 100 }) {
    const endpoint = getSubgraphEndpoint(chainId);
    if (!endpoint || !poolAddress) return [];

    const poolId = poolAddress.toLowerCase();
    const query = `query GetCandles($poolId: String!, $limit: Int!, $period: BigInt!) {
        candles(
            where: { pool: $poolId, period: $period }
            first: $limit
            orderBy: periodStartUnix
            orderDirection: desc
        ) {
            periodStartUnix
            close
        }
    }`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                variables: { poolId, limit, period: String(periodSeconds) }
            })
        });
        const result = await response.json();
        if (result.errors) {
            console.error('[SubgraphPoolFetcher] candles GraphQL errors:', result.errors);
            return [];
        }
        const candles = result.data?.candles || [];
        // Map to { timestamp, price } and sort ascending by time so consumers can
        // index `[length-1]` as the latest candle (matches old Supabase shape after sort).
        return candles
            .map(c => ({
                timestamp: Number(c.periodStartUnix),
                price: parseFloat(c.close)
            }))
            .filter(c => !Number.isNaN(c.price))
            .sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
        console.error('[SubgraphPoolFetcher] candle fetch error:', error);
        return [];
    }
}

/**
 * Factory function to create a fetcher instance with default chain.
 *
 * @param {number} defaultChainId - Default chain ID for all operations
 * @returns {Object} Fetcher instance with fetch method
 */
export function createSubgraphPoolFetcher(defaultChainId = 100) {
    console.log(`🔧 SubgraphPoolFetcher initialized for chain ${defaultChainId}`);

    return {
        name: 'SubgraphPoolFetcher',
        defaultChainId,

        /**
         * @param {string} operation - 'pools.price' | 'pools.batch' | 'pools.candles'
         * @param {Object} args - operation-specific args; chainId optional
         */
        async fetch(operation, args = {}) {
            const chainId = args.chainId || defaultChainId;

            switch (operation) {
                case 'pools.price': {
                    const result = await fetchPoolPrice(args.id, chainId);
                    return {
                        status: result ? 'success' : 'error',
                        data: result ? [result] : [],
                        source: 'SubgraphPoolFetcher'
                    };
                }

                case 'pools.batch': {
                    const poolMap = await fetchPoolsBatch(args.ids, chainId);
                    return {
                        status: poolMap.size > 0 ? 'success' : 'error',
                        data: Array.from(poolMap.entries()).map(([id, data]) => ({ id, ...data })),
                        source: 'SubgraphPoolFetcher'
                    };
                }

                case 'pools.candles': {
                    const candles = await fetchPoolCandles({
                        poolAddress: args.id,
                        limit: args.limit ?? 500,
                        periodSeconds: args.periodSeconds ?? 3600,
                        chainId
                    });
                    return {
                        status: candles.length > 0 ? 'success' : 'error',
                        data: candles,
                        source: 'SubgraphPoolFetcher'
                    };
                }

                default:
                    return {
                        status: 'error',
                        reason: `Operation '${operation}' not supported`,
                        supportedOperations: ['pools.price', 'pools.batch', 'pools.candles']
                    };
            }
        }
    };
}

// Re-export endpoints for convenience
export { SUBGRAPH_ENDPOINTS, getSubgraphEndpoint };

// Default export
export default {
    fetchPoolPrice,
    fetchPoolPrices,
    fetchPoolsBatch,
    createSubgraphPoolFetcher,
    SUBGRAPH_ENDPOINTS
};
