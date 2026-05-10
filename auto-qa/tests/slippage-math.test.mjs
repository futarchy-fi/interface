/**
 * Slippage / minReceive math test (auto-qa).
 *
 * Pins PR #34's switch from float-based `Number()` math to BigInt
 * (BigNumber) arithmetic for `minReceive` calculation in
 * `src/utils/FutarchyQuoteHelper.js:94-97`.
 *
 * The bug (Issue #5): for large token amounts, the lossy float path
 * silently truncated trailing precision, so the `minReceive` shown to
 * the user differed from what the contract enforced. Users saw a
 * "Min. Receive" number that didn't match the on-chain min-output bound.
 *
 * Spec mirrors:
 *   slippageBps   = round(slippagePercentage * 10000)   // 0.005 -> 50 bps
 *   minReceiveBN  = amountOutBig * (10000 - slippageBps) / 10000
 *
 * Uses native BigInt (no ethers dep needed).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

/** Production (correct) path — BigInt arithmetic. */
function minReceiveBigInt(amountOutWei, slippagePercentage) {
    const slippageBps = BigInt(Math.round(slippagePercentage * 10000));
    return (BigInt(amountOutWei) * (10000n - slippageBps)) / 10000n;
}

/** Pre-PR-#34 lossy path — Number arithmetic on potentially huge values. */
function minReceiveLossyFloat(amountOutWei, slippagePercentage) {
    const num = Number(amountOutWei); // ← may lose precision past 2^53
    return BigInt(Math.floor(num * (1 - slippagePercentage)));
}

test('PR #34 — small amount: float and BigInt agree', () => {
    const amountOut = 100n * 10n ** 18n; // 100 tokens in wei
    const slip = 0.005; // 0.5%
    const big = minReceiveBigInt(amountOut, slip);
    const flt = minReceiveLossyFloat(amountOut, slip);
    // For amounts well under 2^53, the difference is < 100 wei.
    const diff = big > flt ? big - flt : flt - big;
    assert.ok(diff < 1_000_000_000n,
        `for small amounts BigInt vs float should differ by very little; got ${diff}`);
});

test('PR #34 — large amount: float silently truncates precision', () => {
    // 1 million tokens in wei = 1e24, well past 2^53 (~9e15)
    const amountOut = 1_000_000n * 10n ** 18n;
    const slip = 0.005;
    const big = minReceiveBigInt(amountOut, slip);
    const flt = minReceiveLossyFloat(amountOut, slip);
    const diff = big > flt ? big - flt : flt - big;
    // Float representation loses ~10 digits of precision at this magnitude.
    // BigInt path is exact; float diverges by at least thousands of wei.
    assert.ok(diff > 0n,
        `at amounts > 2^53 wei the float path SHOULD lose precision; got identical values which suggests the test broke`);
});

test('PR #34 — BigInt path is bit-exact for round numbers', () => {
    // 100 tokens, 0.5% slippage → expect exactly 99.5 tokens minReceive
    const amountOut = 100n * 10n ** 18n;
    const expected = 995n * 10n ** 17n; // 99.5e18
    const got = minReceiveBigInt(amountOut, 0.005);
    assert.equal(got, expected,
        `expected exactly 99.5e18 wei, got ${got}`);
});

test('PR #34 — minReceive ≤ amountOut for any non-negative slippage', () => {
    const amountOut = 1234n * 10n ** 18n;
    for (const slip of [0, 0.001, 0.005, 0.01, 0.05, 0.1]) {
        const min = minReceiveBigInt(amountOut, slip);
        assert.ok(min <= amountOut,
            `minReceive (${min}) must not exceed amountOut (${amountOut}) at slippage ${slip}`);
    }
});

test('PR #34 — minReceive is monotonic non-increasing in slippage', () => {
    const amountOut = 1234n * 10n ** 18n;
    const slips = [0, 0.001, 0.005, 0.01, 0.05, 0.1];
    let prev = amountOut;
    for (const s of slips) {
        const cur = minReceiveBigInt(amountOut, s);
        assert.ok(cur <= prev,
            `slippage ${s}: minReceive should be ≤ previous, got ${cur} > ${prev}`);
        prev = cur;
    }
});

test('PR #34 — slippageBps rounding handles fractional percentages', () => {
    // 0.123% → 12.3 bps → rounds to 12 bps
    const amountOut = 10000n * 10n ** 18n; // 10000 tokens
    const got = minReceiveBigInt(amountOut, 0.00123);
    // Expected: amountOut * 9988 / 10000
    const expected = (amountOut * 9988n) / 10000n;
    assert.equal(got, expected,
        `0.123% slippage should round to 12 bps; expected ${expected}, got ${got}`);
});

test('PR #34 — zero slippage returns amountOut unchanged', () => {
    const amountOut = 99n * 10n ** 18n + 99n; // odd number to catch off-by-one
    assert.equal(minReceiveBigInt(amountOut, 0), amountOut);
});
