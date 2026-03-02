// =================================================================
// 🔧 CONFIGURATION CENTER
// Update these values to point to new Chains, RPCs, or Subgraphs.
// =================================================================

export const CHAIN_ID = 100; // Gnosis Chain

// RPC Provider URL (Fallback if .env is missing)
export const RPC_URL_DEFAULT = 'https://rpc.gnosischain.com';

export const CONTRACTS = {
    // 📝 factories: Loaded from docs/deploy/addresses.json
    AGGREGATOR_FACTORY: '0xe7C27c932C80D30c9aaA30A856c0062208d269b4',
    ORGANIZATION_FACTORY: '0xCF3d0A6d7d85639fb012fA711Fef7286e6Db2808',
    PROPOSAL_FACTORY: '0x899c70C37E523C99Bd61993ca434F1c1A82c106d',

    // 🏛️ default_aggregator: The starting point for the Hierarchy browser
    DEFAULT_AGGREGATOR: '0xc5eb43d53e2fe5fdde5faf400cc4167e5b5d4fc1'.toLowerCase()
};

// 🕸️ subgraph_url: The Graph API Endpoint
// Hierarchy: Aggregators, Orgs, Rich Proposal Metadata (Config)
export const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/1719045/futarchy-complete-new/version/latest';

// 🕯️ market_subgraph_url: Candles, Swaps, Raw Pools
// Used for "unlinked" proposals and market data.
export const MARKET_SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/1718249/algebra-proposals-candles/version/latest';
