import { useState, useEffect } from 'react';
import { useProposalContext } from '../context/ProposalContext';
import { usePoolDiscovery } from '../hooks/usePoolDiscovery';
import { useProposalTokens } from '../hooks/useProposalTokens';
import { useSpotPrices } from '../hooks/useSpotPrices';
import { formatPrice } from '../utils/poolPriceUtils';
import { standardizePriceDisplay, getConventionTagStyle } from '../utils/priceFormatUtils';
import { BASE_CURRENCY_TOKEN_ADDRESS, BASE_COMPANY_TOKEN_ADDRESS } from '../constants/addresses';
import ProposalImpactCalculator from './ProposalImpactCalculator';
import React from 'react';

const LoadingSpinner = () => (
  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
);

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

// Helper function to safely format prices
const formatPriceHelper = (price, decimals = 2) => {
  if (price === null || price === undefined) return 'N/A';
  if (typeof price === 'number') return price.toFixed(decimals);
  const parsed = parseFloat(price);
  return isNaN(parsed) ? 'N/A' : parsed.toFixed(decimals);
};

const PoolCard = ({ pool, onRefresh, refreshing, baseTokenPool }) => {
  const { address, type, description, token0, token1, prices, method, error, lastUpdated, details, stats } = pool;
  const poolType = details?.type;
  
  const getTypeColor = (poolType) => {
    const typeString = poolType?.type || poolType;
    switch (typeString) {
      case 'PREDICTION_MARKET':
        return 'bg-blue-50 border-blue-200';
      case 'CONDITIONAL_CORRELATED': 
        return 'bg-purple-50 border-purple-200';
      case 'BALANCER_POOL':
        return 'bg-orange-50 border-orange-200';
      case 'REGULAR_POOL':
        return 'bg-green-50 border-green-200';
      default: 
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getTypeBadgeColor = (poolType) => {
    const typeString = poolType?.type || poolType;
    switch (typeString) {
      case 'PREDICTION_MARKET':
        return 'bg-blue-100 text-blue-800';
      case 'CONDITIONAL_CORRELATED':
        return 'bg-purple-100 text-purple-800';
      case 'BALANCER_POOL':
        return 'bg-orange-100 text-orange-800';
      case 'REGULAR_POOL':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getBiasBadgeColor = (bias) => {
    switch (bias) {
      case 'YES': return 'bg-green-100 text-green-800';
      case 'NO': return 'bg-red-100 text-red-800';
      case 'MIXED': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleTimeString();
  };

  // Extract bias information from the pool classification or token symbols
  const poolBias = token0?.symbol?.includes('YES') ? 'YES' : 
                   token0?.symbol?.includes('NO') ? 'NO' : 
                   token1?.symbol?.includes('YES') ? 'YES' :
                   token1?.symbol?.includes('NO') ? 'NO' : 'MIXED';

  // Calculate probability for prediction markets
  const calculateProbability = (stats, poolType) => {
    if (!stats || !poolType || poolType.type !== 'PREDICTION_MARKET') return null;
    
    const conditionalTokenSymbol = poolType.conditionalToken?.symbol;
    const baseTokenSymbol = poolType.baseToken?.symbol;
    
    // For company token prediction markets (YES_GNO/sDAI, NO_GNO/sDAI)
    if (conditionalTokenSymbol && (conditionalTokenSymbol.includes('GNO') || conditionalTokenSymbol.includes('_COMPANY'))) {
      // Try to get live spot price from base token pool, fallback to default
      let companySpotPrice = 150; // Default GNO price in sDAI
      
      if (baseTokenPool?.exists && baseTokenPool?.stats?.price) {
        // Base pool price gives us the live company/currency rate
        // Ensure it's a number - Balancer might return strings
        const balancerPrice = parseFloat(baseTokenPool.stats.price);
        if (!isNaN(balancerPrice) && balancerPrice > 0) {
          companySpotPrice = balancerPrice;
        }
      }
      
      // Pool price is how many sDAI per conditional GNO token
      const poolPrice = parseFloat(stats.price) || 0;
      
      // Need to handle token ordering - if conditional token address > base token address, invert price
      let adjustedPoolPrice = poolPrice;
      if (poolType.conditionalToken?.address && poolType.baseToken?.address) {
        const conditionalAddr = poolType.conditionalToken.address.toLowerCase();
        const baseAddr = poolType.baseToken.address.toLowerCase();
        
        // If conditional token is lexicographically greater, we need to invert the price
        if (conditionalAddr > baseAddr) {
          adjustedPoolPrice = 1 / poolPrice;
        }
      }
      
      const probability = adjustedPoolPrice / companySpotPrice;
      
      return {
        probability: probability * 100, // Convert to percentage
        explanation: `${adjustedPoolPrice.toFixed(2)} ${baseTokenSymbol} per ${conditionalTokenSymbol} ÷ ${companySpotPrice.toFixed(2)} ${baseTokenSymbol} per company token = ${(probability * 100).toFixed(2)}%`,
        spotPrice: companySpotPrice,
        isLivePrice: baseTokenPool?.exists && baseTokenPool?.stats?.price
      };
    }
    
    // For currency token prediction markets (YES_sDAI/sDAI, NO_sDAI/sDAI)
    if (conditionalTokenSymbol && conditionalTokenSymbol.includes('sDAI')) {
      // For sDAI conditional tokens, handle token ordering
      let adjustedPrice = parseFloat(stats.price) || 0;
      
      if (poolType.conditionalToken?.address && poolType.baseToken?.address) {
        const conditionalAddr = poolType.conditionalToken.address.toLowerCase();
        const baseAddr = poolType.baseToken.address.toLowerCase();
        
        // If conditional token is lexicographically greater, we need to invert the price
        if (conditionalAddr > baseAddr) {
          adjustedPrice = 1 / (parseFloat(stats.price) || 1);
        }
      }
      
      const probability = adjustedPrice * 100;
      return {
        probability,
        explanation: `${adjustedPrice.toFixed(6)} ${baseTokenSymbol} per ${conditionalTokenSymbol} = ${probability.toFixed(2)}%`
      };
    }
    
    // Default case - assume price is direct probability
    const price = parseFloat(stats.price) || 0;
    return {
      probability: price * 100,
      explanation: `Price = ${(price * 100).toFixed(2)}%`
    };
  };

  return (
    <div className={`border rounded-lg p-4 ${getTypeColor(poolType)}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-1 text-xs font-medium rounded ${getTypeBadgeColor(poolType)}`}>
            {(poolType?.type || poolType || type || 'UNKNOWN').replace('_', ' ')}
          </span>
          {poolBias && poolBias !== 'MIXED' && (
            <span className={`px-2 py-1 text-xs font-medium rounded ${getBiasBadgeColor(poolBias)}`}>
              {poolBias}
            </span>
          )}
          {baseTokenPool?.exists && (poolType?.type || poolType) === 'PREDICTION_MARKET' && (
            <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
              LIVE PRICE
            </span>
          )}
        </div>
        <button
          onClick={() => onRefresh(address)}
          disabled={refreshing}
          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
          title="Refresh price"
        >
          {refreshing ? <LoadingSpinner /> : <RefreshIcon />}
        </button>
      </div>

      {/* Description */}
      <div className="mb-3">
        <span className="text-sm text-gray-600">{description || details?.description || `${token0?.symbol}/${token1?.symbol} Pool`}</span>
      </div>

      {/* Pool Address */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Pool:</span>
          <span className="text-xs font-mono text-gray-700">
            {address.substring(0, 8)}...{address.substring(address.length - 6)}
          </span>
          <a
            href={`https://gnosisscan.io/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800"
          >
            <ExternalLinkIcon />
          </a>
        </div>
      </div>

      {/* Tokens */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-white/50 rounded p-2">
          <div className="text-xs text-gray-500">Token 0</div>
          <div className="font-medium text-sm">{token0?.symbol || details?.tokenA?.symbol}</div>
          <div className="text-xs text-gray-600">{token0?.name || details?.tokenA?.name}</div>
        </div>
        <div className="bg-white/50 rounded p-2">
          <div className="text-xs text-gray-500">Token 1</div>
          <div className="font-medium text-sm">{token1?.symbol || details?.tokenB?.symbol}</div>
          <div className="text-xs text-gray-600">{token1?.name || details?.tokenB?.name}</div>
        </div>
      </div>

      {/* Price Data or Error */}
      {error ? (
        <div className="bg-red-100 border border-red-200 rounded p-3">
          <div className="text-red-800 text-sm font-medium">Error</div>
          <div className="text-red-700 text-xs">{error}</div>
        </div>
      ) : (prices || stats) ? (
        (() => {
          // Use either prices (from existing data) or stats (from discovery)
          const priceData = prices || { price: stats?.price };
          
          // For CONDITIONAL pools, use standardized price display with currency-per-company convention
          if ((poolType?.type || poolType) === 'CONDITIONAL_CORRELATED' && stats) {
            const poolDataForFormatting = {
              classification: {
                type: 'CONDITIONAL',
                tokens: {
                  // We don't need to set specific tokens here as standardizePriceDisplay will determine convention by symbol
                }
              },
              token0,
              token1,
              prices: {
                token0PerToken1: parseFloat(stats.price) || 0,
                token1PerToken0: parseFloat(stats.price) > 0 ? 1 / parseFloat(stats.price) : 0
              }
            };
            
            const standardizedPrice = standardizePriceDisplay(poolDataForFormatting);

          return (
            <div className="space-y-2">
                {/* Primary Price (Convention) */}
                <div className="bg-white/70 rounded p-3 border-l-4 border-purple-500">
                  <div className="text-xs text-gray-500 mb-1 flex items-center gap-2">
                    <span>Primary Price (Convention)</span>
                    {standardizedPrice.tag && (
                      <span className={`px-1 py-0.5 text-xs rounded ${getConventionTagStyle(standardizedPrice.convention)}`}>
                        {standardizedPrice.tag}
                  </span>
                    )}
                  </div>
                  <div className="text-sm font-medium text-purple-900">
                    {standardizedPrice.primaryLabel}
                  </div>
                </div>
                
                {/* Secondary Price (Alternative Direction) */}
                <div className="bg-white/50 rounded p-3">
                  <div className="text-xs text-gray-500 mb-1">Alternative Price</div>
                  <div className="text-sm text-gray-700">
                    {standardizedPrice.secondaryLabel}
                  </div>
                </div>

                {/* Technical details */}
                <div className="text-xs text-gray-500 space-y-1">
                  {method && <div>Method: {method}()</div>}
                  <div>Updated: {formatTimestamp(lastUpdated || stats?.timestamp)}</div>
                  <div>Convention: {standardizedPrice.convention}</div>
                </div>
              </div>
            );
          }
          
          // For PREDICTION pools, use standardized price display with position-per-base convention
          if ((poolType?.type || poolType) === 'PREDICTION_MARKET' && stats) {
            // Determine which token is base and which is position based on symbol
            let baseToken, positionToken;
            if (token0?.symbol?.includes('YES_') || token0?.symbol?.includes('NO_')) {
              positionToken = token0;
              baseToken = token1;
            } else if (token1?.symbol?.includes('YES_') || token1?.symbol?.includes('NO_')) {
              positionToken = token1;
              baseToken = token0;
            } else {
              // Fallback if we can't determine from symbols
              baseToken = token0;
              positionToken = token1;
            }

            const poolDataForFormatting = {
              classification: {
                type: 'PREDICTION',
                tokens: {
                  base: baseToken,
                  position: positionToken
                }
              },
              token0,
              token1,
              prices: {
                token0PerToken1: parseFloat(stats.price) || 0,
                token1PerToken0: parseFloat(stats.price) > 0 ? 1 / parseFloat(stats.price) : 0
              }
            };
            
            const standardizedPrice = standardizePriceDisplay(poolDataForFormatting);

            return (
              <div className="space-y-2">
                {/* Primary Price (Convention) */}
                <div className="bg-white/70 rounded p-3 border-l-4 border-blue-500">
                  <div className="text-xs text-gray-500 mb-1 flex items-center gap-2">
                    <span>Primary Price (Convention)</span>
                    {standardizedPrice.tag && (
                      <span className={`px-1 py-0.5 text-xs rounded ${getConventionTagStyle(standardizedPrice.convention)}`}>
                        {standardizedPrice.tag}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-medium text-blue-900">
                    {standardizedPrice.primaryLabel}
                  </div>
                </div>
                
                {/* Secondary Price (Alternative Direction) */}
                <div className="bg-white/50 rounded p-3">
                  <div className="text-xs text-gray-500 mb-1">Alternative Price</div>
                  <div className="text-sm text-gray-700">
                    {standardizedPrice.secondaryLabel}
                  </div>
                </div>

                {/* Prediction Market Probability */}
                <div className="bg-blue-100 rounded p-3">
                  <div className="text-sm font-medium text-blue-800">Prediction Market</div>
                  {(() => {
                    const probData = calculateProbability(stats, details);
                    return probData ? (
                      <div className="text-xs text-blue-700">
                        <div className="flex items-center gap-1">
                          <span>{details.conditionalToken?.symbol} probability: {probData.probability.toFixed(2)}%</span>
                          {probData.isLivePrice && (
                            <span className="inline-flex items-center px-1 py-0.5 rounded text-xs bg-green-200 text-green-800">Live</span>
                          )}
                        </div>
                        <div className="mt-1 text-blue-600 text-xs">{probData.explanation}</div>
                        {probData.spotPrice && (
                          <div className="mt-1 text-blue-500 text-xs">
                            Company spot: {formatPriceHelper(probData.spotPrice)} {probData.isLivePrice ? '(live)' : '(default)'}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-blue-700">
                        Price: {formatPriceHelper(stats.price)}
                      </div>
                    );
                  })()}
                </div>

                {/* Technical details */}
                <div className="text-xs text-gray-500 space-y-1">
                  {method && <div>Method: {method}()</div>}
                  <div>Updated: {formatTimestamp(lastUpdated || stats?.timestamp)}</div>
                  <div>Convention: {standardizedPrice.convention}</div>
                </div>
              </div>
            );
          }
          
          // For all other pool types, use existing logic
          // Handle Balancer price convention for GNO/sDAI pairs
          let primaryPrice = parseFloat(priceData.price) || 0;
          let secondaryPrice = primaryPrice > 0 ? 1 / primaryPrice : 0;
          
          // Check if this is a GNO/sDAI Balancer pool and apply correct convention
          if ((poolType?.type || poolType) === 'BALANCER_POOL') {
            const token0Symbol = token0?.symbol || details?.tokenA?.symbol;
            const token1Symbol = token1?.symbol || details?.tokenB?.symbol;
            
            // Debug logging
            console.log('🔧 Balancer price debug:', {
              originalPrice: primaryPrice,
              token0Symbol,
              token1Symbol,
              poolType: poolType?.type || poolType
            });
            
            // For GNO/sDAI pairs, ensure we show currency-per-company convention
            // Primary should be: sDAI per GNO (how much sDAI to buy 1 GNO)
            if ((token0Symbol === 'GNO' && token1Symbol === 'sDAI') || 
                (token0Symbol === 'sDAI' && token1Symbol === 'GNO')) {
              
              // GNO should be worth 100+ sDAI, so if we get a small number, invert it
              if (primaryPrice < 50) {
                console.log('🔧 Inverting Balancer price (too small):', primaryPrice, '→', 1/primaryPrice);
                primaryPrice = primaryPrice > 0 ? 1 / primaryPrice : 0;
                secondaryPrice = parseFloat(priceData.price) || 0;
              }
              // Also handle specific token ordering
              else if (token0Symbol === 'sDAI' && token1Symbol === 'GNO') {
                console.log('🔧 Inverting Balancer price (token order):', primaryPrice, '→', 1/primaryPrice);
                primaryPrice = primaryPrice > 0 ? 1 / primaryPrice : 0;
                secondaryPrice = parseFloat(priceData.price) || 0;
              }
              
              console.log('🔧 Final Balancer prices:', { primaryPrice, secondaryPrice });
            }
          }

          return (
            <div className="space-y-2">
              {/* Primary Price (Following Convention) */}
              <div className="bg-white/70 rounded p-3 border-l-4 border-blue-500">
                <div className="text-xs text-gray-500 mb-1">Primary Price (Convention)</div>
                <div className="text-sm font-medium text-blue-900">
                  {formatPriceHelper(primaryPrice)} {token1?.symbol || details?.tokenB?.symbol}/{token0?.symbol || details?.tokenA?.symbol}
                </div>
              </div>
              
              {/* Secondary Price (Alternative Direction) */}
              <div className="bg-white/50 rounded p-3">
                <div className="text-xs text-gray-500 mb-1">Alternative Price</div>
                <div className="text-sm text-gray-700">
                  {formatPriceHelper(secondaryPrice)} {token0?.symbol || details?.tokenA?.symbol}/{token1?.symbol || details?.tokenB?.symbol}
                </div>
              </div>

              {/* Prediction Market Probability */}
              {(poolType?.type || poolType) === 'PREDICTION_MARKET' && stats && (
                <div className="bg-blue-100 rounded p-3">
                  <div className="text-sm font-medium text-blue-800">Prediction Market</div>
                  {(() => {
                    const probData = calculateProbability(stats, details);
                    return probData ? (
                      <div className="text-xs text-blue-700">
                        <div className="flex items-center gap-1">
                          <span>{details.conditionalToken?.symbol} probability: {probData.probability.toFixed(2)}%</span>
                          {probData.isLivePrice && (
                            <span className="inline-flex items-center px-1 py-0.5 rounded text-xs bg-green-200 text-green-800">Live</span>
                          )}
                        </div>
                        <div className="mt-1 text-blue-600 text-xs">{probData.explanation}</div>
                        {probData.spotPrice && (
                          <div className="mt-1 text-blue-500 text-xs">
                            Company spot: {formatPriceHelper(probData.spotPrice)} {probData.isLivePrice ? '(live)' : '(default)'}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-blue-700">
                        Price: {formatPriceHelper(stats.price)}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Balancer Pool Info */}
              {(poolType?.type || poolType) === 'BALANCER_POOL' && (
                <div className="bg-orange-100 rounded p-3">
                  <div className="text-sm font-medium text-orange-800">
                    Balancer {details?.poolType} Pool
                  </div>
                  <div className="text-xs text-orange-700 mt-1">
                    <div>Pool ID: {details?.poolId?.slice(0, 10)}...</div>
                    <div>Source: Balancer Protocol</div>
                    {stats && stats.totalLiquidity && (
                      <div>Liquidity: ${parseFloat(stats.totalLiquidity).toLocaleString()}</div>
                    )}
                    {stats && stats.swapFee && (
                      <div>Swap Fee: {(parseFloat(stats.swapFee) * 100).toFixed(2)}%</div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Technical details */}
              <div className="text-xs text-gray-500 space-y-1">
                {method && <div>Method: {method}()</div>}
                <div>Updated: {formatTimestamp(lastUpdated || stats?.timestamp)}</div>
                <div>Convention: direct_pricing</div>
              </div>
            </div>
          );
        })()
      ) : (
        <div className="bg-yellow-100 border border-yellow-200 rounded p-3">
          <div className="text-yellow-800 text-sm">Loading price data...</div>
        </div>
      )}
    </div>
  );
};

const NativeTokenPriceCard = () => {
  const {
    fetchNativeTokenPrices,
    getNativeTokenPrice,
    getError,
    loading: spotLoading,
    initialized
  } = useSpotPrices();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchNativeTokenPrices();
    } finally {
      setRefreshing(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  // Get the native token price data (sDAI/GNO pair)
  const nativePrice = getNativeTokenPrice();
  // Get error for the native pair - using the base token addresses
  const error = getError(BASE_CURRENCY_TOKEN_ADDRESS, BASE_COMPANY_TOKEN_ADDRESS);

  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800">
            NATIVE TOKEN
          </span>
          <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
            BALANCER
          </span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || spotLoading}
          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
          title="Refresh prices"
        >
          {refreshing || spotLoading ? <LoadingSpinner /> : <RefreshIcon />}
        </button>
      </div>

      <div className="mb-3">
        <span className="text-sm text-gray-600">Native token pricing from Balancer Protocol</span>
      </div>

      {error ? (
        <div className="bg-red-100 border border-red-200 rounded p-3">
          <div className="text-red-800 text-sm font-medium">Error</div>
          <div className="text-red-700 text-xs">{error}</div>
        </div>
      ) : nativePrice ? (
            <div className="space-y-2">
          <div className="bg-white/70 rounded p-3 border-l-4 border-purple-500">
            <div className="text-xs text-gray-500 mb-1">sDAI per GNO</div>
            <div className="text-sm font-medium text-purple-900">
              {nativePrice.priceAtoB?.toFixed(2) || 'N/A'}
                </div>
              </div>
              
              <div className="bg-white/50 rounded p-3">
            <div className="text-xs text-gray-500 mb-1">GNO per sDAI</div>
                <div className="text-sm text-gray-700">
              {nativePrice.priceBtoA?.toFixed(6) || 'N/A'}
                </div>
              </div>
              
              <div className="text-xs text-gray-500 space-y-1">
                <div>Strategy: {nativePrice.strategyUsed}</div>
                <div>Updated: {formatTimestamp(nativePrice.lastUpdated)}</div>
            {nativePrice.pool && (
              <>
                <div>Pool: {nativePrice.pool.id?.slice(0, 10)}...</div>
                <div>TVL: ${parseFloat(nativePrice.pool.totalLiquidity || 0).toLocaleString()}</div>
              </>
            )}
              </div>
            </div>
      ) : (
        <div className="bg-yellow-100 border border-yellow-200 rounded p-3">
          <div className="text-yellow-800 text-sm">Loading native token prices...</div>
        </div>
      )}
    </div>
  );
};

const PoolPriceDisplay = () => {
  const proposal = useProposalContext();
  const proposalTokens = useProposalTokens();
  const poolDiscovery = usePoolDiscovery();
  const [refreshingPool, setRefreshingPool] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // Helper to safely format prices
  const formatPriceHelper2 = (price, decimals = 2) => {
    if (price === null || price === undefined) return 'N/A';
    if (typeof price === 'number') return price.toFixed(decimals);
    const parsed = parseFloat(price);
    return isNaN(parsed) ? 'N/A' : parsed.toFixed(decimals);
  };

  // Debug logging - must be at top before any conditional returns
  React.useEffect(() => {
    if (proposalTokens.isReady) {
      console.log('🚀 PoolPriceDisplay: proposalTokens ready');
      console.log('🚀 PoolPriceDisplay: poolDiscovery.pools:', Object.keys(poolDiscovery.pools).length, 'pools');
    }
  }, [proposalTokens.isReady, poolDiscovery.pools]);

  if (!proposal.isProposalReady()) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center py-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <LoadingSpinner />
            <span className="text-gray-600">Loading proposal...</span>
          </div>
          <p className="text-gray-500">Please load a proposal to discover and analyze pools</p>
        </div>
      </div>
    );
  }

  const handleRefreshAll = async () => {
    if (!isDiscoveryReady) {
      alert('Please wait for tokens to finish loading before discovering pools.');
      return;
    }
    await poolDiscovery.discoverPools();
  };

  const handleRefreshSingle = async (poolAddress) => {
    setRefreshingPool(poolAddress);
    try {
      // For now, just refresh all pools
      // In the future, we could implement single pool refresh
      await poolDiscovery.discoverPools();
    } finally {
      setRefreshingPool(null);
    }
  };

  const formatLastUpdated = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  // Get pools from discovery
  const predictionMarkets = poolDiscovery.getPredictionMarkets();
  const conditionalPools = poolDiscovery.getConditionalPools();
  const baseTokenPool = poolDiscovery.getBaseTokenPool();
  const summary = poolDiscovery.getDiscoverySummary();

  // Convert pools to the format expected by PoolCard
  const formatPoolForCard = (poolKey, poolData) => {
    const { address, exists, stats, details } = poolData;
    
    if (!exists) return null;

    // Get the correct token order from pool stats (actual contract token0/token1)
    let token0, token1;
    
    if (stats && stats.token0 && stats.token1) {
      // Use actual contract token0/token1 order
      const token0Address = stats.token0.toLowerCase();
      const token1Address = stats.token1.toLowerCase();
      
      // Match with our discovered tokens
      if (details?.tokenA?.address?.toLowerCase() === token0Address) {
        token0 = details.tokenA;
        token1 = details.tokenB;
      } else if (details?.tokenB?.address?.toLowerCase() === token0Address) {
        token0 = details.tokenB;
        token1 = details.tokenA;
      } else {
        // Fallback to discovery order if we can't match
        console.warn(`⚠️ Could not match contract tokens with discovered tokens for pool ${address}`);
        token0 = details?.tokenA;
        token1 = details?.tokenB;
      }
      
      console.log(`🔧 Pool ${address} token order:`, {
        contractToken0: token0Address,
        contractToken1: token1Address,
        discoveredTokenA: details?.tokenA?.address,
        discoveredTokenB: details?.tokenB?.address,
        finalToken0: token0?.symbol,
        finalToken1: token1?.symbol
      });
    } else {
      // Fallback to discovery order if no stats available
      token0 = details?.tokenA;
      token1 = details?.tokenB;
    }

    return {
      address,
      type: details?.type?.type || 'UNKNOWN',
      description: details?.description,
      token0, // Use correct contract token0
      token1, // Use correct contract token1
      prices: stats ? { price: stats.price } : null,
      stats,
      details,
      lastUpdated: poolData.timestamp,
      method: 'discovery'
    };
  };

  // Convert pools for the ProposalImpactCalculator with proper classification and prices fields
  const formatPoolForAnalysis = (poolKey, poolData) => {
    const { address, exists, stats, details } = poolData;
    
    if (!exists || !stats) return null;

    // Get the correct token order from pool stats (actual contract token0/token1)
    let token0, token1;
    
    if (stats && stats.token0 && stats.token1) {
      // Use actual contract token0/token1 order
      const token0Address = stats.token0.toLowerCase();
      const token1Address = stats.token1.toLowerCase();
      
      // Match with our discovered tokens
      if (details?.tokenA?.address?.toLowerCase() === token0Address) {
        token0 = details.tokenA;
        token1 = details.tokenB;
      } else if (details?.tokenB?.address?.toLowerCase() === token0Address) {
        token0 = details.tokenB;
        token1 = details.tokenA;
      } else {
        // Fallback to discovery order if we can't match
        console.warn(`⚠️ Could not match contract tokens with discovered tokens for pool ${address}`);
        token0 = details?.tokenA;
        token1 = details?.tokenB;
      }
    } else {
      // Fallback to discovery order if no stats available
      token0 = details?.tokenA;
      token1 = details?.tokenB;
    }

    // Create classification based on pool type
    const poolType = details?.type?.type || 'UNKNOWN';
    let classification = {
      type: poolType === 'PREDICTION_MARKET' ? 'PREDICTION' : 
            poolType === 'CONDITIONAL_CORRELATED' ? 'CONDITIONAL' : 
            poolType,
      poolBias: 'MIXED',
      subtype: poolType
    };

    // Determine bias based on token symbols (use corrected tokens)
    const token0Symbol = token0?.symbol || '';
    const token1Symbol = token1?.symbol || '';
    
    if (token0Symbol.includes('YES') || token1Symbol.includes('YES')) {
      classification.poolBias = 'YES';
      classification.subtype = 'YES';
    } else if (token0Symbol.includes('NO') || token1Symbol.includes('NO')) {
      classification.poolBias = 'NO';
      classification.subtype = 'NO';
    }

    return {
      address,
      token0, // Use correct contract token0
      token1, // Use correct contract token1
      prices: { price: stats.price }, // Add prices field that analysis hook expects
      stats,
      details,
      classification, // Add classification field that analysis hook expects
      lastUpdated: poolData.timestamp,
      method: 'discovery'
    };
  };

  // Format pools by category
  const predictionPoolsFormatted = Object.entries(predictionMarkets)
    .map(([key, pool]) => formatPoolForCard(key, pool))
    .filter(Boolean);

  const conditionalPoolsFormatted = Object.entries(conditionalPools)
    .map(([key, pool]) => formatPoolForCard(key, pool))
    .filter(Boolean);

  const balancerPoolsFormatted = baseTokenPool.exists ? [formatPoolForCard('base_tokens', baseTokenPool)] : [];

  // Format pools for analysis (with classification and prices fields)
  const predictionPoolsForAnalysis = Object.entries(predictionMarkets)
    .map(([key, pool]) => formatPoolForAnalysis(key, pool))
    .filter(Boolean);

  const conditionalPoolsForAnalysis = Object.entries(conditionalPools)
    .map(([key, pool]) => formatPoolForAnalysis(key, pool))
    .filter(Boolean);

  const allPools = [...predictionPoolsFormatted, ...conditionalPoolsFormatted, ...balancerPoolsFormatted];
  const hasData = allPools.length > 0;
  const hasPrices = allPools.some(pool => pool.stats || pool.prices);

  // Check if tokens are ready for discovery
  const isDiscoveryReady = proposalTokens.isReady && !proposalTokens.loading;
  const tokensLoading = proposalTokens.loading;
  const hasDiscoveredPools = Object.keys(poolDiscovery.pools).length > 0;

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        {proposal.getMarketName()} - Pool Prices
      </h2>
      <p className="text-gray-600 mb-6">
        Automatic discovery and pricing for prediction and conditional token pools from proposal contracts
      </p>

      {/* Proposal Info */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-blue-900">Proposal Analysis</h3>
            <div className="flex items-center gap-4 mt-2 text-sm text-blue-700">
              <span>Proposal: {proposal.proposalAddress?.slice(0, 10)}...</span>
              {poolDiscovery.lastDiscovery && (
                <span>Last scan: {poolDiscovery.lastDiscovery.toLocaleTimeString()}</span>
              )}
              {baseTokenPool.exists && baseTokenPool.stats && baseTokenPool.stats.price && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                  Live Balancer Price: {formatPriceHelper2(baseTokenPool.stats.price)} {baseTokenPool.details?.tokenB?.symbol}/{baseTokenPool.details?.tokenA?.symbol}
                </span>
              )}
            </div>

            {/* Opening Time Display */}
            {(() => {
              const openingTimeInfo = proposal.getOpeningTimeInfo();
              if (!openingTimeInfo) return null;
              
              return (
                <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-blue-900">
                        📅 Voting Opens: {openingTimeInfo.utcString}
                      </div>
                      <div className="text-xs text-blue-600 mt-1">
                        Local: {openingTimeInfo.localString}
                      </div>
                    </div>
                    <div className="text-right">
                      {openingTimeInfo.isOpen ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                          🟢 OPEN FOR VOTING
                        </span>
                      ) : (
                        <div>
                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">
                            ⏳ {openingTimeInfo.daysUntilOpening > 0 
                              ? `${openingTimeInfo.daysUntilOpening}d until opening`
                              : openingTimeInfo.hoursUntilOpening > 0
                              ? `${openingTimeInfo.hoursUntilOpening}h until opening`  
                              : `${openingTimeInfo.minutesUntilOpening}m until opening`
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Token Status & Discovery */}
            <div className="mt-3 text-sm">
              {tokensLoading ? (
                <div className="flex items-center gap-2 text-blue-600">
                  <LoadingSpinner />
                  <span>Loading tokens from contracts...</span>
                </div>
              ) : isDiscoveryReady ? (
                <div className="flex items-center gap-2 text-green-600">
                  <span>✅ Tokens ready ({proposalTokens.stats.totalTokens} loaded)</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-orange-600">
                  <span>⚠️ Tokens not ready yet</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Token Status & Discovery */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Pool Discovery</h3>
            <div className="flex items-center gap-4 mt-2 text-sm">
              {tokensLoading ? (
                <div className="flex items-center gap-2 text-blue-600">
                  <LoadingSpinner />
                  <span>Loading tokens from contracts...</span>
                </div>
              ) : isDiscoveryReady ? (
                <div className="flex items-center gap-2 text-green-600">
                  <span>✅ Tokens ready ({proposalTokens.stats.totalTokens} loaded)</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-orange-600">
                  <span>⚠️ Tokens not ready yet</span>
                </div>
              )}
              
              {poolDiscovery.lastDiscovery && (
                <span className="text-gray-600">Last scan: {poolDiscovery.lastDiscovery.toLocaleTimeString()}</span>
              )}
            </div>
            
            {isDiscoveryReady && !hasDiscoveredPools && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700 mb-3">
                  🔍 Ready to discover pools! Click the button below to find all prediction and conditional token pools for this proposal.
                </p>
          <button
                  onClick={handleRefreshAll}
                  disabled={poolDiscovery.loading}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
                >
                  {poolDiscovery.loading ? (
              <>
                <LoadingSpinner />
                      Discovering Pools...
              </>
            ) : (
                    <>
                      🚀 Discover Pools
                    </>
            )}
          </button>
        </div>
            )}
            
            {hasDiscoveredPools && baseTokenPool.exists && baseTokenPool.stats && baseTokenPool.stats.price && (
              <div className="mt-3">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                  Live Balancer Price: {formatPriceHelper2(baseTokenPool.stats.price)} {baseTokenPool.details?.tokenB?.symbol}/{baseTokenPool.details?.tokenA?.symbol}
              </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Bar - Only show when pools have been discovered */}
      {hasDiscoveredPools && (
      <div className="flex items-center justify-between mb-6 p-3 bg-blue-50 rounded-lg">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
              {poolDiscovery.loading ? <LoadingSpinner /> : <div className="w-2 h-2 bg-green-500 rounded-full"></div>}
              <span>Status: {poolDiscovery.loading ? 'Discovering...' : hasData ? 'Ready' : 'No data'}</span>
          </div>
          <div>
              Pools: {predictionPoolsFormatted.length} Prediction, {conditionalPoolsFormatted.length} Conditional, {balancerPoolsFormatted.length} Balancer
          </div>
          <div>
              Last Updated: {formatLastUpdated(poolDiscovery.lastDiscovery)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm transition-colors"
          >
            {showDetails ? 'Hide' : 'Show'} Details
          </button>
          <button
            onClick={handleRefreshAll}
              disabled={poolDiscovery.loading || !isDiscoveryReady}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center gap-1"
          >
              {poolDiscovery.loading ? <LoadingSpinner /> : <RefreshIcon />}
              Refresh Discovery
          </button>
        </div>
      </div>
      )}

      {/* Discovery Status - Show when tokens not ready */}
      {!isDiscoveryReady && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-yellow-700">
            <h3 className="text-sm font-medium">🔄 Waiting for Tokens</h3>
            <p className="text-sm mt-1">
              Pool discovery will be available once all proposal tokens are loaded from their contracts.
              {tokensLoading && ' Please wait...'}
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {poolDiscovery.hasError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-700">
            <h3 className="text-sm font-medium">Discovery Error</h3>
            <p className="text-sm mt-1">{poolDiscovery.error}</p>
          </div>
          <button
            onClick={handleRefreshAll}
            disabled={!isDiscoveryReady || poolDiscovery.loading}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
          >
            Retry Discovery
          </button>
        </div>
      )}

      {/* Pool Results - Only show when pools have been discovered */}
      {hasDiscoveredPools && (
        <>
      {/* Debug Info */}
          {showDetails && hasData && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">Debug Information</h3>
          <div className="space-y-2 text-sm">
                {allPools.map((pool, index) => (
              <div key={index} className="border-l-4 border-blue-500 pl-3">
                <div className="font-medium">{pool.address}</div>
                <div>Type: <span className="font-mono">{pool.type}</span></div>
                    <div>Token0: <span className="font-mono">{pool.token0?.symbol} ({pool.token0?.address})</span></div>
                    <div>Token1: <span className="font-mono">{pool.token1?.symbol} ({pool.token1?.address})</span></div>
                <div>Description: {pool.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prediction Pools */}
          {predictionPoolsFormatted.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-blue-500 rounded"></span>
                Prediction Pools ({predictionPoolsFormatted.length})
          </h3>
          <p className="text-gray-600 text-sm mb-4">
            Pools trading base tokens (GNO, SDAI) against position tokens (YES/NO)
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {predictionPoolsFormatted.map((pool) => (
              <PoolCard
                key={pool.address}
                pool={pool}
                onRefresh={handleRefreshSingle}
                refreshing={refreshingPool === pool.address}
                    baseTokenPool={baseTokenPool}
              />
            ))}
          </div>
        </div>
      )}

      {/* Conditional Pools */}
          {conditionalPoolsFormatted.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-purple-500 rounded"></span>
                Conditional Pools ({conditionalPoolsFormatted.length})
          </h3>
          <p className="text-gray-600 text-sm mb-4">
            Pools trading position tokens against each other (cross-asset arbitrage)
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {conditionalPoolsFormatted.map((pool) => (
              <PoolCard
                key={pool.address}
                pool={pool}
                onRefresh={handleRefreshSingle}
                refreshing={refreshingPool === pool.address}
                    baseTokenPool={baseTokenPool}
              />
            ))}
          </div>
        </div>
      )}

          {/* Balancer Pools */}
          {balancerPoolsFormatted.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-orange-500 rounded"></span>
                Balancer Price Pools ({balancerPoolsFormatted.length})
          </h3>
          <p className="text-gray-600 text-sm mb-4">
                Balancer pools providing live pricing for base token conversions
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {balancerPoolsFormatted.map((pool) => (
              <PoolCard
                key={pool.address}
                pool={pool}
                onRefresh={handleRefreshSingle}
                refreshing={refreshingPool === pool.address}
                    baseTokenPool={baseTokenPool}
              />
            ))}
          </div>
        </div>
      )}

          {/* Proposal Impact Calculator */}
          {predictionPoolsFormatted.length > 0 && conditionalPoolsFormatted.length > 0 && (
            <div className="mb-8">
              {/* Debug logging */}
              {(() => {
                console.log('🔧 ProposalImpactCalculator pools:', {
                  predictionCount: predictionPoolsForAnalysis.length,
                  conditionalCount: conditionalPoolsForAnalysis.length,
                  predictionPools: predictionPoolsForAnalysis.map(p => ({
                    tokens: `${p.token0?.symbol} vs ${p.token1?.symbol}`,
                    classification: p.classification,
                    hasPrices: !!p.prices
                  })),
                  conditionalPools: conditionalPoolsForAnalysis.map(p => ({
                    tokens: `${p.token0?.symbol} vs ${p.token1?.symbol}`,
                    classification: p.classification,
                    hasPrices: !!p.prices
                  }))
                });
                return null;
              })()}
              <ProposalImpactCalculator poolData={{
                prediction: predictionPoolsForAnalysis,
                conditional: conditionalPoolsForAnalysis,
                unknown: [],
                baseTokenPool: baseTokenPool
              }} />
            </div>
          )}

          {/* No Data State - When discovered but no pools found */}
          {!poolDiscovery.loading && !hasData && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 002 2h2a2 2 0 012 2v6a2 2 0 01-2 2h-2a2 2 0 01-2-2v-6a2 2 0 00-2-2h-2a2 2 0 00-2 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2h2a2 2 0 012 2v6a2 2 0 002 2z" />
            </svg>
          </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Pools Found</h3>
              <p className="text-gray-600 mb-4">No pools discovered for this proposal. This could mean the markets haven't been created yet or the proposal hasn't deployed its conditional tokens.</p>
          <button
            onClick={handleRefreshAll}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
                Retry Discovery
          </button>
        </div>
          )}
        </>
      )}

      {/* Footer Info */}
      <div className="mt-8 p-4 bg-gray-100 rounded-lg text-sm text-gray-600">
        <h4 className="font-medium mb-2">How Dynamic Pool Discovery Works:</h4>
        <ul className="space-y-1 text-xs">
          <li><strong>Proposal Analysis:</strong> Reads conditional tokens and base tokens directly from the proposal contract</li>
          <li><strong>Pool Discovery:</strong> Searches for Algebra pools containing these tokens using factory patterns</li>
          <li><strong>Prediction Pools:</strong> One token is a base asset (GNO/SDAI), the other is a position token (YES_*/NO_*)</li>
          <li><strong>Conditional Pools:</strong> Both tokens are position tokens, typically from different underlying assets</li>
          <li><strong>Balancer Integration:</strong> Live pricing from Balancer Protocol for base token conversions</li>
          <li><strong>Live Updates:</strong> Prices are fetched in real-time and include probability calculations for prediction markets</li>
        </ul>
      </div>
    </div>
  );
};

export default PoolPriceDisplay; 