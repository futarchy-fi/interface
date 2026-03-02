import { useState, useEffect } from 'react';
import { useProposalContext } from '../context/ProposalContext';
import { usePoolSearch } from './usePoolSearch';
import { usePoolPrices } from './usePoolPrices';
import { useProposalTokens } from './useProposalTokens';
import { standardizePriceDisplay } from '../utils/priceFormatUtils';

/**
 * High-level hook that combines proposal tokens, pool prices, and pricing
 * Gets conventional prices for YES/NO positions using automatic pool loading
 */
export const useProposalPricing = () => {
  const proposal = useProposalContext();
  const proposalTokens = useProposalTokens();
  const [pricingData, setPricingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get pool search and pricing hooks for automatic loading
  const poolSearch = usePoolSearch();
  const { 
    getPoolPrice: getPoolPriceData, 
    fetchSinglePoolPrice,
    getConditionalPoolPrices,
    getPredictionPoolPrices 
  } = usePoolPrices();

  const loadProposalPricing = async () => {
    console.log('🚀 === LOAD PROPOSAL PRICING STARTED ===');
    
    if (!proposal.isProposalReady()) {
      console.log('❌ Proposal not ready for pricing');
      console.log('   - Proposal address:', proposal.proposalAddress);
      console.log('   - Is ready:', proposal.isProposalReady());
      console.log('   - Has data:', proposal.hasData);
      console.log('   - Is loading:', proposal.loading);
      console.log('   - Error:', proposal.error);
      return;
    }

    if (!proposalTokens.isReady) {
      console.log('❌ Proposal tokens not ready for pricing');
      console.log('   - Tokens ready:', proposalTokens.isReady);
      console.log('   - Tokens loading:', proposalTokens.loading);
      return;
    }

    setLoading(true);
    setError(null);
    console.log('🔄 Set loading to true, cleared error');

    try {
      console.log('🔍 === LOADING PROPOSAL PRICING ===');
      
      // Get tokens from proposal
      const tokens = proposal.getTokens();
      console.log('📋 Proposal tokens received:', tokens);
      console.log('   - Company token:', tokens.companyToken);
      console.log('   - Currency token:', tokens.currencyToken);
      console.log('   - YES Company token:', tokens.yesCompanyToken);
      console.log('   - NO Company token:', tokens.noCompanyToken);
      console.log('   - YES Currency token:', tokens.yesCurrencyToken);
      console.log('   - NO Currency token:', tokens.noCurrencyToken);
      
      // Get real token metadata from enhanced hook
      const tokenMetadata = {};
      console.log('🏷️ Building token metadata...');
      Object.entries(tokens).forEach(([tokenType, address]) => {
        console.log(`   - Processing ${tokenType} (${address})`);
        const enhancedInfo = proposalTokens.getTokenInfoByType(tokenType);
        if (enhancedInfo) {
          tokenMetadata[tokenType] = enhancedInfo;
          console.log(`     ✅ Enhanced metadata found:`, enhancedInfo.symbol, enhancedInfo.name);
        } else {
          console.log(`     ⚠️ No enhanced metadata for ${tokenType}`);
        }
      });
      console.log('🏷️ Final token metadata:', tokenMetadata);

      // Instead of manual discovery, use automatic pool loading
      console.log('🔍 === USING AUTOMATIC POOL LOADING ===');
      
      // Get automatically loaded pool data
      const conditionalPoolPrices = getConditionalPoolPrices();
      const predictionPoolPrices = getPredictionPoolPrices();
      console.log('   - Conditional pools found:', conditionalPoolPrices?.length || 0);
      console.log('   - Prediction pools found:', predictionPoolPrices?.length || 0);
      console.log('   - Conditional pools data:', conditionalPoolPrices);
      console.log('   - Prediction pools data:', predictionPoolPrices);

      // Find pools containing our proposal tokens from the loaded pools
      let yesConditionalPrice = null;
      let noConditionalPrice = null;
      let foundYesPool = null;
      let foundNoPool = null;

      // Check if any of the loaded pools contain our proposal tokens
      console.log('🔍 Matching loaded pools with proposal tokens...');
      
      // Look through all loaded pools to find ones with our tokens
      [...(conditionalPoolPrices || []), ...(predictionPoolPrices || [])].forEach((poolData, index) => {
        console.log(`   - Examining pool ${index}:`, poolData);
        
        if (poolData.token0 && poolData.token1) {
          const token0Addr = poolData.token0.address?.toLowerCase();
          const token1Addr = poolData.token1.address?.toLowerCase();
          
          console.log(`     - Pool tokens: ${poolData.token0.symbol} (${token0Addr}) + ${poolData.token1.symbol} (${token1Addr})`);
          
          // Check if this pool contains our YES tokens (YES_GNO + YES_sDAI)
          const hasYesCompany = token0Addr === tokens.yesCompanyToken?.toLowerCase() || token1Addr === tokens.yesCompanyToken?.toLowerCase();
          const hasYesCurrency = token0Addr === tokens.yesCurrencyToken?.toLowerCase() || token1Addr === tokens.yesCurrencyToken?.toLowerCase();
          
          // Check if this pool contains our NO tokens (NO_GNO + NO_sDAI)  
          const hasNoCompany = token0Addr === tokens.noCompanyToken?.toLowerCase() || token1Addr === tokens.noCompanyToken?.toLowerCase();
          const hasNoCurrency = token0Addr === tokens.noCurrencyToken?.toLowerCase() || token1Addr === tokens.noCurrencyToken?.toLowerCase();
          
          console.log(`     - YES tokens check: company=${hasYesCompany}, currency=${hasYesCurrency}`);
          console.log(`     - NO tokens check: company=${hasNoCompany}, currency=${hasNoCurrency}`);
          
          if (hasYesCompany && hasYesCurrency) {
            console.log(`     ✅ Found YES conditional pool!`, poolData);
            yesConditionalPrice = poolData;
            foundYesPool = poolData;
          }
          
          if (hasNoCompany && hasNoCurrency) {
            console.log(`     ✅ Found NO conditional pool!`, poolData);
            noConditionalPrice = poolData;
            foundNoPool = poolData;
          }
        }
      });

      console.log('🏊 === AUTOMATIC POOL MATCHING RESULTS ===');
      console.log('   - YES conditional pool found:', !!foundYesPool);
      console.log('   - NO conditional pool found:', !!foundNoPool);
      console.log('   - YES conditional price data:', yesConditionalPrice);
      console.log('   - NO conditional price data:', noConditionalPrice);

      // Calculate conventional prices using the loaded pool data
      console.log('📊 === CALCULATING CONVENTIONAL PRICES ===');
      const conventionalPrices = calculateConventionalPrices({
        yesConditional: yesConditionalPrice,
        noConditional: noConditionalPrice,
        predictionPoolPrices,
        conditionalPoolPrices,
        poolPrices: {} // No individual pools since we're using the main conditional pools
      });

      console.log('📊 Calculated conventional prices result:', conventionalPrices);

      const finalData = {
        tokens,
        tokenMetadata,
        pools: {
          yesCompany: null,
          noCompany: null,
          yesCurrency: null,
          noCurrency: null,
          conditionalYes: yesConditionalPrice,
          conditionalNo: noConditionalPrice
        },
        conventionalPrices,
        // Store the pool addresses we found
        conditionalPools: {
          yes: foundYesPool ? { address: foundYesPool.address, pool: foundYesPool } : null,
          no: foundNoPool ? { address: foundNoPool.address, pool: foundNoPool } : null
        },
        rawData: {
          conditionalPoolPrices,
          predictionPoolPrices
        }
      };

      console.log('💾 Setting final pricing data:', finalData);
      setPricingData(finalData);

      console.log('🎉 === PRICING DATA COMPLETE ===');

    } catch (err) {
      console.error('❌ === ERROR IN LOAD PROPOSAL PRICING ===');
      console.error('   - Error message:', err.message);
      console.error('   - Error stack:', err.stack);
      console.error('   - Full error:', err);
      setError(err.message);
    } finally {
      console.log('🔄 Setting loading to false');
      setLoading(false);
    }
  };

  // Calculate conventional "IF YES" and "IF NO" prices
  const calculateConventionalPrices = (data) => {
    console.log('🧮 === CALCULATE CONVENTIONAL PRICES STARTED ===');
    console.log('   - Input data:', data);
    
    try {
      // Get prices from the discovered conditional pools
      const yesConditionalData = data.yesConditional;
      const noConditionalData = data.noConditional;
      
      console.log('🔢 Discovered conditional pool data:');
      console.log('   - YES conditional data:', yesConditionalData);
      console.log('   - NO conditional data:', noConditionalData);
      
      let yesConventionalPrice = 'N/A';
      let noConventionalPrice = 'N/A';
      let yesRawPrice = 0;
      let noRawPrice = 0;
      
      // Process YES conditional pool with standardized pricing
      if (yesConditionalData) {
        console.log('🔍 Processing YES conditional pool for standardized pricing...');
        
        // Extract raw price from different possible paths
        yesRawPrice = 
          yesConditionalData.prices?.token1PerToken0 ||
          yesConditionalData.priceData?.prices?.token1PerToken0 ||
          yesConditionalData.stats?.price ||
          yesConditionalData.price ||
          0;
        
        console.log('   - YES raw price extracted:', yesRawPrice);
        
        if (yesRawPrice > 0 && yesConditionalData.token0 && yesConditionalData.token1) {
          // Use CONDITIONAL classification like Pool Prices does
          const poolDataForFormatting = {
            classification: {
              type: 'CONDITIONAL',
              tokens: {}
            },
            token0: yesConditionalData.token0,
            token1: yesConditionalData.token1,
            prices: {
              token0PerToken1: yesRawPrice,
              token1PerToken0: yesRawPrice > 0 ? 1 / yesRawPrice : 0
            }
          };
          
          console.log('   - YES pool data for formatting:', poolDataForFormatting);
          console.log('   - YES detailed price breakdown:');
          console.log('     - token0:', yesConditionalData.token0?.symbol, yesConditionalData.token0?.address);
          console.log('     - token1:', yesConditionalData.token1?.symbol, yesConditionalData.token1?.address);
          console.log('     - yesRawPrice (token1PerToken0):', yesRawPrice);
          console.log('     - 1/yesRawPrice (token0PerToken1):', yesRawPrice > 0 ? 1 / yesRawPrice : 0);
          console.log('     - Expected: Company (GNO) should cost ~113 Currency (sDAI)');
          console.log('     - Expected: Currency (sDAI) should cost ~0.0088 Company (GNO)');
          
          const standardizedPrice = standardizePriceDisplay(poolDataForFormatting);
          console.log('   - YES standardized price result:', standardizedPrice);
          console.log('   - YES standardized price breakdown:');
          console.log('     - primaryPrice:', typeof standardizedPrice.primaryPrice, '=', standardizedPrice.primaryPrice);
          console.log('     - primaryLabel:', typeof standardizedPrice.primaryLabel, '=', standardizedPrice.primaryLabel);
          console.log('     - secondaryPrice:', typeof standardizedPrice.secondaryPrice, '=', standardizedPrice.secondaryPrice);
          console.log('     - convention:', standardizedPrice.convention);
          
          // Extract the numeric value from the formatted price string
          const primaryPriceNumeric = parseFloat(standardizedPrice.primaryPrice);
          yesConventionalPrice = isNaN(primaryPriceNumeric) ? 'N/A' : primaryPriceNumeric.toFixed(4);
          
          console.log('   - YES conventional price extracted:', yesConventionalPrice);
          console.log('   - YES price conversion: formatted string:', standardizedPrice.primaryPrice, '→ numeric:', primaryPriceNumeric, '→ final:', yesConventionalPrice);
        }
      }
      
      // Process NO conditional pool with standardized pricing
      if (noConditionalData) {
        console.log('🔍 Processing NO conditional pool for standardized pricing...');
        
        // Extract raw price from different possible paths
        noRawPrice = 
          noConditionalData.prices?.token1PerToken0 ||
          noConditionalData.priceData?.prices?.token1PerToken0 ||
          noConditionalData.stats?.price ||
          noConditionalData.price ||
          0;
        
        console.log('   - NO raw price extracted:', noRawPrice);
        
        if (noRawPrice > 0 && noConditionalData.token0 && noConditionalData.token1) {
          // Create pool data structure for standardizePriceDisplay
          const poolDataForFormatting = {
            classification: {
              type: 'CONDITIONAL',
              tokens: {}
            },
            token0: noConditionalData.token0,
            token1: noConditionalData.token1,
            prices: {
              token0PerToken1: noRawPrice,
              token1PerToken0: noRawPrice > 0 ? 1 / noRawPrice : 0
            }
          };
          
          console.log('   - NO pool data for formatting:', poolDataForFormatting);
          
          const standardizedPrice = standardizePriceDisplay(poolDataForFormatting);
          console.log('   - NO standardized price result:', standardizedPrice);
          
          // Extract the numeric value from the formatted price string
          // standardizedPrice.primaryPrice is a formatted string like "113.456"
          const primaryPriceNumeric = parseFloat(standardizedPrice.primaryPrice);
          noConventionalPrice = isNaN(primaryPriceNumeric) ? 'N/A' : primaryPriceNumeric.toFixed(4);
          
          console.log('   - NO conventional price extracted:', noConventionalPrice);
          console.log('   - NO price conversion: formatted string:', standardizedPrice.primaryPrice, '→ numeric:', primaryPriceNumeric, '→ final:', noConventionalPrice);
        }
      }
      
      // Fallback to prediction pools if conditional pools don't have good data
      if ((yesConventionalPrice === 'N/A' || noConventionalPrice === 'N/A') && data.predictionPoolPrices) {
        console.log('🎯 Using prediction pools as fallback...');
        
        const predictionPrices = data.predictionPoolPrices || [];
        console.log('   - Prediction pools count:', predictionPrices.length);
        
        predictionPrices.forEach((poolData, index) => {
          console.log(`   - Examining prediction pool ${index}:`, poolData);
          
          if (poolData.token0 && poolData.token1) {
            const token0Symbol = poolData.token0.symbol || '';
            const token1Symbol = poolData.token1.symbol || '';
            
            console.log(`     - Pool symbols: ${token0Symbol} + ${token1Symbol}`);
            
            // Process YES prediction pool
            if ((token0Symbol.includes('YES') || token1Symbol.includes('YES')) && yesConventionalPrice === 'N/A') {
              console.log(`     ✅ Found YES prediction pool, processing...`);
              
              const rawPrice = 
                poolData.priceData?.prices?.token1PerToken0 ||
                poolData.stats?.price ||
                poolData.price ||
                0;
              
              if (rawPrice > 0) {
                const poolDataForFormatting = {
                  classification: {
                    type: 'PREDICTION',
                    tokens: {
                      base: token0Symbol.includes('YES') ? poolData.token1 : poolData.token0,
                      position: token0Symbol.includes('YES') ? poolData.token0 : poolData.token1
                    }
                  },
                  token0: poolData.token0,
                  token1: poolData.token1,
                  prices: {
                    token0PerToken1: rawPrice > 0 ? 1 / rawPrice : 0,
                    token1PerToken0: rawPrice
                  }
                };
                
                const standardizedPrice = standardizePriceDisplay(poolDataForFormatting);
                // Extract the numeric value from the formatted price string
                const primaryPriceNumeric = parseFloat(standardizedPrice.primaryPrice);
                yesConventionalPrice = isNaN(primaryPriceNumeric) ? 'N/A' : primaryPriceNumeric.toFixed(4);
                yesRawPrice = rawPrice;
                console.log(`     - YES prediction pool conventional price: ${yesConventionalPrice}`);
                console.log(`     - YES prediction price conversion: formatted string: ${standardizedPrice.primaryPrice} → numeric: ${primaryPriceNumeric} → final: ${yesConventionalPrice}`);
              }
            }
            
            // Process NO prediction pool
            if ((token0Symbol.includes('NO') || token1Symbol.includes('NO')) && noConventionalPrice === 'N/A') {
              console.log(`     ✅ Found NO prediction pool, processing...`);
              
              const rawPrice = 
                poolData.priceData?.prices?.token1PerToken0 ||
                poolData.stats?.price ||
                poolData.price ||
                0;
              
              if (rawPrice > 0) {
                const poolDataForFormatting = {
                  classification: {
                    type: 'PREDICTION',
                    tokens: {
                      base: token0Symbol.includes('NO') ? poolData.token1 : poolData.token0,
                      position: token0Symbol.includes('NO') ? poolData.token0 : poolData.token1
                    }
                  },
                  token0: poolData.token0,
                  token1: poolData.token1,
                  prices: {
                    token0PerToken1: rawPrice > 0 ? 1 / rawPrice : 0,
                    token1PerToken0: rawPrice
                  }
                };
                
                const standardizedPrice = standardizePriceDisplay(poolDataForFormatting);
                // Extract the numeric value from the formatted price string
                const primaryPriceNumeric = parseFloat(standardizedPrice.primaryPrice);
                noConventionalPrice = isNaN(primaryPriceNumeric) ? 'N/A' : primaryPriceNumeric.toFixed(4);
                noRawPrice = rawPrice;
                console.log(`     - NO prediction pool conventional price: ${noConventionalPrice}`);
                console.log(`     - NO prediction price conversion: formatted string: ${standardizedPrice.primaryPrice} → numeric: ${primaryPriceNumeric} → final: ${noConventionalPrice}`);
              }
            }
          }
        });
      }

      console.log('📈 Final conventional prices:');
      console.log('   - YES conventional price:', yesConventionalPrice);
      console.log('   - NO conventional price:', noConventionalPrice);
      console.log('   - YES raw price:', yesRawPrice);
      console.log('   - NO raw price:', noRawPrice);

      const confidence = calculateConfidence(data);
      
      console.log('🎯 Final conventional prices calculation result:');
      console.log('   - IF YES:', yesConventionalPrice);
      console.log('   - IF NO:', noConventionalPrice);
      console.log('   - Confidence:', confidence);

      const result = {
        ifYes: yesConventionalPrice,
        ifNo: noConventionalPrice,
        yesRaw: yesRawPrice,
        noRaw: noRawPrice,
        confidence,
        sources: {
          yesSource: data.yesConditional ? 'Discovered Conditional Pool' : 
                   'Prediction Pool Fallback',
          noSource: data.noConditional ? 'Discovered Conditional Pool' : 
                   'Prediction Pool Fallback'
        }
      };
      
      console.log('📋 Final result object:', result);
      return result;
    } catch (err) {
      console.error('❌ === ERROR IN CALCULATE CONVENTIONAL PRICES ===');
      console.error('   - Error message:', err.message);
      console.error('   - Error stack:', err.stack);
      console.error('   - Full error:', err);
      return {
        ifYes: 'Error',
        ifNo: 'Error',
        yesRaw: 0,
        noRaw: 0,
        confidence: 0,
        sources: { yesSource: 'Error', noSource: 'Error' }
      };
    }
  };

  // Calculate confidence based on available pool data
  const calculateConfidence = (data) => {
    console.log('🎯 === CALCULATE CONFIDENCE STARTED ===');
    console.log('   - Input data for confidence:', data);
    
    let confidence = 0;
    const confidenceBreakdown = {};
    
    // Dynamic conditional pools provide highest confidence
    if (data.yesConditional) {
      confidence += 40;
      confidenceBreakdown.yesConditional = 40;
      console.log('   ✅ YES conditional pool found: +40 confidence');
    } else {
      console.log('   ❌ NO YES conditional pool: +0 confidence');
      confidenceBreakdown.yesConditional = 0;
    }
    
    if (data.noConditional) {
      confidence += 40;
      confidenceBreakdown.noConditional = 40;
      console.log('   ✅ NO conditional pool found: +40 confidence');
    } else {
      console.log('   ❌ NO NO conditional pool: +0 confidence');
      confidenceBreakdown.noConditional = 0;
    }
    
    // Individual token pools provide additional confidence
    if (data.poolPrices?.yesCurrency) {
      confidence += 10;
      confidenceBreakdown.yesCurrency = 10;
      console.log('   ✅ YES currency pool found: +10 confidence');
    } else {
      console.log('   ❌ NO YES currency pool: +0 confidence');
      confidenceBreakdown.yesCurrency = 0;
    }
    
    if (data.poolPrices?.noCurrency) {
      confidence += 10;
      confidenceBreakdown.noCurrency = 10;
      console.log('   ✅ NO currency pool found: +10 confidence');
    } else {
      console.log('   ❌ NO NO currency pool: +0 confidence');
      confidenceBreakdown.noCurrency = 0;
    }
    
    // Prediction pools provide backup confidence if no conditional pools
    if (!data.yesConditional && !data.noConditional && data.predictionPoolPrices?.length > 0) {
      confidence += 20;
      confidenceBreakdown.predictionPoolsBackup = 20;
      console.log('   ✅ Using prediction pools as backup: +20 confidence');
    } else {
      console.log('   ❌ Not using prediction pools backup: +0 confidence');
      confidenceBreakdown.predictionPoolsBackup = 0;
    }
    
    const finalConfidence = Math.min(confidence, 100);
    
    console.log('🎯 Confidence calculation summary:');
    console.log('   - Breakdown:', confidenceBreakdown);
    console.log('   - Total before cap:', confidence);
    console.log('   - Final confidence (capped at 100):', finalConfidence);
    
    return finalConfidence;
  };

  // Refresh pricing data
  const refreshPricing = () => {
    loadProposalPricing();
  };

  // Auto-load when proposal changes or token data becomes available
  useEffect(() => {
    console.log('🔄 === useProposalPricing useEffect triggered ===');
    console.log('📍 Proposal ready:', proposal.isProposalReady());
    console.log('📍 Proposal address:', proposal.proposalAddress);
    console.log('📍 Tokens ready:', proposalTokens.isReady);
    console.log('📍 Token infos count:', Object.keys(proposalTokens.tokenInfos || {}).length);
    console.log('📍 Proposal tokens:', proposal.isProposalReady() ? proposal.getTokens() : 'Not available');
    
    if (proposal.isProposalReady() && proposalTokens.isReady) {
      console.log('✅ Starting automatic pricing load...');
      loadProposalPricing();
    } else {
      console.log('⚠️ Waiting for proposal and tokens to be ready');
      console.log('   - Proposal ready:', proposal.isProposalReady());
      console.log('   - Tokens ready:', proposalTokens.isReady);
      console.log('   - Proposal loading:', proposal.loading);
      console.log('   - Tokens loading:', proposalTokens.loading);
    }
  }, [proposal.proposalAddress, proposal.isProposalReady(), proposalTokens.isReady]);

  return {
    pricingData,
    loading: loading || proposalTokens.loading,
    error: error || proposalTokens.error,
    refreshPricing,
    hasData: !!pricingData,
    
    // Convenience getters
    getTokens: () => pricingData?.tokens || {},
    getTokenMetadata: () => pricingData?.tokenMetadata || {},
    getPools: () => pricingData?.pools || {},
    getConventionalPrices: () => pricingData?.conventionalPrices || { ifYes: 'N/A', ifNo: 'N/A' },
    getConfidence: () => pricingData?.conventionalPrices?.confidence || 0,
    getConditionalPools: () => pricingData?.conditionalPools || { yes: null, no: null }
  };
}; 