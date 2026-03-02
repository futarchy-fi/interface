// src/config/subgraphEndpoints.js
/**
 * Unified Subgraph Endpoints Configuration
 * 
 * All subgraph URLs in one place for easy management.
 * Using CloudFront endpoints for reliability.
 */

const CLOUDFRONT_BASE = 'https://d3ugkaojqkfud0.cloudfront.net/subgraphs/name';

// Proposal Candles Subgraphs (for chart data: candles, swaps, pools)
export const CANDLE_SUBGRAPHS = {
    1: `${CLOUDFRONT_BASE}/uniswap-proposal-candles-v1`,
    100: `${CLOUDFRONT_BASE}/algebra-proposal-candles-v1`
};

// Complete Subgraph (for proposal details, tokens, organization data)
export const COMPLETE_SUBGRAPH = {
    100: `${CLOUDFRONT_BASE}/futarchy-complete-new-v3`
};

// Default chain
export const DEFAULT_CHAIN_ID = 100;

// Block explorers
export const EXPLORERS = {
    1: 'https://etherscan.io/tx/',
    100: 'https://gnosisscan.io/tx/'
};

// Helper to get candle subgraph URL
export function getCandleSubgraph(chainId = DEFAULT_CHAIN_ID) {
    return CANDLE_SUBGRAPHS[chainId] || CANDLE_SUBGRAPHS[DEFAULT_CHAIN_ID];
}

// Helper to get complete subgraph URL
export function getCompleteSubgraph(chainId = DEFAULT_CHAIN_ID) {
    return COMPLETE_SUBGRAPH[chainId] || COMPLETE_SUBGRAPH[DEFAULT_CHAIN_ID];
}

// Helper to get explorer URL
export function getExplorerUrl(chainId = DEFAULT_CHAIN_ID) {
    return EXPLORERS[chainId] || EXPLORERS[DEFAULT_CHAIN_ID];
}

export default {
    CANDLE_SUBGRAPHS,
    COMPLETE_SUBGRAPH,
    EXPLORERS,
    DEFAULT_CHAIN_ID,
    getCandleSubgraph,
    getCompleteSubgraph,
    getExplorerUrl
};
