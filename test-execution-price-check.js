const { ethers } = require("ethers");

// Tesla market - buying YES_TSLAon with USDS
const RPC_URL = "https://eth.llamarpc.com";
const QUOTER_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
const POOL_ADDRESS = "0x44fEA76b9F876d85C117e96f6a0323517210CA25"; // YES pool

// Tokens
const TOKEN_IN = "0x87f94FaBA3e8FD5fbb9f49F7e9Ab24E8fC6E7B7E";  // YES_USDS
const TOKEN_OUT = "0x192e4580d85dc767F81F8AD02428F042E3c1074e"; // YES_TSLAon

// ABIs
const QUOTER_V2_ABI = [
  "function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)"
];

const POOL_ABI = [
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function fee() external view returns (uint24)",
  "function liquidity() external view returns (uint128)",
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
];

const ERC20_ABI = [
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)"
];

function sqrtPriceX96ToPrice(sqrtPriceX96) {
  const Q96 = ethers.BigNumber.from(2).pow(96);
  const sqrtPrice = ethers.BigNumber.from(sqrtPriceX96);

  const sqrtPriceSquared = sqrtPrice.mul(sqrtPrice);
  const Q192 = Q96.mul(Q96);

  const price = parseFloat(sqrtPriceSquared.toString()) / parseFloat(Q192.toString());
  return price;
}

