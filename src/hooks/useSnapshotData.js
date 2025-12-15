import { useState, useEffect, useMemo } from 'react';
import { getSnapshotWidgetData } from '../utils/snapshotApi';
import { fetchSnapshotProposalId } from '../utils/supabaseSnapshot';

/**
 * Custom hook to fetch and manage Snapshot proposal data
 * @param {string} marketEventIdOrProposalId - Market event ID (will fetch from Supabase) or direct Snapshot proposal ID
 * @param {Object} options - Configuration options
 * @param {boolean} options.useMock - Force use of mock data
 * @param {boolean} options.autoFetch - Auto-fetch on mount (default: true)
 * @param {number} options.refreshInterval - Auto-refresh interval in ms (default: null)
 * @param {boolean} options.useSupabase - Fetch proposal ID from Supabase using market_event_id (default: true)
 * @returns {Object} Hook state and methods
 */
export function useSnapshotData(marketEventIdOrProposalId, options = {}) {
  const {
    useMock = false,
    autoFetch = true,
    refreshInterval = null,
    useSupabase = true,
  } = options;

  const [state, setState] = useState({
    loading: false,
    data: null,
    error: null,
    source: null,
    snapshotProposalId: null, // The actual Snapshot proposal ID
  });

  // Fetch snapshot data
  const fetchData = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      let snapshotProposalId = marketEventIdOrProposalId;

      // If useSupabase is true, try to fetch the Snapshot proposal ID from Supabase
      if (useSupabase && marketEventIdOrProposalId) {
        console.log('[useSnapshotData] Fetching Snapshot proposal ID from Supabase for market_event_id:', marketEventIdOrProposalId);
        const fetchedId = await fetchSnapshotProposalId(marketEventIdOrProposalId);

        if (fetchedId) {
          snapshotProposalId = fetchedId;
          console.log('[useSnapshotData] Using Snapshot proposal ID from Supabase:', snapshotProposalId);
        } else {
          // NO FALLBACK - if no proposal ID found in Supabase, don't show widget
          console.warn('[useSnapshotData] No Snapshot proposal ID found in Supabase for market_event_id:', marketEventIdOrProposalId);
          console.warn('[useSnapshotData] Widget will not be displayed - add entry to market_event_proposal_links table');
          setState({
            loading: false,
            data: null,
            error: 'No Snapshot proposal linked to this market',
            source: 'error',
            snapshotProposalId: null,
          });
          return; // Exit early - don't fetch from GraphQL
        }
      }

      // Only fetch from Snapshot if we have a proposal ID
      if (!snapshotProposalId) {
        console.warn('[useSnapshotData] No proposal ID provided, cannot fetch Snapshot data');
        setState({
          loading: false,
          data: null,
          error: 'No proposal ID provided',
          source: 'error',
          snapshotProposalId: null,
        });
        return;
      }

      const result = await getSnapshotWidgetData(snapshotProposalId, useMock);

      setState({
        loading: false,
        data: result.data,
        error: result.error || null,
        source: result.source,
        snapshotProposalId,
      });
    } catch (error) {
      setState({
        loading: false,
        data: null,
        error: error.message,
        source: 'error',
        snapshotProposalId: null,
      });
    }
  };

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [marketEventIdOrProposalId, useMock, autoFetch, useSupabase]);

  // Auto-refresh interval
  useEffect(() => {
    if (!refreshInterval) return;

    const intervalId = setInterval(() => {
      fetchData();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [refreshInterval, marketEventIdOrProposalId, useMock, useSupabase]);

  // Calculate highest result
  const highestResult = useMemo(() => {
    if (!state.data?.items || state.data.items.length === 0) return null;

    return state.data.items.reduce((max, item) =>
      item.count > max.count ? item : max,
      state.data.items[0]
    );
  }, [state.data]);

  // Check if proposal passed (highest is "For" or "Yes")
  const proposalPassed = useMemo(() => {
    if (!highestResult) return false;
    const label = highestResult.label.toLowerCase();
    return label.includes('for') || label.includes('yes') || label.includes('approve');
  }, [highestResult]);

  // Check if quorum is met
  const quorumMet = useMemo(() => {
    if (!state.data) return null;
    return state.data.quorumMet;
  }, [state.data]);

  return {
    // State
    loading: state.loading,
    data: state.data,
    error: state.error,
    source: state.source,
    snapshotProposalId: state.snapshotProposalId, // The actual Snapshot proposal ID used

    // Computed values
    highestResult,
    proposalPassed,
    quorumMet,

    // Methods
    refetch: fetchData,
  };
}
