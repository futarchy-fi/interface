/**
 * Swapr SDK Quote Module
 * Provides accurate quotes using @swapr/sdk similar to UniswapSDK quoter
 */

import { ChainId, Percent, Token as SwaprToken, SwaprV3Trade, TokenAmount, TradeType } from "@swapr/sdk";
import { parseUnits } from "viem";
import { ethers } from "ethers";

const ALGEBRA_SUBGRAPH =
  "https://gateway-arbitrum.network.thegraph.com/api/8b2690ffdd390bad59638b894ee8d9f6/subgraphs/id/AAA1vYjxwFHzbt6qKwLHNcDSASyr1J1xVViDH8gTMFMR";

const DEFAULT_GNOSIS_RPC = "https://rpc.gnosischain.com";

// ABI fragments for token info
const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

/**
 * Fetch pool data from Algebra subgraph
 */
async function fetchPoolData(poolAddress) {
  const body = JSON.stringify({
    query: `
      query Pool($id: ID!) {
        pool(id: $id) {
          id
          fee
          liquidity
          sqrtPrice
          tick
          tickSpacing
          token0 { id symbol decimals }
          token1 { id symbol decimals }
        }
      }
    `,
    variables: { id: poolAddress.toLowerCase() },
  });

  try {
    const response = await fetch(ALGEBRA_SUBGRAPH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch pool data: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const json = await response.json();

    if (json.errors?.length) {
      throw new Error(`Subgraph error: ${json.errors.map((e) => e.message).join(", ")}`);
    }

    if (!json.data?.pool) {
      throw new Error(`Pool ${poolAddress} not found on Swapr Algebra subgraph`);
    }

    return json.data.pool;
  } catch (error) {
    console.error('[SwaprSDK] Failed to fetch pool data:', error);
    throw error;
  }
}

/**
 * Fetch token info from blockchain
 */
async function fetchTokenInfo(tokenAddress, provider) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const [decimals, symbol] = await Promise.all([
      tokenContract.decimals(),
      tokenContract.symbol()
    ]);

    return {
      id: tokenAddress.toLowerCase(),
      decimals: decimals.toString(),
      symbol
    };
  } catch (error) {
    console.error(`[SwaprSDK] Failed to fetch token info for ${tokenAddress}:`, error);
    throw error;
  }
}

/**
 * Create Swapr Token instance
 */
function createSwaprToken(tokenData) {
  return new SwaprToken(
    ChainId.XDAI,
    tokenData.id,
    Number(tokenData.decimals),
    tokenData.symbol || "TOKEN"
  );
}

/**
 * Build TokenAmount from token and amount string
 */
function buildTokenAmount(token, amountString) {
  const parsed = parseUnits(amountString, token.decimals);
  return new TokenAmount(token, parsed);
}

/**
 * Get Swapr quote with slippage calculation
 *
 * NOTE: This returns SLIPPAGE (expected vs actual output), NOT price impact
 * Price impact would require sqrtPriceX96After from a quoter, which Swapr SDK doesn't provide
 *
 * @param {Object} params
 * @param {string} params.tokenIn - Input token address
 * @param {string} params.tokenOut - Output token address
 * @param {string} params.amountIn - Input amount (human-readable)
 * @param {string} params.poolAddress - Algebra pool address
 * @param {Object} params.provider - Ethers provider
 * @param {string} params.rpcUrl - Optional RPC URL (defaults to Gnosis RPC)
 * @param {number} params.slippageBps - Slippage in basis points (default: 50 = 0.5%)
 * @param {string} params.action - Transaction action ('Buy' or 'Sell') to determine token roles
 * @param {Object} params.mergeConfig - Optional MERGE_CONFIG for token identification
 * @param {Object} params.baseTokenConfig - Optional BASE_TOKENS_CONFIG for token identification
 * @returns {Promise<Object>} Quote result with slippage (not price impact)
 */
