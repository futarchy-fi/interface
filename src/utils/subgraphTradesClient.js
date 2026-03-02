/**
 * Subgraph Trades Client
 * 
 * Fetches swap data from The Graph subgraphs for Recent Activity / My Trades.
 * Used when ?tradeSource=subgraph URL parameter is set.
 */

import { SUBGRAPH_ENDPOINTS } from '../config/subgraphEndpoints';

const ENDPOINTS = SUBGRAPH_ENDPOINTS;

const EXPLORERS = {
    1: 'https://etherscan.io/tx/',
    100: 'https://gnosisscan.io/tx/'
};

/**
 * Fetch conditional pools for a proposal from subgraph
 * 
 * @param {number} chainId - Chain ID (1 or 100)
 * @param {string} proposalId - Proposal address
 * @returns {Promise<{pools: Array, error: string|null}>}
 */
export async function fetchPoolsForProposal(chainId, proposalId) {
    const endpoint = ENDPOINTS[chainId];

    if (!endpoint) {
        return { pools: [], error: `Unsupported chain: ${chainId}` };
    }

    if (!proposalId) {
        return { pools: [], error: 'No proposal ID provided' };
    }

    const query = `{
        pools(where: { proposal: "${proposalId.toLowerCase()}", type: "CONDITIONAL" }) {
            id
            name
            type
            outcomeSide
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
        console.log(`[SubgraphTradesClient] Found ${pools.length} pools for proposal ${proposalId}`);

        return { pools, error: null };

    } catch (error) {
        console.error('[SubgraphTradesClient] Error fetching pools:', error.message);
        return { pools: [], error: error.message };
    }
}

/**
 * Fetch swaps from subgraph for given pools
 * 
 * @param {number} chainId - Chain ID (1 or 100)
 * @param {string[]} poolAddresses - Array of pool addresses to query
 * @param {string|null} userAddress - If provided, filter by this user's trades (origin field)
 * @param {number} limit - Number of trades to fetch
 * @returns {Promise<{swaps: Array, error: string|null}>}
 */
export async function fetchSwapsFromSubgraph(chainId, poolAddresses, userAddress = null, limit = 30) {
    const endpoint = ENDPOINTS[chainId];

    if (!endpoint) {
        console.error(`[SubgraphTradesClient] No endpoint for chain ${chainId}`);
        return { swaps: [], error: `Unsupported chain: ${chainId}` };
    }

    // CRITICAL: Lowercase all addresses for GraphQL
    const poolIds = poolAddresses.map(p => p.toLowerCase());
    const userLower = userAddress?.toLowerCase();

    console.log('[SubgraphTradesClient] Fetching swaps:', {
        chainId,
        pools: poolIds,
        user: userLower || 'all',
        limit
    });

    // Build where clause
    let whereClause;
    if (userAddress) {
        whereClause = `{ pool_in: ${JSON.stringify(poolIds)}, origin: "${userLower}" }`;
    } else {
        whereClause = `{ pool_in: ${JSON.stringify(poolIds)} }`;
    }

    const query = `{
        swaps(
            where: ${whereClause}
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
            console.error('[SubgraphTradesClient] GraphQL error:', result.errors[0]?.message);
            return { swaps: [], error: result.errors[0]?.message };
        }

        const swaps = result.data?.swaps || [];
        console.log(`[SubgraphTradesClient] ✅ Fetched ${swaps.length} swaps`);

        return { swaps, error: null };

    } catch (error) {
        console.error('[SubgraphTradesClient] Network error:', error.message);
        return { swaps: [], error: error.message };
    }
}

/**
 * Format a number for display, handling very small/large values
 * Shows significant figures rather than fixed decimals
 */
function formatAmount(value) {
    const num = parseFloat(value);
    if (isNaN(num) || num === 0) return '0';

    const absNum = Math.abs(num);

    // For very small numbers, use scientific notation or significant figures
    if (absNum < 0.000001) {
        return num.toExponential(2);
    }
    if (absNum < 0.001) {
        return num.toPrecision(3);
    }
    if (absNum < 1) {
        return num.toFixed(6);
    }
    if (absNum < 1000) {
        return num.toFixed(4);
    }
    if (absNum < 1000000) {
        return num.toFixed(2);
    }
    // Large numbers: use compact notation
    return num.toExponential(2);
}

/**
 * Format price - for PREDICTION pools, show as percentage
 */
function formatPrice(price, poolType) {
    const num = parseFloat(price);
    if (isNaN(num)) return '0';

    // For prediction markets, price represents probability (0-1)
    if (poolType === 'PREDICTION') {
        const percentage = (num * 100).toFixed(2);
        return `${percentage}%`;
    }

    // For conditional pools, show as regular price
    return num.toFixed(4);
}

/**
 * Convert subgraph Swap to interface format
 * (Same format as TradeHistoryCartridge output)
 * 
 * @param {Object} swap - Raw swap from subgraph
 * @param {number} chainId - Chain ID for explorer link
 * @returns {Object} Formatted trade object
 */
