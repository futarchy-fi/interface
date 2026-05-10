/**
 * Footer NAV_LINKS structural lint (auto-qa).
 *
 * Pins the structural invariants of the Footer's NAV_LINKS array. Two
 * concerns it catches:
 *
 *   (a) Mis-shaped entries (missing label/href, or `external: true` on
 *       a path-relative href, which would render as a broken absolute
 *       link)
 *   (b) Documentation link target — currently the unstable external
 *       `https://docs.futarchy.fi`. PR #41 (open) replaces this with
 *       in-app `/documents` (alias `/docs`). The test accepts EITHER
 *       so it stays green across the transition, and pins which states
 *       are valid so a typo or accidental third value (`/doc`,
 *       `https://github.com/...`) surfaces immediately.
 *
 * Static-grep style — no import, since the Footer is a Next.js JSX file
 * and node:test's strict ESM doesn't resolve extension-less relative
 * imports the way Next does.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FOOTER_PATH = new URL('../../src/components/common/Footer.jsx', import.meta.url);

function parseNavLinks() {
    const src = readFileSync(FOOTER_PATH, 'utf8');
    const m = src.match(/const NAV_LINKS = \[([\s\S]*?)\];/);
    assert.ok(m, 'NAV_LINKS array not found in Footer.jsx — has the file been refactored?');

    // Pull each `{ ... }` object literal out of the array body. Avoids
    // pulling in a JS parser dep — the array shape is small and stable.
    const entries = [];
    const re = /\{\s*([^{}]+?)\s*\}/g;
    let item;
    while ((item = re.exec(m[1])) !== null) {
        const obj = {};
        // Match key: value pairs. Handles single-quoted strings and bare
        // booleans.
        const pairRe = /(\w+)\s*:\s*('([^']*)'|true|false)/g;
        let p;
        while ((p = pairRe.exec(item[1])) !== null) {
            obj[p[1]] = p[3] !== undefined ? p[3]
                      : p[2] === 'true' ? true
                      : p[2] === 'false' ? false : p[2];
        }
        entries.push(obj);
    }
    return entries;
}

const NAV_LINKS = parseNavLinks();

test('Footer parser — extracts at least one NAV_LINKS entry', () => {
    assert.ok(NAV_LINKS.length > 0,
        'NAV_LINKS parsed as empty — the regex extractor is broken or the array is empty.');
});

test('Footer — every NAV_LINKS entry has a label and an href', () => {
    for (const e of NAV_LINKS) {
        assert.ok(typeof e.label === 'string' && e.label.length > 0,
            `entry missing label: ${JSON.stringify(e)}`);
        assert.ok(typeof e.href === 'string' && e.href.length > 0,
            `entry missing href: ${JSON.stringify(e)}`);
    }
});

test('Footer — `external: true` entries have an absolute http(s) href', () => {
    for (const e of NAV_LINKS) {
        if (e.external === true) {
            assert.ok(/^https?:\/\//.test(e.href),
                `entry "${e.label}" is marked external but href is not absolute: ${e.href}`);
        }
    }
});

test('Footer — non-external entries have a path-relative href', () => {
    for (const e of NAV_LINKS) {
        if (e.external !== true) {
            assert.ok(e.href.startsWith('/'),
                `entry "${e.label}" is not marked external but href is not path-relative: ${e.href}. ` +
                `If the link is external, set external: true.`);
        }
    }
});

test('PR #41 — Documentation link target is one of the accepted values', () => {
    // Accepted set spans the pre- and post-PR-#41 worlds. If the link
    // gets pointed at a third value (typo, accidental redirect to a
    // GitHub URL, etc.) this test surfaces it.
    const ACCEPTED_DOCS_HREFS = new Set([
        'https://docs.futarchy.fi',  // pre-PR-#41 (current)
        '/documents',                 // post-PR-#41
        '/docs',                      // post-PR-#41 alias
    ]);
    const docs = NAV_LINKS.find(e => e.label === 'Documentation');
    assert.ok(docs, 'no NAV_LINKS entry with label "Documentation"');
    assert.ok(ACCEPTED_DOCS_HREFS.has(docs.href),
        `Documentation href "${docs.href}" is not in the accepted set ` +
        `[${[...ACCEPTED_DOCS_HREFS].join(', ')}]. ` +
        `Either fix the link or add the new value to ACCEPTED_DOCS_HREFS in this test.`);
});

test('PR #41 — Status link is the canonical status URL', () => {
    // Adjacent invariant — the same NAV_LINKS array also holds Status,
    // which has historically been a deployment regression target. Pin it.
    const status = NAV_LINKS.find(e => e.label === 'Status');
    assert.ok(status, 'no NAV_LINKS entry with label "Status"');
    assert.equal(status.href, 'https://status.futarchy.fi',
        `Status link drifted from canonical URL; got "${status.href}"`);
    assert.equal(status.external, true,
        `Status link must be marked external: true`);
});
