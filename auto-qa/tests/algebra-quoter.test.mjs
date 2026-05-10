/**
 * algebraQuoter spec mirror (auto-qa).
 *
 * Pins src/utils/algebraQuoter.js — the direct on-chain Algebra Quoter
 * wrapper that replaced @swapr/sdk to drop quote latency from "420+ RPC
 * calls per quote" to "1-4 RPC calls per quote". Powers swap-modal
 * quotes for non-Futarchy pools.
 *
 * Six concerns pinned:
 *
 *   1. ALGEBRA_QUOTER contract address — canonical Gnosis address.
 *      Drift = quotes route to wrong/non-existent contract.
 *   2. QUOTER_ABI / POOL_ABI / ERC20_ABI shapes — drift = ethers
 *      decodes garbage from callStatic returns.
 *   3. getAlgebraQuote — callStatic with sqrtPriceLimitX96=0, error
 *      remapping (LOK / IIA / AS to human-readable strings).
 *   4. sqrtPriceX96ToPrice (exported helper) — Algebra V3 standard
 *      formula. Cross-pinned against the canonical sqrt-price-x96.test.mjs.
 *   5. Slippage math (default 50 bps = 0.5%) — same algorithm as the
 *      canonical helper. Cross-pin so divergence is visible.
 *   6. Direction-detection (isToken0ToToken1 / shouldInvertPrice /
 *      executionPrice direction) — silent regression here = wrong
 *      price displayed in UI for one half of every pool.
 *
 * Async getAlgebraQuoteWithSlippage NOT mirrored (network-bound) —
 * only its source-text branches and pure helpers.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(
    new URL('../../src/utils/algebraQuoter.js', import.meta.url),
    'utf8',
);

// --- spec mirror of sqrtPriceX96ToPrice (BigInt math) ---
function sqrtPriceX96ToPrice(sqrtPriceX96String) {
    try {
        const sqrt = BigInt(sqrtPriceX96String);
        const Q96 = 2n ** 96n;
        const sqrtSquared = sqrt * sqrt;
        const Q192 = Q96 * Q96;
        return Number(sqrtSquared) / Number(Q192);
    } catch {
        return null;
    }
}

// --- spec mirror of slippage math (BigInt-safe) ---
function applySlippageBps(amountOutWei, slippageBps) {
    const factor = BigInt(10000 - slippageBps);
    return (BigInt(amountOutWei) * factor) / 10000n;
}

// --- spec mirror of token-direction detection ---
function detectDirection(tokenIn, tokenOut, token0, token1) {
    const tInL = tokenIn.toLowerCase();
    const tOutL = tokenOut.toLowerCase();
    const t0L = token0.toLowerCase();
    const t1L = token1.toLowerCase();
    return {
        isToken0ToToken1: tInL === t0L && tOutL === t1L,
        isToken1ToToken0: tInL === t1L && tOutL === t0L,
    };
}

// ---------------------------------------------------------------------------
// ALGEBRA_QUOTER — canonical Gnosis address
// ---------------------------------------------------------------------------

test('ALGEBRA_QUOTER — pinned to canonical 0xcBaD9FDf...0F7 Gnosis Algebra Quoter', () => {
    const m = SRC.match(/ALGEBRA_QUOTER\s*=\s*['"]([^'"]+)['"]/);
    assert.ok(m, 'ALGEBRA_QUOTER not found');
    assert.equal(m[1], '0xcBaD9FDf0D2814659Eb26f600EFDeAF005Eda0F7',
        `ALGEBRA_QUOTER drifted from canonical Gnosis Quoter — every non-Futarchy ` +
        `quote calls this contract; drift means wrong contract / wrong quotes / silent revert.`);
});

test('ALGEBRA_QUOTER — valid 0x + 40 hex chars', () => {
    const m = SRC.match(/ALGEBRA_QUOTER\s*=\s*['"]([^'"]+)['"]/);
    assert.match(m[1], /^0x[0-9a-fA-F]{40}$/);
});

test('ALGEBRA_QUOTER — preserves EIP-55 mixed-case checksum form', () => {
    const m = SRC.match(/ALGEBRA_QUOTER\s*=\s*['"]([^'"]+)['"]/);
    assert.notEqual(m[1], m[1].toLowerCase(),
        `ALGEBRA_QUOTER must preserve EIP-55 checksum case`);
});

// ---------------------------------------------------------------------------
// ABIs — exact shapes
// ---------------------------------------------------------------------------

test('QUOTER_ABI — exact quoteExactInputSingle signature', () => {
    // Pinned: (address tokenIn, address tokenOut, uint256 amountIn,
    // uint160 sqrtPriceLimitX96) returns (uint256 amountOut).
    // Drift means the call ABI differs from the on-chain contract →
    // ethers decodes garbage from callStatic.
    assert.match(SRC,
        /function quoteExactInputSingle\(address tokenIn, address tokenOut, uint256 amountIn, uint160 sqrtPriceLimitX96\) external returns \(uint256 amountOut\)/,
        `QUOTER_ABI signature drifted`);
});

test('POOL_ABI — globalState 7-tuple shape (price, tick, fee, ...)', () => {
    // Pinned: globalState returns (uint160 price, int24 tick, uint16 fee,
    // uint16 timepointIndex, uint16 communityFeeToken0, uint16 communityFeeToken1, bool unlocked).
    // Caller reads .price, .tick, .fee, etc. Drift means undefined
    // properties or off-by-one in tuple index.
    assert.match(SRC,
        /function globalState\(\) external view returns \(uint160 price, int24 tick, uint16 fee, uint16 timepointIndex, uint16 communityFeeToken0, uint16 communityFeeToken1, bool unlocked\)/,
        `POOL_ABI globalState shape drifted`);
});

test('POOL_ABI — has liquidity(), token0(), token1() getters', () => {
    assert.match(SRC, /function liquidity\(\) external view returns \(uint128\)/);
    assert.match(SRC, /function token0\(\) external view returns \(address\)/);
    assert.match(SRC, /function token1\(\) external view returns \(address\)/);
});

test('ERC20_ABI — decimals + symbol getters', () => {
    assert.match(SRC, /function decimals\(\) external view returns \(uint8\)/);
    assert.match(SRC, /function symbol\(\) external view returns \(string\)/);
});

// ---------------------------------------------------------------------------
// getAlgebraQuote — callStatic + sqrtPriceLimitX96=0 + error parsing
// ---------------------------------------------------------------------------

test('source — getAlgebraQuote uses callStatic (NOT direct call)', () => {
    // Pinned: a regression to direct call would attempt a real signed
    // transaction — burns gas and requires a signer.
    assert.match(SRC,
        /quoterContract\.callStatic\.quoteExactInputSingle\(/,
        `must use callStatic — direct call burns gas and requires signer`);
});

test('source — getAlgebraQuote passes sqrtPriceLimitX96 = 0 (no price limit)', () => {
    // Pinned: 0 means "no price limit" in Algebra. A regression to
    // some non-zero literal would silently cap the swap or hit "AS".
    assert.match(SRC,
        /amountIn,\s*\n?\s*0\s*\/\/.*sqrtPriceLimitX96/,
        `sqrtPriceLimitX96 must be 0 (no price limit) with the explanatory comment`);
});

test('source — error remapping: LOK → "Pool is locked"', () => {
    assert.match(SRC,
        /error\.message\?\.includes\(['"]LOK['"]\)[\s\S]*?throw new Error\(['"]Pool is locked['"]\)/,
        `LOK → "Pool is locked" remap drifted`);
});

test('source — error remapping: IIA → "Insufficient input amount"', () => {
    assert.match(SRC,
        /error\.message\?\.includes\(['"]IIA['"]\)[\s\S]*?throw new Error\(['"]Insufficient input amount['"]\)/,
        `IIA → "Insufficient input amount" remap drifted`);
});

test('source — error remapping: AS → "Price limit reached"', () => {
    assert.match(SRC,
        /error\.message\?\.includes\(['"]AS['"]\)[\s\S]*?throw new Error\(['"]Price limit reached['"]\)/,
        `AS → "Price limit reached" remap drifted`);
});

test('source — unknown errors re-thrown unchanged (no swallow)', () => {
    // Pinned: a `throw error;` at the bottom of the catch ensures
    // unknown errors propagate. A regression that returns null/0
    // would silently produce wrong quotes.
    assert.match(SRC,
        /throw\s+error\s*;?\s*\}\s*\}/,
        `unknown errors must be re-thrown (not swallowed/returned)`);
});

// ---------------------------------------------------------------------------
// sqrtPriceX96ToPrice — Algebra V3 standard formula
// ---------------------------------------------------------------------------

test('sqrtPriceX96ToPrice — sqrt = 2^96 → price = 1', () => {
    const r = sqrtPriceX96ToPrice((2n ** 96n).toString());
    assert.equal(r, 1, `sqrt=2^96 must yield price=1 (sqrt²/Q192 = 1)`);
});

test('sqrtPriceX96ToPrice — sqrt = 2 * 2^96 → price = 4', () => {
    const r = sqrtPriceX96ToPrice((2n * (2n ** 96n)).toString());
    assert.equal(r, 4);
});

test('sqrtPriceX96ToPrice — null/invalid input returns null (not throw)', () => {
    // Pinned: callers may pass undefined when pool data not yet loaded.
    // try/catch returns null — a regression to throw would crash UI.
    assert.equal(sqrtPriceX96ToPrice(null), null);
    assert.equal(sqrtPriceX96ToPrice('not a number'), null);
});

test('sqrtPriceX96ToPrice — non-negative for any valid sqrt (square invariant)', () => {
    for (const exp of [0, 48, 96, 144, 160]) {
        const r = sqrtPriceX96ToPrice((2n ** BigInt(exp)).toString());
        assert.ok(r >= 0, `sqrt=2^${exp} produced negative price ${r}`);
    }
});

test('sqrtPriceX96ToPrice — monotonic in sqrtPrice', () => {
    const a = sqrtPriceX96ToPrice((1n << 96n).toString());
    const b = sqrtPriceX96ToPrice((2n << 96n).toString());
    const c = sqrtPriceX96ToPrice((10n << 96n).toString());
    assert.ok(a < b && b < c);
});

test('source — sqrtPriceX96ToPrice formula matches canonical sqrt²/Q192', () => {
    // Cross-pin: the inline math in getAlgebraQuoteWithSlippage uses
    // the same formula. Drift between the two would silently differ
    // from the canonical sqrt-price-x96.test.mjs pin.
    assert.match(SRC,
        /sqrtPriceSquared\s*=\s*sqrtPriceX96\.mul\(sqrtPriceX96\)/,
        `inline rawPoolPrice formula must use sqrt.mul(sqrt) (NOT sqrt.pow(2) — different gas semantics)`);
    assert.match(SRC,
        /Q192\s*=\s*Q96\.mul\(Q96\)/,
        `Q192 must be Q96.mul(Q96)`);
});

// ---------------------------------------------------------------------------
// Slippage math — default 50 bps + (10000 - bps) / 10000
// ---------------------------------------------------------------------------

test('source — getAlgebraQuoteWithSlippage default slippageBps = 50 (0.5%)', () => {
    assert.match(SRC,
        /slippageBps\s*=\s*50,?\s*\n/,
        `default slippageBps drifted from 50 (0.5%) — too low → quote rejected; too high → user gets less`);
});

test('source — slippage formula: amountOut * (10000 - bps) / 10000', () => {
    // Cross-pin against canonical slippage-math.test.mjs. Same algorithm,
    // different module — drift here means swap quotes diverge from
    // canonical UI math.
    assert.match(SRC,
        /slippageFactor\s*=\s*ethers\.BigNumber\.from\(10000\s*-\s*slippageBps\)/,
        `slippageFactor formula drifted from BigNumber.from(10000 - bps)`);
    assert.match(SRC,
        /amountOutWei\.mul\(slippageFactor\)\.div\(10000\)/,
        `minAmountOut formula drifted from amountOut.mul(factor).div(10000)`);
});

test('slippage — applySlippageBps spec mirror: 0 bps → identity', () => {
    const out = '1000000000000000000';
    assert.equal(applySlippageBps(out, 0), BigInt(out));
});

test('slippage — applySlippageBps: 50 bps (0.5%) on 1e18 → 0.995e18', () => {
    const r = applySlippageBps((10n ** 18n).toString(), 50);
    const expected = (10n ** 18n) * 9950n / 10000n;
    assert.equal(r, expected);
});

test('slippage — applySlippageBps non-increasing as bps grows', () => {
    const out = '1000000000000000000';
    let prev = BigInt(out) + 1n;
    for (const bps of [0, 10, 50, 100, 500]) {
        const r = applySlippageBps(out, bps);
        assert.ok(r < prev,
            `monotonicity broken: bps=${bps} produced minOut=${r} ≥ prev=${prev}`);
        prev = r;
    }
});

// ---------------------------------------------------------------------------
// Direction detection — toLowerCase comparison
// ---------------------------------------------------------------------------

test('detectDirection — token0→token1 swap detected', () => {
    const r = detectDirection('0xAA', '0xBB', '0xAA', '0xBB');
    assert.equal(r.isToken0ToToken1, true);
    assert.equal(r.isToken1ToToken0, false);
});

test('detectDirection — token1→token0 swap detected (reverse)', () => {
    const r = detectDirection('0xBB', '0xAA', '0xAA', '0xBB');
    assert.equal(r.isToken0ToToken1, false);
    assert.equal(r.isToken1ToToken0, true);
});

test('detectDirection — case-insensitive (lowercase comparison)', () => {
    // Pinned: ethers returns checksum addresses, but the input may be
    // lower or mixed case. A regression to strict equality would
    // silently mis-detect direction → wrong price inversion.
    const r = detectDirection('0xaaaaaa', '0xBBBBBB', '0xAAAAAA', '0xbbbbbb');
    assert.equal(r.isToken0ToToken1, true,
        `direction detection must be case-insensitive`);
});

test('source — token addresses lowercased BEFORE comparison', () => {
    // Pinned all four lowercases.
    assert.match(SRC, /token0Lower\s*=\s*token0Address\.toLowerCase\(\)/);
    assert.match(SRC, /token1Lower\s*=\s*token1Address\.toLowerCase\(\)/);
    assert.match(SRC, /tokenInLower\s*=\s*tokenIn\.toLowerCase\(\)/);
    assert.match(SRC, /tokenOutLower\s*=\s*tokenOut\.toLowerCase\(\)/);
});

// ---------------------------------------------------------------------------
// Price inversion logic — currency/company orientation
// ---------------------------------------------------------------------------

test('source — shouldInvertPrice = true when token0 is currency', () => {
    // Pinned: rawPoolPrice = token1/token0. We want to display
    // currency/company. So:
    //   token0=currency, token1=company → raw is company/currency → INVERT.
    //   token0=company, token1=currency → raw is currency/company → KEEP.
    assert.match(SRC,
        /if\s*\(token0IsCurrency\)\s*\{[\s\S]*?shouldInvertPrice\s*=\s*true[\s\S]*?\}\s*else\s*\{[\s\S]*?shouldInvertPrice\s*=\s*false/,
        `inversion-by-token-orientation logic drifted`);
});

test('source — currentPrice = shouldInvertPrice ? 1/raw : raw', () => {
    assert.match(SRC,
        /currentPrice\s*=\s*shouldInvertPrice\s*\?\s*\(1\s*\/\s*rawPoolPrice\)\s*:\s*rawPoolPrice/,
        `currentPrice inversion shape drifted`);
});

test('source — executionPrice for currency→company swap is INVERTED', () => {
    // Pinned: when buying company with currency, amountOut/amountIn =
    // company/currency. We want to display currency/company → invert.
    // A regression here = wrong execution price displayed.
    assert.match(SRC,
        /!tokenInIsCompany\s*&&\s*tokenOutIsCompany[\s\S]*?executionPrice\s*=\s*1\s*\/\s*rawExecutionPrice/,
        `currency→company execution price must be 1/raw`);
});

test('source — executionPrice for company→currency swap is DIRECT', () => {
    assert.match(SRC,
        /tokenInIsCompany\s*&&\s*!tokenOutIsCompany[\s\S]*?executionPrice\s*=\s*rawExecutionPrice/,
        `company→currency execution price must be raw (not inverted)`);
});

// ---------------------------------------------------------------------------
// Performance / gas contract pins
// ---------------------------------------------------------------------------

test('source — gasEstimate hardcoded at "400000" with comment about ~300k typical', () => {
    // Pinned: comment says Algebra swaps typically use ~300k gas;
    // 400k provides a buffer. A regression to a much higher value
    // surfaces as confusing wallet-prompt UX.
    assert.match(SRC,
        /gasEstimate:\s*['"]400000['"]/,
        `gasEstimate drifted from "400000"`);
});

test('source — rpcCalls: 4 performance contract pin (the file\'s reason for existing)', () => {
    // The whole point of this file is "1-4 RPC calls per quote"
    // (vs 420+ from @swapr/sdk). Pinned because a regression that
    // re-introduces a loop or extra fetch would silently re-introduce
    // the latency this file was created to fix.
    assert.match(SRC,
        /rpcCalls:\s*4/,
        `rpcCalls drifted from 4 — may indicate extra RPC calls slipped in`);
});

test('source — opening docstring references the "420+ RPC calls" optimization narrative', () => {
    // Pinned the historical context. If the comment is removed, future
    // contributors lose the WHY behind the file's architecture.
    assert.match(SRC,
        /420\+/,
        `module docstring no longer mentions the 420+ RPC call problem this file fixed`);
});