export function convertSwapToTradeFormat(swap, chainId) {
    const timestamp = parseInt(swap.timestamp) * 1000; // Convert to ms
    const explorerBase = EXPLORERS[chainId] || EXPLORERS[100];

    // Determine buy/sell based on token ROLES first, then fall back to symbols
    // Buy = User RECEIVES Outcome Token (tokenOut)
    // Sell = User GIVES Outcome Token (tokenIn)

    // Check Roles
    const tInRole = swap.tokenIn?.role || '';
    const tOutRole = swap.tokenOut?.role || '';

    // Helper to check if role is Company/Outcome
    const isCompanyRole = (r) => r === 'YES_COMPANY' || r === 'NO_COMPANY' || r === 'COMPANY';

    let isBuy = false;

    if (isCompanyRole(tOutRole) && !isCompanyRole(tInRole)) {
        isBuy = true; // Receiving Company Token = Buy
    } else if (isCompanyRole(tInRole) && !isCompanyRole(tOutRole)) {
        isBuy = false; // Giving Company Token = Sell
    } else {
        // Fallback to Symbol Regex if Roles missing or ambiguous
        // If receiving (IN) a conditional token (YES_/NO_), it's a buy
        const tokenInSymbol = swap.tokenIn?.symbol?.toUpperCase() || '';
        const tokenOutSymbol = swap.tokenOut?.symbol?.toUpperCase() || '';

        const tokenInIsConditional = /^(YES|NO)[_\s-]/.test(tokenInSymbol);
        const tokenOutIsConditional = /^(YES|NO)[_\s-]/.test(tokenOutSymbol);

        // This old logic was flawed if BOTH were YES_.
        // Improved Regex Fallback: Assume the one that matches Outcome Side is the Company Token
        const side = swap.pool?.outcomeSide?.toUpperCase() || '';

        // If symbols are ambiguous, standard fallback:
        // Buy if Out is conditional and In is NOT
        isBuy = tokenOutIsConditional && !tokenInIsConditional;
    }

    // Determine event side (YES/NO) from the pool or token symbols
    let eventSide = 'neutral';
    if (swap.pool?.outcomeSide) {
        eventSide = swap.pool.outcomeSide.toLowerCase();
    } else {
        const tokenInSymbol = swap.tokenIn?.symbol?.toUpperCase() || '';
        const tokenOutSymbol = swap.tokenOut?.symbol?.toUpperCase() || '';
        if (tokenInSymbol.startsWith('YES') || tokenOutSymbol.startsWith('YES')) {
            eventSide = 'yes';
        } else if (tokenInSymbol.startsWith('NO') || tokenOutSymbol.startsWith('NO')) {
            eventSide = 'no';
        }
    }

    const poolType = swap.pool?.type || 'UNKNOWN';

    return {
        id: swap.id,
        outcome: {
            eventSide: eventSide,
            operationSide: isBuy ? 'buy' : 'sell'
        },
        amount: {
            // Note: In subgraph, amountIn = what user gave, amountOut = what user received
            // For UI consistency with Supabase format:
            // tokenIN = what user RECEIVES (subgraph's amountOut/tokenOut)
            // tokenOUT = what user GIVES (subgraph's amountIn/tokenIn)
            tokenIN: {
                symbol: swap.tokenOut?.symbol || 'UNKNOWN',
                value: formatAmount(swap.amountOut),
                address: swap.tokenOut?.id
            },
            tokenOUT: {
                symbol: swap.tokenIn?.symbol || 'UNKNOWN',
                value: formatAmount(swap.amountIn),
                address: swap.tokenIn?.id
            }
        },
        price: formatPrice(swap.price, poolType),
        date: timestamp,
        transactionLink: `${explorerBase}${swap.transactionHash}`,
        poolAddress: swap.pool?.id,
        poolName: swap.pool?.name,
        poolType: poolType,
        blockNumber: null, // Not available in swap query
        userAddress: swap.origin
    };
}

/**
 * Fetch and format trades for UI
 * 
 * @param {number} chainId - Chain ID
 * @param {string[]} poolAddresses - Pool addresses to query
 * @param {string|null} userAddress - User address for "My Trades" filter
 * @param {number} limit - Number of trades
 * @returns {Promise<{trades: Array, error: string|null, timestamp: number}>}
 */
export async function fetchFormattedTrades(chainId, poolAddresses, userAddress = null, limit = 30) {
    const { swaps, error } = await fetchSwapsFromSubgraph(chainId, poolAddresses, userAddress, limit);

    if (error) {
        return { trades: [], error, timestamp: Date.now() };
    }

    const trades = swaps.map(swap => convertSwapToTradeFormat(swap, chainId));

    // Sort trades by date descending (newest first) to ensure correct order
    // This is necessary because querying multiple pools via pool_in may not preserve order
    trades.sort((a, b) => b.date - a.date);

    return {
        trades,
        error: null,
        timestamp: Date.now()
    };
}

const subgraphTradesClient = {
    fetchPoolsForProposal,
    fetchSwapsFromSubgraph,
    convertSwapToTradeFormat,
    fetchFormattedTrades,
    ENDPOINTS
};

export default subgraphTradesClient;
