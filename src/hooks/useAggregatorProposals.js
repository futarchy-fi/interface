/**
 * useAggregatorProposals Hook
 * 
 * Fetches proposals from the futarchy-complete subgraph
 * based on an aggregator address, with owner detection.
 * 
 * Usage:
 *   const { proposals, loading, error } = useAggregatorProposals(aggregatorAddress, connectedWallet);
 */

import { useState, useEffect } from 'react';

// Subgraph endpoint for futarchy-complete (metadata hierarchy)
import { AGGREGATOR_SUBGRAPH_URL as SUBGRAPH_URL } from '../config/subgraphEndpoints';

/**
 * GraphQL query to get all proposals under an aggregator
 */
const AGGREGATOR_PROPOSALS_QUERY = `
  query GetAggregatorProposals($aggregatorId: ID!) {
    aggregator(id: $aggregatorId) {
      id
      organizations {
        id
        name
        description
        metadata
        owner
        proposals {
          id
          displayNameEvent
          displayNameQuestion
          description
          metadata
          metadataURI
          proposalAddress
          owner
        }
      }
    }
  }
`;

/**
 * Parse metadata JSON safely
 */
function parseMetadata(metadataString) {
    if (!metadataString) return {};
    try {
        return JSON.parse(metadataString);
    } catch (e) {
        console.warn('[useAggregatorProposals] Failed to parse metadata:', e);
        return {};
    }
}

/**
 * Transform subgraph proposal to EventHighlight-compatible format
 * 
 * Data comes from:
 * - Registry Subgraph: organization metadata, proposal names, owner
 * - Market Subgraph (future): pool addresses, prices, etc.
 */
function transformProposalToEvent(proposal, org, connectedWallet) {
    const orgMeta = parseMetadata(org.metadata);
    const proposalMeta = parseMetadata(proposal.metadata);

    // Debug: Log chain detection sources
    const detectedChain = proposalMeta.chain
        ? parseInt(proposalMeta.chain)
        : (orgMeta.chain ? parseInt(orgMeta.chain) : 100);

    console.log(`[🔗 CHAIN-DETECT] Proposal "${proposal.displayNameEvent?.slice(0, 30)}...":`, {
        proposalMetaChain: proposalMeta.chain,
        orgMetaChain: orgMeta.chain,
        detectedChain,
        proposalAddress: proposal.proposalAddress?.slice(0, 10)
    });

    // Check if connected wallet is the proposal owner OR organization owner (editor)
    const isOwner = connectedWallet &&
        proposal.owner?.toLowerCase() === connectedWallet.toLowerCase();
    const isEditor = connectedWallet &&
        org.owner?.toLowerCase() === connectedWallet.toLowerCase();

    if (connectedWallet) {
        console.log(`[🔗 OWNER-CHECK] Proposal: ${proposal.displayNameEvent?.slice(0, 30)}...`, {
            proposalOwner: proposal.owner?.toLowerCase(),
            orgOwner: org.owner?.toLowerCase(),
            connectedWallet: connectedWallet.toLowerCase(),
            isOwner,
            isEditor
        });
    }

    // Start time - no createdAt in subgraph, use current time as placeholder
    const startTimeSeconds = Math.floor(Date.now() / 1000);

    // End time: prioritize closeTimestamp from metadata JSON
    // closeTimestamp can be in seconds or milliseconds - normalize to seconds
    let endTimeSeconds = startTimeSeconds + 7 * 24 * 60 * 60; // Default 7 days
    if (proposalMeta.closeTimestamp) {
        const closeTs = parseInt(proposalMeta.closeTimestamp);
        // If timestamp > 10 billion, it's likely milliseconds
        endTimeSeconds = closeTs > 10000000000 ? Math.floor(closeTs / 1000) : closeTs;
        console.log(`[🔗 CLOSE-TIME] Proposal "${proposal.displayNameEvent?.slice(0, 30)}..." closeTimestamp:`, {
            raw: proposalMeta.closeTimestamp,
            normalized: endTimeSeconds,
            date: new Date(endTimeSeconds * 1000).toISOString()
        });
    } else if (proposalMeta.endTime) {
        endTimeSeconds = proposalMeta.endTime;
    }

    // Visibility: 'public' (default), 'hidden' (staging/test - only for owner/editor)
    const visibility = proposalMeta.visibility || 'public';

    return {
        // =============================================
        // IDENTIFICATION - Use proposalAddress for links!
        // =============================================
        eventId: proposal.proposalAddress,  // This is what /markets/[id] uses
        proposalMetadataAddress: proposal.id,  // The registry metadata contract
        proposalAddress: proposal.proposalAddress,  // The actual market contract

        // Display info (from Registry Subgraph)
        eventTitle: proposal.displayNameEvent || proposal.displayNameQuestion || 'Unknown Proposal',
        proposalTitle: proposal.displayNameEvent || proposal.displayNameQuestion || 'Unknown Proposal',
        description: proposal.description || '',

        // Organization info (from Registry Subgraph)
        companyId: org.id,
        companyLogo: orgMeta.logo || orgMeta.coverImage || '/assets/fallback-company.png',
        authorName: org.name || 'Unknown Organization',

        // Stats placeholder (will be fetched by card from Market Subgraph)
        stats: {
            yesPrice: '0.50 SDAI',
            noPrice: '0.50 SDAI'
        },

        // Pool info - will need to fetch from market subgraph or metadata
        predictionPools: proposalMeta.predictionPools || proposalMeta.prediction_pools || null,
        poolAddresses: proposalMeta.poolAddresses || proposalMeta.conditional_pools ? {
            yes: proposalMeta.conditional_pools?.yes?.address,
            no: proposalMeta.conditional_pools?.no?.address
        } : null,

        // Time info (seconds, not milliseconds)
        startTime: startTimeSeconds,
        endTime: endTimeSeconds,  // Uses closeTimestamp from metadata if available
        timeProgress: 0,

        // Status — use metadata resolution fields if available
        status: proposalMeta.resolution_status === 'resolved' ? 'resolved' : 'ongoing',
        resolutionStatus: proposalMeta.resolution_status || 'unresolved',
        resolution_status: proposalMeta.resolution_status || null,
        resolution_outcome: proposalMeta.resolution_outcome || null,
        resolutionOutcome: proposalMeta.resolution_outcome || null,
        finalOutcome: proposalMeta.resolution_outcome || null,

        // =============================================
        // VISIBILITY & OWNERSHIP FLAGS
        // =============================================
        visibility,                            // 'public' or 'hidden'
        isOwner,                              // Connected wallet === proposal.owner
        isEditor,                             // Connected wallet === org.owner
        owner: proposal.owner,                 // Who created this proposal metadata
        orgOwner: org.owner,                   // Who owns the organization
        fromSubgraph: true,                    // Came from on-chain registry
        dataSource: 'registry-subgraph',       // Explicit source label

        // Chain ID: Priority - proposal metadata > org metadata > default Gnosis (100)
        chainId: detectedChain,

        // Full metadata for extended use
        // Include display_title_0 (Question) and display_title_1 (Event) for split display
        metadata: {
            ...proposalMeta,
            display_title_0: proposal.displayNameQuestion || null,  // "What will the impact on GNO price be"
            display_title_1: proposal.displayNameEvent || null      // "if GIP-145 is approved?"
        },
        orgMetadata: orgMeta
    };
}

