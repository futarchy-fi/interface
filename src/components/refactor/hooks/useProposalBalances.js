import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useProposalContext } from '../context/ProposalContext';
import { useProposalTokens } from './useProposalTokens';
import { getTokenBalance, getNativeBalance } from '../utils/balanceUtils';

/**
 * Proposal-Aware Balance Hook
 * 
 * Automatically updates when proposal changes, using dynamic token addresses
 * from contracts instead of hardcoded values.
 * 
 * Pattern: Context + Dynamic Token Fetching
 * 
 * Example:
 * const { currency, company, native, refresh } = useProposalBalances();
 * // Automatically reflects current proposal's tokens
 */
export function useProposalBalances() {
  const { address: userAddress, isConnected } = useAccount();
  
  // Subscribe to proposal context - auto-updates when proposal changes
  const proposal = useProposalContext();
  const proposalTokens = useProposalTokens();
  
  // Clean balance structure
  const [balances, setBalances] = useState({
    currency: {
      base: '0',  // Dynamic sDAI/currency token
      yes: '0',   // Dynamic YES_CURRENCY token
      no: '0'     // Dynamic NO_CURRENCY token
    },
    company: {
      base: '0',  // Dynamic GNO/company token
      yes: '0',   // Dynamic YES_COMPANY token
      no: '0'     // Dynamic NO_COMPANY token  
    },
    native: '0'   // xDAI (always same)
  });

  // Token symbols and addresses (dynamic from proposal)
  const [tokenInfo, setTokenInfo] = useState({
    currency: {
      base: { symbol: 'CURRENCY', address: null },
      yes: { symbol: 'YES_CURRENCY', address: null },
      no: { symbol: 'NO_CURRENCY', address: null }
    },
    company: {
      base: { symbol: 'COMPANY', address: null },
      yes: { symbol: 'YES_COMPANY', address: null },
      no: { symbol: 'NO_COMPANY', address: null }
    },
    native: { symbol: 'xDAI', address: 'native' }
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Extract dynamic token addresses and info from proposal context
  const getDynamicTokenInfo = useCallback(() => {
    if (!proposal.isProposalReady() || !proposalTokens.isReady) {
      return null;
    }

    console.log('🔄 Getting dynamic token info from proposal...');
    
    // Get token addresses from proposal context
    const tokens = proposal.getTokens();
    console.log('📍 Proposal tokens:', tokens);
    
    // Get enhanced token info with symbols/names from contracts
    const tokenInfos = proposalTokens.tokenInfos;
    console.log('📍 Token infos from contracts:', tokenInfos);
    
    // Map to clean structure
    const dynamicInfo = {
      currency: {
        base: {
          symbol: tokenInfos.currencyToken?.symbol || tokenInfos.baseCurrency?.symbol || 'CURRENCY',
          address: tokens.currencyToken || tokens.baseCurrency,
          name: tokenInfos.currencyToken?.name || tokenInfos.baseCurrency?.name
        },
        yes: {
          symbol: tokenInfos.yesCurrencyToken?.symbol || tokenInfos.currencyYes?.symbol || 'YES_CURRENCY',
          address: tokens.yesCurrencyToken || tokens.currencyYes,
          name: tokenInfos.yesCurrencyToken?.name || tokenInfos.currencyYes?.name
        },
        no: {
          symbol: tokenInfos.noCurrencyToken?.symbol || tokenInfos.currencyNo?.symbol || 'NO_CURRENCY',
          address: tokens.noCurrencyToken || tokens.currencyNo,
          name: tokenInfos.noCurrencyToken?.name || tokenInfos.currencyNo?.name
        }
      },
      company: {
        base: {
          symbol: tokenInfos.companyToken?.symbol || tokenInfos.baseCompany?.symbol || 'COMPANY',
          address: tokens.companyToken || tokens.baseCompany,
          name: tokenInfos.companyToken?.name || tokenInfos.baseCompany?.name
        },
        yes: {
          symbol: tokenInfos.yesCompanyToken?.symbol || tokenInfos.companyYes?.symbol || 'YES_COMPANY',
          address: tokens.yesCompanyToken || tokens.companyYes,
          name: tokenInfos.yesCompanyToken?.name || tokenInfos.companyYes?.name
        },
        no: {
          symbol: tokenInfos.noCompanyToken?.symbol || tokenInfos.companyNo?.symbol || 'NO_COMPANY',
          address: tokens.noCompanyToken || tokens.companyNo,
          name: tokenInfos.noCompanyToken?.name || tokenInfos.companyNo?.name
        }
      },
      native: { symbol: 'xDAI', address: 'native', name: 'xDAI' }
    };

    console.log('✅ Dynamic token info created:', dynamicInfo);
    return dynamicInfo;
  }, [proposal, proposalTokens]);

  // Fetch balances using dynamic token addresses
  const fetchBalances = useCallback(async (showLoading = true) => {
    if (!userAddress) {
      setBalances({
        currency: { base: '0', yes: '0', no: '0' },
        company: { base: '0', yes: '0', no: '0' },
        native: '0'
      });
      return;
    }

    const dynamicTokenInfo = getDynamicTokenInfo();
    if (!dynamicTokenInfo) {
      console.log('⚠️ No dynamic token info available, skipping balance fetch');
      return;
    }

    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      console.log('🔄 Fetching balances with dynamic addresses...');
      console.log('📍 Using token info:', dynamicTokenInfo);
      
      // Fetch all balances in parallel using dynamic addresses
      const [
        nativeBalance,
        currencyBaseBalance,
        currencyYesBalance,
        currencyNoBalance,
        companyBaseBalance,
        companyYesBalance,
        companyNoBalance,
      ] = await Promise.all([
        getNativeBalance(userAddress),
        dynamicTokenInfo.currency.base.address ? 
          getTokenBalance(dynamicTokenInfo.currency.base.address, userAddress) : Promise.resolve('0'),
        dynamicTokenInfo.currency.yes.address ? 
          getTokenBalance(dynamicTokenInfo.currency.yes.address, userAddress) : Promise.resolve('0'),
        dynamicTokenInfo.currency.no.address ? 
          getTokenBalance(dynamicTokenInfo.currency.no.address, userAddress) : Promise.resolve('0'),
        dynamicTokenInfo.company.base.address ? 
          getTokenBalance(dynamicTokenInfo.company.base.address, userAddress) : Promise.resolve('0'),
        dynamicTokenInfo.company.yes.address ? 
          getTokenBalance(dynamicTokenInfo.company.yes.address, userAddress) : Promise.resolve('0'),
        dynamicTokenInfo.company.no.address ? 
          getTokenBalance(dynamicTokenInfo.company.no.address, userAddress) : Promise.resolve('0'),
      ]);

      const newBalances = {
        currency: {
          base: currencyBaseBalance,
          yes: currencyYesBalance,
          no: currencyNoBalance
        },
        company: {
          base: companyBaseBalance,
          yes: companyYesBalance,
          no: companyNoBalance
        },
        native: nativeBalance
      };

      setBalances(newBalances);
      setTokenInfo(dynamicTokenInfo);
      setLastUpdated(new Date());
      
      console.log('✅ Balances fetched successfully:', newBalances);
      
    } catch (err) {
      console.error('❌ Error fetching proposal balances:', err);
      setError(err.message || 'Failed to fetch balances');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [userAddress, getDynamicTokenInfo]);

  // Auto-fetch when proposal/tokens change OR wallet connects
  useEffect(() => {
    console.log('🔄 === useProposalBalances useEffect triggered ===');
    console.log('📍 Proposal ready:', proposal.isProposalReady());
    console.log('📍 Proposal address:', proposal.proposalAddress);
    console.log('📍 Tokens ready:', proposalTokens.isReady);
    console.log('📍 Wallet connected:', isConnected);
    console.log('📍 User address:', userAddress);
    
    if (isConnected && userAddress && proposal.isProposalReady() && proposalTokens.isReady) {
      console.log('✅ All conditions met - fetching balances...');
      fetchBalances();
    } else {
      console.log('⚠️ Waiting for conditions to be met');
      console.log('   - Wallet connected:', isConnected);
      console.log('   - User address:', !!userAddress);
      console.log('   - Proposal ready:', proposal.isProposalReady());
      console.log('   - Tokens ready:', proposalTokens.isReady);
    }
  }, [isConnected, userAddress, proposal.proposalAddress, proposal.isProposalReady(), proposalTokens.isReady, fetchBalances]);

  // Clear balances when proposal changes (before new ones load)
  useEffect(() => {
    if (!proposal.isProposalReady()) {
      console.log('🧹 Proposal not ready - clearing balances');
      setBalances({
        currency: { base: '0', yes: '0', no: '0' },
        company: { base: '0', yes: '0', no: '0' },
        native: '0'
      });
      setTokenInfo({
        currency: {
          base: { symbol: 'CURRENCY', address: null },
          yes: { symbol: 'YES_CURRENCY', address: null },
          no: { symbol: 'NO_CURRENCY', address: null }
        },
        company: {
          base: { symbol: 'COMPANY', address: null },
          yes: { symbol: 'YES_COMPANY', address: null },
          no: { symbol: 'NO_COMPANY', address: null }
        },
        native: { symbol: 'xDAI', address: 'native' }
      });
      setError(null);
    }
  }, [proposal.proposalAddress]);

  // Manual refresh function
  const refresh = useCallback(() => {
    fetchBalances(true);
  }, [fetchBalances]);

  // Silent refresh
  const silentRefresh = useCallback(() => {
    fetchBalances(false);
  }, [fetchBalances]);

  // Helper: Get non-zero balances for display
  const getNonZeroBalances = useCallback(() => {
    const nonZero = {};
    
    // Currency balances
    if (parseFloat(balances.currency.base) > 0) {
      nonZero[tokenInfo.currency.base.symbol] = balances.currency.base;
    }
    if (parseFloat(balances.currency.yes) > 0) {
      nonZero[tokenInfo.currency.yes.symbol] = balances.currency.yes;
    }
    if (parseFloat(balances.currency.no) > 0) {
      nonZero[tokenInfo.currency.no.symbol] = balances.currency.no;
    }
    
    // Company balances
    if (parseFloat(balances.company.base) > 0) {
      nonZero[tokenInfo.company.base.symbol] = balances.company.base;
    }
    if (parseFloat(balances.company.yes) > 0) {
      nonZero[tokenInfo.company.yes.symbol] = balances.company.yes;
    }
    if (parseFloat(balances.company.no) > 0) {
      nonZero[tokenInfo.company.no.symbol] = balances.company.no;
    }
    
    // Native
    if (parseFloat(balances.native) > 0) {
      nonZero[tokenInfo.native.symbol] = balances.native;
    }
    
    return nonZero;
  }, [balances, tokenInfo]);

  // Helper: Check if proposal-specific tokens are available
  const hasProposalTokens = useCallback(() => {
    return !!(tokenInfo.currency.base.address && tokenInfo.company.base.address);
  }, [tokenInfo]);

  return {
    // Clean balance structure (automatically reflects current proposal)
    currency: balances.currency,    // { base, yes, no } with dynamic tokens
    company: balances.company,      // { base, yes, no } with dynamic tokens
    native: balances.native,        // xDAI
    
    // Token info with symbols and addresses (dynamic from contracts)
    tokenInfo,                      // Full token metadata
    symbols: {                      // Quick symbol access
      currency: {
        base: tokenInfo.currency.base.symbol,
        yes: tokenInfo.currency.yes.symbol,
        no: tokenInfo.currency.no.symbol
      },
      company: {
        base: tokenInfo.company.base.symbol,
        yes: tokenInfo.company.yes.symbol,
        no: tokenInfo.company.no.symbol
      },
      native: tokenInfo.native.symbol
    },
    
    // State
    loading: loading || proposalTokens.loading,
    error: error || proposalTokens.error,
    lastUpdated,
    isConnected,
    
    // Proposal context info
    proposalAddress: proposal.proposalAddress,
    proposalReady: proposal.isProposalReady(),
    tokensReady: proposalTokens.isReady,
    
    // Actions
    refresh,
    silentRefresh,
    
    // Helpers
    getNonZeroBalances,
    hasProposalTokens,
  };
} 