import { useState, useEffect, useCallback } from 'react';
import { useProposalContext } from '../context/ProposalContext';
import { useProposalTokens } from './useProposalTokens';
import { discoverFutarchyPools, getPoolStats } from '../utils/poolUtils';
import { getBaseTokenPoolInfo } from '../utils/balancerPriceUtils';

/**
 * Hook for discovering existing pool addresses for a futarchy proposal
 * Replaces hardcoded pool addresses with dynamic discovery
 * Manual discovery only - no auto-fetching to prevent glitching
 * Uses Balancer for base token pricing
 */
export function usePoolDiscovery() {
  const proposal = useProposalContext();
  const proposalTokens = useProposalTokens();
  
  // State for discovered pools
  const [pools, setPools] = useState({});
  const [poolDetails, setPoolDetails] = useState({});
  const [poolStats, setPoolStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastDiscovery, setLastDiscovery] = useState(null);
  
  // State for Balancer base token pool
  const [baseTokenPool, setBaseTokenPool] = useState({ exists: false });

  // Discover pools when proposal/tokens are ready
  const discoverPools = useCallback(async () => {
    if (!proposal.isProposalReady() || !proposalTokens.isReady) {
      setError('Proposal or tokens not ready yet. Please wait for tokens to load.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Starting pool discovery for proposal:', proposal.proposalAddress);
      
      // Discover futarchy pools
      const { pools: discoveredPools, poolDetails: discoveredDetails } = await discoverFutarchyPools(proposalTokens);
      
      setPools(discoveredPools);
      setPoolDetails(discoveredDetails);
      setLastDiscovery(new Date());
      
      // Get stats for existing futarchy pools
      const stats = {};
      for (const [key, poolAddress] of Object.entries(discoveredPools)) {
        if (poolAddress !== '0x0000000000000000000000000000000000000000') {
          try {
            const poolStat = await getPoolStats(poolAddress);
            if (poolStat) {
              stats[key] = poolStat;
            }
          } catch (err) {
            console.warn(`Could not get stats for pool ${key}:`, err);
          }
        }
      }
      setPoolStats(stats);
      
      // Get Balancer base token pool info
      console.log('🔍 Getting Balancer base token pool info...');
      const balancerPoolInfo = await getBaseTokenPoolInfo(proposalTokens);
      setBaseTokenPool(balancerPoolInfo);
      
      console.log('✅ Pool discovery completed');
      
    } catch (err) {
      console.error('Error discovering pools:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [proposal, proposalTokens, proposal.proposalAddress, proposalTokens.isReady]);

  // Clear pools when proposal changes (no auto-fetch)
  useEffect(() => {
    if (!proposal.isProposalReady()) {
      setPools({});
      setPoolDetails({});
      setPoolStats({});
      setBaseTokenPool({ exists: false });
      setError(null);
      setLastDiscovery(null);
    }
  }, [proposal.isProposalReady(), proposal.proposalAddress]);

  // Helper functions to get specific pool types
  const getPredictionMarkets = useCallback(() => {
    return {
      yesCurrency: {
        address: pools.YES_CURRENCY_PREDICTION,
        exists: poolDetails.YES_CURRENCY_PREDICTION?.exists || false,
        stats: poolStats.YES_CURRENCY_PREDICTION,
        details: poolDetails.YES_CURRENCY_PREDICTION
      },
      noCurrency: {
        address: pools.NO_CURRENCY_PREDICTION,
        exists: poolDetails.NO_CURRENCY_PREDICTION?.exists || false,
        stats: poolStats.NO_CURRENCY_PREDICTION,
        details: poolDetails.NO_CURRENCY_PREDICTION
      },
      yesCompany: {
        address: pools.YES_COMPANY_PREDICTION,
        exists: poolDetails.YES_COMPANY_PREDICTION?.exists || false,
        stats: poolStats.YES_COMPANY_PREDICTION,
        details: poolDetails.YES_COMPANY_PREDICTION
      },
      noCompany: {
        address: pools.NO_COMPANY_PREDICTION,
        exists: poolDetails.NO_COMPANY_PREDICTION?.exists || false,
        stats: poolStats.NO_COMPANY_PREDICTION,
        details: poolDetails.NO_COMPANY_PREDICTION
      }
    };
  }, [pools, poolDetails, poolStats]);

  const getConditionalPools = useCallback(() => {
    return {
      yesCorrelated: {
        address: pools.YES_CORRELATED,
        exists: poolDetails.YES_CORRELATED?.exists || false,
        stats: poolStats.YES_CORRELATED,
        details: poolDetails.YES_CORRELATED
      },
      noCorrelated: {
        address: pools.NO_CORRELATED,
        exists: poolDetails.NO_CORRELATED?.exists || false,
        stats: poolStats.NO_CORRELATED,
        details: poolDetails.NO_CORRELATED
      }
    };
  }, [pools, poolDetails, poolStats]);

  // Return Balancer base token pool instead of hardcoded pool
  const getBaseTokenPool = useCallback(() => {
    return baseTokenPool;
  }, [baseTokenPool]);

  // Get pool address by type
  const getPoolAddress = useCallback((poolType) => {
    return pools[poolType] || '0x0000000000000000000000000000000000000000';
  }, [pools]);

  // Check if any pools exist
  const hasAnyPools = useCallback(() => {
    const futarchyPoolsExist = Object.values(poolDetails).some(detail => detail?.exists);
    const balancerPoolExists = baseTokenPool.exists;
    return futarchyPoolsExist || balancerPoolExists;
  }, [poolDetails, baseTokenPool]);

  // Get discovery summary
  const getDiscoverySummary = useCallback(() => {
    const futarchyPools = Object.values(poolDetails);
    const existingFutarchyPools = futarchyPools.filter(detail => detail?.exists);
    const expectedPools = futarchyPools.filter(detail => detail?.expected);
    const expectedFound = expectedPools.filter(detail => detail?.exists);
    const expectedMissing = expectedPools.filter(detail => !detail?.exists);
    
    // Balancer pool is optional
    const balancerPoolCount = baseTokenPool.exists ? 1 : 0;
    
    return {
      total: futarchyPools.length + balancerPoolCount,
      existing: existingFutarchyPools.length + balancerPoolCount,
      missing: futarchyPools.length - existingFutarchyPools.length,
      
      // Expected pools (futarchy system pools)
      expectedTotal: expectedPools.length,
      expectedFound: expectedFound.length,
      expectedMissing: expectedMissing.length,
      
      // Optional pools (Balancer pool)
      optionalTotal: 1,
      optionalFound: balancerPoolCount,
      
      // Coverage percentage (based on expected pools only)
      percentage: expectedPools.length > 0 ? (expectedFound.length / expectedPools.length * 100).toFixed(1) : 0,
      
      lastDiscovery
    };
  }, [poolDetails, baseTokenPool, lastDiscovery]);

  return {
    // State
    pools,
    poolDetails,
    poolStats,
    loading,
    error,
    lastDiscovery,

    // Actions
    discoverPools,

    // Helpers
    getPredictionMarkets,
    getConditionalPools,
    getBaseTokenPool,
    getPoolAddress,
    hasAnyPools,
    getDiscoverySummary,

    // Status
    isReady: !loading && Object.keys(pools).length > 0,
    hasError: !!error
  };
} 