export async function getSwaprV3QuoteWithPriceImpact({
  tokenIn,
  tokenOut,
  amountIn,
  poolAddress,
  provider,
  rpcUrl = DEFAULT_GNOSIS_RPC,
  slippageBps = 50,
  action = null,
  mergeConfig = null,
  baseTokenConfig = null
}) {
  try {
    console.log('[SwaprSDK] Fetching quote:', {
      tokenIn,
      tokenOut,
      amountIn,
      poolAddress,
      slippageBps
    });

    // Fetch pool data from subgraph
    const poolData = await fetchPoolData(poolAddress);
    console.log('[SwaprSDK] Pool data:', poolData);

    // Fetch token info from blockchain
    const [tokenInInfo, tokenOutInfo] = await Promise.all([
      fetchTokenInfo(tokenIn, provider),
      fetchTokenInfo(tokenOut, provider)
    ]);

    // Create Swapr token instances
    const inputToken = createSwaprToken(tokenInInfo);
    const outputToken = createSwaprToken(tokenOutInfo);

    console.log('[SwaprSDK] Tokens:', {
      inputToken: { symbol: inputToken.symbol, decimals: inputToken.decimals },
      outputToken: { symbol: outputToken.symbol, decimals: outputToken.decimals }
    });

    // Build token amount
    const inputAmount = buildTokenAmount(inputToken, amountIn.toString());

    // Set up trade parameters
    const maximumSlippage = new Percent(String(slippageBps), "10000");
    const recipient = ethers.constants.AddressZero;

    console.log('[SwaprSDK] Getting quote from Swapr SDK...');

    // Get quote from Swapr SDK (uses routing under the hood)
    // Pass the ethers provider object (NOT the RPC URL string)
    const trade = await SwaprV3Trade.getQuote(
      {
        amount: inputAmount,
        quoteCurrency: outputToken,
        maximumSlippage,
        recipient,
        tradeType: TradeType.EXACT_INPUT,
      },
      provider, // Pass ethers provider object
      true // useAggregationOptimization
    );

    console.log('[SwaprSDK] Trade received:', {
      inputAmount: trade.inputAmount.toExact(),
      outputAmount: trade.outputAmount.toExact(),
      executionPrice: trade.executionPrice.toFixed(18)
    });

    // Extract quote data
    const outputAmount = trade.outputAmount;
    const executionPrice = trade.executionPrice;
    const minimumReceived = trade.minimumAmountOut();

    // NOTE: Swapr SDK doesn't provide sqrtPriceX96After from its quoter
    // So we can't calculate TRUE price impact (pool price before vs after)
    // Instead we calculate SLIPPAGE (expected vs actual output based on current pool price)
    // Try to get price impact from SDK first, but it often returns 0 for single-hop trades
    let slippage = null;
    if (trade.priceImpact && parseFloat(trade.priceImpact.toFixed(4)) !== 0) {
      slippage = parseFloat(trade.priceImpact.toFixed(4));
    }

    // Parse amounts to Wei format
    const amountOutWei = ethers.utils.parseUnits(
      outputAmount.toExact(),
      outputToken.decimals
    );

    const minimumReceivedWei = ethers.utils.parseUnits(
      minimumReceived.toExact(),
      outputToken.decimals
    );

    // Get current pool price from sqrtPrice
    const sqrtPriceX96 = poolData.sqrtPrice;
    const rawPoolPrice = sqrtPriceX96ToPrice(sqrtPriceX96); // Always token1/token0

    // Determine token ordering in the pool
    // In Algebra/Uniswap V3: token0 has lower address, token1 has higher address
    const token0Address = poolData.token0.id.toLowerCase();
    const token1Address = poolData.token1.id.toLowerCase();
    const inputTokenAddress = tokenIn.toLowerCase();
    const outputTokenAddress = tokenOut.toLowerCase();

    // Check if we're trading token0->token1 or token1->token0
    const isToken0ToToken1 = inputTokenAddress === token0Address && outputTokenAddress === token1Address;
    const isToken1ToToken0 = inputTokenAddress === token1Address && outputTokenAddress === token0Address;

    // Determine the desired display direction using company/currency tokens
    // We want to show prices as "currency per company" (e.g., sDAI per GNO)
    let shouldInvertPrice = isToken1ToToken0; // Default to token ordering logic

    if (mergeConfig && baseTokenConfig) {
      // Get all possible token addresses
      const companyYesAddress = mergeConfig.companyPositions?.yes?.wrap?.wrappedCollateralTokenAddress?.toLowerCase();
      const companyNoAddress = mergeConfig.companyPositions?.no?.wrap?.wrappedCollateralTokenAddress?.toLowerCase();
      const currencyYesAddress = mergeConfig.currencyPositions?.yes?.wrap?.wrappedCollateralTokenAddress?.toLowerCase();
      const currencyNoAddress = mergeConfig.currencyPositions?.no?.wrap?.wrappedCollateralTokenAddress?.toLowerCase();
      const currencyBaseAddress = baseTokenConfig.currency?.address?.toLowerCase();
      const companyBaseAddress = baseTokenConfig.company?.address?.toLowerCase();

      // Check which token is currency and which is company
      const token0IsCurrency = token0Address === currencyYesAddress ||
                               token0Address === currencyNoAddress ||
                               token0Address === currencyBaseAddress;
      const token1IsCurrency = token1Address === currencyYesAddress ||
                               token1Address === currencyNoAddress ||
                               token1Address === currencyBaseAddress;

      console.log('[SwaprSDK] Token classification:', {
        token0Address,
        token1Address,
        token0IsCurrency,
        token1IsCurrency,
        token0Symbol: poolData.token0.symbol,
        token1Symbol: poolData.token1.symbol
      });

      // sqrtPriceX96 = token1/token0
      // We want "currency per company"
      // If token1 is currency and token0 is company: keep as-is (currency/company) ✓
      // If token0 is currency and token1 is company: invert to get (currency/company) ✗
      if (token0IsCurrency && !token1IsCurrency) {
        // token0 = currency, token1 = company
        // rawPoolPrice = company/currency, we want currency/company → INVERT
        shouldInvertPrice = true;
      } else if (!token0IsCurrency && token1IsCurrency) {
        // token0 = company, token1 = currency
        // rawPoolPrice = currency/company ✓ already correct → DON'T INVERT
        shouldInvertPrice = false;
      }
      // else: both are same type or neither matched, fall back to token ordering logic
    }

    const currentPrice = shouldInvertPrice ? (1 / rawPoolPrice) : rawPoolPrice;

    console.log('[SwaprSDK] Price calculation:', {
      pool_token0: poolData.token0.symbol,
      pool_token1: poolData.token1.symbol,
      input: inputToken.symbol,
      output: outputToken.symbol,
      isToken0ToToken1,
      isToken1ToToken0,
      rawPoolPrice,
      shouldInvertPrice,
      currentPrice: currentPrice
    });

    // Calculate slippage manually if SDK doesn't provide it
    // SLIPPAGE = difference between execution price and current pool price
    // We'll calculate this after we adjust the execution price to match currentPrice direction
    // Store the raw slippage calculation for later
    let needsSlippageCalc = !slippage;

    // Calculate execution price to match currentPrice direction
    // SDK's executionPrice = output per input (always!)
    // currentPrice = currency per company (after our adjustments)
    // We need executionPrice in the same units as currentPrice
    const rawExecutionPrice = parseFloat(executionPrice.toFixed(18));

    // Determine if we need to invert execution price
    // rawExecutionPrice = output/input
    let shouldInvertExecutionPrice = false;

    if (mergeConfig && baseTokenConfig) {
      // Get all possible token addresses
      const companyYesAddress = mergeConfig.companyPositions?.yes?.wrap?.wrappedCollateralTokenAddress?.toLowerCase();
      const companyNoAddress = mergeConfig.companyPositions?.no?.wrap?.wrappedCollateralTokenAddress?.toLowerCase();
      const currencyYesAddress = mergeConfig.currencyPositions?.yes?.wrap?.wrappedCollateralTokenAddress?.toLowerCase();
      const currencyNoAddress = mergeConfig.currencyPositions?.no?.wrap?.wrappedCollateralTokenAddress?.toLowerCase();
      const currencyBaseAddress = baseTokenConfig.currency?.address?.toLowerCase();
      const companyBaseAddress = baseTokenConfig.company?.address?.toLowerCase();

      // Check if input is currency and output is company
      const inputIsCurrency = inputTokenAddress === currencyYesAddress ||
                              inputTokenAddress === currencyNoAddress ||
                              inputTokenAddress === currencyBaseAddress;
      const outputIsCompany = outputTokenAddress === companyYesAddress ||
                              outputTokenAddress === companyNoAddress ||
                              outputTokenAddress === companyBaseAddress;

      // rawExecutionPrice = output/input
      // We want "currency per company"
      // If input=currency, output=company: rawExecutionPrice = company/currency → INVERT
      // If input=company, output=currency: rawExecutionPrice = currency/company → DON'T INVERT
      if (inputIsCurrency && outputIsCompany) {
        shouldInvertExecutionPrice = true;
      } else if (!inputIsCurrency && !outputIsCompany) {
        shouldInvertExecutionPrice = false;
      }
    } else {
      // Fallback: use same logic as pool price
      shouldInvertExecutionPrice = shouldInvertPrice;
    }

    const adjustedExecutionPrice = shouldInvertExecutionPrice ? (1 / rawExecutionPrice) : rawExecutionPrice;

    console.log('[SwaprSDK] Execution price adjustment:', {
      rawExecutionPrice,
      adjustedExecutionPrice,
      currentPrice,
      shouldInvertExecutionPrice,
      inputToken: inputToken.symbol,
      outputToken: outputToken.symbol
    });

    // Calculate slippage now that we have both prices in the same units
    if (needsSlippageCalc && currentPrice > 0 && adjustedExecutionPrice > 0) {
      // Slippage = ((currentPrice - executionPrice) / currentPrice) * 100
      // Both prices are now in "currency per company" units
      slippage = ((currentPrice - adjustedExecutionPrice) / currentPrice) * 100;
      console.log('[SwaprSDK] Calculated slippage:', {
        currentPrice,
        adjustedExecutionPrice,
        slippage: slippage.toFixed(4) + '%'
      });
    }

    const result = {
      amountOut: amountOutWei.toString(),
      amountOutFormatted: outputAmount.toExact(),
      minimumReceived: minimumReceivedWei.toString(),
      minimumReceivedFormatted: minimumReceived.toExact(),
      executionPrice: adjustedExecutionPrice, // Adjusted to match currentPrice direction
      rawExecutionPrice: rawExecutionPrice, // Original SDK value (output per input)
      invertedPrice: (1 / rawExecutionPrice).toFixed(18), // Inverted version
      displayPrice: adjustedExecutionPrice, // For UI: matches currentPrice direction
      slippage: slippage, // NOTE: This is slippage, NOT price impact
      priceImpact: null, // Can't calculate without sqrtPriceX96After from quoter
      currentPrice: currentPrice,
      sqrtPriceX96: sqrtPriceX96,
      poolAddress: poolData.id,
      liquidity: poolData.liquidity,
      gasEstimate: '400000', // Default gas estimate for Algebra swaps
      route: trade.route?.path?.map(t => t.symbol).join(' -> ') || `${inputToken.symbol} -> ${outputToken.symbol}`,
      decimalsIn: inputToken.decimals,
      decimalsOut: outputToken.decimals,
      slippageBps,
      tokenIn: inputToken.symbol,
      tokenOut: outputToken.symbol
    };

    console.log('[SwaprSDK] Quote result:', result);
    return result;

  } catch (error) {
    console.error('[SwaprSDK] Quote failed:', error);
    throw error;
  }
}

