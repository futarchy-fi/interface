import { useState } from 'react';
import { useProposalContext } from '../context/ProposalContext';
import { usePoolDiscovery } from '../hooks/usePoolDiscovery';
import { useProposalTokens } from '../hooks/useProposalTokens';
import React from 'react';

const LoadingSpinner = ({ className = "" }) => (
  <svg className={`animate-spin h-4 w-4 ${className}`} viewBox="0 0 24 24">
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
      fill="none"
      opacity="0.15"
    />
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      d="M4 12a8 8 0 018-8"
    />
  </svg>
);

const PoolCard = ({ poolKey, poolData, onSelect, isSelected, baseTokenPool, formatPrice }) => {
  const { address, exists, stats, details } = poolData;
  const poolType = details?.type;
  
  const getPoolTypeColor = () => {
    if (!exists) return 'bg-gray-100 border-gray-300';
    
    switch (poolType?.type) {
      case 'PREDICTION_MARKET':
        return 'bg-blue-50 border-blue-300';
      case 'CONDITIONAL_CORRELATED':
        return 'bg-green-50 border-green-300';
      case 'REGULAR_POOL':
        return 'bg-purple-50 border-purple-300';
      case 'BALANCER_POOL':
        return 'bg-orange-50 border-orange-300';
      default:
        return 'bg-yellow-50 border-yellow-300';
    }
  };

  const getStatusBadge = () => {
    if (exists) {
      const badgeClass = poolType?.type === 'BALANCER_POOL' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800';
      return <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badgeClass}`}>✅ Found</span>;
    }
    return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">❌ Not Found</span>;
  };

  const formatLiquidity = (liquidity) => {
    if (!liquidity) return 'N/A';
    if (typeof liquidity === 'string' && !isNaN(liquidity)) {
      return parseInt(liquidity).toLocaleString();
    }
    if (typeof liquidity === 'number') {
      return liquidity.toLocaleString();
    }
    return liquidity;
  };

  // Calculate probability for prediction markets with proper spot price handling
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
    <div 
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${getPoolTypeColor()} ${
        isSelected ? 'ring-2 ring-blue-500' : ''
      } ${exists ? 'hover:shadow-md' : 'opacity-75'}`}
      onClick={() => exists && onSelect({ poolKey, poolData })}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{details?.description || poolKey}</h3>
          <p className="text-sm text-gray-600">{poolType?.type?.replace('_', ' ') || 'Unknown'}</p>
        </div>
        {getStatusBadge()}
      </div>
      
      {exists && (
        <div className="space-y-2">
          <div className="text-sm">
            <span className="font-medium">Address:</span>
            <span className="ml-2 font-mono text-xs bg-gray-200 px-2 py-1 rounded">
              {`${address.slice(0, 6)}...${address.slice(-4)}`}
            </span>
          </div>
          
          {stats && (
            <div className="text-sm space-y-1">
              <div>
                <span className="font-medium">Price:</span>
                <span className="ml-2">
                  {poolType?.type === 'BALANCER_POOL' 
                    ? `${formatPrice(stats.price)} ${details?.tokenB?.symbol}/${details?.tokenA?.symbol}`
                    : `${formatPrice(stats.price)} ${details?.tokenB?.symbol}/${details?.tokenA?.symbol}`
                  }
                </span>
              </div>
              <div>
                <span className="font-medium">Liquidity:</span>
                <span className="ml-2">
                  {poolType?.type === 'BALANCER_POOL' && stats.totalLiquidity
                    ? `$${formatLiquidity(parseFloat(stats.totalLiquidity))}`
                    : formatLiquidity(stats.liquidity)
                  }
                </span>
              </div>
              {poolType?.type === 'BALANCER_POOL' && stats.swapFee && (
                <div>
                  <span className="font-medium">Swap Fee:</span>
                  <span className="ml-2">{(parseFloat(stats.swapFee) * 100).toFixed(2)}%</span>
                </div>
              )}
            </div>
          )}
          
          {poolType?.type === 'PREDICTION_MARKET' && stats && (
            <div className="mt-2 p-2 bg-blue-100 rounded">
              <div className="text-sm font-medium text-blue-800">
                Prediction Market
              </div>
              {(() => {
                const probData = calculateProbability(stats, poolType);
                return probData ? (
                  <div className="text-xs text-blue-700">
                    <div className="flex items-center gap-1">
                      <span>{poolType.conditionalToken?.symbol} probability: {probData.probability.toFixed(2)}%</span>
                      {probData.isLivePrice && (
                        <span className="inline-flex items-center px-1 py-0.5 rounded text-xs bg-green-200 text-green-800">Live</span>
                      )}
                    </div>
                    <div className="mt-1 text-blue-600 text-xs">{probData.explanation}</div>
                    {probData.spotPrice && (
                      <div className="mt-1 text-blue-500 text-xs">
                        Company spot: {formatPrice(probData.spotPrice)} {probData.isLivePrice ? '(live)' : '(default)'}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-blue-700">
                    Price: {formatPrice(stats.price)}
                  </div>
                );
              })()}
            </div>
          )}
          
          {poolType?.type === 'BALANCER_POOL' && (
            <div className="mt-2 p-2 bg-orange-100 rounded">
              <div className="text-sm font-medium text-orange-800">
                Balancer {details?.poolType} Pool
              </div>
              <div className="text-xs text-orange-700 mt-1">
                <div>Pool ID: {details?.poolId?.slice(0, 10)}...</div>
                <div>Source: Balancer Protocol</div>
                {poolData.timestamp && (
                  <div>Updated: {new Date(poolData.timestamp).toLocaleTimeString()}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      {!exists && (
        <div className="text-sm text-gray-500">
          <p>Pool not found for:</p>
          <p className="font-mono text-xs">
            {details?.tokenA?.symbol || 'Token A'} / {details?.tokenB?.symbol || 'Token B'}
          </p>
        </div>
      )}
    </div>
  );
};

const PoolDiscoveryDashboard = () => {
  const proposal = useProposalContext();
  const proposalTokens = useProposalTokens();
  const poolDiscovery = usePoolDiscovery();
  const [selectedPool, setSelectedPool] = useState(null);
  const [activeTab, setActiveTab] = useState('futarchy');

  // Helper function to safely format prices
  const formatPrice = (price, decimals = 2) => {
    if (price === null || price === undefined) return 'N/A';
    if (typeof price === 'number') return price.toFixed(decimals);
    const parsed = parseFloat(price);
    return isNaN(parsed) ? 'N/A' : parsed.toFixed(decimals);
  };

  // Debug logging - must be at top before any conditional returns
  React.useEffect(() => {
    if (proposalTokens.isReady) {
      console.log('🐛 DEBUG: proposalTokens.tokenInfos:', proposalTokens.tokenInfos);
      console.log('🐛 DEBUG: proposalTokens.stats:', proposalTokens.stats);
      console.log('🐛 DEBUG: getTokensByCategory():', proposalTokens.getTokensByCategory());
      
      const categories = proposalTokens.getTokensByCategory();
      console.log('🐛 DEBUG: Base tokens:', categories.base);
      console.log('🐛 DEBUG: Conditional tokens:', categories.conditional);
      console.log('🐛 DEBUG: All categories:', categories);
      
      // Check individual token properties
      Object.entries(proposalTokens.tokenInfos).forEach(([key, token]) => {
        console.log(`🐛 DEBUG: Token ${key}:`, {
          symbol: token.symbol,
          tokenType: token.tokenType,
          isConditional: token.isConditional,
          isBaseToken: token.isBaseToken,
          address: token.address
        });
      });
    }
  }, [proposalTokens.isReady, proposalTokens.tokenInfos]);

  if (!proposal.isProposalReady()) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center py-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <LoadingSpinner className="w-6 h-6 text-gray-600" />
            <span className="text-gray-600">Loading proposal...</span>
          </div>
          <p className="text-gray-500">Please load a proposal to discover pools</p>
        </div>
      </div>
    );
  }

  const summary = poolDiscovery.getDiscoverySummary();
  const predictionMarkets = poolDiscovery.getPredictionMarkets();
  const conditionalPools = poolDiscovery.getConditionalPools();
  const baseTokenPool = poolDiscovery.getBaseTokenPool();

  // Check if tokens are ready for discovery
  const isDiscoveryReady = proposalTokens.isReady && !proposalTokens.loading;
  const tokensLoading = proposalTokens.loading;
  const hasDiscoveredPools = Object.keys(poolDiscovery.pools).length > 0;

  // Debug baseTokenPool (separate useEffect to avoid dependency issues)
  React.useEffect(() => {
    if (baseTokenPool?.exists) {
      console.log('🐛 DEBUG: baseTokenPool:', baseTokenPool);
      console.log('🐛 DEBUG: baseTokenPool.stats:', baseTokenPool.stats);
      console.log('🐛 DEBUG: baseTokenPool.stats.price type:', typeof baseTokenPool.stats?.price);
      console.log('🐛 DEBUG: baseTokenPool.stats.price value:', baseTokenPool.stats?.price);
    }
  }, [baseTokenPool]);

  // Core futarchy pools (the main ones we care about)
  const futarchyPools = {
    ...Object.fromEntries(
      Object.entries(predictionMarkets).map(([key, pool]) => [`prediction_${key}`, pool])
    ),
    ...Object.fromEntries(
      Object.entries(conditionalPools).map(([key, pool]) => [`conditional_${key}`, pool])
    )
  };

  // Optional DEX pools (not part of futarchy system)
  const optionalPools = {
    base_tokens: baseTokenPool
  };

  const getFilteredPools = () => {
    switch (activeTab) {
      case 'prediction':
        return Object.fromEntries(
          Object.entries(futarchyPools).filter(([key]) => key.startsWith('prediction_'))
        );
      case 'conditional':
        return Object.fromEntries(
          Object.entries(futarchyPools).filter(([key]) => key.startsWith('conditional_'))
        );
      case 'optional':
        return optionalPools;
      case 'existing':
        // Include both futarchy and optional pools if they exist
        const allPoolsForExisting = { ...futarchyPools, ...optionalPools };
        return Object.fromEntries(
          Object.entries(allPoolsForExisting).filter(([, pool]) => pool.exists)
        );
      default: // 'futarchy' tab - show only core futarchy pools
        return futarchyPools;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {proposal.getMarketName()} - Pool Discovery
        </h2>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>Proposal: {proposal.proposalAddress?.slice(0, 10)}...</span>
          {poolDiscovery.lastDiscovery && (
            <span>Last scan: {poolDiscovery.lastDiscovery.toLocaleTimeString()}</span>
          )}
          {baseTokenPool.exists && baseTokenPool.stats && baseTokenPool.stats.price && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
              Live Balancer Price: {formatPrice(baseTokenPool.stats.price)} {baseTokenPool.details?.tokenB?.symbol}/{baseTokenPool.details?.tokenA?.symbol}
            </span>
          )}
        </div>
      </div>

      {/* Token Status */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Proposal Tokens Status</h3>
            <div className="flex items-center gap-4 mt-2 text-sm">
              {tokensLoading ? (
                <div className="flex items-center gap-2 text-blue-600">
                  <LoadingSpinner className="w-4 h-4" />
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
            
            {/* Show actual token names and symbols when ready */}
            {isDiscoveryReady && (
              <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Base Tokens ({proposalTokens.stats.baseTokens})</h4>
                  <div className="space-y-1">
                    {proposalTokens.getTokensByCategory().base.map((token) => (
                      <div key={token.address} className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                          {token.symbol}
                        </span>
                        <span className="text-gray-600 text-xs">{token.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Conditional Tokens ({proposalTokens.stats.conditionalTokens})</h4>
                  <div className="space-y-1">
                    {proposalTokens.getTokensByCategory().conditional.map((token) => (
                      <div key={token.address} className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                          token.symbol.includes('YES') ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {token.symbol}
                        </span>
                        <span className="text-gray-600 text-xs">{token.name}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Simple debug info */}
                  <div className="mt-2 text-xs text-gray-500">
                    Debug: {proposalTokens.getTokensByCategory().conditional.length} conditional tokens found
                  </div>
                </div>
              </div>
            )}
          </div>
          {isDiscoveryReady && (
            <div className="text-xs text-gray-500">
              Base: {proposalTokens.stats.baseTokens} | Conditional: {proposalTokens.stats.conditionalTokens}
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-gray-900">{hasDiscoveredPools ? summary.expectedTotal : 6}</div>
          <div className="text-sm text-gray-600">Futarchy Pools</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-600">{summary.expectedFound || 0}</div>
          <div className="text-sm text-gray-600">Found</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-red-600">{hasDiscoveredPools ? summary.expectedMissing : '?'}</div>
          <div className="text-sm text-gray-600">Missing</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-purple-600">{hasDiscoveredPools ? summary.percentage : '0'}%</div>
          <div className="text-sm text-gray-600">Coverage</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-600">{summary.optionalFound || 0}</div>
          <div className="text-sm text-gray-600">Optional Found</div>
        </div>
      </div>

      {/* Discovery Status */}
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

      {/* Loading State */}
      {poolDiscovery.loading && (
        <div className="text-center py-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <LoadingSpinner className="w-6 h-6 text-blue-600" />
            <span className="text-gray-600">Discovering pools...</span>
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
            onClick={poolDiscovery.discoverPools}
            disabled={!isDiscoveryReady || poolDiscovery.loading}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
          >
            Retry Discovery
          </button>
        </div>
      )}

      {/* Filter Tabs - only show if we have discovered pools */}
      {hasDiscoveredPools && (
        <div className="mb-6">
          <nav className="flex space-x-1">
            {[
              { key: 'futarchy', label: 'Futarchy Pools', count: Object.keys(futarchyPools).length },
              { key: 'existing', label: 'Existing Only', count: summary.existing },
              { key: 'prediction', label: 'Prediction Markets', count: Object.keys(predictionMarkets).length },
              { key: 'conditional', label: 'Conditional Pools', count: Object.keys(conditionalPools).length },
              ...(baseTokenPool.exists ? [{ key: 'optional', label: 'Balancer Price', count: 1 }] : [])
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Pool Grid - only show if we have discovered pools */}
      {hasDiscoveredPools && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {Object.entries(getFilteredPools()).map(([poolKey, poolData]) => (
            <PoolCard
              key={poolKey}
              poolKey={poolKey}
              poolData={poolData}
              onSelect={setSelectedPool}
              isSelected={selectedPool?.poolKey === poolKey}
              baseTokenPool={baseTokenPool}
              formatPrice={formatPrice}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={poolDiscovery.discoverPools}
          disabled={!isDiscoveryReady || poolDiscovery.loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {poolDiscovery.loading ? (
            <>
              <LoadingSpinner />
              Discovering...
            </>
          ) : !isDiscoveryReady ? (
            'Waiting for Tokens...'
          ) : hasDiscoveredPools ? (
            'Refresh Discovery'
          ) : (
            'Discover Pools'
          )}
        </button>
        
        {hasDiscoveredPools && summary.existing > 0 && (
          <button
            onClick={() => setActiveTab('existing')}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            View {summary.existing} Existing Pools
          </button>
        )}
        
        {hasDiscoveredPools && baseTokenPool.exists && (
          <button
            onClick={() => setActiveTab('optional')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            View Balancer Pool
          </button>
        )}
      </div>

      {/* Selected Pool Details */}
      {selectedPool && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">Selected Pool Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Address:</span>
              <p className="font-mono mt-1">{selectedPool.poolData.address}</p>
            </div>
            <div>
              <span className="font-medium">Type:</span>
              <p className="mt-1">{selectedPool.poolData.details?.type?.description}</p>
            </div>
          </div>
          {selectedPool.poolData.stats && (
            <div className="mt-4">
              <span className="font-medium">Pool Stats:</span>
              <pre className="mt-2 text-xs bg-white p-3 rounded border overflow-x-auto">
                {JSON.stringify(selectedPool.poolData.stats, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PoolDiscoveryDashboard; 