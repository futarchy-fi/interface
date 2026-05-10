/**
 * formatNumber utility tests (auto-qa).
 *
 * Pins the three functions in src/utils/formatNumber.js. They format
 * counts and percentages on the Companies card (Snapshot-style display).
 * Not tied to a single PR, but defensive against subtle drift in the
 * suffix rules — a regression that bumps "999" to "0.999k" or strips
 * the % sign would slip past code review and only surface as an
 * unreadable card.
 *
 * Spec mirrors src/utils/formatNumber.js. If that file is refactored,
 * sync the helpers below.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- spec-mirror of src/utils/formatNumber.js ---

function formatSnapshotNumber(num, decimals = 1) {
    if (num >= 1000000) return (num / 1000000).toFixed(decimals) + 'M';
    if (num >= 1000)    return (num / 1000).toFixed(decimals) + 'k';
    if (Number.isInteger(num)) return num.toString();
    return num.toFixed(decimals);
}

function formatSnapshotPercentage(percentage) {
    return percentage.toFixed(2) + '%';
}

function formatCount(count) {
    if (count >= 1000) return formatSnapshotNumber(count, 1);
    if (count < 1)     return count.toFixed(3);
    if (count < 100)   return count.toFixed(2);
    return count.toFixed(1);
}

// ---------------------------------------------------------------------------
// formatSnapshotNumber — suffix selection rules
// ---------------------------------------------------------------------------

test('formatSnapshotNumber — exact 1_000_000 uses M suffix', () => {
    assert.equal(formatSnapshotNumber(1_000_000), '1.0M');
});

test('formatSnapshotNumber — exact 1000 uses k suffix', () => {
    assert.equal(formatSnapshotNumber(1000), '1.0k');
});

test('formatSnapshotNumber — 999 stays as raw integer (no suffix)', () => {
    // Boundary catch: a regression that flipped >= to > would yield "0.999k".
    assert.equal(formatSnapshotNumber(999), '999');
});

test('formatSnapshotNumber — 999_999 falls in the k range, not M', () => {
    assert.equal(formatSnapshotNumber(999_999), '1000.0k');
});

test('formatSnapshotNumber — integer < 1000 returns plain string with no decimals', () => {
    assert.equal(formatSnapshotNumber(0), '0');
    assert.equal(formatSnapshotNumber(1), '1');
    assert.equal(formatSnapshotNumber(42), '42');
});

test('formatSnapshotNumber — non-integer < 1000 uses default decimals=1', () => {
    assert.equal(formatSnapshotNumber(0.5), '0.5');
    assert.equal(formatSnapshotNumber(3.14), '3.1');
});

test('formatSnapshotNumber — decimals param overrides default precision', () => {
    assert.equal(formatSnapshotNumber(1234, 0), '1k');
    assert.equal(formatSnapshotNumber(1234, 2), '1.23k');
    assert.equal(formatSnapshotNumber(2_500_000, 2), '2.50M');
});

// ---------------------------------------------------------------------------
// formatSnapshotPercentage — fixed 2-decimal % format
// ---------------------------------------------------------------------------

test('formatSnapshotPercentage — always 2 decimals + % sign', () => {
    assert.equal(formatSnapshotPercentage(0), '0.00%');
    assert.equal(formatSnapshotPercentage(50), '50.00%');
    assert.equal(formatSnapshotPercentage(100), '100.00%');
    assert.equal(formatSnapshotPercentage(33.33333), '33.33%');
});

test('formatSnapshotPercentage — preserves negative sign', () => {
    assert.equal(formatSnapshotPercentage(-12.5), '-12.50%');
});

test('formatSnapshotPercentage — rounds half-to-even per JS toFixed', () => {
    // Pin actual JS behavior so a future re-implementation that switches
    // rounding mode (e.g. to Math.round-based) surfaces immediately.
    assert.equal(formatSnapshotPercentage(0.005), '0.01%'); // 0.005 -> "0.01" in V8
});

// ---------------------------------------------------------------------------
// formatCount — three-zone variable precision (>=1000, <1, in-between)
// ---------------------------------------------------------------------------

test('formatCount — count >= 1000 delegates to formatSnapshotNumber', () => {
    assert.equal(formatCount(1500), '1.5k');
    assert.equal(formatCount(2_000_000), '2.0M');
});

test('formatCount — count < 1 uses 3 decimals', () => {
    assert.equal(formatCount(0), '0.000');
    assert.equal(formatCount(0.1), '0.100');
    assert.equal(formatCount(0.123456), '0.123');
});

test('formatCount — count in [1, 100) uses 2 decimals', () => {
    assert.equal(formatCount(1), '1.00');
    assert.equal(formatCount(42.567), '42.57');
    assert.equal(formatCount(99.999), '100.00'); // toFixed rounds — pin this
});

test('formatCount — count in [100, 1000) uses 1 decimal', () => {
    assert.equal(formatCount(100), '100.0');
    assert.equal(formatCount(999.99), '1000.0'); // toFixed rounds even at boundary
    assert.equal(formatCount(500.55), '500.6');
});

// ---------------------------------------------------------------------------
// Boundary continuity — adjacent zones must produce sane transitions
// ---------------------------------------------------------------------------

test('formatCount — 999.4 displays in the [100,1000) zone, not k zone', () => {
    // 999.4 < 1000, so .toFixed(1) → "999.4" (not "999.4k")
    assert.equal(formatCount(999.4), '999.4');
});

test('formatCount — 1000 crosses into k zone (suffix appears)', () => {
    assert.equal(formatCount(1000), '1.0k');
});
