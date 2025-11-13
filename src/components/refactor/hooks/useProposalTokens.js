import { useState, useEffect, useCallback } from 'react';
import { useProposalContext } from '../context/ProposalContext';
import { readMultipleTokenInfos, categorizeProposalToken } from '../utils/erc20Utils';

/**
 * Hook for managing dynamic proposal tokens with real ERC20 data
 * Reads actual token symbols, names, and decimals from contracts
 */
export function useProposalTokens() {
  const [tokenInfos, setTokenInfos] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const proposal = useProposalContext();

  // Read token information from contracts
  const loadTokenInfos = useCallback(async () => {
    if (!proposal.isProposalReady()) {
      console.log('⚠️ Proposal not ready, skipping token loading');
      setTokenInfos({});
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 === LOADING TOKEN INFOS ===');
      console.log('📍 Proposal address:', proposal.proposalAddress);
      console.log('🏛️ Market name:', proposal.getMarketName());
      
      const tokens = proposal.getTokens();
      console.log('📋 Raw tokens from proposal context:', tokens);
      
      // Map proposal token keys to our enhanced token system keys
      const tokenKeyMapping = {
        'currencyToken': 'baseCurrency',
        'companyToken': 'baseCompany', 
        'yesCurrencyToken': 'currencyYes',
        'noCurrencyToken': 'currencyNo',
        'yesCompanyToken': 'companyYes',
        'noCompanyToken': 'companyNo'
      };
      
      const tokenAddresses = [];
      const mappedTokenTypes = [];

      // Collect all token addresses with proper mapping
      Object.entries(tokens).forEach(([proposalTokenType, address]) => {
        const enhancedTokenType = tokenKeyMapping[proposalTokenType];
        console.log(`🎯 Mapping ${proposalTokenType} -> ${enhancedTokenType} (${address})`);
        
        if (address && address !== 'native' && enhancedTokenType) {
          tokenAddresses.push(address);
          mappedTokenTypes.push({ proposalType: proposalTokenType, enhancedType: enhancedTokenType, address });
        }
      });

      // Add native token
      tokenAddresses.push('native');
      mappedTokenTypes.push({ proposalType: 'native', enhancedType: 'native', address: 'native' });

      console.log('📡 Token addresses to read from contracts:', tokenAddresses);
      console.log('🏷️ Token type mappings:', mappedTokenTypes);

      // Read all token infos in parallel
      const contractInfos = await readMultipleTokenInfos(tokenAddresses);
      console.log('📦 Contract infos received:', contractInfos);

      // Build enhanced token metadata using mapped keys
      const enhancedTokens = {};
      
      mappedTokenTypes.forEach(({ proposalType, enhancedType, address }) => {
        const contractInfo = contractInfos[address];
        console.log(`🔧 Processing ${proposalType} -> ${enhancedType} (${address}):`, contractInfo);
        
        if (contractInfo) {
          const categorizedToken = categorizeProposalToken(
            enhancedType, // Use the enhanced token type for categorization
            contractInfo,
            { marketName: proposal.getMarketName() }
          );
          
          // Store using BOTH keys for compatibility
          enhancedTokens[enhancedType] = categorizedToken;
          enhancedTokens[proposalType] = categorizedToken; // Also store with original key
          
          console.log(`✅ Enhanced token created for ${enhancedType}:`, categorizedToken);
        } else {
          console.error(`❌ No contract info found for ${proposalType} -> ${enhancedType} (${address})`);
        }
      });

      console.log('🎉 === TOKEN LOADING COMPLETE ===');
      console.log('📊 All enhanced tokens created:', enhancedTokens);
      
      setTokenInfos(enhancedTokens);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('❌ Error loading token infos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [proposal.isProposalReady, proposal.proposalAddress, proposal.getTokens, proposal.getMarketName]);

  // Load token infos when proposal changes
  useEffect(() => {
    console.log('🔄 === useProposalTokens useEffect triggered ===');
    console.log('📍 Proposal ready:', proposal.isProposalReady());
    console.log('📍 Proposal address:', proposal.proposalAddress);
    
    if (proposal.isProposalReady()) {
      console.log('✅ Starting token loading...');
      loadTokenInfos();
    } else {
      console.log('⚠️ Proposal not ready, clearing token infos');
      setTokenInfos({});
      setError(null);
    }
  }, [loadTokenInfos]);

  // Get token options for dropdowns
  const getTokenOptions = useCallback(() => {
    console.log('🎛️ Building token options. Current tokenInfos:', tokenInfos);
    console.log('📊 Proposal ready:', proposal.isProposalReady());
    console.log('🔄 Loading:', loading);
    
    if (!proposal.isProposalReady()) {
      console.log('⚠️ Proposal not ready, returning empty options');
      return [
        {
          symbol: 'No Proposal Loaded',
          address: '',
          isConditional: false,
          disabled: true,
          category: 'Error'
        }
      ];
    }

    if (Object.keys(tokenInfos).length === 0) {
      console.log('⚠️ No token infos available, returning loading/error options');
      return [
        {
          symbol: loading ? 'Loading tokens...' : 'Loading failed',
          address: '',
          isConditional: false,
          disabled: true,
          category: loading ? 'Loading' : 'Error'
        }
      ];
    }

    const options = [];

    // Add native token first
    if (tokenInfos.native) {
      const nativeOption = {
        ...tokenInfos.native,
        address: 'native'
      };
      options.push(nativeOption);
      console.log('🏦 Added native token option:', nativeOption);
    }

    // Add base tokens
    ['baseCurrency', 'baseCompany'].forEach(tokenType => {
      if (tokenInfos[tokenType]) {
        options.push(tokenInfos[tokenType]);
        console.log(`💰 Added base token ${tokenType}:`, tokenInfos[tokenType]);
      } else {
        console.log(`⚠️ Missing base token: ${tokenType}`);
      }
    });

    // Add conditional tokens
    ['currencyYes', 'currencyNo', 'companyYes', 'companyNo'].forEach(tokenType => {
      if (tokenInfos[tokenType]) {
        options.push(tokenInfos[tokenType]);
        console.log(`🎯 Added conditional token ${tokenType}:`, tokenInfos[tokenType]);
      } else {
        console.log(`⚠️ Missing conditional token: ${tokenType}`);
      }
    });

    console.log('🎛️ Final token options:', options);
    return options;
  }, [proposal.isProposalReady, tokenInfos, loading]);

  // Get token info by address
  const getTokenInfoByAddress = useCallback((address) => {
    if (!address) return null;
    
    return Object.values(tokenInfos).find(token => 
      token.address?.toLowerCase() === address.toLowerCase()
    );
  }, [tokenInfos]);

  // Get token info by type (supports both proposal keys and enhanced keys)
  const getTokenInfoByType = useCallback((tokenType) => {
    // Try direct lookup first
    if (tokenInfos[tokenType]) {
      return tokenInfos[tokenType];
    }
    
    // Try mapping from proposal key to enhanced key
    const tokenKeyMapping = {
      'currencyToken': 'baseCurrency',
      'companyToken': 'baseCompany',
      'yesCurrencyToken': 'currencyYes', 
      'noCurrencyToken': 'currencyNo',
      'yesCompanyToken': 'companyYes',
      'noCompanyToken': 'companyNo'
    };
    
    const enhancedKey = tokenKeyMapping[tokenType];
    if (enhancedKey && tokenInfos[enhancedKey]) {
      return tokenInfos[enhancedKey];
    }
    
    console.log(`⚠️ Token type '${tokenType}' not found in token infos`);
    return null;
  }, [tokenInfos]);

  // Check if token is conditional
  const isConditionalToken = useCallback((address) => {
    if (!address || address === 'native') return false;
    
    const tokenInfo = getTokenInfoByAddress(address);
    return tokenInfo?.isConditional || false;
  }, [getTokenInfoByAddress]);

  // Get token categories
  const getTokensByCategory = useCallback(() => {
    // Deduplicate tokens by address to avoid showing same token twice
    const uniqueTokens = [];
    const seenAddresses = new Set();
    
    Object.values(tokenInfos).forEach(token => {
      if (!seenAddresses.has(token.address)) {
        uniqueTokens.push(token);
        seenAddresses.add(token.address);
      }
    });
    
    return {
      native: uniqueTokens.filter(token => token.tokenType === 'native'),
      base: uniqueTokens.filter(token => token.isBaseToken),
      conditional: uniqueTokens.filter(token => token.isConditional),
      currency: uniqueTokens.filter(token => 
        ['baseCurrency', 'currencyYes', 'currencyNo'].includes(token.tokenType)
      ),
      company: uniqueTokens.filter(token => 
        ['baseCompany', 'companyYes', 'companyNo'].includes(token.tokenType)
      )
    };
  }, [tokenInfos]);

  // Refresh token data
  const refreshTokens = useCallback(() => {
    loadTokenInfos();
  }, [loadTokenInfos]);

  // Get unique tokens for stats (deduplicated by address)
  const getUniqueTokens = useCallback(() => {
    const uniqueTokens = [];
    const seenAddresses = new Set();
    
    Object.values(tokenInfos).forEach(token => {
      if (!seenAddresses.has(token.address)) {
        uniqueTokens.push(token);
        seenAddresses.add(token.address);
      }
    });
    
    return uniqueTokens;
  }, [tokenInfos]);

  return {
    // Token data
    tokenInfos,
    loading,
    error,
    lastUpdated,
    
    // Token access
    getTokenOptions,
    getTokenInfoByAddress,
    getTokenInfoByType,
    getTokensByCategory,
    
    // Utilities
    isConditionalToken,
    refreshTokens,
    
    // Status
    hasTokens: Object.keys(tokenInfos).length > 0,
    isReady: proposal.isProposalReady() && Object.keys(tokenInfos).length > 0,
    
    // Statistics (using deduplicated tokens)
    stats: {
      totalTokens: getUniqueTokens().length,
      baseTokens: getUniqueTokens().filter(t => t.isBaseToken).length,
      conditionalTokens: getUniqueTokens().filter(t => t.isConditional).length,
      nativeTokens: getUniqueTokens().filter(t => t.isNative).length
    }
  };
}

export default useProposalTokens; 