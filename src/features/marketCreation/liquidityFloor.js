// R1 liquidity floor gate (ratified 2026-07-10):
// A market may only go LIVE if a $100 trade moves price < 3%. Below the floor it
// stays DRAFT. "A wizard that mints dead markets would be worse than no wizard."
//
// The pure core computes price impact from pool reserves via constant product,
// which is the honest lower-bound for a concentrated-liquidity pool near the
// active tick (real impact is >= this once liquidity thins). The async wrapper
// prefers the on-chain Algebra quoter (getAlgebraQuote) when available.

export const FLOOR_TRADE_USD = 100;
export const FLOOR_MAX_IMPACT = 0.03; // 3%

/**
 * Constant-product price impact of swapping amountIn of the input reserve.
 * impact = 1 - (executionPrice / spotPrice), all in output-per-input terms.
 * @returns {number} fractional price impact (0.03 = 3%)
 */
export function priceImpactConstantProduct(reserveIn, reserveOut, amountIn) {
  const ri = Number(reserveIn), ro = Number(reserveOut), ai = Number(amountIn);
  if (!(ri > 0 && ro > 0 && ai > 0)) return 1; // no/unknown liquidity => max impact => DRAFT
  const spot = ro / ri;                          // output per input at rest
  const out = (ro * ai) / (ri + ai);             // x*y=k output for amountIn
  const exec = out / ai;                         // realized output per input
  return Math.max(0, 1 - exec / spot);
}

/**
 * Evaluate the floor gate for a pool.
 * @param {object} p
 * @param {number} p.reserveInTokens   input-token reserve (currency side), human units
 * @param {number} p.reserveOutTokens  output-token reserve (company side), human units
 * @param {number} p.tradeUsd          trade size in USD (default $100)
 * @param {number} p.inputUsdPrice     USD price of one input token (currency ~ $1 for sDAI)
 * @returns {{passes:boolean, impact:number, state:'LIVE'|'DRAFT', tradeUsd:number, reason:string}}
 */
export function evaluateFloor({ reserveInTokens, reserveOutTokens, tradeUsd = FLOOR_TRADE_USD, inputUsdPrice = 1 }) {
  const amountIn = tradeUsd / (inputUsdPrice || 1);
  const impact = priceImpactConstantProduct(reserveInTokens, reserveOutTokens, amountIn);
  const passes = impact < FLOOR_MAX_IMPACT;
  return {
    passes,
    impact,
    state: passes ? 'LIVE' : 'DRAFT',
    tradeUsd,
    reason: passes
      ? `a $${tradeUsd} trade moves price ${(impact * 100).toFixed(2)}% (< ${(FLOOR_MAX_IMPACT * 100)}% floor)`
      : `a $${tradeUsd} trade moves price ${(impact * 100).toFixed(2)}% (>= ${(FLOOR_MAX_IMPACT * 100)}% floor) — seed more liquidity before going live`,
  };
}

/**
 * Zero-trade honesty copy (R3). Show this wherever resolution is previewed.
 */
export const ZERO_TRADE_NOTICE =
  'If the TWAP window ends with no trades, the market resolves by the default ' +
  'rule (no trading occurred) — this is not a market verdict.';
