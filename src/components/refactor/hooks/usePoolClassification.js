import { useState, useCallback, useEffect } from 'react';
import { readContract } from '@wagmi/core';
import { useConfig } from 'wagmi';
import { 
  GNOSIS_CHAIN_ID,
  BASE_CURRENCY_TOKEN_ADDRESS,
  BASE_COMPANY_TOKEN_ADDRESS,
  POSITION_TOKENS,
  PREDICTION_POOLS,
  CONDITIONAL_POOLS,
  ALL_KNOWN_POOLS
} from '../constants/addresses';

// Algebra Pool ABI (minimal for getting tokens)
const POOL_ABI = [
  {
    "name": "token0",
    "outputs": [{ "type": "address" }],
    "inputs": [],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "name": "token1", 
    "outputs": [{ "type": "address" }],
    "inputs": [],
    "stateMutability": "view",
    "type": "function"
  }
];

// ERC20 ABI for token metadata
const ERC20_ABI = [
  { "name": "symbol", "inputs": [], "outputs": [{ "type": "string" }], "stateMutability": "view", "type": "function" },
  { "name": "name", "inputs": [], "outputs": [{ "type": "string" }], "stateMutability": "view", "type": "function" },
  { "name": "decimals", "inputs": [], "outputs": [{ "type": "uint8" }], "stateMutability": "view", "type": "function" }
];

/**
 * Hook for classifying Algebra pools based on their token composition
 * 
 * Pool Types:
 * - PREDICTION: Base token (GNO/SDAI) vs Position token (YES_GNO/NO_GNO/YES_SDAI/NO_SDAI)
 * - CONDITIONAL: Position token vs Position token from different assets (e.g., YES_GNO vs NO_SDAI)  
 * - UNKNOWN: Other combinations
 */
