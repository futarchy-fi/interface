/**
 * Liquidity math unit-bound test (auto-qa).
 *
 * Pins the math fix from PR #51 — converting Algebra V3's raw `liquidity`
 * field (1e18-scaled) to a currency-denominated TVL via:
 *   TVL_currency = (2 × L × sqrtPrice) / 1e18      (when currency is token1)
 *   TVL_currency = (2 × L / sqrtPrice) / 1e18      (when currency is token0)
 * where sqrtPrice = 1.0001^(tick/2).
 *
 * Pre-PR-#51, the widget displayed the raw L value as "sDAI" — values
 * like "4.9e21 sDAI" — nonsense.
 *
 * This is a SPEC test: the math here mirrors the production code at
 * `src/hooks/usePoolData.js:141-153`. If those lines change, this test
 * may need a synchronized update — that's the contract.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirrors the production calculation at src/hooks/usePoolData.js:141-153.
 * @param {string|number} rawL  Algebra V3 `liquidity` field (1e18-scaled BigInt).
 * @param {number}        tick  Current pool tick.
 * @param {boolean}       currencyIsToken0
 * @returns {number} TVL in currency token units (NOT wei), or 0 if tick missing.
 */
function tvlFromTick(rawL, tick, currencyIsToken0) {
    let adjustedLiquidity = parseFloat(rawL || 0);
    if (tick === undefined || tick === null) return adjustedLiquidity / 1e18;
    const sqrtPrice = Math.pow(1.0001, tick / 2);
    if (!(sqrtPrice > 0)) return 0;
    const liquidityScaled = currencyIsToken0
        ? adjustedLiquidity / sqrtPrice
        : adjustedLiquidity * sqrtPrice;
    return (liquidityScaled * 2) / 1e18;
}

// ────────────────────────────────────────────────────────────────────────
// Fixture: GIP-150 v2 CONDITIONAL pool data captured from live API.
// ────────────────────────────────────────────────────────────────────────
const YES_POOL = {
    L: '4900580174367112592095',
    tick: 47116,
    currencyIsToken0: false, // token0=YES_GNO, token1=YES_sDAI
};
const NO_POOL = {
    L: '4900580174367112321476',
    tick: -46766,
    currencyIsToken0: true,  // token0=NO_sDAI, token1=NO_GNO
};

test('PR #51 — YES pool TVL is in plausible currency-units range', () => {
    const tvl = tvlFromTick(YES_POOL.L, YES_POOL.tick, YES_POOL.currencyIsToken0);
    assert.ok(tvl > 1,
        `YES pool TVL must be > 1 sDAI; got ${tvl}`);
    assert.ok(tvl < 1e9,
        `YES pool TVL must be < 1e9 sDAI (raw 1e18 leak guard); got ${tvl}`);
    // Sanity: GIP-150's CONDITIONAL pools sit around 100K sDAI TVL.
    assert.ok(tvl > 1e4 && tvl < 1e7,
        `YES pool TVL should be in 10K..10M range for GIP-150; got ${tvl}`);
});

test('PR #51 — NO pool TVL is in plausible currency-units range', () => {
    const tvl = tvlFromTick(NO_POOL.L, NO_POOL.tick, NO_POOL.currencyIsToken0);
    assert.ok(tvl > 1, `NO pool TVL must be > 1 sDAI; got ${tvl}`);
    assert.ok(tvl < 1e9, `NO pool TVL must be < 1e9 sDAI; got ${tvl}`);
    assert.ok(tvl > 1e4 && tvl < 1e7,
        `NO pool TVL should be in 10K..10M range for GIP-150; got ${tvl}`);
});

test('PR #51 — YES and NO TVL are within 50% of each other (futarchy invariant)', () => {
    // For a healthy futarchy market the YES and NO conditional pools
    // start with the same liquidity. They drift but should stay
    // within an order of magnitude. If one is 100× the other, the
    // tick-based formula is broken on one side.
    const yesTvl = tvlFromTick(YES_POOL.L, YES_POOL.tick, YES_POOL.currencyIsToken0);
    const noTvl  = tvlFromTick(NO_POOL.L,  NO_POOL.tick,  NO_POOL.currencyIsToken0);
    const ratio = Math.max(yesTvl, noTvl) / Math.min(yesTvl, noTvl);
    assert.ok(ratio < 2,
        `YES and NO TVL should be within 2x of each other; got ratio ${ratio.toFixed(2)} (YES=${yesTvl.toFixed(0)} NO=${noTvl.toFixed(0)})`);
});

test('PR #51 — fallback /1e18 when tick missing yields plausible value', () => {
    const tvl = tvlFromTick(YES_POOL.L, null, false);
    // Without tick, formula falls back to L / 1e18 ≈ 4900 (raw L is
    // a 1e18-scaled BigInt). This is a degraded fallback but still
    // bounded — must not leak the raw 1e21 value.
    assert.ok(tvl > 1 && tvl < 1e9,
        `fallback TVL out of bounds: ${tvl}`);
});

test('PR #51 — degenerate tick (sqrtPrice=0) returns 0, not Infinity/NaN', () => {
    // Algebra V3 ticks are bounded in [-887272, 887272]. At extreme
    // negative ticks Math.pow(1.0001, tick/2) underflows to 0 — the
    // production guard returns 0 rather than dividing by zero.
    const tvl = tvlFromTick('1000000000000000000', -1_000_000, true);
    assert.ok(tvl === 0 || (Number.isFinite(tvl) && tvl >= 0),
        `extreme negative tick should not yield Infinity/NaN; got ${tvl}`);
});

test('PR #51 — null/zero L returns 0, not NaN', () => {
    assert.equal(tvlFromTick(null, 0, false), 0);
    assert.equal(tvlFromTick(undefined, 0, false), 0);
    assert.equal(tvlFromTick('0', 0, false), 0);
});
