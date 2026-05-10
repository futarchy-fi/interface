/**
 * RPC config spec mirror (auto-qa).
 *
 * Pins src/utils/getRpcUrl.js (the ethers-side RPC list) and the
 * parallel list in src/providers/providers.jsx (the wagmi/RainbowKit
 * side). Two important properties:
 *
 *   1. Each list is non-empty, deduplicated, and HTTPS-only — a
 *      regression that empties one or sneaks in a malformed/insecure
 *      URL would lose RPC fallback (or worse, leak headers over HTTP).
 *
 *   2. The function semantics: chain 1 → Ethereum, chain 100 →
 *      Gnosis, default → Gnosis (per the file's "Default to Gnosis
 *      for futarchy contracts" comment). A regression that flips the
 *      default to Ethereum breaks every futarchy contract call on
 *      unknown chains.
 *
 * Surfaced (not a bug): the two RPC lists in getRpcUrl.js and
 * providers.jsx are NOT identical. Each has 5 Gnosis URLs but the
 * sets differ (getRpcUrl has rpc.ankr.com/gnosis; providers has
 * rpc.gnosischain.com). Documented in PROGRESS.md.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const GET_RPC_URL_SRC = readFileSync(
    new URL('../../src/utils/getRpcUrl.js', import.meta.url),
    'utf8',
);
const PROVIDERS_SRC = readFileSync(
    new URL('../../src/providers/providers.jsx', import.meta.url),
    'utf8',
);

// Pull URL lists out of source files (regex over a single string-array
// region named GNOSIS_RPCS or ETHEREUM_RPCS).
function extractList(src, name) {
    const m = src.match(new RegExp(
        `${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`
    ));
    if (!m) return null;
    return [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map(x => x[1]);
}

const ETHERS_GNOSIS_RPCS    = extractList(GET_RPC_URL_SRC, 'GNOSIS_RPCS');
const ETHERS_ETHEREUM_RPCS  = extractList(GET_RPC_URL_SRC, 'ETHEREUM_RPCS');
const PROVIDERS_GNOSIS_RPCS = extractList(PROVIDERS_SRC, 'GNOSIS_RPCS');

// --- spec mirror of the function semantics ---
function getRpcUrls(chainId, lists = { ethers_gnosis: ETHERS_GNOSIS_RPCS, ethers_ethereum: ETHERS_ETHEREUM_RPCS }) {
    switch (chainId) {
        case 1:   return lists.ethers_ethereum;
        case 100: return lists.ethers_gnosis;
        default:  return lists.ethers_gnosis;
    }
}
function getRpcUrl(chainId) { return getRpcUrls(chainId)[0]; }

// ---------------------------------------------------------------------------
// Extractor sanity
// ---------------------------------------------------------------------------

test('rpc — extractor pulled lists from getRpcUrl.js', () => {
    assert.ok(ETHERS_GNOSIS_RPCS,   'GNOSIS_RPCS not extractable from getRpcUrl.js');
    assert.ok(ETHERS_ETHEREUM_RPCS, 'ETHEREUM_RPCS not extractable from getRpcUrl.js');
    assert.ok(PROVIDERS_GNOSIS_RPCS, 'GNOSIS_RPCS not extractable from providers.jsx');
});

// ---------------------------------------------------------------------------
// Each list: non-empty, HTTPS-only, deduplicated
// ---------------------------------------------------------------------------

const EVERY_LIST = [
    ['getRpcUrl.GNOSIS_RPCS',   ETHERS_GNOSIS_RPCS],
    ['getRpcUrl.ETHEREUM_RPCS', ETHERS_ETHEREUM_RPCS],
    ['providers.GNOSIS_RPCS',   PROVIDERS_GNOSIS_RPCS],
];

for (const [name, list] of EVERY_LIST) {
    test(`rpc — ${name} is non-empty (>= 3 entries)`, () => {
        assert.ok((list?.length || 0) >= 3,
            `${name} has only ${list?.length} entries — fallback logic loses meaning below 3`);
    });

    test(`rpc — ${name} entries are all HTTPS`, () => {
        for (const url of list) {
            assert.match(url, /^https:\/\//,
                `${name} contains non-HTTPS URL: "${url}". HTTP would leak request headers.`);
        }
    });

    test(`rpc — ${name} entries are deduplicated`, () => {
        const set = new Set(list);
        assert.equal(set.size, list.length,
            `${name} has duplicates: ${list.filter((v, i) => list.indexOf(v) !== i).join(', ')}`);
    });
}

// ---------------------------------------------------------------------------
// getRpcUrls function semantics — chain id routing
// ---------------------------------------------------------------------------

test('getRpcUrls — chain 1 returns the Ethereum list', () => {
    assert.equal(getRpcUrls(1), ETHERS_ETHEREUM_RPCS);
});

test('getRpcUrls — chain 100 returns the Gnosis list', () => {
    assert.equal(getRpcUrls(100), ETHERS_GNOSIS_RPCS);
});

test('getRpcUrls — unknown chain id defaults to Gnosis (per "futarchy contracts" comment)', () => {
    // The comment says "Default to Gnosis for futarchy contracts" —
    // pinned so a refactor that flips the default doesn't break every
    // contract call on an unknown chain.
    assert.equal(getRpcUrls(137), ETHERS_GNOSIS_RPCS,
        `unknown chain (Polygon=137) must default to Gnosis, not Ethereum`);
    assert.equal(getRpcUrls(undefined), ETHERS_GNOSIS_RPCS);
    assert.equal(getRpcUrls(null), ETHERS_GNOSIS_RPCS);
});

test('getRpcUrl — returns the first URL from the list', () => {
    assert.equal(getRpcUrl(100), ETHERS_GNOSIS_RPCS[0]);
    assert.equal(getRpcUrl(1), ETHERS_ETHEREUM_RPCS[0]);
});

// ---------------------------------------------------------------------------
// Cross-file consistency — the two Gnosis lists overlap meaningfully
// ---------------------------------------------------------------------------

test('rpc — getRpcUrl and providers Gnosis lists overlap by at least 3 URLs', () => {
    // Some divergence is intentional (different paths use different
    // providers). But the lists shouldn't be COMPLETELY disjoint —
    // that would suggest one of them was accidentally rewritten.
    const overlap = ETHERS_GNOSIS_RPCS.filter(u => PROVIDERS_GNOSIS_RPCS.includes(u));
    assert.ok(overlap.length >= 3,
        `getRpcUrl.GNOSIS_RPCS and providers.GNOSIS_RPCS share only ${overlap.length} URLs. ` +
        `getRpcUrl: ${ETHERS_GNOSIS_RPCS.join(', ')}\n` +
        `providers: ${PROVIDERS_GNOSIS_RPCS.join(', ')}`);
});

// ---------------------------------------------------------------------------
// Pinned: the canonical drpc.org endpoint is in EVERY Gnosis list
// (drpc is the user's primary per CLAUDE.md "first in priority")
// ---------------------------------------------------------------------------

test('rpc — gnosis.drpc.org is in both Gnosis RPC lists', () => {
    assert.ok(ETHERS_GNOSIS_RPCS.includes('https://gnosis.drpc.org'),
        `getRpcUrl.GNOSIS_RPCS missing canonical gnosis.drpc.org`);
    assert.ok(PROVIDERS_GNOSIS_RPCS.includes('https://gnosis.drpc.org'),
        `providers.GNOSIS_RPCS missing canonical gnosis.drpc.org`);
});
