const { ethers } = require('ethers');

class PriceCalculator {
  // Calculate sqrt price for pool initialization (X96 format)
  static sqrtPriceX96(amount0, amount1) {
    // Handle various input types
    const toBigInt = (value) => {
      if (typeof value === 'bigint') return value;
      if (typeof value === 'string') return BigInt(value);
      if (typeof value === 'number') return BigInt(Math.floor(value));
      return BigInt(value.toString());
    };
    
    const amt0 = toBigInt(amount0);
    const amt1 = toBigInt(amount1);
    
    // Convert to numbers for calculation (safe for small test amounts)
    const num0 = Number(amt0);
    const num1 = Number(amt1);
    
    if (num0 === 0) {
      throw new Error('Cannot calculate sqrt price with zero amount0');
    }
    
    const ratio = num1 / num0;
    const sqrtRatio = Math.sqrt(ratio);
    const sqrtPriceX96 = sqrtRatio * (2 ** 96);
    
    return BigInt(Math.floor(sqrtPriceX96));
  }

  // Calculate conditional token prices based on futarchy parameters
  static calculateConditionalPrices(spotPrice, eventProbability, impactPercentage) {
    const impact = impactPercentage / 100; // Convert percentage to decimal
    
    // YES token price = spot * (1 + impact * (1 - probability))
    const yesPrice = spotPrice * (1 + impact * (1 - eventProbability));
    
    // NO token price = spot * (1 - impact * probability)
    const noPrice = spotPrice * (1 - impact * eventProbability);
    
    return {
      yesPrice,
      noPrice,
      yesPriceFormatted: yesPrice.toFixed(6),
      noPriceFormatted: noPrice.toFixed(6)
    };
  }

  // Calculate prediction market ratio (YES/NO)
  static calculatePredictionRatio(eventProbability) {
    const yesRatio = eventProbability;
    const noRatio = 1 - eventProbability;
    
    return {
      yesRatio,
      noRatio,
      ratio: yesRatio / noRatio,
      ratioFormatted: (yesRatio / noRatio).toFixed(4)
    };
  }

  // Calculate liquidity amounts for a pool given target price and total liquidity
  static calculateLiquidityAmounts(token0Decimals, token1Decimals, targetPrice, liquidityAmount1) {
    // User provides amount1 (usually sDAI or conditional sDAI)
    // Calculate amount0 based on price: amount0 = amount1 / price
    
    const amount1Raw = liquidityAmount1;
    const amount0Raw = amount1Raw / targetPrice;
    
    // For very small amounts, use toFixed to avoid scientific notation
    // and ensure we maintain precision
    const formatAmount = (amount, decimals) => {
      if (amount === 0) return '0';
      const dec = typeof decimals === 'bigint' ? Number(decimals) : decimals;
      // Convert to string with full precision
      let str = amount.toFixed(dec);
      
      // Remove trailing zeros but keep at least one decimal place for small amounts
      if (str.includes('.')) {
        // Don't trim if the number is very small (like 0.000000000001)
        if (amount < 0.0001) {
          return str;
        }
        str = str.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
      }
      
      return str;
    };
    
    // Ensure decimals are numbers (ethers v6 may return BigInt)
    const d0 = typeof token0Decimals === 'bigint' ? Number(token0Decimals) : token0Decimals;
    const d1 = typeof token1Decimals === 'bigint' ? Number(token1Decimals) : token1Decimals;

    const amount0Str = formatAmount(amount0Raw, d0);
    const amount1Str = formatAmount(amount1Raw, d1);
    
    // Convert to Wei using BigInt to avoid precision issues
    let amount0Wei, amount1Wei;
    
    try {
      amount0Wei = ethers.parseUnits(amount0Str, d0);
      amount1Wei = ethers.parseUnits(amount1Str, d1);
    } catch (error) {
      // Fallback for very small numbers
      console.log(`Warning: Using fallback for small amounts - ${error.message}`);
      amount0Wei = BigInt(Math.floor(amount0Raw * 10 ** d0));
      amount1Wei = BigInt(Math.floor(amount1Raw * 10 ** d1));
    }

    // Guard: ensure non-zero minimal amounts for low-decimal tokens
    // If user requested a positive liquidityAmount1 but it rounded to zero (e.g., USDC 6 decimals),
    // bump token1 to 1 base unit and recompute token0 to preserve price approximately.
    if (liquidityAmount1 > 0 && amount1Wei === 0n) {
      amount1Wei = 1n; // 1 smallest unit of token1
      // amount0 = amount1 / price
      const amount0FromUnit = Number(amount1Wei) / (10 ** d1) / targetPrice; // still a tiny float
      const amount0StrAdj = formatAmount(amount0FromUnit, d0);
      try {
        amount0Wei = ethers.parseUnits(amount0StrAdj, d0);
      } catch (_) {
        amount0Wei = amount0Wei > 0n ? amount0Wei : 1n;
      }
    }
    
    return {
      amount0: amount0Raw,
      amount1: amount1Raw,
      amount0Wei,
      amount1Wei
    };
  }

