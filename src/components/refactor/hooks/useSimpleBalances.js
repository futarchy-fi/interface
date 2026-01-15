import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { 
  getAllBalances, 
  getAllTokenMetadata, 
  getProposalTokenAddresses 
} from '../utils/balanceUtils';
import { useProposalContext } from '../context/ProposalContext';

/**
 * Super Simple Balance Hook - PROPOSAL AWARE VERSION
 * 
 * The easiest way to get wallet balances with clean, intuitive structure.
 * NOW UPDATES AUTOMATICALLY WHEN PROPOSAL CHANGES!
 * 
 * Example:
 * const { currency, company, native, loading, refresh } = useSimpleBalances(proposalAddress);
 * // OR use global context:
 * const { currency, company, native, loading, refresh } = useSimpleBalances();
 * 
 * Access balances like:
 * - currency.base    (sDAI for this proposal)
 * - currency.yes     (YES_sDAI for this proposal) 
 * - currency.no      (NO_sDAI for this proposal)
 * - company.base     (GNO for this proposal)
 * - company.yes      (YES_GNO for this proposal)
 * - company.no       (NO_GNO for this proposal)
 * - native           (xDAI)
 */
export function useSimpleBalances(proposalAddress = null) {
  const { address: userAddress, isConnected } = useAccount();
  const proposalContext = useProposalContext();
  
  // Use provided address or fall back to context
  const activeProposalAddress = proposalAddress || proposalContext.proposalAddress;
  
  // Clean, intuitive balance structure
  const [balances, setBalances] = useState({
    currency: {
      base: '0',  // sDAI
      yes: '0',   // YES_sDAI
      no: '0'     // NO_sDAI
    },
    company: {
      base: '0',  // GNO
      yes: '0',   // YES_GNO
      no: '0'     // NO_GNO
    },
    native: '0'   // xDAI
  });

  // Token symbols for display
  const [symbols, setSymbols] = useState({
    currency: {
      base: 'sDAI',
      yes: 'YES_sDAI',
      no: 'NO_sDAI'
    },
    company: {
      base: 'GNO',
      yes: 'YES_GNO',
      no: 'NO_GNO'
    },
    native: 'xDAI'
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Convert raw balances to clean structure
  const convertToCleanStructure = useCallback((rawBalances) => {
    return {
      currency: {
        base: rawBalances.baseCurrency || '0',
        yes: rawBalances.currencyYes || '0',
        no: rawBalances.currencyNo || '0'
      },
      company: {
        base: rawBalances.baseCompany || '0',
        yes: rawBalances.companyYes || '0',
        no: rawBalances.companyNo || '0'
      },
      native: rawBalances.native || '0'
    };
  }, []);

  // Convert raw metadata to clean symbols
  const convertToCleanSymbols = useCallback((rawMetadata) => {
    return {
      currency: {
        base: rawMetadata.baseCurrency?.symbol || 'sDAI',
        yes: rawMetadata.currencyYes?.symbol || 'YES_sDAI',
        no: rawMetadata.currencyNo?.symbol || 'NO_sDAI'
      },
      company: {
        base: rawMetadata.baseCompany?.symbol || 'GNO',
        yes: rawMetadata.companyYes?.symbol || 'YES_GNO',
        no: rawMetadata.companyNo?.symbol || 'NO_GNO'
      },
      native: rawMetadata.native?.symbol || 'xDAI'
    };
  }, []);

  // 🔥 NEW: Proposal-aware balance fetching
  const fetchProposalBalances = useCallback(async (showLoading = true) => {
    if (!userAddress || !activeProposalAddress) {
      setBalances({
        currency: { base: '0', yes: '0', no: '0' },
        company: { base: '0', yes: '0', no: '0' },
        native: '0'
      });
      return;
    }

    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      // 🎯 Get token addresses for THIS proposal
      const tokenAddresses = await getProposalTokenAddresses(activeProposalAddress);
      
      // Fetch balances using proposal-specific addresses
      const [rawBalances, rawMetadata] = await Promise.all([
        getAllBalances(userAddress, tokenAddresses),
        getAllTokenMetadata(tokenAddresses)
      ]);
      
      // Convert to clean structure
      const cleanBalances = convertToCleanStructure(rawBalances);
      const cleanSymbols = convertToCleanSymbols(rawMetadata);
      
      setBalances(cleanBalances);
      setSymbols(cleanSymbols);
      setLastUpdated(new Date());
      
    } catch (err) {
      console.error('Error fetching proposal balances:', err);
      setError(err.message || 'Failed to fetch proposal balances');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [userAddress, activeProposalAddress, convertToCleanStructure, convertToCleanSymbols]);

  // 🔄 Auto-update when proposal changes
  useEffect(() => {
    if (isConnected && userAddress && activeProposalAddress) {
      fetchProposalBalances();
    }
  }, [isConnected, userAddress, activeProposalAddress, fetchProposalBalances]);

  // Refresh function
  const refresh = useCallback(() => {
    fetchProposalBalances(true);
  }, [fetchProposalBalances]);

  // Silent refresh
  const silentRefresh = useCallback(() => {
    fetchProposalBalances(false);
  }, [fetchProposalBalances]);

  // Helper: Check if user has any currency balances
  const hasCurrencyBalances = useCallback(() => {
    return parseFloat(balances.currency.base) > 0 || 
           parseFloat(balances.currency.yes) > 0 || 
           parseFloat(balances.currency.no) > 0;
  }, [balances]);

  // Helper: Check if user has any company balances  
  const hasCompanyBalances = useCallback(() => {
    return parseFloat(balances.company.base) > 0 || 
           parseFloat(balances.company.yes) > 0 || 
           parseFloat(balances.company.no) > 0;
  }, [balances]);

  // Helper: Get total position value (YES + NO tokens)
  const getPositionTotals = useCallback(() => {
    return {
      currency: parseFloat(balances.currency.yes) + parseFloat(balances.currency.no),
      company: parseFloat(balances.company.yes) + parseFloat(balances.company.no)
    };
  }, [balances]);

  // Helper: Get only non-zero balances for display
  const getNonZeroBalances = useCallback(() => {
    const nonZero = {};
    
    // Currency balances
    if (parseFloat(balances.currency.base) > 0) nonZero[symbols.currency.base] = balances.currency.base;
    if (parseFloat(balances.currency.yes) > 0) nonZero[symbols.currency.yes] = balances.currency.yes;
    if (parseFloat(balances.currency.no) > 0) nonZero[symbols.currency.no] = balances.currency.no;
    
    // Company balances
    if (parseFloat(balances.company.base) > 0) nonZero[symbols.company.base] = balances.company.base;
    if (parseFloat(balances.company.yes) > 0) nonZero[symbols.company.yes] = balances.company.yes;
    if (parseFloat(balances.company.no) > 0) nonZero[symbols.company.no] = balances.company.no;
    
    // Native
    if (parseFloat(balances.native) > 0) nonZero[symbols.native] = balances.native;
    
    return nonZero;
  }, [balances, symbols]);

  return {
    // Clean balance structure
    currency: balances.currency,    // { base, yes, no }
    company: balances.company,      // { base, yes, no }
    native: balances.native,        // xDAI
    
    // Symbols for display
    symbols,                        // Same structure with token symbols
    
    // State
    loading,
    error,
    lastUpdated,
    isConnected,
    
    // Actions
    refresh,
    silentRefresh,
    
    // Helpers
    hasCurrencyBalances,
    hasCompanyBalances,
    getPositionTotals,
    getNonZeroBalances,
  };
}

/**
 * Even simpler hook - just get formatted balances for display
 */
export function useFormattedBalances() {
  const balanceHook = useSimpleBalances();
  
  return {
    ...balanceHook,
    // Pre-formatted for easy display
    formatted: balanceHook.getNonZeroBalances(),
    
    // Quick accessors with symbols
    currencyBase: `${balanceHook.currency.base} ${balanceHook.symbols.currency.base}`,
    currencyYes: `${balanceHook.currency.yes} ${balanceHook.symbols.currency.yes}`,
    currencyNo: `${balanceHook.currency.no} ${balanceHook.symbols.currency.no}`,
    companyBase: `${balanceHook.company.base} ${balanceHook.symbols.company.base}`,
    companyYes: `${balanceHook.company.yes} ${balanceHook.symbols.company.yes}`,
    companyNo: `${balanceHook.company.no} ${balanceHook.symbols.company.no}`,
    native: `${balanceHook.native} ${balanceHook.symbols.native}`,
  };
} 