/**
 * Subgraph Endpoints Configuration
 * 
 * Endpoints for fetching Futarchy proposal data from The Graph
 */

export const SUBGRAPH_ENDPOINTS = {
    // Ethereum Mainnet - Uniswap V3 pools
    1: 'https://api.studio.thegraph.com/query/1718249/uniswap-proposal-candles/version/latest',

    // Gnosis Chain - Algebra/Swapr pools (CloudFront)
    100: 'https://d3ugkaojqkfud0.cloudfront.net/subgraphs/name/algebra-proposal-candles-v1'
};

// Aggregator/Organization hierarchy subgraph (CloudFront) - v2 has metadataEntries
export const AGGREGATOR_SUBGRAPH_URL = 'https://d3ugkaojqkfud0.cloudfront.net/subgraphs/name/futarchy-complete-new-v3';

// Default Aggregator Contract (same as futarchy-complete-sdk)
export const DEFAULT_AGGREGATOR = '0xC5eB43D53e2FE5FddE5faf400CC4167e5b5d4Fc1';

/**
 * Pool types available in the subgraph
 */
export const POOL_TYPES = {
    PREDICTION: 'PREDICTION',       // Probability pools (YES_sDAI/sDAI, NO_sDAI/sDAI)
    CONDITIONAL: 'CONDITIONAL',     // Wrapped conditional token pools (YES_GNO/YES_sDAI)
    EXPECTED_VALUE: 'EXPECTED_VALUE' // Expected value pools (YES_GNO/sDAI)
};

/**
 * Outcome sides for conditional pools
 */
export const OUTCOME_SIDES = {
    YES: 'YES',
    NO: 'NO'
};

/**
 * Get the subgraph endpoint for a given chain ID
 * @param {number} chainId - The chain ID
 * @returns {string|null} The endpoint URL or null if not supported
 */
export function getSubgraphEndpoint(chainId) {
    return SUBGRAPH_ENDPOINTS[chainId] || null;
}

/**
 * Check if a chain ID is supported
 * @param {number} chainId - The chain ID
 * @returns {boolean} True if the chain is supported
 */
export function isChainSupported(chainId) {
    return chainId in SUBGRAPH_ENDPOINTS;
}
