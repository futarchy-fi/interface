// Multi-option futarchy markets (FutarchyMultiFactory): reading prices and building transactions.
//
// A market has N options. Every option k has two tokens, k_COMPANY (e.g. BUCK_NVDA) and k_CURRENCY
// (BUCK_USDG), and two Uniswap V3 pools:
//   price pool        k_COMPANY / k_CURRENCY   the company token's price if option k wins
//   probability pool  k_CURRENCY / CURRENCY    the probability of option k
// Splitting 1 CURRENCY through the router gives 1 of every k_CURRENCY (same for COMPANY).
//
// No React and no wallet library in here: the page and the node test script both call these functions
// with a viem public client, so the transactions a user signs are the ones the test sends.
import { encodeFunctionData, parseUnits, formatUnits } from 'viem';

export const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'o', type: 'address' }, { name: 's', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 's', type: 'address' }, { name: 'v', type: 'uint256' }], outputs: [{ type: 'bool' }] },
];
export const POOL_ABI = [
  {
    type: 'function', name: 'slot0', stateMutability: 'view', inputs: [],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' }, { name: 'tick', type: 'int24' }, { name: 'observationIndex', type: 'uint16' },
      { name: 'observationCardinality', type: 'uint16' }, { name: 'observationCardinalityNext', type: 'uint16' },
      { name: 'feeProtocol', type: 'uint8' }, { name: 'unlocked', type: 'bool' },
    ],
  },
];
export const ROUTER_ABI = [
  { type: 'function', name: 'splitPosition', stateMutability: 'nonpayable', inputs: [{ name: 'proposal', type: 'address' }, { name: 'collateralToken', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'mergePositions', stateMutability: 'nonpayable', inputs: [{ name: 'proposal', type: 'address' }, { name: 'collateralToken', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'redeemPositions', stateMutability: 'nonpayable', inputs: [{ name: 'proposal', type: 'address' }, { name: 'collateralToken', type: 'address' }, { name: 'outcome', type: 'uint256' }, { name: 'amount', type: 'uint256' }], outputs: [] },
];
export const SWAP_ROUTER_ABI = [
  {
    type: 'function', name: 'exactInputSingle', stateMutability: 'payable',
    inputs: [{
      name: 'params', type: 'tuple',
      components: [
        { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' }, { name: 'fee', type: 'uint24' },
        { name: 'recipient', type: 'address' }, { name: 'amountIn', type: 'uint256' },
        { name: 'amountOutMinimum', type: 'uint256' }, { name: 'sqrtPriceLimitX96', type: 'uint160' },
      ],
    }],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
];
export const QUOTER_ABI = [
  {
    type: 'function', name: 'quoteExactInputSingle', stateMutability: 'nonpayable',
    inputs: [{
      name: 'params', type: 'tuple',
      components: [
        { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' }, { name: 'amountIn', type: 'uint256' },
        { name: 'fee', type: 'uint24' }, { name: 'sqrtPriceLimitX96', type: 'uint160' },
      ],
    }],
    outputs: [
      { name: 'amountOut', type: 'uint256' }, { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' }, { name: 'gasEstimate', type: 'uint256' },
    ],
  },
];
export const CONDITIONAL_TOKENS_ABI = [
  { type: 'function', name: 'payoutDenominator', stateMutability: 'view', inputs: [{ name: 'c', type: 'bytes32' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'payoutNumerators', stateMutability: 'view', inputs: [{ name: 'c', type: 'bytes32' }, { name: 'i', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
];

const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

/** token1 per token0 in whole-token units, from a pool's sqrtPriceX96. */
export function token1PerToken0(sqrtPriceX96, decimals0, decimals1) {
  const ratio = Number(sqrtPriceX96) / 2 ** 96;
  return ratio * ratio * 10 ** (decimals0 - decimals1);
}

/** Price of `base` in `quote` for a pool whose token0 is given. */
function poolPrice(sqrtPriceX96, token0, base, baseDecimals, quoteDecimals) {
  return same(token0, base)
    ? token1PerToken0(sqrtPriceX96, baseDecimals, quoteDecimals)
    : 1 / token1PerToken0(sqrtPriceX96, quoteDecimals, baseDecimals);
}

/**
 * Every option's probability and conditional price, the spot price, and the two sums that arbitrage
 * keeps in line: probabilities add to 1, and spot = sum of probability times conditional price.
 */
export async function readMarket(publicClient, cfg) {
  const slot0 = (address) => publicClient.readContract({ address, abi: POOL_ABI, functionName: 'slot0' });
  const [spotSlot, denominator, ...slots] = await Promise.all([
    slot0(cfg.spotPool.address),
    publicClient.readContract({ address: cfg.conditionalTokens, abi: CONDITIONAL_TOKENS_ABI, functionName: 'payoutDenominator', args: [cfg.conditionId] }),
    ...cfg.options.flatMap((o) => [slot0(o.pricePool.address), slot0(o.probPool.address)]),
  ]);
  const cd = cfg.company.decimals, qd = cfg.currency.decimals;
  const spot = poolPrice(spotSlot[0], cfg.spotPool.token0, cfg.company.address, cd, qd);
  const options = cfg.options.map((o, i) => ({
    ...o,
    price: poolPrice(slots[2 * i][0], o.pricePool.token0, o.companyToken, cd, qd),
    probability: poolPrice(slots[2 * i + 1][0], o.probPool.token0, o.currencyToken, qd, qd),
  }));
  const sumProbability = options.reduce((s, o) => s + o.probability, 0);
  const implied = options.reduce((s, o) => s + o.probability * o.price, 0) / sumProbability;

  let winner = null;
  if (denominator > 0n) {
    const numerators = await Promise.all(cfg.options.map((o) => publicClient.readContract({
      address: cfg.conditionalTokens, abi: CONDITIONAL_TOKENS_ABI, functionName: 'payoutNumerators', args: [cfg.conditionId, BigInt(o.index)],
    })));
    const position = numerators.findIndex((n) => n > 0n);
    winner = position < 0 ? null : cfg.options[position].index; // the option's index, not its place in the list
  }
  return { spot, options, sumProbability, implied, resolved: denominator > 0n, winner };
}

/** The account's balances: the two collaterals and both tokens of every option (raw bigints). */
export async function readBalances(publicClient, cfg, account) {
  const bal = (address) => publicClient.readContract({ address, abi: ERC20_ABI, functionName: 'balanceOf', args: [account] });
  const [company, currency, ...rest] = await Promise.all([
    bal(cfg.company.address), bal(cfg.currency.address),
    ...cfg.options.flatMap((o) => [bal(o.companyToken), bal(o.currencyToken)]),
  ]);
  const options = cfg.options.map((o, i) => ({ index: o.index, company: rest[2 * i], currency: rest[2 * i + 1] }));
  const min = (xs) => xs.reduce((m, x) => (x < m ? x : m));
  return {
    company, currency, options,
    completeCompany: min(options.map((o) => o.company)),
    completeCurrency: min(options.map((o) => o.currency)),
  };
}

/**
 * The four trades of one option. `side` is 'buy' or 'sell'; `kind` is 'probability' or 'price'.
 *   probability buy   CURRENCY   -> k_CURRENCY     sell  k_CURRENCY -> CURRENCY
 *   price       buy   k_CURRENCY -> k_COMPANY      sell  k_COMPANY  -> k_CURRENCY
 * When the input is an option token, `collateral` is what it can be split from.
 */
export function tradeRoute(cfg, option, kind, side) {
  const tok = (address, symbol, decimals, collateral = null) => ({ address, symbol, decimals, collateral });
  const kCurrency = tok(option.currencyToken, `${option.symbol}_${cfg.currency.symbol}`, cfg.currency.decimals, cfg.currency);
  const kCompany = tok(option.companyToken, `${option.symbol}_${cfg.company.symbol}`, cfg.company.decimals, cfg.company);
  const currency = tok(cfg.currency.address, cfg.currency.symbol, cfg.currency.decimals);
  if (kind === 'probability') {
    return side === 'buy'
      ? { tokenIn: currency, tokenOut: kCurrency, fee: option.probPool.fee }
      : { tokenIn: kCurrency, tokenOut: currency, fee: option.probPool.fee };
  }
  return side === 'buy'
    ? { tokenIn: kCurrency, tokenOut: kCompany, fee: option.pricePool.fee }
    : { tokenIn: kCompany, tokenOut: kCurrency, fee: option.pricePool.fee };
}

/** Quote an exact-input swap. Returns the output and the minimum after slippage (raw bigints). */
export async function quoteSwap(publicClient, cfg, route, amountIn, slippageBps = 100) {
  const { result } = await publicClient.simulateContract({
    address: cfg.quoterV2, abi: QUOTER_ABI, functionName: 'quoteExactInputSingle',
    args: [{ tokenIn: route.tokenIn.address, tokenOut: route.tokenOut.address, amountIn, fee: route.fee, sqrtPriceLimitX96: 0n }],
  });
  const amountOut = result[0];
  return { amountOut, minAmountOut: (amountOut * BigInt(10000 - slippageBps)) / 10000n };
}

const call = (label, to, abi, functionName, args) => ({ label, to, data: encodeFunctionData({ abi, functionName, args }) });
const allowanceOf = (publicClient, token, owner, spender) =>
  publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: 'allowance', args: [owner, spender] });

/**
 * The transactions for one trade, in order. If the input is an option token and the account holds less
 * than `amountIn`, the shortfall is split from its collateral first (which also leaves the account
 * holding the same amount of every other option's token). Approvals are for the exact amounts and are
 * skipped when the existing allowance is enough.
 */
export async function planTrade(publicClient, cfg, account, route, amountIn, minAmountOut) {
  const calls = [];
  const { tokenIn, tokenOut } = route;
  if (tokenIn.collateral) {
    const held = await publicClient.readContract({ address: tokenIn.address, abi: ERC20_ABI, functionName: 'balanceOf', args: [account] });
    if (held < amountIn) {
      const shortfall = amountIn - held;
      const c = tokenIn.collateral;
      if (await allowanceOf(publicClient, c.address, account, cfg.router) < shortfall) {
        calls.push(call(`Approve ${c.symbol}`, c.address, ERC20_ABI, 'approve', [cfg.router, shortfall]));
      }
      calls.push(call(`Split ${formatUnits(shortfall, c.decimals)} ${c.symbol} into every option`, cfg.router, ROUTER_ABI, 'splitPosition', [cfg.proposal, c.address, shortfall]));
    }
  }
  if (await allowanceOf(publicClient, tokenIn.address, account, cfg.swapRouter02) < amountIn) {
    calls.push(call(`Approve ${tokenIn.symbol}`, tokenIn.address, ERC20_ABI, 'approve', [cfg.swapRouter02, amountIn]));
  }
  calls.push(call(`Swap ${tokenIn.symbol} for ${tokenOut.symbol}`, cfg.swapRouter02, SWAP_ROUTER_ABI, 'exactInputSingle', [{
    tokenIn: tokenIn.address, tokenOut: tokenOut.address, fee: route.fee, recipient: account,
    amountIn, amountOutMinimum: minAmountOut, sqrtPriceLimitX96: 0n,
  }]));
  return calls;
}

/** Merge `amount` of every option's token of one collateral ('company' or 'currency') back into it. */
export async function planMerge(publicClient, cfg, account, which, amount) {
  const collateral = cfg[which];
  const calls = [];
  const allowances = await Promise.all(cfg.options.map((o) => allowanceOf(publicClient, which === 'company' ? o.companyToken : o.currencyToken, account, cfg.router)));
  cfg.options.forEach((o, i) => {
    if (allowances[i] < amount) {
      calls.push(call(`Approve ${o.symbol}_${collateral.symbol}`, which === 'company' ? o.companyToken : o.currencyToken, ERC20_ABI, 'approve', [cfg.router, amount]));
    }
  });
  calls.push(call(`Merge into ${formatUnits(amount, collateral.decimals)} ${collateral.symbol}`, cfg.router, ROUTER_ABI, 'mergePositions', [cfg.proposal, collateral.address, amount]));
  return calls;
}

/** After resolution: redeem the winning option's tokens of one collateral for the collateral. */
export async function planRedeem(publicClient, cfg, account, which, optionIndex, amount) {
  const collateral = cfg[which];
  const option = cfg.options[optionIndex];
  const token = which === 'company' ? option.companyToken : option.currencyToken;
  const calls = [];
  if (await allowanceOf(publicClient, token, account, cfg.router) < amount) {
    calls.push(call(`Approve ${option.symbol}_${collateral.symbol}`, token, ERC20_ABI, 'approve', [cfg.router, amount]));
  }
  calls.push(call(`Redeem for ${collateral.symbol}`, cfg.router, ROUTER_ABI, 'redeemPositions', [cfg.proposal, collateral.address, BigInt(optionIndex), amount]));
  return calls;
}

/** Parse a typed amount, dropping digits beyond the token's decimals. Returns 0n for empty or invalid input. */
export function parseAmount(text, decimals) {
  const s = String(text ?? '').trim();
  if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return 0n;
  const [whole, frac = ''] = s.split('.');
  return parseUnits(`${whole || '0'}.${frac.slice(0, decimals) || '0'}`, decimals);
}
