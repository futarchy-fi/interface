import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { 
  getAllBalances, 
  getAllTokenMetadata, 
  getTokenAddresses,
  getProposalTokenAddresses 
} from '../utils/balanceUtils';
import { useProposalContext } from '../context/ProposalContext';

export function useBalances() {
  const { address: userAddress, isConnected } = useAccount();
  const proposalContext = useProposalContext();
  
  // State management
  const [balances, setBalances] = useState({
    native: '0',
    baseCurrency: '0',
    baseCompany: '0',
    currencyYes: '0',
    currencyNo: '0',
    companyYes: '0',
    companyNo: '0',
  });
  
  const [metadata, setMetadata] = useState({
    native: { symbol: 'xDAI', name: 'xDAI', address: 'native' },
    baseCurrency: { symbol: 'SDAI', name: 'Savings DAI', address: '' },
    baseCompany: { symbol: 'GNO', name: 'Gnosis', address: '' },
    currencyYes: { symbol: 'YES_SDAI', name: 'YES SDAI', address: '' },
    currencyNo: { symbol: 'NO_SDAI', name: 'NO SDAI', address: '' },
    companyYes: { symbol: 'YES_GNO', name: 'YES GNO', address: '' },
    companyNo: { symbol: 'NO_GNO', name: 'NO GNO', address: '' },
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch token metadata (symbols, names, addresses)
  const fetchMetadata = useCallback(async () => {
    try {
      const tokenMetadata = await getAllTokenMetadata();
      setMetadata(tokenMetadata);
    } catch (err) {
      console.error('Error fetching metadata:', err);
      // Keep default metadata if fetch fails
    }
  }, []);

  // Fetch all balances (now proposal-aware!)
  const fetchBalances = useCallback(async (showLoading = true) => {
    if (!userAddress) {
      setBalances({
        native: '0',
        baseCurrency: '0',
        baseCompany: '0',
        currencyYes: '0',
        currencyNo: '0',
        companyYes: '0',
        companyNo: '0',
      });
      return;
    }

    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      // 🎯 Get proposal-specific token addresses if we have a proposal
      let tokenAddresses = null;
      if (proposalContext.proposalAddress) {
        console.log(`🔍 [useBalances] Fetching balances for proposal: ${proposalContext.proposalAddress}`);
        try {
          tokenAddresses = await getProposalTokenAddresses(proposalContext.proposalAddress);
          console.log(`✅ [useBalances] Got proposal token addresses:`, tokenAddresses);
        } catch (error) {
          console.warn(`⚠️ [useBalances] Failed to get proposal tokens, falling back to defaults:`, error);
        }
      }
      
      const userBalances = await getAllBalances(userAddress, tokenAddresses);
      setBalances(userBalances);
      setLastUpdated(new Date());
      
    } catch (err) {
      console.error('Error fetching balances:', err);
      setError(err.message || 'Failed to fetch balances');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [userAddress, proposalContext.proposalAddress]);

  // Initial load of metadata and balances
  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    if (isConnected && userAddress) {
      fetchBalances();
    }
  }, [isConnected, userAddress, fetchBalances]);

  // Refresh balances (useful after transactions)
  const refreshBalances = useCallback(() => {
    fetchBalances(true);
  }, [fetchBalances]);

  // Silent refresh (without loading indicator)
  const silentRefresh = useCallback(() => {
    fetchBalances(false);
  }, [fetchBalances]);

  // Get balance for specific token
  const getBalance = useCallback((tokenKey) => {
    return balances[tokenKey] || '0';
  }, [balances]);

  // Get metadata for specific token
  const getTokenMetadata = useCallback((tokenKey) => {
    return metadata[tokenKey] || { symbol: 'UNKNOWN', name: 'Unknown Token', address: '' };
  }, [metadata]);

  // Check if user has any balances
  const hasAnyBalance = useCallback(() => {
    return Object.values(balances).some(balance => parseFloat(balance) > 0);
  }, [balances]);

  // Get non-zero balances
  const getNonZeroBalances = useCallback(() => {
    const nonZero = {};
    Object.entries(balances).forEach(([key, balance]) => {
      if (parseFloat(balance) > 0) {
        nonZero[key] = balance;
      }
    });
    return nonZero;
  }, [balances]);

  // Get position token balances (YES/NO tokens)
  const getPositionBalances = useCallback(() => {
    return {
      currency: {
        yes: balances.currencyYes,
        no: balances.currencyNo,
      },
      company: {
        yes: balances.companyYes,
        no: balances.companyNo,
      }
    };
  }, [balances]);

  // Get base token balances
  const getBaseBalances = useCallback(() => {
    return {
      native: balances.native,
      currency: balances.baseCurrency,
      company: balances.baseCompany,
    };
  }, [balances]);

  // Get token addresses
  const addresses = getTokenAddresses();

  return {
    // State
    balances,
    metadata,
    loading,
    error,
    lastUpdated,
    addresses,
    
    // Actions
    refreshBalances,
    silentRefresh,
    fetchMetadata,
    
    // Getters
    getBalance,
    getTokenMetadata,
    hasAnyBalance,
    getNonZeroBalances,
    getPositionBalances,
    getBaseBalances,
    
    // Computed
    isConnected,
    userAddress,
  };
} 