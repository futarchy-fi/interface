/**
 * Global Feature Flags
 * 
 * Configuration flags that control application-wide behavior.
 */

/**
 * ENABLE_SUBGRAPH_FOR_ALL_PROPOSALS
 * 
 * When set to `true`:
 * - All proposals use SubgraphChart only (no TripleChart)
 * - All proposals use SubgraphTradesDataLayer for trades
 * - All proposals use Subgraph for volume/liquidity (not Tickspread API)
 * - Chain is auto-detected from Registry metadata (chain: 100 or 1)
 * 
 * When set to `false`:
 * - Proposals use data sources based on whitelist and URL params
 * - Default behavior: TripleChart + RecentTradesDataLayer + Tickspread API
 */
export const ENABLE_SUBGRAPH_FOR_ALL_PROPOSALS = true;

/**
 * ENABLE_V2_SUBGRAPH
 * 
 * When set to `true`:
 * - Companies page shows ONLY subgraph cards (from Registry aggregator)
 * - Supabase companies/proposals are hidden
 * - Uses default aggregator without requiring URL param
 * - No need for ?useAggregator= or ?debugMode= params
 * 
 * When set to `false`:
 * - Shows both Supabase and Subgraph cards (default behavior)
 * - Requires ?useAggregator= param to enable subgraph
 */
export const ENABLE_V2_SUBGRAPH = true;

/**
 * USE_QUERY_PARAM_URLS
 * 
 * When set to `true`:
 * - Market links use query param format: /market?proposalId=0x123...
 * - Static website friendly (no 404 on direct page access)
 * 
 * When set to `false`:
 * - Market links use path format: /markets/0x123...
 * - Requires dynamic routing / SSR support
 */
export const USE_QUERY_PARAM_URLS = true;

