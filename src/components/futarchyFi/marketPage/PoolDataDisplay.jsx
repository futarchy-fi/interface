import React from 'react';
import { useYesNoPoolData } from '../../../hooks/usePoolData';
import { ethers } from 'ethers';

const PoolDataDisplay = ({ config }) => {
  const { data, loading, error } = useYesNoPoolData(config);
  
  console.log('PoolDataDisplay render:', {
    config: config,
    poolAddresses: {
      yes: config?.POOL_CONFIG_YES?.address,
      no: config?.POOL_CONFIG_NO?.address
    },
    data,
    loading,
    error
  });

  // If config is not loaded yet, show waiting message
  if (!config || !config.POOL_CONFIG_YES || !config.POOL_CONFIG_NO) {
    console.log('PoolDataDisplay: Config not ready yet', config);
    return (
      <div className="flex gap-6 text-sm mb-4">
        <div className="flex items-center gap-2">
          <span className="text-futarchyGray3">Waiting for pool configuration...</span>
        </div>
      </div>
    );
  }

  const formatVolume = (volume) => {
    if (!volume) return '0';
    
    let num;
    const volumeStr = volume.toString();
    
    // Check if it's in scientific notation
    if (volumeStr.includes('e') || volumeStr.includes('E')) {
      // For scientific notation, assume it's already in wei and divide by 10^18
      num = parseFloat(volumeStr) / 1e18;
      num = Math.abs(num);
    } else if (volumeStr.includes('.')) {
      // Already decimal format
      num = Math.abs(parseFloat(volumeStr));
    } else {
      // Wei format - use ethers to convert
      try {
        const formatted = ethers.utils.formatUnits(volumeStr, 18);
        num = Math.abs(parseFloat(formatted));
      } catch (e) {
        // If ethers fails, try direct division
        num = Math.abs(parseFloat(volumeStr) / 1e18);
      }
    }
    
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    if (num < 1) return num.toFixed(4); // Show more decimals for small numbers
    return num.toFixed(2);
  };

  const formatLiquidity = (amount) => {
    if (!amount) return '0';
    
    // Check if it's already a decimal number (not wei)
    let num;
    if (typeof amount === 'number' || (typeof amount === 'string' && amount.includes('.'))) {
      // Already in decimal format
      num = Math.abs(parseFloat(amount));
    } else {
      // In wei format, convert from 18 decimals
      const formatted = ethers.utils.formatUnits(amount.toString(), 18);
      num = Math.abs(parseFloat(formatted));
    }
    
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    if (num < 1) return num.toFixed(4); // Show more decimals for small numbers
    return num.toFixed(2);
  };

  if (loading) {
    return (
      <div className="flex gap-6 text-sm mb-4">
        <div className="flex items-center gap-2">
          <span className="text-futarchyGray3">Loading pool data...</span>
          <div className="w-4 h-4 border-2 border-futarchyGray11 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    console.error('PoolDataDisplay error:', error);
    return (
      <div className="flex gap-6 text-sm mb-4">
        <div className="flex items-center gap-2">
          <span className="text-futarchyGray3">Pool data unavailable</span>
        </div>
      </div>
    );
  }
  
  // If no data is available at all, show a message
  if (!data.yesPool.volume && !data.noPool.volume && !data.yesPool.liquidity && !data.noPool.liquidity) {
    return (
      <div className="flex gap-6 text-sm mb-4">
        <div className="flex items-center gap-2">
          <span className="text-futarchyGray3">Pool data not available</span>
        </div>
      </div>
    );
  }

  // Support both old (amount0/amount1) and new ({ token, amount }) formats
  const getLiquidityTotal = (liquidity) => {
    if (!liquidity) return 0;
    if (typeof liquidity.amount !== 'undefined') return liquidity.amount;
    return (liquidity.amount0 || 0) + (liquidity.amount1 || 0);
  };

  const yesLiquidityTotal = getLiquidityTotal(data.yesPool.liquidity);
  const noLiquidityTotal = getLiquidityTotal(data.noPool.liquidity);
  const totalLiquidity = yesLiquidityTotal + noLiquidityTotal;

  return (
    <div className="flex flex-wrap gap-6 text-sm mb-4">
      {/* YES Pool Volume */}
      <div className="flex items-center gap-2">
        <span className="text-white/60">YES Volume:</span>
        <span className="text-white font-medium">
          {formatVolume(data.yesPool.volume)} sDAI
        </span>
      </div>

      {/* NO Pool Volume */}
      <div className="flex items-center gap-2">
        <span className="text-white/60">NO Volume:</span>
        <span className="text-white font-medium">
          {formatVolume(data.noPool.volume)} sDAI
        </span>
      </div>

      {/* YES Liquidity */}
      {yesLiquidityTotal > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-white/60">YES Liquidity:</span>
          <span className="text-white font-medium">
            {formatLiquidity(yesLiquidityTotal)} sDAI
          </span>
        </div>
      )}

      {/* NO Liquidity */}
      {noLiquidityTotal > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-white/60">NO Liquidity:</span>
          <span className="text-white font-medium">
            {formatLiquidity(noLiquidityTotal)} sDAI
          </span>
        </div>
      )}

      {/* Total Liquidity */}
      {totalLiquidity > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-white/60">Total Liquidity:</span>
          <span className="text-white font-medium">
            {formatLiquidity(totalLiquidity)} sDAI
          </span>
        </div>
      )}
    </div>
  );
};

export default PoolDataDisplay;