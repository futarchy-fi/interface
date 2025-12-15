#!/usr/bin/env node
/**
 * Test script for Swapr SDK quote with specific pool
 * Tests: 0.01 YES_SDAI -> YES_GNO
 */

import { ChainId, Percent, Token as SwaprToken, SwaprV3Trade, TokenAmount, TradeType } from "@swapr/sdk";
import { parseUnits } from "viem";
import { ethers } from "ethers";

const ALGEBRA_SUBGRAPH =
  "https://gateway-arbitrum.network.thegraph.com/api/8b2690ffdd390bad59638b894ee8d9f6/subgraphs/id/AAA1vYjxwFHzbt6qKwLHNcDSASyr1J1xVViDH8gTMFMR";
const DEFAULT_GNOSIS_RPC = "https://rpc.gnosischain.com";

// Test parameters
const POOL_ADDRESS = "0xF1D0eF18f29b2Fe00C3ed17F7705F315cfF02Fb3"; // YES pool
const TOKEN_IN = "0xD724b3203D46b3fF71273A760b45A7c460f3c020"; // YES_SDAI
const TOKEN_OUT = "0xD356f0cEC8f2631eCE8C9316dc59433106D97f2d"; // YES_GNO
const AMOUNT_IN = "1"; // 1 YES_SDAI
const SLIPPAGE_BPS = 2000; // 20% slippage

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

  console.log('[TEST] Fetching pool data from subgraph...');
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
}

async function fetchTokenInfo(tokenAddress, provider) {
  const ERC20_ABI = [
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
  ];

  console.log(`[TEST] Fetching token info for ${tokenAddress}...`);
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
}

function createSwaprToken(tokenData) {
  return new SwaprToken(
    ChainId.XDAI,
    tokenData.id,
    Number(tokenData.decimals),
    tokenData.symbol || "TOKEN"
  );
}

function buildTokenAmount(token, amountString) {
  const parsed = parseUnits(amountString, token.decimals);
  return new TokenAmount(token, parsed);
}

function sqrtPriceX96ToPrice(sqrtPriceX96String) {
  try {
    const sqrtPriceX96 = ethers.BigNumber.from(sqrtPriceX96String);
    const Q96 = ethers.BigNumber.from(2).pow(96);

    // Price = (sqrtPrice / 2^96)^2
    const sqrtPriceSquared = sqrtPriceX96.mul(sqrtPriceX96);
    const Q192 = Q96.mul(Q96);

    // Convert to decimal
    const price = parseFloat(sqrtPriceSquared.toString()) / parseFloat(Q192.toString());
    return price;
  } catch (error) {
    console.error('[TEST] Error calculating price:', error);
    return null;
  }
}

