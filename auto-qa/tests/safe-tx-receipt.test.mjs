/**
 * waitForSafeTxReceipt config + behavior spec mirror (auto-qa).
 *
 * Pins src/utils/waitForSafeTxReceipt.js — the polling helper used by
 * RedemptionModal, CollateralModal, and ConfirmSwapModal to track
 * Safe (Gnosis Safe) multisig transaction execution.
 *
 * Critical pinned values:
 *   SAFE_TX_SERVICE_URLS — chain ID → Safe Transaction Service URL map
 *   timeoutMs default    — 120s (2 min) before giving up
 *   pollIntervalMs       — 4s between Safe API polls
 *
 * Bug class this catches: a typo in the Safe service URL silently
 * breaks Safe transaction tracking — the function throws after
 * timeout with no clear indication that the URL was wrong. Plus the
 * "404 = retry; other = throw" error-handling rule is subtle and
 * easily broken by a refactor.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(
    new URL('../../src/utils/waitForSafeTxReceipt.js', import.meta.url),
    'utf8',
);

// ---------------------------------------------------------------------------
// SAFE_TX_SERVICE_URLS — chain ID → URL map
// ---------------------------------------------------------------------------

test('safe-tx — SAFE_TX_SERVICE_URLS has Ethereum mainnet (chain 1)', () => {
    assert.match(SRC,
        /1\s*:\s*['"]https:\/\/safe-transaction-mainnet\.safe\.global['"]/,
        `chain 1 missing canonical safe-transaction-mainnet URL`);
});

test('safe-tx — SAFE_TX_SERVICE_URLS has Gnosis Chain (chain 100)', () => {
    // Gnosis is the primary chain for futarchy. URL drift breaks every
    // futarchy multisig tx that uses Safe.
    assert.match(SRC,
        /100\s*:\s*['"]https:\/\/safe-transaction-gnosis-chain\.safe\.global['"]/,
        `chain 100 missing canonical safe-transaction-gnosis-chain URL`);
});

test('safe-tx — SAFE_TX_SERVICE_URLS has Sepolia testnet (chain 11155111)', () => {
    assert.match(SRC,
        /11155111\s*:\s*['"]https:\/\/safe-transaction-sepolia\.safe\.global['"]/,
        `chain 11155111 (Sepolia) missing canonical URL`);
});

test('safe-tx — every URL in the map is HTTPS and points at safe.global', () => {
    // Defensive sweep: extract every URL value from the map.
    const m = SRC.match(/SAFE_TX_SERVICE_URLS\s*=\s*\{([^}]+)\}/);
    assert.ok(m, 'SAFE_TX_SERVICE_URLS map not found');
    const urls = [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map(x => x[1]);
    assert.ok(urls.length >= 3, `expected at least 3 URLs; got ${urls.length}`);
    for (const url of urls) {
        assert.match(url, /^https:\/\//, `URL not HTTPS: ${url}`);
        assert.match(url, /\.safe\.global$/, `URL not on safe.global: ${url}`);
    }
});

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

test('safe-tx — timeoutMs default is 120_000 (2 min)', () => {
    // Pinned: 2 min should be enough for indexing + execution. Drift
    // shorter would cause spurious "tx didn't execute" errors;
    // drift longer would hang the modal indefinitely.
    assert.match(SRC, /timeoutMs\s*=\s*120_?000/,
        `timeoutMs default drifted from 120_000 (2 min)`);
});

test('safe-tx — pollIntervalMs default is 4_000 (4 sec)', () => {
    // 4s is a balance between responsiveness and Safe API load.
    assert.match(SRC, /pollIntervalMs\s*=\s*4_?000/,
        `pollIntervalMs default drifted from 4_000 (4 sec)`);
});

// ---------------------------------------------------------------------------
// Error handling logic — 404 retries, other errors throw
// ---------------------------------------------------------------------------

test('safe-tx — 404 from Safe API is treated as "still indexing" (retry)', () => {
    // Critical pin: before the Safe service indexes a freshly-submitted
    // tx, getTransaction returns 404. The poll loop must keep retrying.
    // A refactor that throws on all errors would surface the 404 as a
    // hard failure during the brief indexing window.
    assert.match(SRC,
        /if\s*\(\s*err\?\.response\?\.status\s*!==\s*404\s*\)\s*\{[\s\S]*?throw\s+err/,
        `404 retry logic missing — must NOT throw on 404`);
});

test('safe-tx — non-404 errors are re-thrown', () => {
    // The flip-side: a real error (5xx, network failure, malformed
    // response) MUST throw out of the poll loop. The implementation
    // does this via the same "if !== 404" branch above.
    assert.match(SRC,
        /catch\s*\(\s*err\s*\)[\s\S]*?if\s*\(\s*err\?\.response\?\.status\s*!==\s*404\s*\)/,
        `error path doesn't compare against 404 — non-404 errors won't surface`);
});

// ---------------------------------------------------------------------------
// Throws on unsupported chain
// ---------------------------------------------------------------------------

test('safe-tx — throws on unsupported chainId', () => {
    // Hard fail (not retry) when chainId isn't in the URL map.
    assert.match(SRC,
        /if\s*\(\s*!txServiceUrl\s*\)\s*\{[\s\S]*?throw new Error/,
        `unsupported chainId must throw immediately, not enter poll loop`);
});

// ---------------------------------------------------------------------------
// Status callback contract
// ---------------------------------------------------------------------------

test('safe-tx — onStatus callback uses optional chaining (?.)', () => {
    // The caller can omit onStatus. Optional-chain ensures missing
    // callback doesn't throw.
    assert.match(SRC, /onStatus\?\.\(/,
        `onStatus must use ?.() optional chaining so callers can omit it`);
});

test('safe-tx — emits POLLING_SAFE_API status before first poll', () => {
    assert.match(SRC, /status:\s*['"]POLLING_SAFE_API['"]/);
});

test('safe-tx — emits PENDING_EXECUTION status when tx not yet executed', () => {
    assert.match(SRC, /status:\s*['"]PENDING_EXECUTION['"]/);
});

test('safe-tx — emits EXECUTED_ON_CHAIN status when transactionHash appears', () => {
    assert.match(SRC, /status:\s*['"]EXECUTED_ON_CHAIN['"]/);
});

test('safe-tx — emits CONFIRMED status after viem block confirmation', () => {
    assert.match(SRC, /status:\s*['"]CONFIRMED['"]/);
});

test('safe-tx — emits WAITING_FOR_INDEXING status during 404 retry', () => {
    assert.match(SRC, /status:\s*['"]WAITING_FOR_INDEXING['"]/);
});

// ---------------------------------------------------------------------------
// Execution detection: transactionHash field presence
// ---------------------------------------------------------------------------

test('safe-tx — execution detected by safeTx.transactionHash being truthy', () => {
    // Safe's API fills in `transactionHash` only after on-chain
    // execution. The poll loop checks this field. A refactor that
    // checks `isExecuted` instead would have a small race window
    // (Safe sets isExecuted before the hash is propagated).
    assert.match(SRC, /if\s*\(\s*safeTx\.transactionHash\s*\)/,
        `execution detection must check transactionHash field, not isExecuted`);
});

// ---------------------------------------------------------------------------
// Final viem confirmation step
// ---------------------------------------------------------------------------

test('safe-tx — calls publicClient.waitForTransactionReceipt after Safe execution', () => {
    // After Safe says "executed", we still wait for the on-chain block
    // to confirm via viem. Removing this would return a receipt that
    // might still get reorged out.
    assert.match(SRC,
        /publicClient\.waitForTransactionReceipt\(\s*\{\s*hash:\s*realHash\s*\}\s*\)/,
        `must call publicClient.waitForTransactionReceipt with realHash`);
});

// ---------------------------------------------------------------------------
// Timeout error message
// ---------------------------------------------------------------------------

test('safe-tx — distinguishes "still pending" vs "not indexed" in timeout error', () => {
    // The timeout message branches on lastSafeTx?.isExecuted:
    //   - isExecuted === false → "still pending (needs confirmations)"
    //   - else → "not indexed / not executed"
    // This helps users understand what to do next when they hit timeout.
    assert.match(SRC, /Safe tx still pending/,
        `pending-vs-not-indexed branch missing from timeout error`);
    assert.match(SRC, /Safe tx not indexed/,
        `pending-vs-not-indexed branch missing from timeout error`);
});
