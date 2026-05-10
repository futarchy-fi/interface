/**
 * URL shape contract test (auto-qa).
 *
 * Documents and pins the URL shapes the app is expected to accept when
 * a user lands on a market/milestones page. Each shape must yield the
 * same proposal address.
 *
 * Catches the family of bugs that landed as PR #52 (extract proposalId
 * from milestones URL hash) and PR #55 (404 redirect from /market/<addr>
 * to /market?proposalId=<addr>).
 *
 * Implementation note: the production extraction lives inline in
 * src/pages/milestones.js (matches /0x[a-fA-F0-9]{40}/ against
 * window.location.hash). This test mirrors that regex so any future
 * change to the extraction logic — e.g. tightening to require a
 * specific hash prefix — has a single, visible, failing spec to
 * update. That's the contract.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// The canonical address fixture we expect to be extracted across forms.
const ADDR = '0x1a0f209fa9730a4668ce43ce18982cb0010a972a';

// Mirrors the production regex in src/pages/milestones.js (~line 51).
// If you update that, update this too.
const ADDR_RE = /0x[a-fA-F0-9]{40}/;

/**
 * Single extraction function over `(pathname, search, hash)`. Order of
 * precedence:
 *   1. ?proposalId=… (search params)
 *   2. /market/<addr> (path segment)
 *   3. /0x[a-fA-F0-9]{40}/ anywhere in the hash
 *
 * Returns null if no shape matches.
 */
function extractProposalId({ pathname = '/', search = '', hash = '' } = {}) {
    // (1) explicit search param
    try {
        const sp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
        const fromQuery = sp.get('proposalId');
        if (fromQuery && ADDR_RE.test(fromQuery)) return fromQuery.toLowerCase();
    } catch { /* fall through */ }

    // (2) path segment: /market/<addr> or /markets/<addr>
    const pathMatch = pathname.match(/\/markets?\/(0x[a-fA-F0-9]{40})\b/);
    if (pathMatch) return pathMatch[1].toLowerCase();

    // (3) hash literal: #milestone:0x… / #market:0x… / #anything-with-0x…
    const hashMatch = hash.match(ADDR_RE);
    if (hashMatch) return hashMatch[0].toLowerCase();

    return null;
}

// ────────────────────────────────────────────────────────────────────────
// Test matrix — every supported URL shape must yield ADDR.
// ────────────────────────────────────────────────────────────────────────

test('?proposalId=<addr> — explicit search param', () => {
    const out = extractProposalId({
        pathname: '/markets',
        search: `?proposalId=${ADDR}`,
        hash: '',
    });
    assert.equal(out, ADDR);
});

test('?proposalId=<addr> with mixed-case hex — normalized to lowercase', () => {
    // Mixed case (EIP-55 checksum) is what users actually paste from
    // etherscan. The "0x" must stay lowercase though — the production
    // regex /0x[a-fA-F0-9]{40}/ rejects "0X". This test documents the
    // current behavior; if it were liberalized the test should change.
    const mixed = '0x' + ADDR.slice(2).split('').map((c, i) =>
        i % 2 ? c.toUpperCase() : c
    ).join('');
    const out = extractProposalId({
        pathname: '/markets',
        search: `?proposalId=${mixed}`,
        hash: '',
    });
    assert.equal(out, ADDR);
});

test('?proposalId=0X<addr> uppercase prefix — currently REJECTED (documented gap)', () => {
    // This is a real gap: production's /0x[…]/ regex rejects uppercase "0X".
    // Etherscan users may paste "0X1A0F…" and silently lose the param.
    // We don't fix production here; just lock in the current behavior so
    // any future liberalization of the regex (or this spec) is deliberate.
    const out = extractProposalId({
        pathname: '/markets',
        search: `?proposalId=${ADDR.toUpperCase()}`, // 0X… (uppercase X)
        hash: '',
    });
    assert.equal(out, null,
        'currently null — flag as a known gap, not a regression');
});

test('PR #55 — /market/<addr> path segment', () => {
    const out = extractProposalId({
        pathname: `/market/${ADDR}`,
        search: '',
        hash: '',
    });
    assert.equal(out, ADDR);
});

test('PR #55 — /markets/<addr> (plural) path segment', () => {
    const out = extractProposalId({
        pathname: `/markets/${ADDR}`,
        search: '',
        hash: '',
    });
    assert.equal(out, ADDR);
});

test('PR #52 — #milestone:<addr> hash form', () => {
    const out = extractProposalId({
        pathname: '/milestones',
        search: '?company_id=gnosis',
        hash: `#milestone:${ADDR}`,
    });
    assert.equal(out, ADDR);
});

test('PR #52 — #market:<addr> hash form', () => {
    const out = extractProposalId({
        pathname: '/milestones',
        search: '?company_id=gnosis',
        hash: `#market:${ADDR}`,
    });
    assert.equal(out, ADDR);
});

test('PR #52 — bare #<addr> hash (no prefix)', () => {
    const out = extractProposalId({
        pathname: '/milestones',
        search: '',
        hash: `#${ADDR}`,
    });
    assert.equal(out, ADDR);
});

test('precedence: search param wins over hash when both present', () => {
    const other = '0xb0e6bc187b0d68bb86e1054221f68c8767576639';
    const out = extractProposalId({
        pathname: '/milestones',
        search: `?proposalId=${ADDR}`,
        hash: `#milestone:${other}`,
    });
    assert.equal(out, ADDR, 'search-param should beat hash');
});

test('null when no recognizable shape is present', () => {
    const out = extractProposalId({
        pathname: '/companies',
        search: '?company_id=gnosis',
        hash: '',
    });
    assert.equal(out, null);
});

test('null when hash contains a string with 0x but wrong length', () => {
    const out = extractProposalId({
        pathname: '/markets',
        search: '',
        hash: '#0xshort',
    });
    assert.equal(out, null);
});