async function testExecutionPriceCheck() {
  console.log("🧪 Testing Execution Price Calculation for Tesla YES Market\n");
  console.log("📍 Pool:", POOL_ADDRESS);
  console.log("💱 Buying YES_TSLAon with USDS (1 USDS input)\n");

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);

  try {
    // Get pool info
    const [token0, token1, fee, liquidity, slot0] = await Promise.all([
      pool.token0(),
      pool.token1(),
      pool.fee(),
      pool.liquidity(),
      pool.slot0()
    ]);

    const sqrtPriceX96Before = slot0.sqrtPriceX96;

    console.log("📊 Pool Info:");
    console.log("  Token0:", token0);
    console.log("  Token1:", token1);
    console.log("  Fee tier:", fee, `(${fee/10000}%)`);
    console.log("  Liquidity:", liquidity.toString());

    // Get token info
    const token0Contract = new ethers.Contract(token0, ERC20_ABI, provider);
    const token1Contract = new ethers.Contract(token1, ERC20_ABI, provider);

    const [symbol0, symbol1, decimals0, decimals1] = await Promise.all([
      token0Contract.symbol(),
      token1Contract.symbol(),
      token0Contract.decimals(),
      token1Contract.decimals()
    ]);

    console.log(`  ${symbol0} (${decimals0} decimals)`);
    console.log(`  ${symbol1} (${decimals1} decimals)\n`);

    // Determine token ordering
    const isToken0Input = TOKEN_IN.toLowerCase() === token0.toLowerCase();
    console.log("🔄 Trade direction:", isToken0Input ? `${symbol0} → ${symbol1}` : `${symbol1} → ${symbol0}\n`);

    // Get quote from QuoterV2
    console.log("💬 Calling QuoterV2...");
    const quoter = new ethers.Contract(QUOTER_V2, QUOTER_V2_ABI, provider);

    const amountIn = ethers.utils.parseUnits("1", isToken0Input ? decimals0 : decimals1);

    const params = {
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      amountIn: amountIn,
      fee: fee,
      sqrtPriceLimitX96: 0
    };

    const result = await quoter.callStatic.quoteExactInputSingle(params);
    const [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] = result;

    // Calculate prices
    const currentPoolPrice = sqrtPriceX96ToPrice(sqrtPriceX96Before);
    const poolPriceAfter = sqrtPriceX96ToPrice(sqrtPriceX96After);

    const amountOutFormatted = parseFloat(ethers.utils.formatUnits(amountOut, isToken0Input ? decimals1 : decimals0));
    const amountInFormatted = parseFloat(ethers.utils.formatUnits(amountIn, isToken0Input ? decimals0 : decimals1));

    // Raw execution price (output/input)
    const rawExecutionPrice = amountOutFormatted / amountInFormatted;

    console.log("\n✅ SUCCESS! Quote received:\n");
    console.log("📈 PRICES (raw from sqrtPrice):");
    console.log("  Current Pool Price (before):", currentPoolPrice.toFixed(10), `(token1/token0 = ${symbol1}/${symbol0})`);
    console.log("  Pool Price After:", poolPriceAfter.toFixed(10), `(token1/token0 = ${symbol1}/${symbol0})`);
    console.log("  Price Change:", ((poolPriceAfter - currentPoolPrice) / currentPoolPrice * 100).toFixed(4) + "%");

    console.log("\n📊 AMOUNTS:");
    console.log("  Input:", amountInFormatted, symbol0);
    console.log("  Output:", amountOutFormatted, symbol1);
    console.log("  Raw Execution Price:", rawExecutionPrice.toFixed(10), `(output/input = ${symbol1}/${symbol0})`);

    console.log("\n🔄 LOGIC CHECK:");
    console.log("  Is token0 input?", isToken0Input ? "YES" : "NO");
    console.log("  Input token:", isToken0Input ? symbol0 : symbol1);
    console.log("  Output token:", isToken0Input ? symbol1 : symbol0);

    // Pool price is always token1/token0 = YES_USDS/YES_TSLAon
    // Raw execution price is output/input
    // If input=YES_USDS and output=YES_TSLAon, then rawExecutionPrice = YES_TSLAon/YES_USDS
    // We want to display USDS per TSLAon, so we need to invert rawExecutionPrice

    // But pool price is already USDS/TSLAon (token1/token0), so we should keep it as-is!

    console.log("\n🔄 INVERTED PRICES (for display as USDS per TSLAon):");

    let currentPriceInverted, poolPriceAfterInverted, executionPriceInverted;

    if (isToken0Input) {
      // Input is token0 (YES_TSLAon), output is token1 (YES_USDS)
      // rawExecutionPrice = token1/token0 = USDS/TSLAon ✓ already correct direction
      // Pool prices = token1/token0 = USDS/TSLAon ✓ already correct direction
      currentPriceInverted = currentPoolPrice;
      poolPriceAfterInverted = poolPriceAfter;
      executionPriceInverted = rawExecutionPrice;
    } else {
      // Input is token1 (YES_USDS), output is token0 (YES_TSLAon)
      // rawExecutionPrice = token0/token1 = TSLAon/USDS ✗ need to invert
      // Pool prices = token1/token0 = USDS/TSLAon ✓ already correct direction
      currentPriceInverted = currentPoolPrice;
      poolPriceAfterInverted = poolPriceAfter;
      executionPriceInverted = 1 / rawExecutionPrice;
    }

    console.log("  Current Pool Price:", currentPriceInverted.toFixed(4), `${symbol1}/${symbol0}`);
    console.log("  Execution Price (avg):", executionPriceInverted.toFixed(4), `${symbol1}/${symbol0}`);
    console.log("  Pool Price After:", poolPriceAfterInverted.toFixed(4), `${symbol1}/${symbol0}`);

    console.log("\n🎯 VERIFICATION:");
    console.log("  ✓ Current < Execution?", currentPriceInverted < executionPriceInverted ? "✅ YES" : "❌ NO");
    console.log("  ✓ Execution < Pool After?", executionPriceInverted < poolPriceAfterInverted ? "✅ YES" : "❌ NO");
    console.log("  ✓ Current < Pool After?", currentPriceInverted < poolPriceAfterInverted ? "✅ YES" : "❌ NO");

    console.log("\n📐 Expected order: Current < Execution < Pool After");
    console.log(`  Actual order: ${currentPriceInverted.toFixed(4)} < ${executionPriceInverted.toFixed(4)} < ${poolPriceAfterInverted.toFixed(4)}`);

    console.log("\n💰 SLIPPAGE & IMPACT:");
    const priceImpact = ((poolPriceAfter - currentPoolPrice) / currentPoolPrice) * 100;
    const slippage = ((currentPriceInverted - executionPriceInverted) / currentPriceInverted) * 100;

    console.log("  Price Impact:", priceImpact.toFixed(4) + "% (pool moved)");
    console.log("  Slippage:", slippage.toFixed(4) + "% (your cost vs current price)");

    console.log("\n📊 OTHER INFO:");
    console.log("  Gas estimate:", gasEstimate.toString());
    console.log("  Ticks crossed:", initializedTicksCrossed.toString());

  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    if (error.error?.message) {
      console.error("  Contract error:", error.error.message);
    }
  }
}

testExecutionPriceCheck();
