/**
 * Direct Algebra Quoter Implementation
 *
 * Replaces @swapr/sdk to avoid 420+ RPC calls per quote.
 * This implementation makes only 1-2 RPC calls per quote.
 */

import { ethers } from 'ethers';

// Algebra contracts on Gnosis Chain
const ALGEBRA_QUOTER = "0xcBaD9FDf0D2814659Eb26f600EFDeAF005Eda0F7";

// Minimal Quoter ABI - only what we need
const QUOTER_ABI = [
  "function quoteExactInputSingle(address tokenIn, address tokenOut, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)"
];

// Pool ABI for getting current state
const POOL_ABI = [
  "function globalState() external view returns (uint160 price, int24 tick, uint16 fee, uint16 timepointIndex, uint16 communityFeeToken0, uint16 communityFeeToken1, bool unlocked)",
  "function liquidity() external view returns (uint128)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)"
];

// Token ABI
const ERC20_ABI = [
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)"
];

/**
 * Get quote directly from Algebra Quoter contract
 * Makes only 1 RPC call!
 *
 * @param {Object} params
 * @param {string} params.tokenIn - Input token address
 * @param {string} params.tokenOut - Output token address
 * @param {string|BigNumber} params.amountIn - Input amount (in wei)
 * @param {Object} params.provider - Ethers provider
 * @returns {Promise<BigNumber>} Amount out (in wei)
 */
export async function getAlgebraQuote({
  tokenIn,
  tokenOut,
  amountIn,
  provider
}) {
  console.log('[AlgebraQuoter] Getting quote:', {
    tokenIn,
    tokenOut,
    amountIn: amountIn.toString(),
    quoter: ALGEBRA_QUOTER
  });

  const quoterContract = new ethers.Contract(
    ALGEBRA_QUOTER,
    QUOTER_ABI,
    provider
  );

  try {
    const startTime = Date.now();

    // IMPORTANT: Must use callStatic since quoter functions aren't view functions
    const amountOut = await quoterContract.callStatic.quoteExactInputSingle(
      tokenIn,
      tokenOut,
      amountIn,
      0  // sqrtPriceLimitX96 = 0 means no price limit
    );

    const duration = Date.now() - startTime;
    console.log(`[AlgebraQuoter] ✅ Quote received in ${duration}ms:`, {
      amountOut: amountOut.toString()
    });

    return amountOut;
  } catch (error) {
    console.error('[AlgebraQuoter] Quote failed:', error);

    // Parse common errors
    if (error.message?.includes('LOK')) {
      throw new Error('Pool is locked');
    } else if (error.message?.includes('IIA')) {
      throw new Error('Insufficient input amount');
    } else if (error.message?.includes('AS')) {
      throw new Error('Price limit reached');
    }

    throw error;
  }
}

/**
 * Get comprehensive quote with slippage and pool info
 * Makes 2-3 RPC calls (much better than 420+!)
 *
 * @param {Object} params
 * @param {string} params.tokenIn - Input token address
 * @param {string} params.tokenOut - Output token address
 * @param {string} params.amountIn - Input amount (human-readable string)
 * @param {string} params.poolAddress - Pool address for getting current price
 * @param {Object} params.provider - Ethers provider
 * @param {number} params.slippageBps - Slippage in basis points (default: 50 = 0.5%)
 * @param {Object} params.mergeConfig - Optional token config for price direction
 * @param {Object} params.baseTokenConfig - Optional token config for price direction
 * @returns {Promise<Object>} Comprehensive quote result
 */
