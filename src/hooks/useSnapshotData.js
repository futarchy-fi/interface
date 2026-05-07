import { useState, useEffect, useMemo } from 'react';
import { getSnapshotWidgetData } from '../utils/snapshotApi';

/**
 * Custom hook to fetch and manage Snapshot proposal data.
 *
 * The Snapshot proposal ID is read from on-chain proposal metadata
 * (proposalMetadata.metadata.snapshot_id) by the caller and passed in directly.
 *
 * @param {string|null} snapshotProposalId - The Snapshot proposal ID (bytes32 hex, e.g. "0x32a1...")
 * @param {Object} options
 * @param {boolean} options.useMock - Force use of mock data
 * @param {boolean} options.autoFetch - Auto-fetch on mount (default: true)
 * @param {number} options.refreshInterval - Auto-refresh interval in ms (default: null)
 */
export function useSnapshotData(snapshotProposalId, options = {}) {
  const {
    useMock = false,
    autoFetch = true,
    refreshInterval = null,
  } = options;

  const [state, setState] = useState({
    loading: false,
    data: null,
    error: null,
    source: null,
    snapshotProposalId: null,
  });

  const fetchData = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    if (!snapshotProposalId) {
      setState({
        loading: false,
        data: null,
        error: 'No Snapshot proposal linked to this market',
        source: 'error',
        snapshotProposalId: null,
      });
      return;
    }

    try {
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

  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [snapshotProposalId, useMock, autoFetch]);

  useEffect(() => {
    if (!refreshInterval) return;
    const intervalId = setInterval(fetchData, refreshInterval);
    return () => clearInterval(intervalId);
  }, [refreshInterval, snapshotProposalId, useMock]);

  const highestResult = useMemo(() => {
    if (!state.data?.items || state.data.items.length === 0) return null;
    return state.data.items.reduce(
      (max, item) => (item.count > max.count ? item : max),
      state.data.items[0]
    );
  }, [state.data]);

  const proposalPassed = useMemo(() => {
    if (!highestResult) return false;
    const label = highestResult.label.toLowerCase();
    return label.includes('for') || label.includes('yes') || label.includes('approve');
  }, [highestResult]);

  const quorumMet = useMemo(() => {
    if (!state.data) return null;
    return state.data.quorumMet;
  }, [state.data]);

  return {
    loading: state.loading,
    data: state.data,
    error: state.error,
    source: state.source,
    snapshotProposalId: state.snapshotProposalId,
    highestResult,
    proposalPassed,
    quorumMet,
    refetch: fetchData,
  };
}