async function testSwaprQuote() {
  const startTime = Date.now();
  console.log('=== Testing Swapr SDK Quote ===');
  console.log('Pool:', POOL_ADDRESS);
  console.log('Token In:', TOKEN_IN, '(YES_SDAI)');
  console.log('Token Out:', TOKEN_OUT, '(YES_GNO)');
  console.log('Amount In:', AMOUNT_IN);
  console.log('Slippage:', SLIPPAGE_BPS / 100, '%');
  console.log('');

  try {
    // Create provider
    console.log('[TEST] Creating provider...');
    const provider = new ethers.providers.JsonRpcProvider(DEFAULT_GNOSIS_RPC);

    // Fetch pool data
    console.log('[TEST] Fetching pool data...');
    const poolData = await fetchPoolData(POOL_ADDRESS);
    console.log('[TEST] Pool data:', {
      id: poolData.id,
      fee: poolData.fee,
      liquidity: poolData.liquidity,
      sqrtPrice: poolData.sqrtPrice,
      token0: poolData.token0.symbol,
      token1: poolData.token1.symbol
    });

    // Calculate current pool price
    const currentPrice = sqrtPriceX96ToPrice(poolData.sqrtPrice);
    console.log('[TEST] Current pool price (from sqrtPriceX96):', currentPrice);

    // Fetch token info
    console.log('[TEST] Fetching token info...');
    const [tokenInInfo, tokenOutInfo] = await Promise.all([
      fetchTokenInfo(TOKEN_IN, provider),
      fetchTokenInfo(TOKEN_OUT, provider)
    ]);

    console.log('[TEST] Token In info:', tokenInInfo);
    console.log('[TEST] Token Out info:', tokenOutInfo);

    // Create Swapr tokens
    console.log('[TEST] Creating Swapr token instances...');
    const inputToken = createSwaprToken(tokenInInfo);
    const outputToken = createSwaprToken(tokenOutInfo);

    console.log('[TEST] Input token:', {
      symbol: inputToken.symbol,
      decimals: inputToken.decimals,
      address: inputToken.address
    });
    console.log('[TEST] Output token:', {
      symbol: outputToken.symbol,
      decimals: outputToken.decimals,
      address: outputToken.address
    });

    // Build token amount
    console.log('[TEST] Building input amount...');
    const inputAmount = buildTokenAmount(inputToken, AMOUNT_IN);
    console.log('[TEST] Input amount:', inputAmount.toExact(), inputToken.symbol);

    // Set up trade parameters
    const maximumSlippage = new Percent(String(SLIPPAGE_BPS), "10000");
    const recipient = ethers.constants.AddressZero;

    console.log('[TEST] Getting quote from Swapr SDK...');
    console.log('[TEST] Trade params:', {
      amount: inputAmount.toExact(),
      quoteCurrency: outputToken.symbol,
      maximumSlippage: maximumSlippage.toSignificant(2) + '%',
      recipient,
      tradeType: 'EXACT_INPUT'
    });

    // Get quote from Swapr SDK
    // NOTE: Pass the ethers provider, NOT the RPC URL string
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

    console.log('');
    console.log('=== QUOTE RESULT ===');
    console.log('Input Amount:', trade.inputAmount.toExact(), inputToken.symbol);
    console.log('Output Amount:', trade.outputAmount.toExact(), outputToken.symbol);
    console.log('Execution Price:', trade.executionPrice.toFixed(6));
    console.log('Inverted Price:', trade.executionPrice.invert().toFixed(6));
    console.log('Minimum Received:', trade.minimumAmountOut().toExact(), outputToken.symbol);
    console.log('Maximum Sent:', trade.maximumAmountIn().toExact(), inputToken.symbol);

    // Price impact
    let priceImpact = null;
    if (trade.priceImpact) {
      priceImpact = parseFloat(trade.priceImpact.toFixed(4));
      console.log('Price Impact:', priceImpact + '%');
    } else {
      console.log('Price Impact: N/A');
    }

    // Route
    const route = trade.route?.path?.map(t => t.symbol).join(' -> ') || `${inputToken.symbol} -> ${outputToken.symbol}`;
    console.log('Route:', route);

    const endTime = Date.now();
    const elapsedTime = ((endTime - startTime) / 1000).toFixed(2);

    console.log('');
    console.log('=== FULL RESULT OBJECT ===');
    const result = {
      pool: poolData.id,
      chainId: ChainId.XDAI,
      tradeType: "EXACT_INPUT",
      direction: `${inputToken.symbol} -> ${outputToken.symbol}`,
      amountIn: trade.inputAmount.toExact(),
      amountOut: trade.outputAmount.toExact(),
      executionPrice: trade.executionPrice.toFixed(18),
      invertedPrice: trade.executionPrice.invert().toFixed(18),
      minimumReceived: trade.minimumAmountOut().toExact(),
      maximumSent: trade.maximumAmountIn().toExact(),
      priceImpact: priceImpact,
      currentPrice: currentPrice,
      slippageToleranceBps: SLIPPAGE_BPS,
      route: route,
      executionTimeSeconds: elapsedTime
    };

    console.log(JSON.stringify(result, null, 2));
    console.log('');
    console.log(`⏱️  Total execution time: ${elapsedTime}s`);

  } catch (error) {
    console.error('');
    console.error('=== ERROR ===');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testSwaprQuote().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
