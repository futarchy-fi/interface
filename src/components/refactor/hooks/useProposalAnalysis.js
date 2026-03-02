import { useState, useEffect, useMemo } from 'react';
import { standardizePriceDisplay } from '../utils/priceFormatUtils';

/**
 * Hook for calculating proposal impact and event probabilities
 * 
 * @param {Object} poolData - Pool data containing conditional and prediction pools
 * @returns {Object} Analysis data with impact calculations and event probabilities
 */
export function useProposalAnalysis(poolData) {
  const [impactData, setImpactData] = useState([]);
  const [eventProbabilities, setEventProbabilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Extract pools
  const conditionalPools = poolData?.conditional || [];
  const predictionPools = poolData?.prediction || [];
  const baseTokenPool = poolData?.baseTokenPool; // Use baseTokenPool for native pricing

  // Debug logging
  console.log('🔧 useProposalAnalysis received pools:', {
    conditionalCount: conditionalPools.length,
    predictionCount: predictionPools.length,
    hasBaseTokenPool: !!baseTokenPool,
    baseTokenPoolExists: baseTokenPool?.exists,
    baseTokenPoolPrice: baseTokenPool?.stats?.price,
    conditional: conditionalPools.map(p => ({
      tokens: `${p.token0?.symbol} vs ${p.token1?.symbol}`,
      classification: p.classification,
      hasPrices: !!p.prices,
      hasStats: !!p.stats
    })),
    prediction: predictionPools.map(p => ({
      tokens: `${p.token0?.symbol} vs ${p.token1?.symbol}`,
      classification: p.classification,
      hasPrices: !!p.prices,
      hasStats: !!p.stats
    }))
  });

  console.log('🔧 About to process conditional pools for grouping...', {
    conditionalPoolsLength: conditionalPools.length,
    conditionalPools: conditionalPools,
    conditionalPoolsRef: conditionalPools === conditionalPools, // Always true, just for debugging
    timestamp: Date.now()
  });

  // Group conditional pools by asset pairs - Force recalculation by stringifying the pools
  const poolGroups = useMemo(() => {
    console.log('🔧 Grouping conditional pools useMemo TRIGGERED!', conditionalPools.length);
    
    const result = conditionalPools.reduce((groups, pool) => {
      const { classification } = pool;
      console.log('🔧 Processing conditional pool:', {
        tokens: `${pool.token0?.symbol} vs ${pool.token1?.symbol}`,
        classification,
        hasClassification: !!classification,
        type: classification?.type
      });
      
      if (!classification || classification.type !== 'CONDITIONAL') {
        console.log('🔧 Skipping pool - not CONDITIONAL type');
        return groups;
      }

      // Determine asset pair from token symbols
      const hasGNO = pool.token0.symbol.includes('GNO') || pool.token1.symbol.includes('GNO');
      const hasDAI = pool.token0.symbol.includes('sDAI') || pool.token1.symbol.includes('sDAI') || 
                     pool.token0.symbol.includes('DAI') || pool.token1.symbol.includes('DAI');
      
      console.log('🔧 Asset detection:', { hasGNO, hasDAI });
      
      if (hasGNO && hasDAI) {
        const assetPair = 'GNO-sDAI';
        if (!groups[assetPair]) {
          groups[assetPair] = { yes: null, no: null };
        }
        
        // Determine if this is YES or NO pool based on poolBias
        const bias = classification.poolBias || classification.subtype;
        console.log('🔧 Pool bias detected:', bias);
        
        if (bias === 'YES') {
          groups[assetPair].yes = pool;
          console.log('🔧 Added as YES pool');
        } else if (bias === 'NO') {
          groups[assetPair].no = pool;
          console.log('🔧 Added as NO pool');
        }
      }
      
      console.log('🔧 Current groups:', Object.keys(groups));
      return groups;
    }, {});
    
    console.log('🔧 Final poolGroups result:', result);
    return result;
  }, [JSON.stringify(conditionalPools)]);

  // Calculate event probabilities from prediction pools
  const calculateEventProbabilities = useMemo(() => {
    console.log('🔧 Event probabilities useMemo TRIGGERED! Processing prediction pools for probabilities:', predictionPools.length);
    
    return predictionPools
      .filter(pool => {
        // Check if this is a YES prediction pool
        const classification = pool.classification;
        if (!classification || classification.type !== 'PREDICTION') return false;
        
        // Look for YES in the pool bias or check token symbols for YES_
        const bias = classification.poolBias || classification.subtype;
        const hasYESToken = pool.token0.symbol.includes('YES_') || pool.token1.symbol.includes('YES_');
        
        console.log('Checking prediction pool for YES:', {
          pool: `${pool.token0.symbol} vs ${pool.token1.symbol}`,
          bias,
          hasYESToken,
          hasPrices: !!pool.prices,
          classification
        });
        
        return (bias === 'YES' || hasYESToken) && pool.prices;
      })
      .map(pool => {
        try {
          // Get standardized price (position per base - probability for prediction pools)
          const standardPrice = standardizePriceDisplay({
            classification: pool.classification,
            token0: pool.token0,
            token1: pool.token1,
            prices: pool.prices
          });
          
          // Extract the position-per-base value (probability)
          const probabilityValue = parseFloat(standardPrice.primaryPrice);
          const probabilityPercentage = probabilityValue * 100;
          
          console.log('Calculated probability:', {
            pool: `${pool.token0.symbol} vs ${pool.token1.symbol}`,
            probabilityValue,
            probabilityPercentage,
            standardPrice
          });
          
          // Determine asset type
          const hasGNO = pool.token0.symbol.includes('GNO') || pool.token1.symbol.includes('GNO');
          const hasDAI = pool.token0.symbol.includes('sDAI') || pool.token1.symbol.includes('sDAI') || 
                         pool.token0.symbol.includes('DAI') || pool.token1.symbol.includes('DAI');
          
          let assetType = 'Unknown';
          if (hasGNO && hasDAI) assetType = 'GNO-sDAI';
          else if (hasGNO) assetType = 'GNO';
          else if (hasDAI) assetType = 'sDAI';
          
          return {
            assetType,
            pool,
            probabilityValue,
            probabilityPercentage,
            description: `${pool.token0.symbol} vs ${pool.token1.symbol}`,
            confidenceLevel: probabilityPercentage > 70 ? 'Very High' :
                           probabilityPercentage > 50 ? 'High' :
                           probabilityPercentage > 30 ? 'Moderate' : 'Low'
          };
        } catch (err) {
          console.error('Error calculating probability for pool:', pool, err);
          return null;
        }
      })
      .filter(prob => {
        const isValid = prob && !isNaN(prob.probabilityPercentage) && prob.probabilityPercentage > 0 && prob.probabilityPercentage <= 100;
        console.log('Probability filter result:', { prob, isValid });
        return isValid;
      });
  }, [JSON.stringify(predictionPools)]);

  // Calculate proposal impact
  useEffect(() => {
    const calculateImpact = async () => {
      if (Object.keys(poolGroups).length === 0) {
        console.log('🔧 No pool groups available for impact calculation');
        setImpactData([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Get native price from baseTokenPool (Balancer pool)
        let spotPrice = null;
        
        if (baseTokenPool?.exists && baseTokenPool?.stats?.price) {
          // baseTokenPool price is sDAI per GNO (currency per company)
          spotPrice = parseFloat(baseTokenPool.stats.price);
          console.log('🔧 Using baseTokenPool spot price:', spotPrice);
        } else {
          console.warn('🔧 baseTokenPool not available, using default spot price');
          spotPrice = 150; // Default GNO price in sDAI
        }
        
        if (!spotPrice || spotPrice <= 0) {
          setError('Native spot price not available');
          setImpactData([]);
          return;
        }

        const impacts = [];
        
        console.log('🔧 Calculating impacts for pool groups:', Object.keys(poolGroups));
        
        Object.entries(poolGroups).forEach(([assetPair, pools]) => {
          const { yes: yesPool, no: noPool } = pools;
          
          console.log('🔧 Processing pool group:', assetPair, { hasYes: !!yesPool, hasNo: !!noPool });
          
          if (!yesPool || !noPool || !yesPool.prices || !noPool.prices) {
            console.log('🔧 Skipping pool group - missing pools or prices');
            return;
          }
          
          try {
            // Get standardized prices (currency per company convention)
            const yesStandardPrice = standardizePriceDisplay({
              classification: yesPool.classification,
              token0: yesPool.token0,
              token1: yesPool.token1,
              prices: yesPool.prices
            });
            
            const noStandardPrice = standardizePriceDisplay({
              classification: noPool.classification,
              token0: noPool.token0,
              token1: noPool.token1,
              prices: noPool.prices
            });
            
            // Extract the currency-per-company values
            const yesConditionalPrice = parseFloat(yesStandardPrice.primaryPrice);
            const noConditionalPrice = parseFloat(noStandardPrice.primaryPrice);
            
            console.log('🔧 Impact calculation inputs:', {
              yesConditionalPrice,
              noConditionalPrice,
              spotPrice
            });
            
            if (yesConditionalPrice && noConditionalPrice && spotPrice) {
              // Calculate impact: (yes - no) / spot * 100
              const impactPercentage = ((yesConditionalPrice - noConditionalPrice) / spotPrice) * 100;
              
              console.log('🔧 Calculated impact:', impactPercentage);
              
              impacts.push({
                assetPair,
                yesPool,
                noPool,
                yesConditionalPrice,
                noConditionalPrice,
                spotConditional: spotPrice,
                impactPercentage,
                impactDirection: impactPercentage > 0 ? 'POSITIVE' : 'NEGATIVE'
              });
            }
          } catch (err) {
            console.error('Error calculating impact for pools:', assetPair, err);
          }
        });
        
        console.log('🔧 Final impacts calculated:', impacts);
        setImpactData(impacts);
      } catch (err) {
        console.error('Error in impact calculation:', err);
        setError(err.message);
        setImpactData([]);
      } finally {
        setLoading(false);
      }
    };

    calculateImpact();
  }, [poolGroups, baseTokenPool]);

  // Update event probabilities
  useEffect(() => {
    setEventProbabilities(calculateEventProbabilities);
  }, [calculateEventProbabilities]);

  const finalHasData = impactData.length > 0 || eventProbabilities.length > 0;
  
  console.log('🔧 useProposalAnalysis final state:', {
    impactDataLength: impactData.length,
    eventProbabilitiesLength: eventProbabilities.length,
    hasData: finalHasData,
    loading,
    error,
    poolGroupsKeys: Object.keys(poolGroups)
  });

  return {
    // Data
    impactData,
    eventProbabilities,
    
    // State
    loading,
    error,
    
    // Helpers
    hasData: finalHasData,
    hasImpactData: impactData.length > 0,
    hasEventProbabilities: eventProbabilities.length > 0
  };
} 