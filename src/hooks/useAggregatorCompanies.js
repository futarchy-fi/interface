/**
 * useAggregatorCompanies Hook
 * 
 * Fetches organizations (companies) from the futarchy-complete subgraph
 * based on an aggregator address.
 * 
 * Usage:
 *   const { companies, loading, error } = useAggregatorCompanies(aggregatorAddress);
 */

import { useState, useEffect } from 'react';

// Subgraph endpoint for futarchy-complete (metadata hierarchy)
import { AGGREGATOR_SUBGRAPH_URL as SUBGRAPH_URL } from '../config/subgraphEndpoints';

/**
 * GraphQL query to get all organizations under an aggregator
 * Includes proposal metadata to check visibility (active = not hidden)
 */
const AGGREGATOR_COMPANIES_QUERY = `
  query GetAggregatorCompanies($aggregatorId: ID!) {
    aggregator(id: $aggregatorId) {
      id
      name
      description
      organizations {
        id
        name
        description
        metadata
        metadataURI
        owner
        proposals {
          id
          proposalAddress
          metadata
          metadataEntries {
            key
            value
          }
        }
      }
    }
  }
`;


/**
 * Parse organization metadata JSON safely
 */
function parseMetadata(metadataString) {
    if (!metadataString) return {};
    try {
        return JSON.parse(metadataString);
    } catch (e) {
        console.warn('[useAggregatorCompanies] Failed to parse metadata:', e);
        return {};
    }
}

/**
 * Transform subgraph organization to CompaniesCard format
 */
function transformOrgToCard(org) {
    const meta = parseMetadata(org.metadata);

    // Extract chainId from metadata (stored as string "1" or "100")
    const chainId = meta.chain ? parseInt(meta.chain, 10) : 100; // Default to Gnosis (100)

    // Count active proposals (not archived, not hidden, not resolved)
    const proposals = (org.proposals || []).filter(p => {
        const meta = parseMetadata(p.metadata);
        return meta.archived !== true;
    });
    const activeProposals = proposals.filter(proposal => {
        // Check metadataEntries for visibility key
        const visibilityEntry = proposal.metadataEntries?.find(e => e.key === 'visibility');
        const visibility = visibilityEntry?.value || 'public'; // Default to public
        if (visibility === 'hidden') return false;

        // Check metadata for resolution status — resolved proposals are not active
        const proposalMeta = parseMetadata(proposal.metadata);
        if (proposalMeta.resolution_status === 'resolved' || proposalMeta.resolution_outcome) {
            return false;
        }

        return true;
    });

    return {
        companyID: org.id,                                    // Use contract address as ID
        title: org.name || 'Unknown Organization',
        description: org.description || '',
        image: meta.coverImage || meta.logo || '/assets/fallback-company.png',
        colors: meta.colors || { primary: '#6b21a8' },        // Default purple
        proposals: proposals.length,                          // Total proposals
        proposalsCount: proposals.length,                     // Alias for table (total)
        activeProposals: activeProposals.length,              // ✅ Active (public) proposals
        fromSubgraph: true,                                   // ✅ Flag for badge display
        chainId,                                              // ✅ Chain from metadata

        // Additional metadata for extended use
        owner: org.owner,
        website: meta.website,
        twitter: meta.twitter,
        metadataURI: org.metadataURI
    };
}



/**
 * Fetch organizations from subgraph
 */
async function fetchAggregatorCompanies(aggregatorAddress) {
    const response = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: AGGREGATOR_COMPANIES_QUERY,
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

/**
 * React hook to fetch companies from an aggregator
 * 
 * @param {string|null} aggregatorAddress - The aggregator contract address
 * @returns {{ 
 *   companies: Array, 
 *   aggregatorName: string,
 *   loading: boolean, 
 *   error: Error|null 
 * }}
 */
export function useAggregatorCompanies(aggregatorAddress) {
    const [companies, setCompanies] = useState([]);
    const [aggregatorName, setAggregatorName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Skip if no aggregator address provided
        if (!aggregatorAddress) {
            setCompanies([]);
            setAggregatorName('');
            return;
        }

        let cancelled = false;

        async function loadCompanies() {
            setLoading(true);
            setError(null);

            try {
                const aggregator = await fetchAggregatorCompanies(aggregatorAddress);

                if (cancelled) return;

                setAggregatorName(aggregator.name || 'Unknown Aggregator');

                const transformedCompanies = (aggregator.organizations || [])
                    .map(transformOrgToCard);

                setCompanies(transformedCompanies);

                console.log(`[useAggregatorCompanies] Loaded ${transformedCompanies.length} companies from ${aggregator.name}`);
            } catch (e) {
                if (cancelled) return;
                console.error('[useAggregatorCompanies] Error:', e);
                setError(e);
                setCompanies([]);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadCompanies();

        return () => {
            cancelled = true;
        };
    }, [aggregatorAddress]);

    return { companies, aggregatorName, loading, error };
}

/**
 * Standalone function to fetch companies (for non-React usage)
 */
export async function fetchCompaniesFromAggregator(aggregatorAddress) {
    const aggregator = await fetchAggregatorCompanies(aggregatorAddress);
    return {
        aggregatorName: aggregator.name,
        companies: (aggregator.organizations || []).map(transformOrgToCard)
    };
}

export default useAggregatorCompanies;
