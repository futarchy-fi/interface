/**
 * Impact formula test (auto-qa).
 *
 * Pins PR #31: "Fix Impact showing 0% by using candle close prices".
 *
 * Background: the subgraph `tick` field on YES and NO CONDITIONAL pools
 * was sometimes stale/identical (both showed -50491 on the AAVE market)
 * even when the pools' real prices had diverged. Tick-derived prices
 * came out equal → impact = (yes - no)/spot * 100 = 0%, the wrong
 * answer. PR #31 swaps tick-derived prices for candle close prices so
 * YES and NO actually differ.
 *
 * The impact *formula* is unchanged by PR #31 — what changed is which
 * inputs feed into it. So the test pins the formula AND demonstrates
 * the bug condition: when YES and NO prices are equal, impact is 0
 * regardless of formula path; when they diverge (post-PR-#31), the
 * formula yields the displayed impact percentage.
 *
 * Spec mirrors:
 *   src/components/chart/SubgraphChart.jsx:515-526 (single-point card)
 *   src/components/chart/TripleChart.jsx:120-131    (chart series)
 *
 * If those line ranges change, this test may need a synchronized update.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirror of SubgraphChart.jsx:515-526. Computes the Impact % shown on
 * the SubgraphChart card. Two paths:
 *   1. Spot price available → (yes - no)/spot * 100      (preferred)
 *   2. No spot → (yes - no)/max(yes, no) * 100           (fallback)
 *
 * @param {number|null} yesPrice
 * @param {number|null} noPrice
 * @param {number|null} spotPrice
 * @param {boolean} showSpot
 * @returns {number} impact percentage
 */
function impactPercent(yesPrice, noPrice, spotPrice, showSpot) {
    if (yesPrice === null || noPrice === null) return 0;
    if (showSpot && spotPrice && spotPrice > 0) {
        return ((yesPrice - noPrice) / spotPrice) * 100;
    }
    const denominator = Math.max(yesPrice, noPrice);
    return denominator > 0 ? ((yesPrice - noPrice) / denominator) * 100 : 0;
}

/**
 * Mirror of TripleChart.jsx:120-131 — the per-timestamp impact series
 * used by the chart line. Always uses the spot-based formula; skips any
 * timestamp where any of the three values is missing or spot <= 0.
 */
function impactSeries(yesData, noData, spotData) {
    const map = new Map();
    yesData.forEach(d => { if (!map.has(d.time)) map.set(d.time, {}); map.get(d.time).yes = d.value; });
    noData.forEach(d => { if (!map.has(d.time)) map.set(d.time, {}); map.get(d.time).no = d.value; });
    spotData.forEach(d => { if (!map.has(d.time)) map.set(d.time, {}); map.get(d.time).spot = d.value; });

    const out = [];
    map.forEach((v, time) => {
        if (v.yes !== undefined && v.no !== undefined && v.spot !== undefined && v.spot > 0) {
            out.push({ time, value: ((v.yes - v.no) / v.spot) * 100 });
        }
    });
    out.sort((a, b) => a.time - b.time);
    return out;
}

const EPS = 1e-9;
const close = (a, b) => Math.abs(a - b) < EPS;

// ---------------------------------------------------------------------------
// PR #31 — bug condition: identical YES & NO prices → 0% impact
// ---------------------------------------------------------------------------

test('PR #31 — bug repro: equal YES/NO prices yield 0% impact (spot path)', () => {
    // Pre-PR #31, both pools' tick-derived prices came back equal (subgraph
    // staleness). The formula isn't broken — but the inputs were degenerate.
    const yes = 120, no = 120, spot = 100;
    assert.equal(impactPercent(yes, no, spot, true), 0,
        'when YES == NO the formula yields exactly 0 — explains the user-visible "Impact 0.00%" bug');
});

test('PR #31 — bug repro: equal YES/NO prices yield 0% impact (fallback path)', () => {
    const yes = 134.45, no = 134.45;
    assert.equal(impactPercent(yes, no, null, false), 0,
        'fallback path: equal prices also yield 0');
});

// ---------------------------------------------------------------------------
// PR #31 — fixed condition: candle-close prices diverge → meaningful impact
// ---------------------------------------------------------------------------

test('PR #31 — AAVE example: divergent candle prices give ~20% impact (spot path)', () => {
    // From the PR body: "YES: 134.45, NO: 106.68 GHO/AAVE for AAVE market"
    // and the description says Impact should show "~20% (not 0.00%)".
    // We don't know the exact spot price the PR author used; pick one that
    // brackets the documented "~20%" expectation.
    const yes = 134.45, no = 106.68;
    const spot = 134.45; // an at-the-money spot ≈ YES gives the upper bound
    const impact = impactPercent(yes, no, spot, true);
    // (134.45 - 106.68)/134.45 * 100 ≈ 20.65%
    assert.ok(impact > 19 && impact < 22,
        `expected ~20% impact for AAVE-style spread; got ${impact.toFixed(2)}%`);
});