/**
 * Calculate price from sqrtPriceX96
 * Price = (sqrtPriceX96 / 2^96)^2
 */
export function sqrtPriceX96ToPrice(sqrtPriceX96String) {
  try {
    const sqrtPriceX96 = ethers.BigNumber.from(sqrtPriceX96String);
    const Q96 = ethers.BigNumber.from(2).pow(96);

    // Price = (sqrtPrice / 2^96)^2
    // To avoid precision loss: (sqrtPrice^2) / (2^192)
    const sqrtPriceSquared = sqrtPriceX96.mul(sqrtPriceX96);
    const Q192 = Q96.mul(Q96);

    // Convert to decimal
    const price = parseFloat(sqrtPriceSquared.toString()) / parseFloat(Q192.toString());

    return price;
  } catch (error) {
    console.error('[SwaprSDK] Error calculating price from sqrtPriceX96:', error);
    return null;
  }
}

/**
 * Calculate price impact percentage
 * Price impact % = ((executionPrice - currentPrice) / currentPrice) * 100
 */
export function calculatePriceImpact(currentPrice, executionPrice) {
  try {
    const priceImpact = ((parseFloat(executionPrice) - currentPrice) / currentPrice) * 100;
    return priceImpact;
  } catch (error) {
    console.error('[SwaprSDK] Error calculating price impact:', error);
    return null;
  }
}

