const { ethers } = require("ethers");

// Setup
const RPC_URL = "https://eth.llamarpc.com"; // Free Ethereum RPC
const QUOTER_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e"; // Ethereum mainnet
const POOL_ADDRESS = "0x44fEA76b9F876d85C117e96f6a0323517210CA25";

// Tokens
const TOKEN_IN = "0x87f94FaBA3e8FD5fbb9f49F7e9Ab24E8fC6E7B7E";
const TOKEN_OUT = "0x192e4580d85dc767F81F8AD02428F042E3c1074e";

// ABIs
const QUOTER_V2_ABI = [
  "function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)"
];

const POOL_ABI = [
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function fee() external view returns (uint24)",
  "function liquidity() external view returns (uint128)"
];

const ERC20_ABI = [
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)"
];

async function testQuoterV2() {
  console.log("🧪 Testing QuoterV2 with Ethereum pool...\n");

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

  // Check pool info
  console.log("📊 Checking pool:", POOL_ADDRESS);
  const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);

  try {
    const [token0, token1, fee, liquidity] = await Promise.all([
      pool.token0(),
      pool.token1(),
      pool.fee(),
      pool.liquidity()
    ]);

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
    console.log(`  ${symbol1} (${decimals1} decimals)`);

    // Check which direction to swap
    const isToken0Input = TOKEN_IN.toLowerCase() === token0.toLowerCase();
    console.log("\n🔄 Swap direction:", isToken0Input ? `${symbol0} → ${symbol1}` : `${symbol1} → ${symbol0}`);

    // Test QuoterV2
    console.log("\n💬 Testing QuoterV2 quote...");
    const quoter = new ethers.Contract(QUOTER_V2, QUOTER_V2_ABI, provider);

    const amountIn = ethers.utils.parseUnits("0.001", isToken0Input ? decimals0 : decimals1);

    const params = {
      tokenIn: TOKEN_IN,
      tokenOut: TOKEN_OUT,
      amountIn: amountIn,
      fee: fee,
      sqrtPriceLimitX96: 0
    };

    console.log("  Input amount:", ethers.utils.formatUnits(amountIn, isToken0Input ? decimals0 : decimals1));
    console.log("  Fee tier:", fee);

    const result = await quoter.callStatic.quoteExactInputSingle(params);
    const [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] = result;

    console.log("\n✅ SUCCESS!");
    console.log("  Amount out:", ethers.utils.formatUnits(amountOut, isToken0Input ? decimals1 : decimals0));
    console.log("  Sqrt price after:", sqrtPriceX96After.toString());
    console.log("  Ticks crossed:", initializedTicksCrossed.toString());
    console.log("  Gas estimate:", gasEstimate.toString());

    const effectivePrice = parseFloat(ethers.utils.formatUnits(amountOut, isToken0Input ? decimals1 : decimals0)) /
                          parseFloat(ethers.utils.formatUnits(amountIn, isToken0Input ? decimals0 : decimals1));
    console.log("  Effective price:", effectivePrice);

  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    if (error.error?.message) {
      console.error("  Contract error:", error.error.message);
    }
  }
}

testQuoterV2();