export function usePoolClassification() {
  const config = useConfig();
  const [classifications, setClassifications] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get all base token addresses organized by asset type
  const getBaseTokens = useCallback(() => {
    return {
      currency: [
        { address: BASE_CURRENCY_TOKEN_ADDRESS, symbol: 'sDAI' }
      ],
      company: [
        { address: BASE_COMPANY_TOKEN_ADDRESS, symbol: 'GNO' }
      ]
    };
  }, []);

  // Get all position token addresses organized by asset and side
  const getPositionTokens = useCallback(() => {
    return {
      currency: {
        yes: [{ address: POSITION_TOKENS.currency.yes, symbol: 'YES_sDAI' }],
        no: [{ address: POSITION_TOKENS.currency.no, symbol: 'NO_sDAI' }]
      },
      company: {
        yes: [{ address: POSITION_TOKENS.company.yes, symbol: 'YES_GNO' }],
        no: [{ address: POSITION_TOKENS.company.no, symbol: 'NO_GNO' }]
      }
    };
  }, []);

  // Enhanced symbol-based classification for unknown tokens
  const classifyTokenBySymbol = useCallback((symbol) => {
    if (!symbol) return null;
    
    const upperSymbol = symbol.toUpperCase();
    
    // YES position tokens
    if (upperSymbol.includes('YES_')) {
      let asset = 'unknown';
      let side = 'yes';
      
      // Detect asset type from symbol patterns
      if (upperSymbol.includes('GNO') || upperSymbol.includes('GNOSIS')) {
        asset = 'company';
      } else if (upperSymbol.includes('SDAI') || upperSymbol.includes('DAI') || upperSymbol.includes('CURRENCY')) {
        asset = 'currency';
      }
      
      return { type: 'POSITION', asset, side, symbol, inferred: true };
    }
    
    // NO position tokens
    if (upperSymbol.includes('NO_')) {
      let asset = 'unknown';
      let side = 'no';
      
      // Detect asset type from symbol patterns
      if (upperSymbol.includes('GNO') || upperSymbol.includes('GNOSIS')) {
        asset = 'company';
      } else if (upperSymbol.includes('SDAI') || upperSymbol.includes('DAI') || upperSymbol.includes('CURRENCY')) {
        asset = 'currency';
      }
      
      return { type: 'POSITION', asset, side, symbol, inferred: true };
    }
    
    // Base currency tokens
    if (upperSymbol === 'SDAI' || upperSymbol === 'DAI' || upperSymbol.includes('CURRENCY')) {
      return { type: 'BASE', asset: 'currency', symbol, inferred: true };
    }
    
    // Base company tokens
    if (upperSymbol === 'GNO' || upperSymbol === 'GNOSIS' || upperSymbol.includes('COMPANY')) {
      return { type: 'BASE', asset: 'company', symbol, inferred: true };
    }
    
    return null;
  }, []);

  // Classify a single token
  const classifyToken = useCallback((tokenAddress, tokenSymbol, tokenName) => {
    // First check exact address matching
    const baseTokens = getBaseTokens();
    const positionTokens = getPositionTokens();
    
    // Check if it's a known base token
    for (const [asset, tokens] of Object.entries(baseTokens)) {
      for (const token of tokens) {
        if (token.address.toLowerCase() === tokenAddress.toLowerCase()) {
          return { 
            type: 'BASE', 
            asset, 
            symbol: tokenSymbol, 
            address: token.address,
            inferred: false 
          };
        }
      }
    }

    // Check if it's a known position token
    for (const [asset, assetTokens] of Object.entries(positionTokens)) {
      for (const [side, tokens] of Object.entries(assetTokens)) {
        for (const token of tokens) {
          if (token.address.toLowerCase() === tokenAddress.toLowerCase()) {
            return { 
              type: 'POSITION', 
              asset, 
              side, 
              symbol: tokenSymbol, 
              address: token.address,
              inferred: false 
            };
          }
        }
      }
    }

    // Fallback to symbol-based classification
    if (tokenSymbol) {
      const symbolClassification = classifyTokenBySymbol(tokenSymbol);
      if (symbolClassification) {
        return { ...symbolClassification, address: tokenAddress };
      }
    }

    return { type: 'UNKNOWN', symbol: tokenSymbol || 'UNKNOWN', address: tokenAddress };
  }, [getBaseTokens, getPositionTokens, classifyTokenBySymbol]);

  // Classify pool based on token0 and token1 (now includes symbol-based classification)
  const classifyPool = useCallback((token0Address, token1Address, token0Data = {}, token1Data = {}) => {
    const token0 = classifyToken(token0Address, token0Data.symbol, token0Data.name);
    const token1 = classifyToken(token1Address, token1Data.symbol, token1Data.name);

    // Prediction Pool: Base token + Position token
    if ((token0.type === 'BASE' && token1.type === 'POSITION') ||
        (token0.type === 'POSITION' && token1.type === 'BASE')) {
      
      const baseToken = token0.type === 'BASE' ? token0 : token1;
      const positionToken = token0.type === 'POSITION' ? token0 : token1;
      
      const confidence = (baseToken.inferred || positionToken.inferred) ? 'inferred' : 'confirmed';
      const side = positionToken.side; // 'yes' or 'no'
      
      return {
        type: 'PREDICTION',
        subtype: side.toUpperCase(), // 'YES' or 'NO'
        baseAsset: baseToken.asset,
        positionSide: positionToken.side,
        description: `${baseToken.symbol} vs ${positionToken.symbol} (${side.toUpperCase()} prediction${confidence === 'inferred' ? ', inferred' : ''})`,
        confidence,
        tokens: {
          base: baseToken,
          position: positionToken
        }
      };
    }

    // Conditional Pool: Position token + Position token
    if (token0.type === 'POSITION' && token1.type === 'POSITION') {
      const confidence = (token0.inferred || token1.inferred) ? 'inferred' : 'confirmed';
      
      // Determine the sides
      const token0Side = token0.side || 'unknown';
      const token1Side = token1.side || 'unknown';
      
      let subtype = '';
      let poolBias = '';
      
      if (token0Side === token1Side && token0Side !== 'unknown') {
        // Both tokens are same side (YES vs YES or NO vs NO)
        subtype = `${token0Side.toUpperCase()}_POOL`;
        poolBias = token0Side.toUpperCase();
      } else if (token0Side !== token1Side && token0Side !== 'unknown' && token1Side !== 'unknown') {
        // Different sides (YES vs NO)
        subtype = 'YES_VS_NO';
        poolBias = 'MIXED';
      } else {
        // Unknown sides
        subtype = 'UNKNOWN_SIDES';
        poolBias = 'UNKNOWN';
      }
      
      if (token0.asset !== token1.asset && token0.asset !== 'unknown' && token1.asset !== 'unknown') {
        return {
          type: 'CONDITIONAL',
          subtype,
          poolBias,
          description: `${token0.symbol} vs ${token1.symbol} (Cross-asset ${poolBias} pool${confidence === 'inferred' ? ', inferred' : ''})`,
          confidence,
          tokens: {
            token0,
            token1
          }
        };
      } else {
        // Same asset or unknown asset position tokens
        const assetType = (token0.asset === token1.asset) ? 'Same-asset' : 'Cross-position';
        return {
          type: 'CONDITIONAL',
          subtype,
          poolBias,
          description: `${token0.symbol} vs ${token1.symbol} (${assetType} ${poolBias} pool${confidence === 'inferred' ? ', inferred' : ''})`,
          confidence,
          tokens: {
            token0,
            token1
          }
        };
      }
    }

    // Enhanced unknown classification with more details
    const hasPositionLikeTokens = token0.symbol?.includes('YES') || token0.symbol?.includes('NO') ||
                                  token1.symbol?.includes('YES') || token1.symbol?.includes('NO');
    
    let potentialBias = 'UNKNOWN';
    if (hasPositionLikeTokens) {
      const hasYes = token0.symbol?.includes('YES') || token1.symbol?.includes('YES');
      const hasNo = token0.symbol?.includes('NO') || token1.symbol?.includes('NO');
      
      if (hasYes && hasNo) {
        potentialBias = 'MIXED';
      } else if (hasYes) {
        potentialBias = 'YES';
      } else if (hasNo) {
        potentialBias = 'NO';
      }
    }
    
    return {
      type: 'UNKNOWN',
      subtype: 'UNCLASSIFIED',
      poolBias: potentialBias,
      description: hasPositionLikeTokens 
        ? `${token0.symbol} vs ${token1.symbol} (Possible ${potentialBias} prediction tokens - check addresses)`
        : `${token0.symbol} vs ${token1.symbol}`,
      tokens: {
        token0,
        token1
      }
    };
  }, [classifyToken]);

  // Fetch pool token addresses and classify
  const analyzePool = useCallback(async (poolAddress) => {
    if (!poolAddress || !config) return null;

    try {
      setLoading(true);
      setError(null);

      // Get token addresses from pool
      const [token0Address, token1Address] = await Promise.all([
        readContract(config, {
          address: poolAddress,
          abi: POOL_ABI,
          functionName: 'token0',
          chainId: GNOSIS_CHAIN_ID,
        }),
        readContract(config, {
          address: poolAddress,
          abi: POOL_ABI,
          functionName: 'token1',
          chainId: GNOSIS_CHAIN_ID,
        })
      ]);

      // Get token metadata
      const [token0Symbol, token0Name, token0Decimals, token1Symbol, token1Name, token1Decimals] = await Promise.all([
        readContract(config, {
          address: token0Address,
          abi: ERC20_ABI,
          functionName: 'symbol',
          chainId: GNOSIS_CHAIN_ID,
        }),
        readContract(config, {
          address: token0Address,
          abi: ERC20_ABI,
          functionName: 'name',
          chainId: GNOSIS_CHAIN_ID,
        }),
        readContract(config, {
          address: token0Address,
          abi: ERC20_ABI,
          functionName: 'decimals',
          chainId: GNOSIS_CHAIN_ID,
        }),
        readContract(config, {
          address: token1Address,
          abi: ERC20_ABI,
          functionName: 'symbol',
          chainId: GNOSIS_CHAIN_ID,
        }),
        readContract(config, {
          address: token1Address,
          abi: ERC20_ABI,
          functionName: 'name',
          chainId: GNOSIS_CHAIN_ID,
        }),
        readContract(config, {
          address: token1Address,
          abi: ERC20_ABI,
          functionName: 'decimals',
          chainId: GNOSIS_CHAIN_ID,
        })
      ]);

      // Classify the pool
      const classification = classifyPool(token0Address, token1Address, { symbol: token0Symbol, name: token0Name }, { symbol: token1Symbol, name: token1Name });

      const result = {
        poolAddress,
        token0: {
          address: token0Address,
          symbol: token0Symbol,
          name: token0Name,
          decimals: Number(token0Decimals)
        },
        token1: {
          address: token1Address,
          symbol: token1Symbol,
          name: token1Name,
          decimals: Number(token1Decimals)
        },
        classification
      };

      // Cache the result
      setClassifications(prev => ({
        ...prev,
        [poolAddress.toLowerCase()]: result
      }));

      return result;

    } catch (err) {
      console.error('Error analyzing pool:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [config, classifyPool]);

  // Analyze all known pools
  const analyzeKnownPools = useCallback(async () => {
    if (!config) return [];

    try {
      setLoading(true);
      setError(null);

      const poolAddresses = Object.values(ALL_KNOWN_POOLS).map(pool => pool.address);
      const results = await Promise.allSettled(
        poolAddresses.map(address => analyzePool(address))
      );

      const successful = results
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value);

      console.log('Successfully analyzed pools:', successful);
      return successful;

    } catch (err) {
      console.error('Error analyzing known pools:', err);
      setError(err.message);
      return [];
    }
  }, [config, analyzePool]);

  // Get classification for a specific pool (from cache or analyze)
  const getPoolClassification = useCallback(async (poolAddress) => {
    if (!poolAddress) return null;

    const cached = classifications[poolAddress.toLowerCase()];
    if (cached) return cached;

    return await analyzePool(poolAddress);
  }, [classifications, analyzePool]);

  // Get all prediction pools
  const getPredictionPools = useCallback(() => {
    return Object.values(classifications).filter(
      pool => pool.classification.type === 'PREDICTION'
    );
  }, [classifications]);

  // Get all conditional pools
  const getConditionalPools = useCallback(() => {
    return Object.values(classifications).filter(
      pool => pool.classification.type === 'CONDITIONAL'
    );
  }, [classifications]);

  // 🔥 NEW: Analyze pools for a specific proposal
  const analyzeProposalPools = useCallback(async (proposalAddress) => {
    if (!proposalAddress || !config) return {};

    setLoading(true);
    setError(null);

    try {
      console.log('Analyzing pools for proposal:', proposalAddress);
      
      // 🎯 Find pools related to this proposal
      // This would need to be implemented based on how pools are discovered for proposals
      // For now, we'll analyze known pools and filter by those containing proposal tokens
      
      const proposalRelatedPools = Object.values(ALL_KNOWN_POOLS).filter(pool => {
        // This is a simplified check - you might need more sophisticated logic
        // to determine which pools are related to a specific proposal
        return true; // For now, analyze all pools
      });

      const results = {};
      
      for (const pool of proposalRelatedPools) {
        try {
          const classification = await analyzePool(pool.address);
          if (classification) {
            results[pool.address.toLowerCase()] = {
              ...classification,
              proposalAddress, // 🔥 Add proposal context
              poolAddress: pool.address
            };
          }
        } catch (poolError) {
          console.error(`Error analyzing pool ${pool.address}:`, poolError);
          results[pool.address.toLowerCase()] = {
            poolAddress: pool.address,
            proposalAddress,
            classification: {
              type: 'ERROR',
              error: poolError.message
            }
          };
        }
      }

      setClassifications(prev => ({
        ...prev,
        ...results
      }));

      console.log('Proposal pool analysis complete:', results);
      return results;
      
    } catch (err) {
      console.error('Error analyzing proposal pools:', err);
      setError(err.message || 'Failed to analyze proposal pools');
      return {};
    } finally {
      setLoading(false);
    }
  }, [config, analyzePool, ALL_KNOWN_POOLS]);

  return {
    // State
    classifications,
    loading,
    error,
    
    // Actions
    analyzePool,
    analyzeKnownPools,
    analyzeProposalPools, // 🔥 NEW: Export proposal analysis function
    getPoolClassification,
    
    // Getters
    getPredictionPools,
    getConditionalPools,
    
    // Utilities
    classifyToken,
    classifyPool,
    
    // Constants
    PREDICTION_POOLS,
    CONDITIONAL_POOLS,
    ALL_KNOWN_POOLS
  };
} 