/**
 * Fetch proposals from subgraph
 */
async function fetchAggregatorProposals(aggregatorAddress) {
    const response = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: AGGREGATOR_PROPOSALS_QUERY,
            variables: { aggregatorId: aggregatorAddress.toLowerCase() }
        })
    });

    const result = await response.json();

    if (result.errors) {
        throw new Error(result.errors[0]?.message || 'Subgraph query failed');
    }

    if (!result.data?.aggregator) {
        throw new Error(`Aggregator not found: ${aggregatorAddress}`);
    }

    return result.data.aggregator;
}

// Market subgraph endpoints by chain
const MARKET_SUBGRAPH_ENDPOINTS = {
    1: 'https://api.studio.thegraph.com/query/1718249/uniswap-proposal-candles/version/latest',
    100: 'https://d3ugkaojqkfud0.cloudfront.net/subgraphs/name/algebra-proposal-candles-v1'
};

/**
 * Bulk fetch pool addresses from market subgraphs grouped by chain
 * 
 * Example: 5 proposals (2 on chain 1, 3 on chain 100)
 * → 1 query to Mainnet subgraph with 2 proposal IDs
 * → 1 query to Gnosis subgraph with 3 proposal IDs
 * → Total: 2 calls instead of 5
 * 
 * @param {Array} proposals - Array of proposal objects with chainId and proposalAddress
 * @returns {Object} Map of proposalAddress → { yesPool, noPool }
 */
