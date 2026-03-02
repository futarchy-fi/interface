/**
 * useSearchProposals Hook
 * 
 * Search proposals by marketName on chain-specific subgraphs.
 * Uses uniswap-proposals-candles for chain 1 (Ethereum)
 * and algebra-proposals-candles for chain 100 (Gnosis).
 * 
 * Usage:
 *   const { proposals, loading, error, search } = useSearchProposals(100);
 *   search('GNO budget');
 */

import { useState, useCallback } from 'react';
import { SUBGRAPH_ENDPOINTS } from '../config/subgraphEndpoints';

/**
 * GraphQL query to search proposals by marketName
 * Uses contains_nocase for case-insensitive search
 */
const SEARCH_PROPOSALS_QUERY = `
    query SearchProposals($searchTerm: String!) {
        proposals(
            first: 20,
            where: { marketName_contains_nocase: $searchTerm }
        ) {
            id
            marketName
            pools {
                id
                type
                outcomeSide
            }
        }
    }
`;

/**
 * GraphQL query to get recent proposals (for initial display)
 */
const RECENT_PROPOSALS_QUERY = `
    query RecentProposals {
        proposals(first: 20) {
            id
            marketName
            pools {
                id
                type
                outcomeSide
            }
        }
    }
`;

/**
 * React hook to search proposals from chain-specific subgraph
 * 
 * @param {number} chainId - The chain ID (1 for Ethereum, 100 for Gnosis)
 * @returns {{ 
 *   proposals: Array,
 *   loading: boolean, 
 *   error: Error|null,
 *   search: (query: string) => void,
 *   loadRecent: () => void
 * }}
 */
export function useSearchProposals(chainId = 100) {
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const endpoint = SUBGRAPH_ENDPOINTS[chainId] || SUBGRAPH_ENDPOINTS[100];

    // Search proposals by marketName
    const search = useCallback(async (searchTerm) => {
        if (!searchTerm || searchTerm.trim().length < 2) {
            setProposals([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: SEARCH_PROPOSALS_QUERY,
                    variables: { searchTerm: searchTerm.trim() }
                })
            });

            const result = await response.json();

            if (result.errors) {
                throw new Error(result.errors[0]?.message || 'Subgraph query failed');
            }

            setProposals(result.data?.proposals || []);
            console.log(`[useSearchProposals] Found ${result.data?.proposals?.length || 0} proposals for "${searchTerm}"`);

        } catch (e) {
            console.error('[useSearchProposals] Error:', e);
            setError(e);
            setProposals([]);
        } finally {
            setLoading(false);
        }
    }, [endpoint]);

    // Load recent proposals (for initial display)
    const loadRecent = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: RECENT_PROPOSALS_QUERY })
            });

            const result = await response.json();

            if (result.errors) {
                throw new Error(result.errors[0]?.message || 'Subgraph query failed');
            }

            setProposals(result.data?.proposals || []);
            console.log(`[useSearchProposals] Loaded ${result.data?.proposals?.length || 0} recent proposals`);

        } catch (e) {
            console.error('[useSearchProposals] Error:', e);
            setError(e);
            setProposals([]);
        } finally {
            setLoading(false);
        }
    }, [endpoint]);

    return { proposals, loading, error, search, loadRecent };
}

export default useSearchProposals;