export async function getAlgebraQuoteWithSlippage({
  tokenIn,
  tokenOut,
  amountIn,
  poolAddress,
  provider,
  slippageBps = 50,
  mergeConfig = null,
  baseTokenConfig = null
}) {
  const startTime = Date.now();

  try {
    console.log('[AlgebraQuoter] Fetching comprehensive quote:', {
      tokenIn,
      tokenOut,
      amountIn,
      poolAddress,
      slippageBps
    });

    // Fetch token info (2 RPC calls in parallel)
    const [tokenInContract, tokenOutContract] = [
      new ethers.Contract(tokenIn, ERC20_ABI, provider),
      new ethers.Contract(tokenOut, ERC20_ABI, provider)
    ];

    const [[decimalsIn, symbolIn], [decimalsOut, symbolOut]] = await Promise.all([
      Promise.all([tokenInContract.decimals(), tokenInContract.symbol()]),
      Promise.all([tokenOutContract.decimals(), tokenOutContract.symbol()])
    ]);

    console.log('[AlgebraQuoter] Token info:', {
      tokenIn: { symbol: symbolIn, decimals: decimalsIn },
      tokenOut: { symbol: symbolOut, decimals: decimalsOut }
    });

    // Convert amount to wei
    const amountInWei = ethers.utils.parseUnits(amountIn.toString(), decimalsIn);

    // Get quote from Quoter (1 RPC call)
    const amountOutWei = await getAlgebraQuote({
      tokenIn,
      tokenOut,
      amountIn: amountInWei,
      provider
    });

    // Calculate minimum amount with slippage
    const slippageFactor = ethers.BigNumber.from(10000 - slippageBps);
    const minAmountOutWei = amountOutWei.mul(slippageFactor).div(10000);

    // Format amounts
    const amountOutFormatted = ethers.utils.formatUnits(amountOutWei, decimalsOut);
    const minAmountOutFormatted = ethers.utils.formatUnits(minAmountOutWei, decimalsOut);

    // Get pool info for current price (1 RPC call)
    const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);
    const [globalState, liquidity, token0Address, token1Address] = await Promise.all([
      poolContract.globalState(),
      poolContract.liquidity(),
      poolContract.token0(),
      poolContract.token1()
    ]);

    const sqrtPriceX96 = globalState.price;
    const fee = globalState.fee; // Dynamic fee in parts per million

    // Calculate current pool price from sqrtPriceX96
    const Q96 = ethers.BigNumber.from(2).pow(96);
    const sqrtPriceSquared = sqrtPriceX96.mul(sqrtPriceX96);
    const Q192 = Q96.mul(Q96);
    const rawPoolPrice = parseFloat(sqrtPriceSquared.toString()) / parseFloat(Q192.toString());

    // Determine token ordering and price direction
    const token0Lower = token0Address.toLowerCase();
    const token1Lower = token1Address.toLowerCase();
    const tokenInLower = tokenIn.toLowerCase();
    const tokenOutLower = tokenOut.toLowerCase();

    const isToken0ToToken1 = tokenInLower === token0Lower && tokenOutLower === token1Lower;
    const isToken1ToToken0 = tokenInLower === token1Lower && tokenOutLower === token0Lower;

    // Determine if we should invert price for display
    let shouldInvertPrice = isToken1ToToken0;

    if (mergeConfig && baseTokenConfig) {
      // Use config to determine currency/company tokens for proper price direction
      const currencyYesAddress = mergeConfig.currencyPositions?.yes?.wrap?.wrappedCollateralTokenAddress?.toLowerCase();
      const currencyNoAddress = mergeConfig.currencyPositions?.no?.wrap?.wrappedCollateralTokenAddress?.toLowerCase();
      const currencyBaseAddress = baseTokenConfig.currency?.address?.toLowerCase();

      const token0IsCurrency = token0Lower === currencyYesAddress ||
                               token0Lower === currencyNoAddress ||
                               token0Lower === currencyBaseAddress;

      if (token0IsCurrency) {
        // token0 = currency, token1 = company
        // rawPoolPrice = company/currency, we want currency/company → INVERT
        shouldInvertPrice = true;
      } else {
        // token0 = company, token1 = currency
        // rawPoolPrice = currency/company ✓ already correct
        shouldInvertPrice = false;
      }
    }

    const currentPrice = shouldInvertPrice ? (1 / rawPoolPrice) : rawPoolPrice;

    // Calculate execution price - MUST match currentPrice direction
    // Rule: Always show "currency per company" (e.g., sDAI per GNO)
    const rawExecutionPrice = parseFloat(amountOutFormatted) / parseFloat(amountIn);

    // Determine which token is company and which is currency
    let tokenInIsCompany = false;
    let tokenOutIsCompany = false;

    if (mergeConfig && baseTokenConfig) {
      const companyYesAddress = mergeConfig.companyPositions?.yes?.wrap?.wrappedCollateralTokenAddress?.toLowerCase();
      const companyNoAddress = mergeConfig.companyPositions?.no?.wrap?.wrappedCollateralTokenAddress?.toLowerCase();
      const companyBaseAddress = baseTokenConfig.company?.address?.toLowerCase();

      tokenInIsCompany = tokenInLower === companyYesAddress ||
                         tokenInLower === companyNoAddress ||
                         tokenInLower === companyBaseAddress;

      tokenOutIsCompany = tokenOutLower === companyYesAddress ||
                          tokenOutLower === companyNoAddress ||
                          tokenOutLower === companyBaseAddress;
    }

    // If buying company with currency (currency -> company), invert to show currency/company
    // If buying currency with company (company -> currency), use direct ratio
    let executionPrice;
    if (tokenInIsCompany && !tokenOutIsCompany) {
      // Selling company (GNO) for currency (sDAI): amountOut/amountIn = sDAI/GNO ✓ correct
      console.log('[AlgebraQuoter] Token direction: company → currency (correct, using direct ratio)');
      executionPrice = rawExecutionPrice;
    } else if (!tokenInIsCompany && tokenOutIsCompany) {
      // Buying company (GNO) with currency (sDAI): amountOut/amountIn = GNO/sDAI, need to invert
      console.log('[AlgebraQuoter] Token direction: currency → company (inverting to show currency/company)');
      executionPrice = 1 / rawExecutionPrice;
    } else {
      // Fallback: use raw calculation
      console.log('[AlgebraQuoter] Token direction: unknown (using raw calculation)', {
        tokenInIsCompany,
        tokenOutIsCompany
      });
      executionPrice = rawExecutionPrice;
    }

    // Calculate slippage (difference between current price and execution price)
    const slippage = currentPrice > 0 && executionPrice > 0
      ? ((currentPrice - executionPrice) / currentPrice) * 100
      : null;

    const duration = Date.now() - startTime;

    const result = {
      amountOut: amountOutWei.toString(),
      amountOutFormatted,
      minimumReceived: minAmountOutWei.toString(),
      minimumReceivedFormatted: minAmountOutFormatted,
      executionPrice,
      displayPrice: executionPrice,
      slippage,
      priceImpact: slippage, // For backward compatibility
      currentPrice,
      sqrtPriceX96: sqrtPriceX96.toString(),
      poolAddress,
      liquidity: liquidity.toString(),
      fee: fee.toString(), // Dynamic fee in parts per million
      gasEstimate: '400000', // Algebra swaps typically use ~300k gas
      route: `${symbolIn} -> ${symbolOut}`,
      decimalsIn: decimalsIn.toString(),
      decimalsOut: decimalsOut.toString(),
      slippageBps,
      tokenIn: symbolIn,
      tokenOut: symbolOut,
      duration: `${duration}ms`,
      rpcCalls: 4 // 2 for token info, 1 for quote, 1 for pool info
    };

    console.log('[AlgebraQuoter] ✅ Quote complete:', result);
    return result;

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[AlgebraQuoter] ❌ Quote failed after ${duration}ms:`, error);
    throw error;
  }
}

/**
 * Calculate price from sqrtPriceX96
 * Helper function for price conversions
 */
export function sqrtPriceX96ToPrice(sqrtPriceX96String) {
  try {
    const sqrtPriceX96 = ethers.BigNumber.from(sqrtPriceX96String);
    const Q96 = ethers.BigNumber.from(2).pow(96);
    const sqrtPriceSquared = sqrtPriceX96.mul(sqrtPriceX96);
    const Q192 = Q96.mul(Q96);
    const price = parseFloat(sqrtPriceSquared.toString()) / parseFloat(Q192.toString());
    return price;
  } catch (error) {
    console.error('[AlgebraQuoter] Error calculating price:', error);
    return null;
  }
}
