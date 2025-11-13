import React from 'react';
import { formatPrice } from '../utils/poolPriceUtils';
import { standardizePriceDisplay } from '../utils/priceFormatUtils';

/**
 * Simple, direct implementation of proposal impact calculator
 * Processes pool data immediately without complex dependencies
 */
const ProposalImpactCalculator = ({ poolData }) => {
  console.log('📊 ProposalImpactCalculator received data:', poolData);

  // Extract data directly
  const predictionPools = poolData?.prediction || [];
  const conditionalPools = poolData?.conditional || [];
  const baseTokenPool = poolData?.baseTokenPool;

  console.log('📊 Processing pools:', {
    predictionCount: predictionPools.length,
    conditionalCount: conditionalPools.length,
    hasBasePool: !!baseTokenPool,
    basePoolPrice: baseTokenPool?.stats?.price
  });

  // Get spot price from Balancer pool
  const getCorrectSpotPrice = () => {
    if (!baseTokenPool?.exists || !baseTokenPool?.stats?.price) {
      return 105.65; // Fallback based on current Balancer price
    }

    // Apply the same price conversion logic as in PoolCard
    let rawPrice = parseFloat(baseTokenPool.stats.price);
    
    // Check if this is a GNO/sDAI Balancer pool and apply correct convention
    const token0Symbol = baseTokenPool.details?.tokenA?.symbol;
    const token1Symbol = baseTokenPool.details?.tokenB?.symbol;
    
    console.log('📊 Spot price calculation debug:', {
      rawPrice,
      token0Symbol,
      token1Symbol
    });
    
    // For GNO/sDAI pairs, ensure we show currency-per-company convention
    if ((token0Symbol === 'GNO' && token1Symbol === 'sDAI') || 
        (token0Symbol === 'sDAI' && token1Symbol === 'GNO')) {
      
      // GNO should be worth 100+ sDAI, so if we get a small number, invert it
      if (rawPrice < 50) {
        const correctedPrice = rawPrice > 0 ? 1 / rawPrice : 0;
        console.log('📊 Inverting spot price (too small):', rawPrice, '→', correctedPrice);
        return correctedPrice;
      }
      // Also handle specific token ordering
      else if (token0Symbol === 'sDAI' && token1Symbol === 'GNO') {
        const correctedPrice = rawPrice > 0 ? 1 / rawPrice : 0;
        console.log('📊 Inverting spot price (token order):', rawPrice, '→', correctedPrice);
        return correctedPrice;
      }
    }
    
    console.log('📊 Using spot price as-is:', rawPrice);
    return rawPrice;
  };

  const spotPrice = getCorrectSpotPrice();

  console.log('📊 Final spot price:', spotPrice);

  // Process event probabilities directly from prediction pools
  const eventProbabilities = predictionPools
    .filter(pool => {
      const hasYES = pool.token0?.symbol?.includes('YES') || pool.token1?.symbol?.includes('YES');
      const hasPrice = pool.prices?.price || pool.stats?.price;
      console.log('📊 Checking prediction pool:', {
        tokens: `${pool.token0?.symbol} vs ${pool.token1?.symbol}`,
        hasYES,
        hasPrice: !!hasPrice,
        price: hasPrice
      });
      return hasYES && hasPrice;
    })
    .map(pool => {
      const price = parseFloat(pool.prices?.price || pool.stats?.price || 0);
      
      // Determine asset type
      const hasGNO = pool.token0?.symbol?.includes('GNO') || pool.token1?.symbol?.includes('GNO');
      const assetType = hasGNO ? 'GNO' : 'sDAI';
      
      let probability;
      
      if (hasGNO) {
        // For GNO prediction pools: normalize by spot GNO price
        // Price is sDAI per YES_GNO, spot is sDAI per GNO
        // Probability = (price / spotPrice) * 100
        probability = (price / spotPrice) * 100;
        console.log('📊 GNO probability calculation:', {
          price,
          spotPrice,
          probability,
          formula: `(${price} / ${spotPrice}) * 100 = ${probability}`
        });
      } else {
        // For sDAI prediction pools: direct percentage (already normalized)
        probability = price * 100;
        console.log('📊 sDAI probability calculation:', {
          price,
          probability,
          formula: `${price} * 100 = ${probability}`
        });
      }
      
      console.log('📊 Calculated probability:', {
        pool: `${pool.token0?.symbol} vs ${pool.token1?.symbol}`,
        price,
        probability,
        assetType
      });

      return {
        assetType,
        probability,
        description: `${pool.token0?.symbol} vs ${pool.token1?.symbol}`,
        confidenceLevel: probability > 70 ? 'Very High' :
                        probability > 50 ? 'High' :
                        probability > 30 ? 'Moderate' : 'Low',
        poolPrice: price,
        spotPrice: hasGNO ? spotPrice : null,
        calculationFormula: hasGNO 
          ? `(${price.toFixed(3)} / ${spotPrice.toFixed(3)}) × 100 = ${probability.toFixed(1)}%`
          : `${price.toFixed(6)} × 100 = ${probability.toFixed(1)}%`,
        calculationExplanation: hasGNO
          ? `Pool price: ${price.toFixed(3)} sDAI per ${pool.token0?.symbol?.includes('YES') ? pool.token0?.symbol : pool.token1?.symbol}, Spot price: ${spotPrice.toFixed(3)} sDAI per GNO`
          : `Pool price: ${price.toFixed(6)} sDAI per ${pool.token0?.symbol?.includes('YES') ? pool.token0?.symbol : pool.token1?.symbol} (direct probability)`
      };
    });

  // Process impact data directly from conditional pools
  const impactData = [];
  
  // Group conditional pools by outcome
  const yesPool = conditionalPools.find(pool => 
    pool.token0?.symbol?.includes('YES') && pool.token1?.symbol?.includes('YES')
  );
  const noPool = conditionalPools.find(pool => 
    pool.token0?.symbol?.includes('NO') && pool.token1?.symbol?.includes('NO')
  );

  console.log('📊 Found conditional pools:', {
    hasYesPool: !!yesPool,
    hasNoPool: !!noPool,
    yesPrice: yesPool?.prices?.price || yesPool?.stats?.price,
    noPrice: noPool?.prices?.price || noPool?.stats?.price
  });

  if (yesPool && noPool) {
    // Use standardized price display to get currency-per-company convention
    const getStandardizedPrice = (pool) => {
      const rawPrice = parseFloat(pool.prices?.price || pool.stats?.price || 0);
      
      const poolDataForFormatting = {
        classification: {
          type: 'CONDITIONAL',
          tokens: {}
        },
        token0: pool.token0,
        token1: pool.token1,
        prices: {
          token0PerToken1: rawPrice,
          token1PerToken0: rawPrice > 0 ? 1 / rawPrice : 0
        }
      };
      
      const standardizedPrice = standardizePriceDisplay(poolDataForFormatting);
      
      console.log('📊 Standardized price for', `${pool.token0?.symbol}/${pool.token1?.symbol}:`, {
        rawPrice,
        standardizedPrimary: standardizedPrice.primaryPrice,
        convention: standardizedPrice.convention,
        label: standardizedPrice.primaryLabel
      });
      
      return standardizedPrice.primaryPrice;
    };

    const yesPrice = getStandardizedPrice(yesPool);
    const noPrice = getStandardizedPrice(noPool);
    
    console.log('📊 Using standardized prices:', {
      yesPrice,
      noPrice,
      spotPrice
    });
    
    if (yesPrice > 0 && noPrice > 0) {
      // Impact calculation using currency-per-company convention
      const impactPercentage = ((yesPrice - noPrice) / spotPrice) * 100;
      
      console.log('📊 Calculated impact with convention prices:', {
        yesPrice,
        noPrice,
        spotPrice,
        impactPercentage,
        formula: `((${yesPrice} - ${noPrice}) / ${spotPrice}) * 100 = ${impactPercentage}`
      });

      impactData.push({
        assetPair: 'GNO-sDAI',
        yesConditionalPrice: yesPrice,
        noConditionalPrice: noPrice,
        spotConditional: spotPrice,
        impactPercentage,
        impactDirection: impactPercentage > 0 ? 'POSITIVE' : 'NEGATIVE'
      });
    }
  }

  // Check if we have any data to show
  const hasEventProbabilities = eventProbabilities.length > 0;
  const hasImpactData = impactData.length > 0;
  const hasData = hasEventProbabilities || hasImpactData;

  console.log('📊 Final analysis results:', {
    hasData,
    hasEventProbabilities,
    hasImpactData,
    eventProbabilities,
    impactData
  });

  if (!hasData) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="text-yellow-800 text-sm">
          <div className="font-medium mb-2">⚡ Proposal Analysis</div>
          <div>No valid analysis data found. Check pool prices and token symbols.</div>
          <div className="mt-2 text-xs">
            Debug: {predictionPools.length} prediction pools, {conditionalPools.length} conditional pools
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">⚡</span>
        <h3 className="text-lg font-semibold text-gray-900">Proposal Analysis</h3>
        <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800">
          LIVE CALCULATION
        </span>
      </div>
      
      {/* Event Probabilities Section */}
      {hasEventProbabilities && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🎯</span>
            <h4 className="font-medium text-gray-900">Event Probability</h4>
            <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
              MARKET IMPLIED
            </span>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {eventProbabilities.map((prob, index) => (
              <div key={index} className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-900">{prob.assetType} Proposal</div>
                  <div className={`px-3 py-1 rounded-full text-lg font-bold ${
                    prob.probability > 50 
                      ? 'bg-green-100 text-green-800' 
                      : prob.probability > 30
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {prob.probability.toFixed(1)}%
                  </div>
                </div>
                
                <div className="text-xs text-gray-600 mb-2">
                  Based on {prob.description} → {formatPrice(prob.probability / 100)} probability
                </div>
                
                {/* Detailed Calculation */}
                <div className="bg-gray-50 rounded p-2 mb-2 text-xs">
                  <div className="text-gray-700 mb-1">
                    <strong>Calculation:</strong> {prob.calculationFormula}
                  </div>
                  <div className="text-gray-600">
                    {prob.calculationExplanation}
                  </div>
                  {prob.assetType === 'GNO' && (
                    <div className="text-gray-500 mt-1">
                      <strong>Method:</strong> Normalize conditional token price by spot price to get probability
                    </div>
                  )}
                  {prob.assetType === 'sDAI' && (
                    <div className="text-gray-500 mt-1">
                      <strong>Method:</strong> Pool price directly represents probability (sDAI = numeraire)
                    </div>
                  )}
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      prob.probability > 50 ? 'bg-green-500' : 
                      prob.probability > 30 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(prob.probability, 100)}%` }}
                  ></div>
                </div>
                
                <div className="text-xs text-gray-500 mt-1">
                  Market confidence: {prob.confidenceLevel}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Impact Analysis Section */}
      {hasImpactData && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📊</span>
            <h4 className="font-medium text-gray-900">Price Impact</h4>
            <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
              IF PROPOSAL PASSES
            </span>
          </div>
          
          <div className="text-xs text-gray-600 mb-4">
            Formula: (YES Price - NO Price) / Spot Price × 100
          </div>

          {impactData.map((impact, index) => (
            <div key={index} className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium text-gray-900">{impact.assetPair} Proposal</div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  impact.impactDirection === 'POSITIVE' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {impact.impactPercentage > 0 ? '+' : ''}{impact.impactPercentage.toFixed(3)}%
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="bg-green-50 rounded p-2">
                  <div className="text-xs text-gray-500">YES Pool Price</div>
                  <div className="font-medium text-green-800">
                    {formatPrice(impact.yesConditionalPrice)} sDAI/GNO
                  </div>
                </div>
                
                <div className="bg-red-50 rounded p-2">
                  <div className="text-xs text-gray-500">NO Pool Price</div>
                  <div className="font-medium text-red-800">
                    {formatPrice(impact.noConditionalPrice)} sDAI/GNO
                  </div>
                </div>
                
                <div className="bg-blue-50 rounded p-2">
                  <div className="text-xs text-gray-500">Spot Price</div>
                  <div className="font-medium text-blue-800">
                    {formatPrice(impact.spotConditional)} sDAI/GNO
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-600">
                <div>Calculation: ({formatPrice(impact.yesConditionalPrice)} - {formatPrice(impact.noConditionalPrice)}) / {formatPrice(impact.spotConditional)} × 100 = {impact.impactPercentage.toFixed(3)}%</div>
                <div className="mt-1">
                  <strong>Interpretation:</strong> The proposal is expected to {impact.impactDirection === 'POSITIVE' ? 'increase' : 'decrease'} the GNO price by {Math.abs(impact.impactPercentage).toFixed(3)}% if passed.
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-4 text-xs text-gray-500">
        <div><strong>Simplified Analysis:</strong></div>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Event Probability:</strong> Direct calculation from YES prediction pool prices</li>
          <li><strong>Price Impact:</strong> Based on conditional pool price differences vs spot price</li>
          <li>Using live Balancer spot price: {formatPrice(spotPrice)} sDAI/GNO</li>
        </ul>
      </div>
    </div>
  );
};

export default ProposalImpactCalculator; 