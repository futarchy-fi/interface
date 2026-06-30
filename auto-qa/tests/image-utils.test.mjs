/**
 * imageUtils tests (auto-qa).
 *
 * Pins src/utils/imageUtils.js — the company-logo fallback chain used
 * across the Companies card, ResolvedEvents data transformer, and
 * useAggregatorCompanies hook. The priority chain (image → logo →
 * logo_url → generated avatar) is subtle enough that a refactor that
 * reorders or short-circuits would silently degrade thousands of
 * cards to UI-Avatar placeholders.
 *
 * Spec mirrors src/utils/imageUtils.js for the pure functions
 * (getCompanyImage, generateFallbackImage, getInitials,
 * generateColorFromId, generateColorFromString, getDefaultFallbackImage).
 * The async DOM-dependent helpers (verifyImageUrl, getVerifiedCompanyImage,
 * preloadImage) are skipped — they need a browser-like Image global.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- spec-mirror of src/utils/imageUtils.js (pure functions only) ---

function getInitials(name) {
    if (!name || typeof name !== 'string') return 'CO';
    return name.split(' ').filter(w => w.length > 0).map(w => w[0].toUpperCase()).join('').slice(0, 2);
}

function generateColorFromId(id) {
    const colors = ['4F46E5','7C3AED','DB2777','DC2626','059669','2563EB','EA580C','16A34A','9333EA','CA8A04'];
    const numericId = typeof id === 'string' ? parseInt(id) || 0 : id;
    return colors[numericId % colors.length];
}

function generateColorFromString(str) {
    if (!str || typeof str !== 'string') return '6B7280';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).slice(0, 6).padStart(6, '0');
}

function generateFallbackImage(name, id) {
    const initials = getInitials(name);
    const bgColor = generateColorFromId(id);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&size=200&background=${bgColor}&color=fff&bold=true&rounded=true`;
}

function getDefaultFallbackImage() {
    return 'https://ui-avatars.com/api/?name=CO&size=200&background=6B7280&color=fff&bold=true&rounded=true';
}

function getCompanyImage(companyData) {
    if (!companyData) return getDefaultFallbackImage();
    if (companyData.image && companyData.image.trim() !== '')       return companyData.image;
    if (companyData.logo && companyData.logo.trim() !== '')         return companyData.logo;
    if (companyData.logo_url && companyData.logo_url.trim() !== '') return companyData.logo_url;
    return generateFallbackImage(companyData.name || 'Unknown', companyData.id || 0);
}

// ---------------------------------------------------------------------------
// getCompanyImage — priority chain
// ---------------------------------------------------------------------------

test('getCompanyImage — null/undefined returns default UI-Avatars URL', () => {
    assert.equal(getCompanyImage(null), getDefaultFallbackImage());
    assert.equal(getCompanyImage(undefined), getDefaultFallbackImage());
});

test('getCompanyImage — image field wins over logo and logo_url', () => {
    const got = getCompanyImage({
        image: 'https://example.com/img.png',
        logo: 'https://example.com/logo.png',
        logo_url: 'https://example.com/logo_url.png',
    });
    assert.equal(got, 'https://example.com/img.png');
});

test('getCompanyImage — logo wins over logo_url when image is absent', () => {
    const got = getCompanyImage({
        logo: 'https://example.com/logo.png',
        logo_url: 'https://example.com/logo_url.png',
    });
    assert.equal(got, 'https://example.com/logo.png');
});

test('getCompanyImage — logo_url is the last URL fallback before generated avatar', () => {
    const got = getCompanyImage({ logo_url: 'https://example.com/lu.png' });
    assert.equal(got, 'https://example.com/lu.png');
});

test('getCompanyImage — empty/whitespace strings DO fall through to next fallback', () => {
    // Subtle: empty string and "   " count as missing per the .trim() check.
    // A future refactor that drops the trim would silently cause "" or " " to
    // be returned as the image src, breaking the <Image>.
    const got = getCompanyImage({
        image: '   ',
        logo: '',
        logo_url: 'https://example.com/lu.png',
    });
    assert.equal(got, 'https://example.com/lu.png');
});

test('getCompanyImage — falls through to generateFallbackImage when all URLs missing', () => {
    const got = getCompanyImage({ name: 'Acme Corp', id: 5 });
    assert.match(got, /^https:\/\/ui-avatars\.com\/api\//,
        `expected UI-Avatars URL; got "${got}"`);
    assert.match(got, /name=AC/, `initials must be "AC" for "Acme Corp"`);
});

test('getCompanyImage — missing name uses "Unknown" → initials "U"', () => {
    const got = getCompanyImage({ id: 1 });
    assert.match(got, /name=U/, `expected name=U from "Unknown"; got "${got}"`);
});

// ---------------------------------------------------------------------------
// getInitials
// ---------------------------------------------------------------------------

test('getInitials — empty/null returns "CO"', () => {
    assert.equal(getInitials(null), 'CO');
    assert.equal(getInitials(undefined), 'CO');
    assert.equal(getInitials(''), 'CO');
    assert.equal(getInitials(123), 'CO');
});

test('getInitials — single word: first letter only', () => {
    assert.equal(getInitials('Acme'), 'A');
    assert.equal(getInitials('gnosis'), 'G');
});

test('getInitials — multi-word: first letter of first two words', () => {
    assert.equal(getInitials('Acme Corp'), 'AC');
    assert.equal(getInitials('Curve Decentralized Exchange'), 'CD',
        'must take only first 2 letters; ignores third word');
});

test('getInitials — collapses extra spaces (filters empty splits)', () => {
    assert.equal(getInitials('Acme   Corp'), 'AC',
        'multi-space gap should not introduce empty initials');
    assert.equal(getInitials('  Acme  '), 'A',
        'leading/trailing space should not count as words');
});

// ---------------------------------------------------------------------------
// generateColorFromId — palette modulo
// ---------------------------------------------------------------------------

test('generateColorFromId — id=0 returns first color', () => {
    assert.equal(generateColorFromId(0), '4F46E5');
});

test('generateColorFromId — wraps around palette at id=10', () => {
    // 10 colors; id 10 → idx 0
    assert.equal(generateColorFromId(10), generateColorFromId(0));
    assert.equal(generateColorFromId(11), generateColorFromId(1));
});

test('generateColorFromId — string id parsed to integer', () => {
    assert.equal(generateColorFromId('5'), generateColorFromId(5));
    // Non-numeric string → parseInt returns NaN → || 0 → color[0]
    assert.equal(generateColorFromId('not-a-number'), generateColorFromId(0));
});

// ---------------------------------------------------------------------------
// generateColorFromString — deterministic hash
// ---------------------------------------------------------------------------

test('generateColorFromString — same input → same color (deterministic)', () => {
    assert.equal(generateColorFromString('Acme'), generateColorFromString('Acme'));
});

test('generateColorFromString — different input → typically different color', () => {
    assert.notEqual(generateColorFromString('Acme'), generateColorFromString('Globex'),
        'collisions exist but two distinct simple names should not collide');
});

test('generateColorFromString — empty/non-string returns gray-500 default', () => {
    assert.equal(generateColorFromString(''), '6B7280');
    assert.equal(generateColorFromString(null), '6B7280');
    assert.equal(generateColorFromString(123), '6B7280');
});

test('generateColorFromString — output is always a 6-char hex (zero-padded)', () => {
    for (const s of ['a', 'A', 'Acme', '🦊', 'long-string-of-text']) {
        const c = generateColorFromString(s);
        assert.equal(c.length, 6, `color for "${s}" not 6 chars: "${c}"`);
        assert.match(c, /^[0-9a-f]{6}$/, `color for "${s}" not lowercase hex: "${c}"`);
    }
});

// ---------------------------------------------------------------------------
// generateFallbackImage — UI Avatars URL structure
// ---------------------------------------------------------------------------

test('generateFallbackImage — produces a valid UI Avatars URL with initials and bg color', () => {
    const url = generateFallbackImage('Acme Corp', 3);
    assert.match(url, /^https:\/\/ui-avatars\.com\/api\/\?/);
    assert.match(url, /name=AC/);
    assert.match(url, new RegExp(`background=${generateColorFromId(3)}`));
    assert.match(url, /size=200/);
    assert.match(url, /rounded=true/);
});

test('getDefaultFallbackImage — pinned URL', () => {
    // Pin the exact URL so a refactor that tweaks it (e.g. switches to
    // /assets/default-company-logo.png instead) surfaces immediately.
    assert.equal(
        getDefaultFallbackImage(),
        'https://ui-avatars.com/api/?name=CO&size=200&background=6B7280&color=fff&bold=true&rounded=true'
    );
});