/**
 * Get pool address from config based on outcome
 * Helper function to determine which pool to use
 */
export function getPoolAddressForOutcome(outcome, poolConfigYes, poolConfigNo) {
  const eventHappens = outcome === 'Event Will Occur';
  const poolConfig = eventHappens ? poolConfigYes : poolConfigNo;
  return poolConfig?.address;
}

/**
 * Execute Swapr swap (placeholder - actual execution handled by existing helpers)
 * This is just for API consistency with uniswapSdk.js
 */
export async function executeSwaprV3Swap({
  tokenIn,
  tokenOut,
  amountIn,
  minAmountOut,
  poolAddress,
  signer
}) {
  console.log('[SwaprSDK] Execute swap - delegating to executeAlgebraExactSingle');

  // Import the existing helper
  const { executeAlgebraExactSingle } = await import('./sushiswapV3Helper');

  const amountInWei = ethers.utils.parseUnits(amountIn.toString(), 18);
  const minAmountOutWei = minAmountOut ? ethers.utils.parseUnits(minAmountOut.toString(), 18) : ethers.BigNumber.from(0);

  return await executeAlgebraExactSingle({
    signer,
    tokenIn,
    tokenOut,
    amount: amountInWei,
    minOutputAmount: minAmountOutWei,
    slippageBps: 50,
    options: {
      gasLimit: 400000,
      gasPrice: ethers.utils.parseUnits("0.97", "gwei")
    }
  });
}