test('PR #31 — fallback path: divergent prices yield non-zero impact', () => {
    // No spot available (showSpot=false or spot=0): falls back to
    // (yes - no)/max(yes, no) * 100. With yes > no this is the same
    // upper-bound formula.
    const impact = impactPercent(134.45, 106.68, null, false);
    assert.ok(close(impact, ((134.45 - 106.68) / 134.45) * 100),
        `fallback should equal (yes-no)/max(yes,no)*100; got ${impact}`);
});

// ---------------------------------------------------------------------------
// Sign / direction invariants
// ---------------------------------------------------------------------------

test('formula — YES > NO yields positive impact', () => {
    const i = impactPercent(110, 100, 105, true);
    assert.ok(i > 0, `YES > NO should be positive impact; got ${i}`);
});

test('formula — NO > YES yields negative impact', () => {
    const i = impactPercent(100, 110, 105, true);
    assert.ok(i < 0, `NO > YES should be negative impact; got ${i}`);
});

test('formula — symmetric: swapping YES and NO flips the sign', () => {
    const a = impactPercent(120, 100, 110, true);
    const b = impactPercent(100, 120, 110, true);
    assert.ok(close(a, -b), `expected ${a} === -${b}`);
});

// ---------------------------------------------------------------------------
// Defensive guards
// ---------------------------------------------------------------------------

test('formula — null YES or NO yields 0% (guard)', () => {
    assert.equal(impactPercent(null, 100, 100, true), 0);
    assert.equal(impactPercent(100, null, 100, true), 0);
});

test('formula — spot=0 falls back to denominator path (no div-by-zero)', () => {
    // spotPrice > 0 guard sends us into the fallback branch.
    const i = impactPercent(120, 100, 0, true);
    // Fallback: (120-100)/max(120,100)*100 = 16.67
    assert.ok(close(i, ((120 - 100) / 120) * 100), `got ${i}`);
});

test('formula — spot=0 with YES==NO==0 fallback yields 0 (no div-by-zero)', () => {
    const i = impactPercent(0, 0, 0, true);
    assert.equal(i, 0, 'denominator=0 must short-circuit to 0');
});

// ---------------------------------------------------------------------------
// Series-builder invariants (TripleChart.jsx)
// ---------------------------------------------------------------------------

test('series — drops timestamps missing any of yes/no/spot', () => {
    const yes  = [{ time: 1, value: 110 }, { time: 2, value: 115 }, { time: 3, value: 120 }];
    const no   = [{ time: 1, value: 100 }, { time: 2, value: 102 }];                          // missing t=3
    const spot = [{ time: 1, value: 105 }, { time: 2, value: 108 }, { time: 3, value: 112 }];
    const s = impactSeries(yes, no, spot);
    assert.equal(s.length, 2, `expected 2 series points (t=1,2 only); got ${s.length}`);
    assert.deepEqual(s.map(p => p.time), [1, 2]);
});

test('series — drops timestamps where spot <= 0 (guards div-by-zero)', () => {
    const yes  = [{ time: 1, value: 110 }, { time: 2, value: 115 }];
    const no   = [{ time: 1, value: 100 }, { time: 2, value: 102 }];
    const spot = [{ time: 1, value: 0   }, { time: 2, value: 108 }]; // t=1 has spot=0
    const s = impactSeries(yes, no, spot);
    assert.equal(s.length, 1, `t=1 must be skipped (spot=0); got ${s.length}`);
    assert.equal(s[0].time, 2);
});

test('series — output sorted by time ascending', () => {
    const yes  = [{ time: 3, value: 120 }, { time: 1, value: 110 }, { time: 2, value: 115 }];
    const no   = [{ time: 3, value: 102 }, { time: 1, value: 100 }, { time: 2, value: 101 }];
    const spot = [{ time: 3, value: 112 }, { time: 1, value: 105 }, { time: 2, value: 108 }];
    const s = impactSeries(yes, no, spot);
    const times = s.map(p => p.time);
    assert.deepEqual(times, [...times].sort((a, b) => a - b), 'series must be sorted by time');
});

test('series — degenerate yes==no case yields 0 at every point (PR #31 bug)', () => {
    // Pre-PR #31: every series point had yes == no (tick collapse) → impact
    // line was a flat 0%. This is the chart-level companion to the card-level
    // bug repro test above.
    const yes  = [{ time: 1, value: 120 }, { time: 2, value: 121 }];
    const no   = [{ time: 1, value: 120 }, { time: 2, value: 121 }];
    const spot = [{ time: 1, value: 100 }, { time: 2, value: 100 }];
    const s = impactSeries(yes, no, spot);
    assert.equal(s.length, 2);
    assert.ok(s.every(p => p.value === 0),
        `equal yes/no must produce a flat 0 series — pre-PR-#31 chart symptom`);
});