async function bulkFetchPoolsByChain(proposals) {
    // Group proposals by chain
    const proposalsByChain = {};
    for (const p of proposals) {
        const chainId = p.chainId || 100;
        if (!proposalsByChain[chainId]) {
            proposalsByChain[chainId] = [];
        }
        if (p.proposalAddress) {
            proposalsByChain[chainId].push(p.proposalAddress.toLowerCase());
        }
    }

    console.log('[🔗 REGISTRY-POOLS] Grouped proposals by chain:',
        Object.entries(proposalsByChain).map(([chain, ids]) => `Chain ${chain}: ${ids.length} proposals`).join(', ')
    );

    // Make one query per chain
    const poolMap = {};

    for (const [chainId, proposalIds] of Object.entries(proposalsByChain)) {
        const endpoint = MARKET_SUBGRAPH_ENDPOINTS[parseInt(chainId)];
        if (!endpoint || proposalIds.length === 0) continue;

        try {
            console.log(`[🔗 REGISTRY-POOLS] Querying market subgraph chain ${chainId} for ${proposalIds.length} proposals...`);

            const query = `
                query GetProposalPools($ids: [ID!]!) {
                    proposals(where: { id_in: $ids }) {
                        id
                        pools {
                            id
                            type
                            outcomeSide
                        }
                    }
                }
            `;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    variables: { ids: proposalIds }
                })
            });

            const result = await response.json();

            if (result.errors) {
                console.warn(`[🔗 REGISTRY-POOLS] Chain ${chainId} query error:`, result.errors[0]?.message);
                continue;
            }

            // Map proposal ID → pools
            for (const proposal of result.data?.proposals || []) {
                const pools = { yes: null, no: null };

                for (const pool of proposal.pools || []) {
                    // Look for CONDITIONAL pools (the ones used for price display)
                    if (pool.type === 'CONDITIONAL' || pool.type === 'conditional') {
                        if (pool.outcomeSide === 'YES' || pool.outcomeSide === 'yes') {
                            pools.yes = pool.id;
                        } else if (pool.outcomeSide === 'NO' || pool.outcomeSide === 'no') {
                            pools.no = pool.id;
                        }
                    }
                }

                poolMap[proposal.id.toLowerCase()] = pools;
            }

            console.log(`[🔗 REGISTRY-POOLS] Chain ${chainId}: Got CONDITIONAL pools for ${result.data?.proposals?.length || 0} proposals`);

        } catch (e) {
            console.warn(`[🔗 REGISTRY-POOLS] Chain ${chainId} fetch failed:`, e.message);
        }
    }

    return poolMap;
}

/**
 * React hook to fetch proposals from an aggregator
 * 
 * @param {string|null} aggregatorAddress - The aggregator contract address
 * @param {string|null} connectedWallet - The connected wallet address (for owner detection)
 * @returns {{ 
 *   proposals: Array, 
 *   organizations: Array,
 *   loading: boolean, 
 *   error: Error|null 
 * }}
 */
export function useAggregatorProposals(aggregatorAddress, connectedWallet = null) {
    const [proposals, setProposals] = useState([]);
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Skip if no aggregator address provided
        if (!aggregatorAddress) {
            setProposals([]);
            setOrganizations([]);
            return;
        }

        let cancelled = false;

        async function loadProposals() {
            setLoading(true);
            setError(null);

            try {
                const aggregator = await fetchAggregatorProposals(aggregatorAddress);

                if (cancelled) return;

                const allProposals = [];
                const orgs = [];

                for (const org of aggregator.organizations || []) {
                    orgs.push({
                        id: org.id,
                        name: org.name,
                        owner: org.owner,
                        proposalCount: org.proposals?.length || 0
                    });

                    for (const proposal of org.proposals || []) {
                        const event = transformProposalToEvent(proposal, org, connectedWallet);
                        allProposals.push(event);
                    }
                }

                // Sort by createdAt (most recent first)
                allProposals.sort((a, b) => b.startTime - a.startTime);

                setProposals(allProposals);
                setOrganizations(orgs);

                console.log(`[useAggregatorProposals] Loaded ${allProposals.length} proposals from ${orgs.length} organizations`);
            } catch (e) {
                if (cancelled) return;
                console.error('[useAggregatorProposals] Error:', e);
                setError(e);
                setProposals([]);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadProposals();

        return () => {
            cancelled = true;
        };
    }, [aggregatorAddress, connectedWallet]);

    return { proposals, organizations, loading, error };
}

/**
 * Standalone function to fetch proposals (for non-React usage)
 * 
 * 1. Fetches proposals from registry subgraph (names, owners, org metadata)
 * 2. Groups by chain, bulk fetches pool addresses from market subgraphs
 * 3. Merges pool addresses back into proposals
 */
export async function fetchProposalsFromAggregator(aggregatorAddress, connectedWallet = null) {
    console.log(`[fetchProposalsFromAggregator] Starting fetch from aggregator: ${aggregatorAddress}`);

    // Step 1: Get proposals from registry subgraph
    const aggregator = await fetchAggregatorProposals(aggregatorAddress);

    const allProposals = [];
    for (const org of aggregator.organizations || []) {
        for (const proposal of org.proposals || []) {
            allProposals.push(transformProposalToEvent(proposal, org, connectedWallet));
        }
    }

    console.log(`[🔗 REGISTRY-PROPOSALS] Got ${allProposals.length} proposals from registry subgraph`);

    // Step 2: Bulk fetch pool addresses from market subgraphs (grouped by chain)
    // This makes 1 query per chain instead of N queries
    if (allProposals.length > 0) {
        const poolMap = await bulkFetchPoolsByChain(allProposals);

        // Step 3: Merge pool addresses back into proposals
        for (const proposal of allProposals) {
            const pools = poolMap[proposal.proposalAddress?.toLowerCase()];
            if (pools) {
                proposal.poolAddresses = {
                    yes: pools.yes,
                    no: pools.no
                };
                console.log(`[🔗 REGISTRY-POOLS] Merged pools for "${proposal.eventTitle}": YES=${pools.yes?.slice(0, 10)}..., NO=${pools.no?.slice(0, 10)}...`);
            }
        }
    }

    return {
        proposals: allProposals.sort((a, b) => b.startTime - a.startTime),
        organizations: aggregator.organizations || []
    };
}

export default useAggregatorProposals;
