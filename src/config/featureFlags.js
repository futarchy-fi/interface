/**
 * Feature Flags — all permanently enabled
 *
 * These flags were used during the V1→V2 migration and are now always true.
 * Kept as named exports to avoid touching 15+ import sites.
 * Safe to inline and remove in a future cleanup pass.
 */

export const ENABLE_SUBGRAPH_FOR_ALL_PROPOSALS = true;
export const ENABLE_V2_SUBGRAPH = true;
export const USE_QUERY_PARAM_URLS = true;