  // Calculate all 6 pool configurations for a futarchy proposal
  static calculatePoolConfigurations(params) {
    const {
      spotPrice,
      eventProbability,
      impactPercentage,
      liquidityAmounts, // Array of 6 values
      companyTokenDecimals = 18,
      currencyTokenDecimals = 18
    } = params;

    const conditionalPrices = this.calculateConditionalPrices(spotPrice, eventProbability, impactPercentage);
    const predictionRatio = this.calculatePredictionRatio(eventProbability);

    const pools = [
      {
        poolId: 1,
        name: 'YES-Company/YES-Currency (Price-Correlated)',
        token0: 'YES-Company',
        token1: 'YES-Currency',
        targetPrice: conditionalPrices.yesPrice,
        liquidity: liquidityAmounts[0] || 0.000000000001
      },
      {
        poolId: 2,
        name: 'NO-Company/NO-Currency (Price-Correlated)',
        token0: 'NO-Company',
        token1: 'NO-Currency',
        targetPrice: conditionalPrices.noPrice,
        liquidity: liquidityAmounts[1] || 0.000000000001
      },
      {
        poolId: 3,
        name: 'YES-Company/Currency (Expected Value)',
        token0: 'YES-Company',
        token1: 'Currency',
        targetPrice: spotPrice * eventProbability,
        liquidity: liquidityAmounts[2] || 0.000000000001
      },
      {
        poolId: 4,
        name: 'NO-Company/Currency (Expected Value)',
        token0: 'NO-Company',
        token1: 'Currency',
        targetPrice: spotPrice * (1 - eventProbability),
        liquidity: liquidityAmounts[3] || 0.000000000001
      },
      {
        poolId: 5,
        name: 'YES-Currency/Currency (Prediction)',
        token0: 'YES-Currency',
        token1: 'Currency',
        targetPrice: eventProbability,
        liquidity: liquidityAmounts[4] || 0.000000000001
      },
      {
        poolId: 6,
        name: 'NO-Currency/Currency (Prediction)',
        token0: 'NO-Currency',
        token1: 'Currency',
        targetPrice: 1 - eventProbability,
        liquidity: liquidityAmounts[5] || 0.000000000001
      }
    ];

    // Calculate actual amounts for each pool
    return pools.map(pool => {
      const isCond0 = pool.token0.startsWith('YES') || pool.token0.startsWith('NO');
      const isCond1 = pool.token1.startsWith('YES') || pool.token1.startsWith('NO');
      const decimals0 = isCond0
        ? 18
        : (pool.token0.includes('Company') ? companyTokenDecimals : currencyTokenDecimals);
      const decimals1 = isCond1
        ? 18
        : (pool.token1.includes('Company') ? companyTokenDecimals : currencyTokenDecimals);
      
      // The liquidity amount is always for token1 (sDAI or conditional sDAI)
      const amounts = this.calculateLiquidityAmounts(
        decimals0,
        decimals1,
        pool.targetPrice,
        pool.liquidity // This is the amount1 (token1 amount)
      );

      return {
        ...pool,
        ...amounts,
        decimals0,
        decimals1
      };
    });
  }

  // Verify price after pool creation
  static verifyPoolPrice(actualPrice, targetPrice, tolerance = 0.01) {
    const deviation = Math.abs(actualPrice - targetPrice) / targetPrice;
    return {
      isValid: deviation <= tolerance,
      deviation: deviation * 100,
      deviationFormatted: `${(deviation * 100).toFixed(2)}%`,
      actualPrice,
      targetPrice
    };
  }

  // Convert AMM price to logical price (handles token reordering)
  static convertAMMPrice(ammPrice, needsReorder) {
    return needsReorder ? 1 / ammPrice : ammPrice;
  }
}

module.exports = PriceCalculator;
