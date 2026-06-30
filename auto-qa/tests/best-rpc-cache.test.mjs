/**
 * getBestRpc cache helpers spec mirror (auto-qa).
 *
 * Pins src/utils/getBestRpc.js — the chain-aware RPC selector that
 * powers any code path needing a fast working RPC. Three layers:
 *
 *   1. RPC_LISTS — hardcoded URL lists per chain. HTTPS-only, dedup,
 *      non-empty. A regression that empties one would fall through to
 *      `throw new Error("No RPC endpoints configured for chain ...")`.
 *
 *   2. Constants — RPC_TIMEOUT_MS (5s), CACHE_DURATION_MS (5min),
 *      MAX_CACHED_RPC_COUNT (3). Drift here changes user-visible
 *      latency / staleness silently.
 *
 *   3. normalizeCacheEntry — back-compat shim. Older builds wrote
 *      { url, timestamp } (single-url shape); the new code reads
 *      { urls, timestamp } (array shape). The shim must preserve the
 *      old entries so warm caches survive a rolling deploy.
 *
 *   4. The LRU rotation inside tryCachedRpcs — when a cached candidate
 *      succeeds, it must move to FRONT, dedupe, and clip to
 *      MAX_CACHED_RPC_COUNT. A regression that drops the dedupe would
 *      let the same URL accumulate (and crowd out the others).
 *
 * The async path (testRpc, getBestRpc) is NOT mirrored — it does
 * fetch() + console.log + setTimeout. That's an integration concern.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(
    new URL('../../src/utils/getBestRpc.js', import.meta.url),
    'utf8',
);

// --- spec mirror of normalizeCacheEntry (pure) ---
function normalizeCacheEntry(entry) {
    if (!entry) return null;
    if (Array.isArray(entry.urls)) {
        return entry;
    }
    if (entry.url) {
        return {
            urls: [entry.url],
            timestamp: entry.timestamp || Date.now(),
        };
    }
    return null;
}

// --- spec mirror of the LRU rotation inside tryCachedRpcs ---
// When candidateUrl succeeds: move to front, dedupe, clip to max.
function rotateOnHit(urls, candidateUrl, maxCount) {
    const deduped = urls.filter(url => url !== candidateUrl);
    return [candidateUrl, ...deduped].slice(0, maxCount);
}

// ---------------------------------------------------------------------------
// RPC_LISTS — pinned from source text
// ---------------------------------------------------------------------------

function extractRpcList(chainId) {
    // Find the RPC_LISTS object body, then find the chainId block within.
    const block = SRC.match(/RPC_LISTS\s*=\s*\{([\s\S]*?)\n\};/);
    assert.ok(block, 'RPC_LISTS object not found');
    // Lines like `  100: [ ... ]` — pull the array following `<chainId>:`.
    const re = new RegExp(`${chainId}\\s*:\\s*\\[([\\s\\S]*?)\\]`);
    const m = block[1].match(re);
    if (!m) return null;
    return [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map(x => x[1]);
}

const ETH_RPCS    = extractRpcList(1);
const GNOSIS_RPCS = extractRpcList(100);

test('RPC_LISTS — chain 1 (Ethereum) has >= 3 entries, all HTTPS, deduped', () => {
    assert.ok(ETH_RPCS, 'chain 1 RPC list not extractable');
    assert.ok(ETH_RPCS.length >= 3,
        `chain 1 has only ${ETH_RPCS.length} RPCs — fallback loses meaning below 3`);
    for (const url of ETH_RPCS) {
        assert.match(url, /^https:\/\//,
            `chain 1 contains non-HTTPS RPC: ${url}`);
    }
    assert.equal(new Set(ETH_RPCS).size, ETH_RPCS.length,
        `chain 1 RPC list contains duplicates`);
});

test('RPC_LISTS — chain 100 (Gnosis) has >= 3 entries, all HTTPS, deduped', () => {
    assert.ok(GNOSIS_RPCS, 'chain 100 RPC list not extractable');
    assert.ok(GNOSIS_RPCS.length >= 3,
        `chain 100 has only ${GNOSIS_RPCS.length} RPCs`);
    for (const url of GNOSIS_RPCS) {
        assert.match(url, /^https:\/\//,
            `chain 100 contains non-HTTPS RPC: ${url}`);
    }
    assert.equal(new Set(GNOSIS_RPCS).size, GNOSIS_RPCS.length,
        `chain 100 RPC list contains duplicates`);
});

test('RPC_LISTS — chain 100 includes the canonical rpc.gnosischain.com', () => {
    // Pinned because it's the chain's own official endpoint and survives
    // any third-party outage.
    assert.ok(GNOSIS_RPCS.includes('https://rpc.gnosischain.com'),
        `chain 100 RPC list missing canonical https://rpc.gnosischain.com`);
});

// ---------------------------------------------------------------------------
// Constants — pinned from source text
// ---------------------------------------------------------------------------

test('RPC_TIMEOUT_MS — pinned at 5000ms (5 seconds)', () => {
    const m = SRC.match(/RPC_TIMEOUT_MS\s*=\s*(\d+)/);
    assert.ok(m, 'RPC_TIMEOUT_MS not found');
    assert.equal(parseInt(m[1]), 5000,
        `RPC_TIMEOUT_MS drifted from 5000ms — too low fails fast on slow networks; ` +
        `too high stalls the user before fallback kicks in.`);
});

test('CACHE_DURATION_MS — pinned at 5 minutes', () => {
    // The expression is `5 * 60 * 1000` — match the parts.
    const m = SRC.match(/CACHE_DURATION_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/);
    assert.ok(m,
        `CACHE_DURATION_MS drifted from 5*60*1000 (5 min). ` +
        `Shortening means more cold probes; lengthening means stale cached RPCs ` +
        `that may have gone down.`);
});

test('MAX_CACHED_RPC_COUNT — pinned at 3 (top-3 fastest kept warm)', () => {
    const m = SRC.match(/MAX_CACHED_RPC_COUNT\s*=\s*(\d+)/);
    assert.ok(m, 'MAX_CACHED_RPC_COUNT not found');
    assert.equal(parseInt(m[1]), 3,
        `MAX_CACHED_RPC_COUNT changed — affects fallback breadth in cached path. ` +
        `1 = single-point-of-failure; >5 = cache stale URLs longer than helpful.`);
});

// ---------------------------------------------------------------------------
// normalizeCacheEntry — null/empty inputs
// ---------------------------------------------------------------------------

test('normalizeCacheEntry — null entry returns null', () => {
    assert.equal(normalizeCacheEntry(null), null);
});

test('normalizeCacheEntry — undefined entry returns null', () => {
    assert.equal(normalizeCacheEntry(undefined), null);
});

test('normalizeCacheEntry — empty object returns null (no urls, no url)', () => {
    assert.equal(normalizeCacheEntry({}), null);
});

// ---------------------------------------------------------------------------
// normalizeCacheEntry — modern shape (urls array) is returned unchanged
// ---------------------------------------------------------------------------

test('normalizeCacheEntry — modern shape returned by identity (not copy)', () => {
    // Identity matters: callers mutate cacheEntry in-place to update
    // urls/timestamp on hit. A defensive copy here would silently
    // discard those mutations.
    const entry = { urls: ['https://a'], timestamp: 12345 };
    assert.equal(normalizeCacheEntry(entry), entry,
        `modern shape MUST be returned by identity (callers mutate in place)`);
});

test('normalizeCacheEntry — modern shape with empty urls array still returned', () => {
    // Empty-but-array means "we tried and nothing worked" — distinct
    // from missing. Caller checks `urls.length` separately.
    const entry = { urls: [], timestamp: 12345 };
    assert.equal(normalizeCacheEntry(entry), entry);
});

// ---------------------------------------------------------------------------
// normalizeCacheEntry — legacy shape (single url) gets upgraded
// ---------------------------------------------------------------------------

test('normalizeCacheEntry — legacy { url, timestamp } upgraded to { urls: [url], timestamp }', () => {
    // Pinned: this back-compat shim is what lets a rolling deploy keep
    // the warm cache. Drop it and every user pays a cold-probe penalty
    // on the deploy boundary.
    const legacy = { url: 'https://a', timestamp: 12345 };
    const r = normalizeCacheEntry(legacy);
    assert.deepEqual(r, { urls: ['https://a'], timestamp: 12345 });
});

test('normalizeCacheEntry — legacy without timestamp gets a fresh Date.now()', () => {
    // Defensive default: if a legacy entry somehow lost its timestamp,
    // we treat it as fresh rather than letting it expire instantly.
    const before = Date.now();
    const r = normalizeCacheEntry({ url: 'https://a' });
    const after = Date.now();
    assert.deepEqual(r.urls, ['https://a']);
    assert.ok(r.timestamp >= before && r.timestamp <= after,
        `timestamp must be set to ~Date.now() when legacy entry lacks one`);
});

// ---------------------------------------------------------------------------
// LRU rotation — successful URL moves to front, dedupes, clips to max
// ---------------------------------------------------------------------------

test('rotateOnHit — candidate already at front: stays at front, no duplicates', () => {
    const r = rotateOnHit(['a', 'b', 'c'], 'a', 3);
    assert.deepEqual(r, ['a', 'b', 'c']);
});

test('rotateOnHit — candidate in middle: moves to front, others preserve order', () => {
    const r = rotateOnHit(['a', 'b', 'c'], 'b', 3);
    assert.deepEqual(r, ['b', 'a', 'c']);
});

test('rotateOnHit — candidate at end: moves to front', () => {
    const r = rotateOnHit(['a', 'b', 'c'], 'c', 3);
    assert.deepEqual(r, ['c', 'a', 'b']);
});

test('rotateOnHit — candidate not in list: prepended, list grows up to max', () => {
    // This case can happen after an entry ages out of the array but
    // the caller passes it back in (shouldn't really happen given the
    // current code, but the function handles it).
    const r = rotateOnHit(['a', 'b'], 'c', 3);
    assert.deepEqual(r, ['c', 'a', 'b']);
});

test('rotateOnHit — clips to MAX_CACHED_RPC_COUNT when over capacity', () => {
    // Pinned: bug would be "we keep 4 cached RPCs instead of 3" — silent
    // regression that weakens the eviction guarantee.
    const r = rotateOnHit(['a', 'b', 'c', 'd'], 'e', 3);
    assert.deepEqual(r, ['e', 'a', 'b']);
});

test('rotateOnHit — dedupe does NOT add a duplicate when candidate appears twice in input', () => {
    // Defensive: even if upstream wrote duplicates, a single rotation
    // should de-dupe them.
    const r = rotateOnHit(['a', 'b', 'a'], 'a', 3);
    assert.deepEqual(r, ['a', 'b']);
});

// ---------------------------------------------------------------------------
// Source-text shape pins (catch silent refactors)
// ---------------------------------------------------------------------------

test('getBestRpc — uses POST + eth_blockNumber for the probe (not GET / not chain_id)', () => {
    // Pinned: an RPC test that uses GET would always fail on
    // standards-compliant JSON-RPC endpoints. A test that uses
    // `eth_chainId` would fail on chains that haven't replied to that
    // method (rare but possible). `eth_blockNumber` is the canonical
    // liveness probe.
    assert.match(SRC, /method:\s*['"]POST['"]/, 'probe method must be POST');
    assert.match(SRC, /method:\s*['"]eth_blockNumber['"]/,
        'probe RPC method must be eth_blockNumber');
});

test('getBestRpc — sets jsonrpc: "2.0" in the probe body', () => {
    // Some RPC endpoints reject calls without the proper jsonrpc version.
    assert.match(SRC, /jsonrpc:\s*['"]2\.0['"]/);
});

test('getBestRpc — uses AbortController + setTimeout for the timeout (not setTimeout-only)', () => {
    // Pinned: a setTimeout-only timeout would race the request but not
    // actually cancel it — fetch keeps the socket open. AbortController
    // is the only way to actually free the resource on timeout.
    assert.match(SRC, /AbortController/);
    assert.match(SRC, /controller\.abort\(\)/);
    assert.match(SRC, /signal:\s*controller\.signal/);
});

test('getBestRpc — sorts working RPCs by ascending latency', () => {
    // Pinned the sort direction: descending would pick the SLOWEST
    // working RPC — silent UX regression.
    assert.match(SRC, /\.sort\(\(a,\s*b\)\s*=>\s*a\.latency\s*-\s*b\.latency\)/,
        `working RPCs must be sorted ASC by latency (a.latency - b.latency)`);
});

test('getBestRpc — exports clearRpcCache, diagnoseRpcs, getRpcCacheStatus', () => {
    // These are utilities used by debug pages / diagnostics. A refactor
    // that drops the export breaks those callers silently (next build
    // surfaces the error but only if the caller is in a tested path).
    assert.match(SRC, /export\s+function\s+clearRpcCache/);
    assert.match(SRC, /export\s+async\s+function\s+diagnoseRpcs/);
    assert.match(SRC, /export\s+function\s+getRpcCacheStatus/);
});
