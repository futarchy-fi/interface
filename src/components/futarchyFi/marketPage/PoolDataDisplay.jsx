import React, { useState } from 'react';
import { useYesNoPoolData } from '../../../hooks/usePoolData';
import { ethers } from 'ethers';

const PoolDataDisplay = ({ config }) => {
  const { data, loading, error } = useYesNoPoolData(config);
  const [showTooltip, setShowTooltip] = useState(false);

  // If config is not loaded yet, show waiting message
  if (!config || !config.POOL_CONFIG_YES || !config.POOL_CONFIG_NO) {
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

    // Check if it's raw USD volume (from subgraph) or sDAI volume (from legacy)
    let num = parseFloat(volume);

    // Legacy might be in wei strings
    if (typeof volume === 'string' && !volume.includes('.') && volume.length > 10) {
      try {
        num = parseFloat(ethers.utils.formatUnits(volume, 18));
      } catch (e) {
        num = 0;
      }
    }

    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatLiquidity = (amount) => {
    if (!amount) return '0';

    // Handle Subgraph (Raw L)
    if (amount.isRaw) {
      const num = parseFloat(amount.amount);
      if (num === 0) return '0';
      // Raw Liquidity (L) is usually very large (1e18+). 
      // We can just format it as a compact number to show it's non-zero.
      // "6.33e+21" -> "6.33e21" or similar
      return num.toExponential(2).replace('+', '');
    }

    // Legacy Logic
    let num;
    if (typeof amount === 'number' || (typeof amount === 'string' && amount.includes('.'))) {
      num = Math.abs(parseFloat(amount));
    } else {
      const val = amount.amount || amount;
      const formatted = ethers.utils.formatUnits(val.toString(), 18);
      num = Math.abs(parseFloat(formatted));
    }

    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    if (num < 1) return num.toFixed(4);
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

  // Support both old (amount0/amount1) and new ({ token, amount }) formats
  const getLiquidityTotal = (liquidity) => {
    if (!liquidity) return 0;
    if (liquidity.isRaw) return liquidity; // Pass through raw object
    if (typeof liquidity.amount !== 'undefined') return liquidity.amount;
    return (liquidity.amount0 || 0) + (liquidity.amount1 || 0);
  };

  const yesLiquidityTotal = getLiquidityTotal(data.yesPool.liquidity);
  const noLiquidityTotal = getLiquidityTotal(data.noPool.liquidity);

  // Only sum if compatible types (legacy). Raw L doesn't sum linearly like TVL for display usually.
  const isRaw = data.yesPool.liquidity?.isRaw;
  const totalLiquidity = isRaw ? null : (yesLiquidityTotal + noLiquidityTotal);

  const sourceLabel = data.source === 'subgraph' ? '⚡ Subgraph' : '🗄️ Legacy';
  const sourceColor = data.source === 'subgraph' ? 'text-yellow-400' : 'text-gray-400';

  return (
    <div className="flex flex-col gap-2 mb-4">
      <div className="flex flex-wrap gap-6 text-sm">
        {/* YES Pool Volume */}
        <div className="flex items-center gap-2">
          <span className="text-white/60">YES Volume:</span>
          <span className="text-white font-medium">
            {formatVolume(data.yesPool.volume)}
          </span>
        </div>

        {/* NO Pool Volume */}
        <div className="flex items-center gap-2">
          <span className="text-white/60">NO Volume:</span>
          <span className="text-white font-medium">
            {formatVolume(data.noPool.volume)}
          </span>
        </div>

        {/* YES Liquidity */}
        {yesLiquidityTotal && (
          <div className="flex items-center gap-2">
            <span className="text-white/60">YES Liq:</span>
            <span className="text-white font-medium">
              {formatLiquidity(yesLiquidityTotal)} {isRaw ? 'L' : 'sDAI'}
            </span>
          </div>
        )}

        {/* NO Liquidity */}
        {noLiquidityTotal && (
          <div className="flex items-center gap-2">
            <span className="text-white/60">NO Liq:</span>
            <span className="text-white font-medium">
              {formatLiquidity(noLiquidityTotal)} {isRaw ? 'L' : 'sDAI'}
            </span>
          </div>
        )}
      </div>

      {/* Source Indicator Badge - Always Show if source is determined */}
      {data.source && data.source !== 'loading' && (
        <div className="flex justify-end w-full mt-2">
          <div
            className={`text-[10px] uppercase font-bold tracking-wider ${sourceColor} border border-white/10 px-2 py-0.5 rounded cursor-help`}
            title={data.source === 'subgraph' ? 'Data fetched from Decentralized Subgraph' : 'Data fetched from centralized API'}
          >
            Source: {sourceLabel}
          </div>
        </div>
      )}
    </div>
  );
};

export default PoolDataDisplay;