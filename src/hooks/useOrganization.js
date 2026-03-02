/**
 * useOrganization Hook
 * 
 * Fetches organization data from the futarchy-complete subgraph by address.
 * Also detects if the connected wallet is the organization owner.
 * 
 * Usage:
 *   const { org, isOwner, loading, error, refetch } = useOrganization(orgAddress);
 */

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';

// Subgraph endpoint
import { AGGREGATOR_SUBGRAPH_URL as SUBGRAPH_URL } from '../config/subgraphEndpoints';

/**
 * GraphQL query to get organization by ID
 */
const ORGANIZATION_QUERY = `
  query GetOrganization($id: ID!) {
    organization(id: $id) {
      id
      name
      description
      metadata
      metadataURI
      owner
      proposals {
        id
        proposalAddress
        displayNameQuestion
        displayNameEvent
        description
        metadata
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
        console.warn('[useOrganization] Failed to parse metadata:', e);
        return {};
    }
}

/**
 * React hook to fetch organization from subgraph
 * 
 * @param {string|null} orgAddress - The organization contract address
 * @returns {{ 
 *   org: Object|null,
 *   isOwner: boolean,
 *   loading: boolean, 
 *   error: Error|null,
 *   refetch: Function
 * }}
 */
export function useOrganization(orgAddress) {
    const [org, setOrg] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // Get connected wallet
    const { address: connectedAddress } = useAccount();

    // Detect if connected wallet is owner
    const isOwner = org?.owner && connectedAddress &&
        org.owner.toLowerCase() === connectedAddress.toLowerCase();

    // Fetch function
    const fetchOrg = useCallback(async () => {
        if (!orgAddress || orgAddress.length !== 42) {
            setOrg(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(SUBGRAPH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: ORGANIZATION_QUERY,
                    variables: { id: orgAddress.toLowerCase() }
                })
            });

            const result = await response.json();

            if (result.errors) {
                throw new Error(result.errors[0]?.message || 'Subgraph query failed');
            }

            if (!result.data?.organization) {
                throw new Error(`Organization not found: ${orgAddress}`);
            }

            const rawOrg = result.data.organization;
            const meta = parseMetadata(rawOrg.metadata);

            // Transform to a format compatible with existing companyData
            const transformed = {
                id: rawOrg.id,
                name: rawOrg.name || 'Unknown Organization',
                description: rawOrg.description || '',
                logo: meta.logo || meta.coverImage || '/assets/fallback-company.png',
                coverImage: meta.coverImage || meta.logo || '/assets/fallback-company.png',
                colors: meta.colors || { primary: '#6b21a8' },
                chain: meta.chain || 100, // Chain ID from metadata (default: Gnosis)
                owner: rawOrg.owner,
                currencyToken: 'xDAI', // Default for Gnosis chain
                proposals: rawOrg.proposals || [],
                metadata: rawOrg.metadata,
                metadataURI: rawOrg.metadataURI,
                website: meta.website,
                twitter: meta.twitter,
                fromSubgraph: true
            };

            setOrg(transformed);
            console.log(`[useOrganization] Loaded: ${transformed.name}`);

        } catch (e) {
            console.error('[useOrganization] Error:', e);
            setError(e);
            setOrg(null);
        } finally {
            setLoading(false);
        }
    }, [orgAddress, refreshKey]);

    // Initial fetch
    useEffect(() => {
        fetchOrg();
    }, [fetchOrg]);

    // Refetch function for manual refresh
    const refetch = useCallback(() => {
        setRefreshKey(prev => prev + 1);
    }, []);

    return { org, isOwner, loading, error, refetch };
}

export default useOrganization;
