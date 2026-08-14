import { ethers } from 'ethers';

export const UNISWAP_V3_QUOTER_V2 = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';
export const UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';

const ERC20_ABI = ['function decimals() view returns (uint8)'];
const FACTORY_ABI = ['function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)'];
const POOL_ABI = [
  'function token0() view returns (address)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)'
];
const QUOTER_V2_ABI = [
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
];

const token1PerToken0 = (sqrtPriceX96, decimals0, decimals1) => {
  const sqrtRatio = Number(sqrtPriceX96.toString()) / (2 ** 96);
  return sqrtRatio * sqrtRatio * (10 ** (decimals0 - decimals1));
};

export async function quoteUniswapV3ExactInput({
  provider,
  tokenIn,
  tokenOut,
  amountIn,
  fee = 500,
  slippageBps = 50,
  blockTag
}) {
  if (!provider) throw new Error('Provider is required');
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps >= 10000) {
    throw new Error('slippageBps must be an integer from 0 to 9999');
  }

  const callOverrides = blockTag == null ? {} : { blockTag };
  const factory = new ethers.Contract(UNISWAP_V3_FACTORY, FACTORY_ABI, provider);
  const poolAddress = await factory.getPool(tokenIn, tokenOut, fee, callOverrides);
  if (poolAddress === ethers.constants.AddressZero) {
    throw new Error(`No Uniswap V3 ${fee} pool for this token pair`);
  }

  const tokenInContract = new ethers.Contract(tokenIn, ERC20_ABI, provider);
  const tokenOutContract = new ethers.Contract(tokenOut, ERC20_ABI, provider);
  const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
  const [decimalsIn, decimalsOut, token0, slot0] = await Promise.all([
    tokenInContract.decimals(callOverrides),
    tokenOutContract.decimals(callOverrides),
    pool.token0(callOverrides),
    pool.slot0(callOverrides)
  ]);
  const amountInRaw = ethers.utils.parseUnits(amountIn.toString(), decimalsIn);
  if (amountInRaw.isZero()) throw new Error('Amount in must be greater than zero');

  const quoter = new ethers.Contract(UNISWAP_V3_QUOTER_V2, QUOTER_V2_ABI, provider);
  const result = await quoter.callStatic.quoteExactInputSingle({
    tokenIn,
    tokenOut,
    amountIn: amountInRaw,
    fee,
    sqrtPriceLimitX96: 0
  }, callOverrides);
  const amountOutRaw = result.amountOut ?? result[0];
  const sqrtPriceX96After = result.sqrtPriceX96After ?? result[1];
  const initializedTicksCrossed = result.initializedTicksCrossed ?? result[2];
  const gasEstimate = result.gasEstimate ?? result[3];
  if (amountOutRaw.isZero()) throw new Error('Pool quote returned zero output');

  const tokenInIsToken0 = tokenIn.toLowerCase() === token0.toLowerCase();
  const decimals0 = tokenInIsToken0 ? decimalsIn : decimalsOut;
  const decimals1 = tokenInIsToken0 ? decimalsOut : decimalsIn;
  const poolRate = token1PerToken0(slot0.sqrtPriceX96 ?? slot0[0], decimals0, decimals1);
  const currentSpotRate = tokenInIsToken0 ? poolRate : 1 / poolRate;
  const amountInFormatted = ethers.utils.formatUnits(amountInRaw, decimalsIn);
  const amountOutFormatted = ethers.utils.formatUnits(amountOutRaw, decimalsOut);
  const executionRate = Number(amountOutFormatted) / Number(amountInFormatted);
  const priceImpactPct = Math.max(0, (1 - executionRate / currentSpotRate) * 100);
  const minimumAmountOutRaw = amountOutRaw.mul(10000 - slippageBps).div(10000);

  return {
    poolAddress,
    blockTag: blockTag ?? 'latest',
    feeTier: fee,
    amountInRaw: amountInRaw.toString(),
    amountInFormatted,
    amountOutRaw: amountOutRaw.toString(),
    amountOutFormatted,
    minimumAmountOutRaw: minimumAmountOutRaw.toString(),
    minimumAmountOutFormatted: ethers.utils.formatUnits(minimumAmountOutRaw, decimalsOut),
    currentSpotRate,
    executionRate,
    priceImpactPct,
    sqrtPriceX96Before: (slot0.sqrtPriceX96 ?? slot0[0]).toString(),
    sqrtPriceX96After: sqrtPriceX96After.toString(),
    initializedTicksCrossed: initializedTicksCrossed.toString(),
    gasEstimate: gasEstimate.toString(),
    decimalsIn: Number(decimalsIn),
    decimalsOut: Number(decimalsOut)
  };
}
