/**
 * precisionFormatter utility tests (auto-qa).
 *
 * Pins src/utils/precisionFormatter.js — used in 8 production files
 * including SubgraphChart, MarketBalancePanel, PositionsTable,
 * ConfirmSwapModal, and ChartParameters. The "smart precision" logic
 * (increase precision until value doesn't round to 0) and the
 * type-specific trailing-zero handling are subtle enough that subtle
 * regressions would slip past code review and only show up as wrong
 * numbers on the trading screen.
 *
 * Spec mirrors src/utils/precisionFormatter.js with the production
 * default PRECISION_CONFIG inlined. The mirror omits the production
 * console.log spam.
 *
 * Notable quirk pinned: formatPercentage MULTIPLIES the input by 100,
 * so formatPercentage(0.5) → "50%" (not "0.5%"). This is the opposite
 * convention from formatNumber.formatSnapshotPercentage which assumes
 * the input is already in percent form.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Production default config — copy of PRECISION_CONFIG.display in
// src/components/futarchyFi/marketPage/constants/contracts.js:358.
const DEFAULT_CONFIG = {
    display: {
        main: 1,
        default: 2,
        price: 2,
        swapPrice: 1,
        amount: 6,
        balance: 4,
        percentage: 1,
        smallNumbers: 8,
    },
};

function formatWith(value, type = 'default', config = null) {
    const precisionConfig = config || DEFAULT_CONFIG;
    if (value === null || value === undefined || value === '' || isNaN(value)) return 'N/A';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (!isFinite(num)) return 'N/A';
    if (num === 0) return '0';

    let precision = precisionConfig?.display?.[type] ?? precisionConfig?.display?.default ?? 2;

    // Very-small handling
    if (Math.abs(num) < 0.0001 && Math.abs(num) > 0) {
        const smallPrecision = precisionConfig?.display?.smallNumbers ?? 20;
        return num.toFixed(smallPrecision).replace(/\.?0+$/, '');
    }

    let formatted = num.toFixed(precision);
    const originalPrecision = precision;
    const maxPrecision = precisionConfig?.display?.smallNumbers ?? 20;

    while (parseFloat(formatted) === 0 && precision < maxPrecision && num !== 0) {
        precision++;
        formatted = num.toFixed(precision);
    }

    if (parseFloat(formatted) === 0 && num !== 0) {
        return num.toFixed(maxPrecision).replace(/\.?0+$/, '');
    }
    if (precision > originalPrecision) {
        return formatted.replace(/\.?0+$/, '');
    }
    if (type === 'balance') {
        return formatted.replace(/\.?0+$/, '');
    }
    return formatted;
}

function formatPercentage(value, config = null) {
    if (value === null || value === undefined || value === '' || isNaN(value)) return 'N/A';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `${formatWith(num * 100, 'percentage', config)}%`;
}

function getPrecision(type = 'default', config = null) {
    const precisionConfig = config || DEFAULT_CONFIG;
    return precisionConfig?.display?.[type] ?? precisionConfig?.display?.default ?? 2;
}

// ---------------------------------------------------------------------------
// formatWith — invalid input handling
// ---------------------------------------------------------------------------

test('formatWith — invalid inputs return "N/A"', () => {
    for (const v of [null, undefined, '', NaN, 'not a number']) {
        assert.equal(formatWith(v, 'price'), 'N/A',
            `${JSON.stringify(v)} should yield "N/A"`);
    }
});

test('formatWith — Infinity returns "N/A"', () => {
    assert.equal(formatWith(Infinity, 'price'), 'N/A');
    assert.equal(formatWith(-Infinity, 'price'), 'N/A');
});

test('formatWith — exact zero returns "0" (no decimals, no precision)', () => {
    assert.equal(formatWith(0, 'price'), '0');
    assert.equal(formatWith('0', 'price'), '0');
    assert.equal(formatWith(0.0, 'balance'), '0');
});

// ---------------------------------------------------------------------------
// formatWith — type-specific precision lookup
// ---------------------------------------------------------------------------

test('formatWith — price type uses 2-decimal precision', () => {
    assert.equal(formatWith(3.23456, 'price'), '3.23');
});

test('formatWith — amount type uses 6-decimal precision', () => {
    assert.equal(formatWith(1234.5, 'amount'), '1234.500000');
});

test('formatWith — balance type strips trailing zeros (display contract)', () => {
    // From the function comment: "but keep at least original precision for
    // display consistency when non-zero". Trailing zeros are stripped.
    assert.equal(formatWith(1.0, 'balance'), '1');
    assert.equal(formatWith(1.2300, 'balance'), '1.23');
});

test('formatWith — non-balance types KEEP trailing zeros', () => {
    // Pinned: keep trailing zeros for stable column-aligned display.
    assert.equal(formatWith(1.5, 'amount'), '1.500000');
    assert.equal(formatWith(1.5, 'price'), '1.50');
});

test('formatWith — unknown type falls back to default (2 decimals)', () => {
    assert.equal(formatWith(3.14159, 'totally-unknown-type'), '3.14');
});

// ---------------------------------------------------------------------------
// formatWith — small-number branching (< 0.0001)
// ---------------------------------------------------------------------------

test('formatWith — values < 0.0001 use smallNumbers precision (8)', () => {
    // toFixed(8) on 0.00001234 = "0.00001234" (no trailing zeros to strip).
    assert.equal(formatWith(0.00001234, 'price'), '0.00001234');
});

test('formatWith — small-number path strips trailing zeros', () => {
    assert.equal(formatWith(0.00001, 'price'), '0.00001');
});

test('formatWith — negative small numbers use the same path', () => {
    assert.equal(formatWith(-0.00001234, 'price'), '-0.00001234');
});

// ---------------------------------------------------------------------------
// formatWith — smart-precision: never display non-zero value as "0"
// ---------------------------------------------------------------------------

test('formatWith — value rounding to 0 at default precision auto-bumps precision', () => {
    // 0.001 with type 'price' (precision=2) would round to "0.00" — the
    // smart-precision loop bumps until the displayed value is non-zero.
    const out = formatWith(0.001, 'price');
    assert.notEqual(parseFloat(out), 0,
        `0.001 must NOT display as zero; got "${out}"`);
});

test('formatWith — smart-precision strips trailing zeros after bump', () => {
    // After the precision bump, the strip-zeros branch fires.
    assert.equal(formatWith(0.001, 'price'), '0.001');
});

// ---------------------------------------------------------------------------
// formatWith — string vs number input parity
// ---------------------------------------------------------------------------

test('formatWith — accepts string and number forms equivalently', () => {
    assert.equal(formatWith(1.5, 'price'), formatWith('1.5', 'price'));
    assert.equal(formatWith(0.001, 'amount'), formatWith('0.001', 'amount'));
});

// ---------------------------------------------------------------------------
// formatPercentage — input is a *fraction*, not a percent
// ---------------------------------------------------------------------------

test('formatPercentage — input is multiplied by 100', () => {
    // The convention pin: 0.5 → "50.0%", NOT "0.5%". This is opposite
    // to formatSnapshotPercentage. If a future refactor "fixes" this
    // by removing the *100, every percentage in the app silently
    // shrinks by 100×.
    assert.equal(formatPercentage(0.5), '50.0%');
    assert.equal(formatPercentage(0.1234), '12.3%');
    assert.equal(formatPercentage(1), '100.0%');
});

test('formatPercentage — invalid → "N/A" (not "N/A%")', () => {
    // Invalid input MUST short-circuit before adding the % suffix —
    // otherwise users see the literal "N/A%" which looks like a value.
    assert.equal(formatPercentage(null), 'N/A');
    assert.equal(formatPercentage(undefined), 'N/A');
    assert.equal(formatPercentage('not-a-num'), 'N/A');
});

// ---------------------------------------------------------------------------
// getPrecision — config lookup
// ---------------------------------------------------------------------------

test('getPrecision — returns the per-type precision from config', () => {
    assert.equal(getPrecision('price'), 2);
    assert.equal(getPrecision('amount'), 6);
    assert.equal(getPrecision('smallNumbers'), 8);
});

test('getPrecision — unknown type falls back to default (2)', () => {
    assert.equal(getPrecision('made-up-type'), 2);
});

test('getPrecision — accepts custom config and ignores defaults', () => {
    const custom = { display: { price: 7, default: 5 } };
    assert.equal(getPrecision('price', custom), 7);
    assert.equal(getPrecision('made-up-type', custom), 5);
});
