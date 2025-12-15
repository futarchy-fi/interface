/**
 * Test QuoterV2 with 0.01 USDS input
 * Matching the transaction: 0.01 USDS → YES_TSLAon
 */

import { ethers } from "ethers";

// Contract addresses
const QUOTER_V2_ADDRESS = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
const POOL_ADDRESS = "0x44fEA76b9F876d85C117e96f6a0323517210CA25";
const TOKEN_IN = "0x87f94FaBA3e8FD5fbb9f49F7e9Ab24E8fC6E7B7E"; // YES_USDS
const TOKEN_OUT = "0x192e4580d85dc767F81F8AD02428F042E3c1074e"; // YES_TSLAon
const AMOUNT_IN = "0.01"; // 0.01 USDS

// ABIs
const QUOTER_V2_ABI = [
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)"
];

const POOL_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
  "function liquidity() view returns (uint128)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
];

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

function sqrtPriceX96ToPrice(sqrtPriceX96) {
  const Q96 = ethers.BigNumber.from(2).pow(96);
  const sqrtPrice = ethers.BigNumber.from(sqrtPriceX96);
  const price = sqrtPrice.mul(sqrtPrice).mul(ethers.BigNumber.from(10).pow(18)).div(Q96).div(Q96);
  return parseFloat(ethers.utils.formatUnits(price, 18));
}

