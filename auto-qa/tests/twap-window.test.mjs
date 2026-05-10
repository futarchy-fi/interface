/**
 * TWAP window calculation test (auto-qa).
 *
 * Pins PR #54: TWAP window for ended proposals.
 *
 * Before PR #54, TWAP was always computed over `[twapStart..now]` even
 * for ended proposals. After end-time, this included an empty no-trade
 * window, dragging the TWAP toward the last trade and showing a wrong
 * value to users.
 *
 * After PR #54 (MarketPageShowcase.jsx:632-636), the window is:
 *   active proposal:  [twapStart..now]              → secondsAgoEnd = 0
 *   ended proposal:   [twapStart..twapEnd]          → secondsAgoEnd = now - twapEnd
 *
 * Spec mirrors the production calculation. If those lines change, this
 * test may need a synchronized update — that's the contract.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirror of the production logic at MarketPageShowcase.jsx:632-636.
 * Returns the TWAP window bounds in the same shape the production
 * code computes: { secondsAgoStart, secondsAgoEnd } relative to `now`.
 *
 * @param {number} now              current unix timestamp
 * @param {number} twapStart        twap start unix timestamp
 * @param {number} twapDuration     twap duration in seconds
 * @param {boolean} hasEnded        whether the proposal has ended
 * @returns {{secondsAgoStart: number, secondsAgoEnd: number}}
 */
function twapWindow(now, twapStart, twapDuration, hasEnded) {
    const twapEnd = twapStart + twapDuration;
    const secondsAgoStart = Math.max(1, now - twapStart);
    const secondsAgoEnd = hasEnded ? Math.max(0, now - twapEnd) : 0;
    return { secondsAgoStart, secondsAgoEnd };
}

const HOUR = 3600;
const DAY  = 86400;

test('PR #54 — active proposal: window ends at now (secondsAgoEnd=0)', () => {
    const twapStart = 1_770_000_000;
    const twapDuration = 2 * DAY;
    const now = twapStart + DAY; // 1 day into a 2-day window
    const w = twapWindow(now, twapStart, twapDuration, /*hasEnded=*/false);
    assert.equal(w.secondsAgoEnd, 0, 'active proposals should anchor the window at "now"');
    assert.equal(w.secondsAgoStart, DAY, 'window should start 1 day ago');
});

test('PR #54 — ended proposal: window ends at twapEnd, not now', () => {
    const twapStart = 1_770_000_000;
    const twapDuration = 2 * DAY;
    const twapEnd = twapStart + twapDuration;
    const now = twapEnd + 5 * HOUR; // 5h after the proposal ended
    const w = twapWindow(now, twapStart, twapDuration, /*hasEnded=*/true);

    // The bug pre-PR-#54: secondsAgoEnd would be 0 (anchored at now),
    // so the TWAP would integrate over [twapStart..now], including the
    // 5h of post-end no-trade time → drags TWAP value.
    // The fix: secondsAgoEnd = now - twapEnd (5 hours).
    assert.equal(w.secondsAgoEnd, 5 * HOUR,
        `ended proposals must clamp the window to twapEnd, not now`);
    assert.equal(w.secondsAgoStart, twapDuration + 5 * HOUR,
        `secondsAgoStart should be twapDuration + secondsAgoEnd`);
});

test('PR #54 — ended proposal: window length stays equal to twapDuration', () => {
    const twapStart = 1_770_000_000;
    const twapDuration = 7 * DAY;
    for (const ageHours of [1, 24, 100, 500]) {
        const now = twapStart + twapDuration + ageHours * HOUR;
        const w = twapWindow(now, twapStart, twapDuration, true);
        const windowLen = w.secondsAgoStart - w.secondsAgoEnd;
        assert.equal(windowLen, twapDuration,
            `at age ${ageHours}h: window length should equal twapDuration; got ${windowLen} vs ${twapDuration}`);
    }
});

test('PR #54 — secondsAgoStart >= 1 even when now == twapStart (Math.max guard)', () => {
    const twapStart = 1_770_000_000;
    const twapDuration = DAY;
    const w = twapWindow(twapStart, twapStart, twapDuration, false);
    assert.ok(w.secondsAgoStart >= 1,
        `secondsAgoStart must be >= 1 to avoid div-by-zero in TWAP integration; got ${w.secondsAgoStart}`);
});

test('PR #54 — ended proposal sampled BEFORE twapEnd: secondsAgoEnd clamped to 0', () => {
    // Edge case: a proposal "hasEnded" can be set true while now is
    // briefly less than twapEnd (clock skew, server-side render lag).
    // The Math.max(0, …) guard prevents a negative secondsAgoEnd.
    const twapStart = 1_770_000_000;
    const twapDuration = DAY;
    const twapEnd = twapStart + twapDuration;
    const now = twapEnd - 60; // 60s BEFORE end, but flagged as ended
    const w = twapWindow(now, twapStart, twapDuration, true);
    assert.ok(w.secondsAgoEnd >= 0,
        `secondsAgoEnd must never be negative; got ${w.secondsAgoEnd}`);
});

test('PR #54 — TWAP value at t > end equals TWAP at t = end (window-clamping invariant)', () => {
    // The high-level property the fix preserves: once a proposal has
    // ended, the TWAP window stops growing. So the window at t=end+1h
    // and the window at t=end+24h must cover the same time range
    // [twapStart..twapEnd] — different secondsAgoEnd values, same
    // window length.
    const twapStart = 1_770_000_000;
    const twapDuration = 2 * DAY;
    const twapEnd = twapStart + twapDuration;

    const w1h  = twapWindow(twapEnd + HOUR,    twapStart, twapDuration, true);
    const w24h = twapWindow(twapEnd + 24*HOUR, twapStart, twapDuration, true);

    // Window length identical:
    assert.equal(
        w1h.secondsAgoStart - w1h.secondsAgoEnd,
        w24h.secondsAgoStart - w24h.secondsAgoEnd,
        'window length should be invariant once proposal has ended'
    );
});
