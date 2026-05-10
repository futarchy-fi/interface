/**
 * SeededRandom spec mirror (auto-qa).
 *
 * Pins src/utils/seededRandom.js — a deterministic PRNG used to
 * generate stable per-market visual jitter (chart shimmer, fake
 * candle wicks before live data arrives) in two chart components:
 *
 *   - src/components/futarchyFi/marketPage/SpotMarketChart.jsx (imports it)
 *   - src/components/futarchyFi/marketPage/MarketCharts.jsx     (DUPLICATES the class inline!)
 *
 * The duplication is a code-smell worth pinning: if the inline copy
 * drifts from the canonical class, two charts of the same proposal
 * will look subtly different (visual flicker on tab switch). This
 * file pins both.
 *
 * The implementation is `Math.sin(seed++) * 10000`, fractional part —
 * not cryptographic, not even uniform, but deterministic. Three things
 * matter:
 *
 *   1. SAME seed → SAME sequence (determinism — the entire point).
 *   2. Each call advances `seed` by exactly 1 (visible side effect).
 *   3. Output is in [0, 1) (callers may multiply by a range).
 *
 * Also pins the dead-code state of src/utils/MarkdownParser.js — it
 * has zero callers AND executes `console.log(html)` at module load
 * (line 62). Documented so a future refactor that removes the file
 * doesn't accidentally remove its OUTPUT-on-import warning sign.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const CANONICAL_SRC = readFileSync(
    new URL('../../src/utils/seededRandom.js', import.meta.url),
    'utf8',
);
const MARKETCHARTS_SRC = readFileSync(
    new URL('../../src/components/futarchyFi/marketPage/MarketCharts.jsx', import.meta.url),
    'utf8',
);
const MARKDOWN_PARSER_SRC = readFileSync(
    new URL('../../src/utils/MarkdownParser.js', import.meta.url),
    'utf8',
);

// --- spec mirror of canonical SeededRandom ---
class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }
    random() {
        const x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    }
}

// ---------------------------------------------------------------------------
// Determinism — same seed → same sequence (the whole point)
// ---------------------------------------------------------------------------

test('SeededRandom — same seed yields identical first value', () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    assert.equal(a.random(), b.random(),
        `same seed must produce identical first value — determinism is the whole contract`);
});

test('SeededRandom — same seed yields identical sequence (10 calls)', () => {
    const a = new SeededRandom(7);
    const b = new SeededRandom(7);
    const seqA = Array.from({ length: 10 }, () => a.random());
    const seqB = Array.from({ length: 10 }, () => b.random());
    assert.deepEqual(seqA, seqB,
        `same seed must produce identical sequence`);
});

test('SeededRandom — DIFFERENT seeds yield different first values (sanity)', () => {
    // Otherwise the seed parameter is ignored.
    const a = new SeededRandom(1).random();
    const b = new SeededRandom(2).random();
    assert.notEqual(a, b,
        `different seeds must produce different first values`);
});

// ---------------------------------------------------------------------------
// Output range — must be [0, 1)
// ---------------------------------------------------------------------------

test('SeededRandom — output is in [0, 1) for many seeds', () => {
    // Probe 100 random seeds, 10 calls each. A regression that returns
    // raw Math.sin output (without the fractional wrap) would yield
    // values around ±10000.
    for (let s = 0; s < 100; s++) {
        const r = new SeededRandom(s);
        for (let i = 0; i < 10; i++) {
            const v = r.random();
            assert.ok(v >= 0 && v < 1,
                `SeededRandom(${s}) call #${i+1} returned ${v}, outside [0, 1)`);
        }
    }
});

test('SeededRandom — output is FLOAT (not integer)', () => {
    // Catches a regression that returns Math.floor(...) or coerces to int.
    const r = new SeededRandom(13);
    let sawNonInt = false;
    for (let i = 0; i < 20; i++) {
        const v = r.random();
        if (v !== Math.floor(v)) { sawNonInt = true; break; }
    }
    assert.ok(sawNonInt, `SeededRandom must yield non-integer values (got only integers)`);
});

// ---------------------------------------------------------------------------
// Side effect — seed advances by exactly 1 per call
// ---------------------------------------------------------------------------

test('SeededRandom — each random() call mutates seed += 1', () => {
    const r = new SeededRandom(100);
    assert.equal(r.seed, 100);
    r.random(); assert.equal(r.seed, 101);
    r.random(); assert.equal(r.seed, 102);
    r.random(); assert.equal(r.seed, 103);
});

test('SeededRandom — after N calls, seed === initialSeed + N', () => {
    const r = new SeededRandom(0);
    for (let i = 1; i <= 50; i++) {
        r.random();
        assert.equal(r.seed, i,
            `after ${i} calls, seed must be ${i}; got ${r.seed}`);
    }
});

// ---------------------------------------------------------------------------
// Edge cases — negative / zero / non-integer seeds
// ---------------------------------------------------------------------------

test('SeededRandom — seed=0 works (Math.sin(0) = 0; fractional of 0 = 0)', () => {
    // Math.sin(0) = 0 → 0 * 10000 = 0 → 0 - floor(0) = 0
    // Pinned: returning EXACTLY 0 is allowed by the [0, 1) contract.
    const r = new SeededRandom(0);
    const first = r.random();
    assert.equal(first, 0,
        `SeededRandom(0).random() === 0 (Math.sin(0)*10000 - floor = 0)`);
    // Subsequent calls advance seed → non-zero outputs.
    assert.notEqual(r.random(), 0);
});

test('SeededRandom — negative seed works (no throw, in [0, 1))', () => {
    const r = new SeededRandom(-100);
    for (let i = 0; i < 5; i++) {
        const v = r.random();
        assert.ok(v >= 0 && v < 1,
            `negative seed produced out-of-range value ${v}`);
    }
});

// ---------------------------------------------------------------------------
// Cross-file consistency — MarketCharts.jsx inline copy MUST match canonical
// ---------------------------------------------------------------------------

test('cross-file — MarketCharts.jsx inline SeededRandom matches the canonical algorithm', () => {
    // Pinned: MarketCharts.jsx duplicates the SeededRandom class inline
    // (with a "// Using the same seeded random as SwapPage" comment).
    // If one drifts from the other, two charts of the same proposal
    // produce different visual jitter — silent UX inconsistency.
    //
    // Approach: extract the inline class body and compare its
    // structural shape to the canonical one. Whitespace-tolerant.
    function normalize(s) {
        return s.replace(/\s+/g, ' ').trim();
    }
    const canonicalClass = CANONICAL_SRC.match(/class SeededRandom\s*\{([\s\S]*?)^\}/m);
    const inlineClass = MARKETCHARTS_SRC.match(/class SeededRandom\s*\{([\s\S]*?)^\}/m);
    assert.ok(canonicalClass, 'canonical SeededRandom class body not found in seededRandom.js');
    assert.ok(inlineClass,
        `MarketCharts.jsx no longer contains an inline SeededRandom class — ` +
        `if it has been removed in favor of an import, this test should be deleted ` +
        `(and the duplication code-smell is fixed).`);
    assert.equal(normalize(inlineClass[1]), normalize(canonicalClass[1]),
        `MarketCharts.jsx inline SeededRandom DRIFTED from canonical seededRandom.js. ` +
        `Two charts of the same proposal will produce different visual jitter. ` +
        `Either re-sync, or import the canonical class instead.`);
});

test('cross-file — both copies use the exact Math.sin(seed++) * 10000 expression', () => {
    // A simpler shape pin: the core PRNG expression. Catches drift in
    // either file independently.
    const re = /Math\.sin\(this\.seed\+\+\)\s*\*\s*10000/;
    assert.match(CANONICAL_SRC, re,
        `canonical seededRandom.js no longer uses Math.sin(this.seed++) * 10000`);
    assert.match(MARKETCHARTS_SRC, re,
        `MarketCharts.jsx no longer uses Math.sin(this.seed++) * 10000`);
});

// ---------------------------------------------------------------------------
// Dead-code surface — MarkdownParser.js has zero callers AND a console.log
// at module load. Pinned for visibility (NOT to fix — the directive
// is leave-bugs-as-tests-only).
// ---------------------------------------------------------------------------

test('MarkdownParser — zero importers (dead module)', () => {
    // Pinned: any import of this file would trigger the bottom-of-file
    // `console.log(html)` to run at module evaluation time. Currently
    // safe because nothing imports it. A regression here = either
    // (a) someone imported the module → `console.log` now runs in
    // production, or (b) the file got deleted (great, this test should
    // be deleted too) or (c) the file was renamed.
    // Caller search is done by grep; this test pins the LACK of import.
    // The actual `grep` is in the loop tooling; here we just sanity
    // check that the file still exists with its identifying shape.
    assert.match(MARKDOWN_PARSER_SRC, /function customMarkdownParser/,
        `MarkdownParser.js shape changed — the dead-code-with-side-effect status may need re-assessment`);
});

test('MarkdownParser — module-level console.log STILL runs at import time (hazard pin)', () => {
    // PINNED HAZARD: lines 60-62 execute `customMarkdownParser(...)` and
    // `console.log(html)` at module evaluation time. If anyone ever
    // imports this module, those lines run unconditionally.
    //
    // Per the /loop directive: leave the bug, pin it. If the file is
    // ever cleaned up (the demo block removed) this test will fail
    // and we delete it.
    assert.match(MARKDOWN_PARSER_SRC,
        /^[\s]*const html = customMarkdownParser\(markdownMetrics\);[\s]*\n[\s]*console\.log\(html\);/m,
        `MarkdownParser.js hazard pin: module-level console.log no longer present. ` +
        `Either the demo block was removed (good — delete this test) or it was ` +
        `restructured (re-pin under the new shape).`);
});

test('MarkdownParser — has a default export (any consumer would get the parser)', () => {
    assert.match(MARKDOWN_PARSER_SRC, /export\s+default\s+customMarkdownParser/);
});
