/**
 * isSafeWallet detection spec mirror (auto-qa).
 *
 * Pins src/utils/ethersAdapters.js:isSafeWallet — used by
 * AddLiquidityModal and ConfirmSwapModal to gate Safe-specific tx
 * flows. The function has THREE independent detection paths:
 *
 *   1. Wagmi connector: name OR id contains "safe" OR name contains "gnosis"
 *   2. window.ethereum: isSafe===true OR isSafeApp===true
 *   3. document.referrer: contains "safe.global"
 *
 * If ANY path matches → returns true. The detection is intentionally
 * permissive because false positives are harmless (Safe flow gracefully
 * degrades) but false negatives skip the Safe-specific waitForSafeTxReceipt
 * flow and the user sees a tx hash that never confirms.
 *
 * Spec mirrors the function. Globals (window, document) are stubbed
 * via globalThis assignments per test (cleanup after each).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- spec mirror ---

function isSafeWallet(walletClient) {
    const connectorName = walletClient?.connector?.name?.toLowerCase() || '';
    const connectorId = walletClient?.connector?.id?.toLowerCase() || '';

    if (connectorName.includes('safe') || connectorId.includes('safe') || connectorName.includes('gnosis')) {
        return true;
    }
    if (typeof window !== 'undefined' && window.ethereum) {
        if (window.ethereum.isSafe === true) return true;
        if (window.ethereum.isSafeApp === true) return true;
    }
    if (typeof document !== 'undefined' && document.referrer?.includes('safe.global')) {
        return true;
    }
    return false;
}

// Test isolation helpers — set/reset globalThis.window and globalThis.document
function withGlobals({ ethereum, referrer }, fn) {
    const origWindow = globalThis.window;
    const origDocument = globalThis.document;
    try {
        if (ethereum !== undefined) globalThis.window = { ethereum };
        if (referrer !== undefined) globalThis.document = { referrer };
        return fn();
    } finally {
        globalThis.window = origWindow;
        globalThis.document = origDocument;
    }
}

// ---------------------------------------------------------------------------
// Path 1: Wagmi connector
// ---------------------------------------------------------------------------

test('isSafeWallet — connector.name contains "safe" → true', () => {
    assert.equal(isSafeWallet({ connector: { name: 'Safe Wallet' } }), true);
    assert.equal(isSafeWallet({ connector: { name: 'safe' } }), true);
});

test('isSafeWallet — connector.name case-insensitive (SAFE, sAfE)', () => {
    // .toLowerCase() applied before .includes() — regression that
    // drops the lowercase would miss connectors named e.g. "SAFE Wallet".
    assert.equal(isSafeWallet({ connector: { name: 'SAFE Wallet' } }), true);
    assert.equal(isSafeWallet({ connector: { name: 'sAfE' } }), true);
});

test('isSafeWallet — connector.id contains "safe" → true', () => {
    assert.equal(isSafeWallet({ connector: { id: 'safe-connector' } }), true);
    assert.equal(isSafeWallet({ connector: { id: 'SAFE_APPS' } }), true);
});

test('isSafeWallet — connector.name contains "gnosis" → true (Safe ↔ Gnosis Safe historic)', () => {
    // Pinned: "gnosis" matches in name only (not id). This is because
    // historically Safe was called "Gnosis Safe" and some connectors
    // still use the old name.
    assert.equal(isSafeWallet({ connector: { name: 'Gnosis Safe Wallet' } }), true);
    assert.equal(isSafeWallet({ connector: { name: 'gnosis' } }), true);
});

test('isSafeWallet — connector.id contains "gnosis" alone does NOT trigger (name-only check)', () => {
    // Pinned current behavior: the "gnosis" check is only on name, not id.
    // This is asymmetric with the "safe" check. Documenting via test.
    const r = isSafeWallet({ connector: { id: 'gnosis-chain-rpc', name: 'Some Wallet' } });
    assert.equal(r, false,
        `current behavior: "gnosis" check only on name, not id. ` +
        `If we ever add it to id check too, this test pin guides the deliberate update.`);
});

// ---------------------------------------------------------------------------
// Defensive guards
// ---------------------------------------------------------------------------

test('isSafeWallet — null/undefined walletClient does NOT throw', () => {
    // Optional chaining defends both .connector?.name and .connector?.id.
    assert.doesNotThrow(() => isSafeWallet(null));
    assert.doesNotThrow(() => isSafeWallet(undefined));
});

test('isSafeWallet — walletClient with no connector → falls through to global checks', () => {
    // No throw, falls through to window/document checks (which return false in default env).
    const r = withGlobals({}, () => isSafeWallet({}));
    assert.equal(r, false);
});

test('isSafeWallet — walletClient with empty connector → falls through to false', () => {
    const r = withGlobals({}, () => isSafeWallet({ connector: {} }));
    assert.equal(r, false);
});

// ---------------------------------------------------------------------------
// Path 2: window.ethereum.isSafe / isSafeApp
// ---------------------------------------------------------------------------

test('isSafeWallet — window.ethereum.isSafe === true → true', () => {
    const r = withGlobals(
        { ethereum: { isSafe: true } },
        () => isSafeWallet({})
    );
    assert.equal(r, true);
});

test('isSafeWallet — window.ethereum.isSafeApp === true → true', () => {
    const r = withGlobals(
        { ethereum: { isSafeApp: true } },
        () => isSafeWallet({})
    );
    assert.equal(r, true);
});

test('isSafeWallet — window.ethereum.isSafe must be STRICTLY === true (truthy is not enough)', () => {
    // Pinned: the check is `=== true`, not just truthy. A "safe" string
    // or 1 wouldn't trigger. Defensive against frame providers that
    // return non-boolean values.
    const r1 = withGlobals(
        { ethereum: { isSafe: 'true' } },
        () => isSafeWallet({})
    );
    assert.equal(r1, false, `string "true" must NOT match strict === true`);
    const r2 = withGlobals(
        { ethereum: { isSafe: 1 } },
        () => isSafeWallet({})
    );
    assert.equal(r2, false, `number 1 must NOT match strict === true`);
});

test('isSafeWallet — window.ethereum without isSafe/isSafeApp → false (in absence of other paths)', () => {
    const r = withGlobals(
        { ethereum: { isMetaMask: true } },
        () => isSafeWallet({})
    );
    assert.equal(r, false);
});

// ---------------------------------------------------------------------------
// Path 3: document.referrer
// ---------------------------------------------------------------------------

test('isSafeWallet — document.referrer contains "safe.global" → true', () => {
    const r = withGlobals(
        { referrer: 'https://app.safe.global/foo' },
        () => isSafeWallet({})
    );
    assert.equal(r, true);
});

test('isSafeWallet — document.referrer is empty → false (no path 3 match)', () => {
    const r = withGlobals(
        { referrer: '' },
        () => isSafeWallet({})
    );
    assert.equal(r, false);
});

test('isSafeWallet — document.referrer is unrelated → false', () => {
    const r = withGlobals(
        { referrer: 'https://twitter.com/somewhere' },
        () => isSafeWallet({})
    );
    assert.equal(r, false);
});

test('isSafeWallet — document undefined does NOT throw (typeof guard)', () => {
    // Path 3 only fires if document exists. SSR / non-browser env should
    // not crash on the function call.
    const origDoc = globalThis.document;
    delete globalThis.document;
    try {
        assert.doesNotThrow(() => isSafeWallet({}));
        assert.equal(isSafeWallet({}), false);
    } finally {
        globalThis.document = origDoc;
    }
});

// ---------------------------------------------------------------------------
// Combined: any path matches → true (OR semantics)
// ---------------------------------------------------------------------------

test('isSafeWallet — connector path wins even if other paths would also match', () => {
    // Doesn't matter which short-circuits — result is still true.
    const r = withGlobals(
        { ethereum: { isSafe: true }, referrer: 'https://safe.global/' },
        () => isSafeWallet({ connector: { name: 'Safe' } })
    );
    assert.equal(r, true);
});

test('isSafeWallet — all three paths false → returns false', () => {
    const r = withGlobals(
        { ethereum: { isMetaMask: true }, referrer: 'https://other.com/' },
        () => isSafeWallet({ connector: { name: 'MetaMask', id: 'metamask' } })
    );
    assert.equal(r, false);
});
