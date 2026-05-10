/**
 * Contract addresses lint (auto-qa).
 *
 * Walks src/components/futarchyFi/marketPage/constants/contracts.js and
 * asserts every 0x-prefixed string follows shape rules. Catches a
 * class of catastrophic bugs:
 *
 *   - An address typo (truncated, extra digit, wrong case) silently
 *     breaks every transaction targeting that contract.
 *   - A merge accident concatenates two addresses into one.
 *   - A refactor swaps two addresses by name.
 *
 * Pinned shape invariants:
 *   - Address: 0x + exactly 40 hex chars
 *   - Hash / condition id: 0x + 64 hex chars (32 bytes)
 *   - Chain id / small constant: 0x + 1-8 hex chars
 *   - Everything else is suspicious
 *
 * Pinned specific values that are "external constants" — well-known
 * addresses that must never drift:
 *   - REQUIRED_CHAIN_ID = '0x64' (Gnosis Chain = 100 in hex)
 *   - COW_SETTLEMENT_ADDRESS = canonical CoW Protocol settlement
 *   - WXDAI_ADDRESS = canonical wrapped xDAI on Gnosis
 *
 * Plus a count baseline so additions/removals are intentional.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FILE = new URL(
    '../../src/components/futarchyFi/marketPage/constants/contracts.js',
    import.meta.url,
);

const SRC = readFileSync(FILE, 'utf8');

// Extract every quoted "0x..." literal. Match in single-quoted strings only
// to avoid pulling 0x out of comments. The constants file uses single
// quotes consistently for these literals.
const HEX_LITERAL_RE = /'(0x[0-9a-fA-F]+)'/g;
const all = [];
let m;
while ((m = HEX_LITERAL_RE.exec(SRC)) !== null) all.push(m[1]);

const addresses = all.filter(s => s.length === 42);
const non42     = all.filter(s => s.length !== 42);

// ---------------------------------------------------------------------------
// Sanity / extractor checks
// ---------------------------------------------------------------------------

test('contracts — extractor finds at least 10 0x-literals', () => {
    assert.ok(all.length >= 10,
        `extractor found only ${all.length} 0x-literals — regex broken or file shrunk dramatically`);
});

// ---------------------------------------------------------------------------
// Address shape — every 42-char 0x-literal must be all-hex
// ---------------------------------------------------------------------------

test('contracts — every 42-char 0x-literal is valid hex (40 chars after 0x)', () => {
    for (const a of addresses) {
        assert.match(a, /^0x[0-9a-fA-F]{40}$/,
            `address fails shape check: "${a}"`);
    }
});

test('contracts — no address is the zero address (0x000…000)', () => {
    // A literal zero-address constant is almost always a copy-paste bug.
    const ZERO = '0x' + '0'.repeat(40);
    for (const a of addresses) {
        assert.notEqual(a.toLowerCase(), ZERO,
            `zero address found in contracts.js — likely a placeholder left in by mistake`);
    }
});

test('contracts — addresses do not contain repeated characters past plausibility', () => {
    // Catches "0xaaaaaaa..." or "0xfffff..." style placeholders.
    for (const a of addresses) {
        const body = a.slice(2).toLowerCase();
        const allSameChar = /^(.)\1+$/.test(body);
        assert.ok(!allSameChar,
            `address "${a}" is all the same character — likely a placeholder`);
    }
});

// ---------------------------------------------------------------------------
// Non-address 0x-literals (chain ids, etc.) — must be 1-8 hex chars
// ---------------------------------------------------------------------------

test('contracts — non-address 0x-literals are recognized shapes (chain id / 32-byte hash)', () => {
    // Allowed shapes:
    //   - chain id / small constant: 1-8 hex chars (e.g. '0x64' for Gnosis)
    //   - 32-byte hash / condition id: exactly 64 hex chars
    // Anything else is suspicious — possibly an address that lost or gained chars.
    for (const s of non42) {
        const body = s.slice(2);
        assert.match(body, /^[0-9a-fA-F]+$/, `non-address literal "${s}" has non-hex chars`);
        const isSmall = body.length >= 1 && body.length <= 8;
        const isHash  = body.length === 64;
        assert.ok(isSmall || isHash,
            `0x literal "${s}" has ${body.length} hex chars — not 40 (address), 64 (hash), or 1-8 (chain id). ` +
            `Possibly a typo where an address lost or gained chars.`);
    }
});

// ---------------------------------------------------------------------------
// Pinned external constants — well-known values that MUST NOT drift
// ---------------------------------------------------------------------------

test('contracts — REQUIRED_CHAIN_ID is exactly 0x64 (Gnosis = 100)', () => {
    const m = SRC.match(/REQUIRED_CHAIN_ID\s*=\s*'(0x[0-9a-fA-F]+)'/);
    assert.ok(m, 'REQUIRED_CHAIN_ID literal not found in source');
    assert.equal(m[1], '0x64',
        `REQUIRED_CHAIN_ID drifted: got "${m[1]}". 0x64 = chain id 100 (Gnosis Chain). ` +
        `If we intentionally moved off Gnosis, this is a major rollout — update the test.`);
});

test('contracts — COW_SETTLEMENT_ADDRESS is the canonical CoW Protocol address', () => {
    // CoW's settlement contract is the same address on every chain it's deployed on.
    const m = SRC.match(/COW_SETTLEMENT_ADDRESS\s*=\s*'(0x[0-9a-fA-F]+)'/);
    assert.ok(m, 'COW_SETTLEMENT_ADDRESS not found');
    assert.equal(m[1], '0x9008D19f58AAbD9eD0D60971565AA8510560ab41',
        `COW_SETTLEMENT_ADDRESS drifted from canonical CoW Protocol settlement`);
});

test('contracts — WXDAI_ADDRESS is the canonical wXDAI on Gnosis', () => {
    const m = SRC.match(/WXDAI_ADDRESS\s*=\s*'(0x[0-9a-fA-F]+)'/);
    assert.ok(m, 'WXDAI_ADDRESS not found');
    assert.equal(m[1], '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
        `WXDAI_ADDRESS drifted — wXDAI on Gnosis is fixed`);
});

test('contracts — VAULT_RELAYER_ADDRESS is the canonical CoW vault relayer', () => {
    const m = SRC.match(/VAULT_RELAYER_ADDRESS\s*=\s*'(0x[0-9a-fA-F]+)'/);
    assert.ok(m, 'VAULT_RELAYER_ADDRESS not found');
    assert.equal(m[1], '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110',
        `VAULT_RELAYER_ADDRESS drifted from canonical CoW Protocol vault relayer`);
});

// ---------------------------------------------------------------------------
// Counts — baseline so additions/removals are intentional
// ---------------------------------------------------------------------------

test('contracts — address count is within expected range', () => {
    // Count includes addresses inside the ABI strings (those are mostly
    // event topics that look like 0x... but happen to be 64 chars — they
    // get filtered out of `addresses`). Just pin the order of magnitude.
    assert.ok(addresses.length >= 8 && addresses.length <= 50,
        `address count is ${addresses.length} — outside expected range [8, 50]. ` +
        `If you added/removed addresses intentionally, bump this range.`);
});

test('contracts — extractor finds the expected NAMED addresses', () => {
    // Spot-check a few names that must always exist. If any of these
    // disappears, the surrounding components are likely broken.
    const REQUIRED_NAMES = [
        'CONDITIONAL_TOKENS_ADDRESS',
        'WRAPPER_SERVICE_ADDRESS',
        'VAULT_RELAYER_ADDRESS',
        'COW_SETTLEMENT_ADDRESS',
        'FUTARCHY_ROUTER_ADDRESS',
        'BASE_CURRENCY_TOKEN_ADDRESS',
        'BASE_COMPANY_TOKEN_ADDRESS',
        'MARKET_ADDRESS',
        'WXDAI_ADDRESS',
        'REQUIRED_CHAIN_ID',
    ];
    for (const name of REQUIRED_NAMES) {
        assert.match(SRC, new RegExp(`export const ${name}\\s*=`),
            `required export "${name}" missing from contracts.js`);
    }
});
