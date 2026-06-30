/**
 * SDAI rate config + convertSdaiToUsd spec mirror (auto-qa).
 *
 * Pins src/utils/getSdaiRate.js — used via useSdaiRate hook in
 * MarketPageShowcase to convert sDAI prices to USD-equivalents.
 *
 * Three layers:
 *   1. SDAI_CONTRACT_RATE address (canonical sDAI rate provider on
 *      Gnosis — must equal the same constant on the api side)
 *   2. CACHE_DURATION = 5 min (must match the api side cache to keep
 *      the two services consistent on rate updates)
 *   3. convertSdaiToUsd pure function — null guards + multiplication
 *
 * Pinned cross-file consistency: SDAI_CONTRACT_RATE in interface
 * must equal CHAIN_CONFIG[100].defaultRateProvider in api repo.
 * See `auto-qa/tests/rate-provider-config.test.mjs` in futarchy-api
 * for the api-side pin.
 *
 * Notable surfaced quirk (not fixed per directive): fetchSdaiRate
 * uses ethers v5 `ethers.utils.parseUnits` / `formatUnits` API while
 * the installed ethers is v6. The function lives behind a try/catch
 * that returns the 1.02 default on error — so it currently silently
 * returns 1.02 in production for every call (same family of dead-code
 * issue as src/utils/formatters.js). Documented in PROGRESS.md.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(
    new URL('../../src/utils/getSdaiRate.js', import.meta.url),
    'utf8',
);

// --- spec mirror of convertSdaiToUsd ---
function convertSdaiToUsd(sdaiAmount, sdaiRate) {
    if (sdaiAmount === null || sdaiAmount === undefined || sdaiRate === null || sdaiRate === undefined) {
        return null;
    }
    return sdaiAmount * sdaiRate;
}

// ---------------------------------------------------------------------------
// SDAI_CONTRACT_RATE — canonical sDAI rate provider on Gnosis
// ---------------------------------------------------------------------------

const CANONICAL_SDAI_RATE_PROVIDER = '0x89C80A4540A00b5270347E02e2E144c71da2EceD';

test('sdai-rate — SDAI_CONTRACT_RATE is the canonical sDAI rate provider on Gnosis', () => {
    const m = SRC.match(/SDAI_CONTRACT_RATE\s*=\s*['"]([^'"]+)['"]/);
    assert.ok(m, 'SDAI_CONTRACT_RATE not found');
    assert.equal(m[1], CANONICAL_SDAI_RATE_PROVIDER,
        `SDAI_CONTRACT_RATE drifted from canonical sDAI rate provider on Gnosis. ` +
        `MUST also equal CHAIN_CONFIG[100].defaultRateProvider in futarchy-api/src/services/rate-provider.js. ` +
        `Drift between the two repos would cause the api and the frontend to convert sDAI at different rates.`);
});

// ---------------------------------------------------------------------------
// CACHE_DURATION — 5 minutes
// ---------------------------------------------------------------------------

test('sdai-rate — CACHE_DURATION is 5 * 60 * 1000 ms (5 min, matches api side)', () => {
    // Both sides cache for 5 min. Mismatch would mean the frontend and
    // api show different rates for up to a few minutes after an update.
    assert.match(SRC, /CACHE_DURATION\s*=\s*5\s*\*\s*60\s*\*\s*1000/,
        `CACHE_DURATION drifted from 5 * 60 * 1000 (5 min). ` +
        `Must match futarchy-api rate-provider CACHE_DURATION.`);
});

// ---------------------------------------------------------------------------
// Default fallback rate (1.02)
// ---------------------------------------------------------------------------

test('sdai-rate — fallback default is 1.02 (used in 3 error paths)', () => {
    // The function returns 1.02 in three places: no provider, contract
    // error, critical error. All three paths must use the same value.
    // Count appearances; 1.02 should show up at least 3 times in the
    // source (not counting the docstring).
    const occurrences = (SRC.match(/1\.02/g) || []).length;
    assert.ok(occurrences >= 3,
        `expected at least 3 occurrences of "1.02" (fallback in 3 error paths + parseUnits init); got ${occurrences}`);
});

// ---------------------------------------------------------------------------
// convertSdaiToUsd — pure function
// ---------------------------------------------------------------------------

test('convertSdaiToUsd — null sdaiAmount returns null', () => {
    assert.equal(convertSdaiToUsd(null, 1.02), null);
    assert.equal(convertSdaiToUsd(undefined, 1.02), null);
});

test('convertSdaiToUsd — null sdaiRate returns null', () => {
    assert.equal(convertSdaiToUsd(100, null), null);
    assert.equal(convertSdaiToUsd(100, undefined), null);
});

test('convertSdaiToUsd — happy path: sdaiAmount * sdaiRate', () => {
    assert.equal(convertSdaiToUsd(100, 1.02), 102);
    assert.equal(convertSdaiToUsd(50, 1.5), 75);
});

test('convertSdaiToUsd — zero amount returns 0', () => {
    // Critical pin: 0 must NOT be treated as falsy → null. The function
    // uses explicit null/undefined checks, so 0 should pass through.
    assert.equal(convertSdaiToUsd(0, 1.02), 0);
});

test('convertSdaiToUsd — zero rate returns 0', () => {
    assert.equal(convertSdaiToUsd(100, 0), 0);
});

test('convertSdaiToUsd — negative inputs work (no clamping)', () => {
    // Pinned current behavior: no clamping. Negative amounts/rates
    // pass through (callers are responsible for sign handling).
    assert.equal(convertSdaiToUsd(-100, 1.02), -102);
    assert.equal(convertSdaiToUsd(100, -1.02), -102);
});

// ---------------------------------------------------------------------------
// SDAI_RATE_PROVIDER_ABI — must contain getRate() with uint256 output
// ---------------------------------------------------------------------------

test('sdai-rate — ABI contains getRate() returning uint256', () => {
    // Sanity that the ABI matches the contract surface. A typo here
    // (e.g. "Rate" instead of "getRate") would silently make the call
    // fail and the function would return 1.02.
    assert.match(SRC, /"name":\s*"getRate"/, `ABI missing "getRate" name`);
    assert.match(SRC, /"type":\s*"uint256"/, `ABI missing uint256 output type`);
    assert.match(SRC, /"stateMutability":\s*"view"/, `ABI missing "view" mutability`);
});

// ---------------------------------------------------------------------------
// 18-decimal scaling (matches api side)
// ---------------------------------------------------------------------------

test('sdai-rate — uses 18-decimal scaling for sDAI', () => {
    assert.match(SRC, /currencyDecimals\s*=\s*18/,
        `sdai-rate must use 18 decimals (sDAI standard); drift would scale rates wrongly`);
});

// ---------------------------------------------------------------------------
// Timeout protection on getRate call
// ---------------------------------------------------------------------------

test('sdai-rate — getRate call has 10-second timeout protection', () => {
    // Pin the timeout so that an upstream RPC stall doesn't hang the
    // chart render. A regression that removes Promise.race() would
    // cause the page to spin until the user closes it.
    assert.match(SRC, /Promise\.race/, `getRate must use Promise.race for timeout protection`);
    assert.match(SRC, /10000/, `timeout literal (10000ms) not found`);
});