async function main() {
  console.log('🧪 Testing QuoterV2 with 0.01 USDS → YES_TSLAon\n');

  const provider = new ethers.providers.JsonRpcProvider("https://eth.llamarpc.com");

  // Get pool info
  const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
  const [token0, token1, fee, liquidity, slot0] = await Promise.all([
    pool.token0(),
    pool.token1(),
    pool.fee(),
    pool.liquidity(),
    pool.slot0()
  ]);

  const token0Contract = new ethers.Contract(token0, ERC20_ABI, provider);
  const token1Contract = new ethers.Contract(token1, ERC20_ABI, provider);
  const [decimals0, symbol0, decimals1, symbol1] = await Promise.all([
    token0Contract.decimals(),
    token0Contract.symbol(),
    token1Contract.decimals(),
    token1Contract.symbol()
  ]);

  console.log('📍 Pool:', POOL_ADDRESS);
  console.log('💱 Buying YES_TSLAon with 0.01 USDS\n');

  console.log('📊 Pool Info:');
  console.log(`  Token0: ${token0} (${symbol0})`);
  console.log(`  Token1: ${token1} (${symbol1})`);
  console.log(`  Fee tier: ${fee} (${fee/10000}%)`);
  console.log(`  Liquidity: ${liquidity.toString()}`);

  const currentSqrtPrice = slot0.sqrtPriceX96;
  const currentPoolPrice = sqrtPriceX96ToPrice(currentSqrtPrice);
  console.log(`  Current sqrtPriceX96: ${currentSqrtPrice.toString()}`);
  console.log(`  Current Pool Price: ${currentPoolPrice.toFixed(4)} (token1/token0 = ${symbol1}/${symbol0})\n`);

  // Determine token ordering
  const isToken0Input = TOKEN_IN.toLowerCase() === token0.toLowerCase();
  console.log('🔄 Trade direction:', isToken0Input ? `${symbol0} → ${symbol1}` : `${symbol1} → ${symbol0}`);
  console.log(`  Input: ${AMOUNT_IN} ${isToken0Input ? symbol0 : symbol1}`);

  // Call QuoterV2
  const quoter = new ethers.Contract(QUOTER_V2_ADDRESS, QUOTER_V2_ABI, provider);
  const amountInWei = ethers.utils.parseUnits(AMOUNT_IN, isToken0Input ? decimals0 : decimals1);

  console.log('\n💬 Calling QuoterV2...\n');

  try {
    const result = await quoter.callStatic.quoteExactInputSingle({
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      amountIn: amountInWei,
      fee: fee,
      sqrtPriceLimitX96: 0
    });

    const [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] = result;

    console.log('✅ SUCCESS! Quote received:\n');

    // Calculate prices
    const poolPriceAfter = sqrtPriceX96ToPrice(sqrtPriceX96After);
    const rawExecutionPrice = parseFloat(ethers.utils.formatUnits(amountOut, isToken0Input ? decimals1 : decimals0)) / parseFloat(AMOUNT_IN);

    console.log('📈 RAW PRICES (from sqrtPrice):');
    console.log(`  Current Pool Price (before): ${currentPoolPrice.toFixed(4)} (token1/token0 = ${symbol1}/${symbol0})`);
    console.log(`  Pool Price After: ${poolPriceAfter.toFixed(4)} (token1/token0 = ${symbol1}/${symbol0})`);
    console.log(`  Price Change: ${((poolPriceAfter - currentPoolPrice) / currentPoolPrice * 100).toFixed(4)}%\n`);

    console.log('📊 AMOUNTS:');
    console.log(`  Input: ${AMOUNT_IN} ${isToken0Input ? symbol0 : symbol1}`);
    console.log(`  Output: ${ethers.utils.formatUnits(amountOut, isToken0Input ? decimals1 : decimals0)} ${isToken0Input ? symbol1 : symbol0}`);
    console.log(`  Raw Execution Price: ${rawExecutionPrice.toFixed(10)} (output/input = ${isToken0Input ? symbol1 : symbol0}/${isToken0Input ? symbol0 : symbol1})\n`);

    // Invert prices for display (we want USDS per TSLAon)
    // sqrtPriceX96 is ALWAYS token1/token0 (USDS/TSLAon in this case)
    // So we DON'T need to invert pool prices - they're already correct!
    // But execution price = output/input, which needs inversion based on trade direction
    const displayCurrentPrice = currentPoolPrice; // Already USDS/TSLAon
    const displayPoolPriceAfter = poolPriceAfter; // Already USDS/TSLAon
    // rawExecutionPrice = output/input = TSLAon/USDS, need to invert to get USDS/TSLAon
    const displayExecutionPrice = isToken0Input ? rawExecutionPrice : (1 / rawExecutionPrice);

    console.log('🔄 DISPLAY PRICES (USDS per TSLAon):');
    console.log(`  Current Pool Price: ${displayCurrentPrice.toFixed(4)} ${symbol1}/${symbol0}`);
    console.log(`  Execution Price (avg): ${displayExecutionPrice.toFixed(4)} ${symbol1}/${symbol0}`);
    console.log(`  Pool Price After: ${displayPoolPriceAfter.toFixed(4)} ${symbol1}/${symbol0}\n`);

    // Calculate metrics
    const priceImpact = ((displayPoolPriceAfter - displayCurrentPrice) / displayCurrentPrice) * 100;
    const slippage = ((displayCurrentPrice - displayExecutionPrice) / displayCurrentPrice) * 100;

    console.log('💰 METRICS:');
    console.log(`  Price Impact: ${priceImpact.toFixed(4)}% (pool price moved from ${displayCurrentPrice.toFixed(4)} to ${displayPoolPriceAfter.toFixed(4)})`);
    console.log(`  Slippage: ${slippage.toFixed(4)}% (execution price ${displayExecutionPrice.toFixed(4)} vs current ${displayCurrentPrice.toFixed(4)})\n`);

    console.log('🎯 VERIFICATION:');
    console.log(`  ✓ Current < Pool After? ${displayCurrentPrice < displayPoolPriceAfter ? '✅ YES' : '❌ NO'} (buying should push price UP)`);
    console.log(`  ✓ Current < Execution? ${displayCurrentPrice < displayExecutionPrice ? '✅ YES' : '❌ NO'} (should pay more than current)`);
    console.log(`  ✓ Execution < Pool After? ${displayExecutionPrice < displayPoolPriceAfter ? '✅ YES' : '❌ NO'} (avg should be between current and after)\n`);

    console.log('📐 Expected order for BUY: Current < Execution < Pool After');
    console.log(`  Actual order: ${displayCurrentPrice.toFixed(4)} < ${displayExecutionPrice.toFixed(4)} < ${displayPoolPriceAfter.toFixed(4)}\n`);

    console.log('📊 OTHER INFO:');
    console.log(`  Gas estimate: ${gasEstimate.toString()}`);
    console.log(`  Ticks crossed: ${initializedTicksCrossed}`);

  } catch (error) {
    console.error('❌ FAILED!');
    console.error('Error:', error.message);
    if (error.error) {
      console.error('Details:', error.error);
    }
  }
}

main().catch(console.error);
