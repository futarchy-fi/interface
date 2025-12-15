// Usage: npm run getpoolprice
// Works with ethers v5 (CommonJS)

const { ethers } = require("ethers");

const GNOSIS_RPC = "https://rpc.gnosischain.com";
const POOL_ADDRESS = "0x23B0f7937DAa3385ab7FDaa7AD902f744c9d4d05";

const POOL_ABI = [
  {
    "name": "globalState",
    "outputs": [
      { "type": "uint160", "name": "price" }, // sqrtPriceX96
      { "type": "int24", "name": "tick" },
      { "type": "uint16", "name": "lastFee" },
      { "type": "uint8", "name": "pluginConfig" },
      { "type": "uint16", "name": "communityFee" },
      { "type": "bool", "name": "unlocked" }
    ],
    "inputs": [],
    "stateMutability": "view",
    "type": "function"
  },
  { "name": "token0", "inputs": [], "outputs": [{ "type": "address" }], "stateMutability": "view", "type": "function" },
  { "name": "token1", "inputs": [], "outputs": [{ "type": "address" }], "stateMutability": "view", "type": "function" }
];

const ERC20_ABI = ["function decimals() view returns (uint8)"];

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(GNOSIS_RPC);
  const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);

  // Get token addresses
  const [token0, token1] = await Promise.all([
    pool.token0(),
    pool.token1(),
  ]);

  // Get decimals
  const erc20_0 = new ethers.Contract(token0, ERC20_ABI, provider);
  const erc20_1 = new ethers.Contract(token1, ERC20_ABI, provider);
  const [decimals0, decimals1] = await Promise.all([
    erc20_0.decimals(),
    erc20_1.decimals(),
  ]);

  // Get sqrtPriceX96
  const { price: sqrtPriceX96 } = await pool.globalState();

  // Compute price
  const p = Number(sqrtPriceX96) / 2 ** 96;
  const priceT1perT0 = p * p;
  const priceT0perT1 = 1 / priceT1perT0;

  // Adjust for decimals
  const adjPriceT1perT0 = priceT1perT0 * 10 ** (decimals0 - decimals1);
  const adjPriceT0perT1 = priceT0perT1 * 10 ** (decimals1 - decimals0);

  console.log(`token0: ${token0} (decimals: ${decimals0})`);
  console.log(`token1: ${token1} (decimals: ${decimals1})`);
  console.log(`\nsqrtPriceX96: ${sqrtPriceX96.toString()}`);
  console.log(`\n1 token0 ≈ ${adjPriceT1perT0.toPrecision(10)} token1`);
  console.log(`1 token1 ≈ ${adjPriceT0perT1.toPrecision(10)} token0`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
