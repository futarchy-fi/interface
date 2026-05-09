/**
 * Subgraph Endpoints Configuration
 *
 * Endpoints for fetching Futarchy proposal data.
 *
 * After the AWS → GCP migration both the registry and candles
 * subgraphs are hosted by the Checkpoint indexers behind
 * api.futarchy.fi. The Checkpoint schema differs from the old
 * Graph Node schema (no auto-generated reverse fields), so callers
 * must issue flat queries and join in JS.
 */

// Aggregator/Organization hierarchy — Checkpoint registry indexer
export const AGGREGATOR_SUBGRAPH_URL = 'https://api.futarchy.fi/registry/graphql';

// Candles/pools — Checkpoint candles indexer (serves both chains)
export const SUBGRAPH_ENDPOINTS = {
    1:   'https://api.futarchy.fi/candles/graphql',
    100: 'https://api.futarchy.fi/candles/graphql',
};

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
