#!/usr/bin/env node
/**
 * invariants-catalog.mjs — sister to `scripts/scenarios-catalog.mjs`.
 *
 * Reads `flows/dom-api-invariant.spec.mjs` (the cross-layer DOM↔API
 * invariant suite), extracts each `test('<title>', ...)` declaration,
 * detects each test's COVERAGE DIMENSION from the test body's
 * assertions, and emits `flows/INVARIANTS.md` — a markdown catalog
 * grouped by dimension.
 *
 * Unlike the scenarios catalog (which imports each scenario module
 * to read its `default` export), this script parses the spec file
 * directly because Playwright tests are inline functions. Parsing
 * is regex-based:
 *   - matches each `test('...', ...)` opening and pulls out the
 *     title string
 *   - extracts the test BODY (up to a closing brace heuristic) to
 *     detect which Playwright assertions it uses
 *
 * Coverage dimensions (informal):
 *   - attribute-src   : uses `toHaveAttribute('src', ...)`
 *   - attribute-href  : uses `toHaveAttribute('href', ...)`
 *   - attribute-alt   : uses `toHaveAttribute('alt', ...)`
 *   - network-level   : tracks `candlesCalls.push(...)` / `onCall`
 *   - text-level      : everything else (default catch-all)
 *
 * Output file is committed; CI can re-run the script and diff to
 * enforce the catalog stays in sync with the spec.
 *
 * Run via:  npm --prefix auto-qa/harness run invariants:catalog
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_FILE   = join(__dirname, '..', 'flows', 'dom-api-invariant.spec.mjs');
const OUTPUT_FILE = join(__dirname, '..', 'flows', 'INVARIANTS.md');

function escapePipes(s) {
    return String(s ?? '').replace(/\|/g, '\\|');
}

const src = readFileSync(SPEC_FILE, 'utf8');

// Match `test('<title>', async ({...}) => {` declarations and
// capture the body up to the matching closing brace at the same
// indentation level.
//
// We use a simple approach: find each `test('...'` opening,
// then capture all source from that point until the next `test(`
// or end of file. That over-captures slightly (each test body
// extends to the start of the next test), but the dimension
// detection only relies on keyword presence so over-capture is
// safe.
const testRe = /test\(\s*'((?:[^'\\]|\\.)*)'\s*,/g;

// Collect all match positions first so we can slice bodies.
const matches = [...src.matchAll(testRe)];
const entries = [];

for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const title = match[1].replace(/\\'/g, "'");
    const bodyStart = match.index + match[0].length;
    const bodyEnd   = i + 1 < matches.length
        ? matches[i + 1].index
        : src.length;
    const body = src.slice(bodyStart, bodyEnd);

    // Split title on the em-dash for id + description.
    const dash = title.indexOf(' — ');
    let id, summary;
    if (dash === -1) {
        id      = '(unlabeled)';
        summary = title;
    } else {
        const head = title.slice(0, dash).trim();
        summary    = title.slice(dash + 3).trim();
        id = head.replace(/^slice\s+/i, '');
    }

    // Detect dimension from body content.
    let dimension;
    if (/toHaveAttribute\(\s*['"]src['"]/.test(body))       dimension = 'attribute-src';
    else if (/toHaveAttribute\(\s*['"]href['"]/.test(body)) dimension = 'attribute-href';
    else if (/toHaveAttribute\(\s*['"]alt['"]/.test(body))  dimension = 'attribute-alt';
    else if (/candlesCalls\.push|onCall\s*:/.test(body))    dimension = 'network-level';
    else                                                     dimension = 'text-level';

    entries.push({ id, summary, dimension });
}

if (entries.length === 0) {
    console.error(
        'invariants-catalog: no `test(...)` declarations found in',
        SPEC_FILE,
    );
    process.exit(1);
}

// Natural sort by id (numeric prefix preserves ordering before
// alphabetic suffix).
function naturalCompare(a, b) {
    const re = /(\d+)|(\D+)/g;
    const aParts = a.match(re) || [];
    const bParts = b.match(re) || [];
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const ap = aParts[i] ?? '';
        const bp = bParts[i] ?? '';
        if (ap.match(/^\d+$/) && bp.match(/^\d+$/)) {
            const aNum = Number(ap);
            const bNum = Number(bp);
            if (aNum !== bNum) return aNum - bNum;
        } else if (ap !== bp) {
            return ap < bp ? -1 : 1;
        }
    }
    return 0;
}

// Dimensions in display order — text first (most common), then
// network, then attribute sub-dimensions ordered by introduction
// (src came first, then href, then alt).
const DIMENSION_ORDER = [
    'text-level',
    'network-level',
    'attribute-src',
    'attribute-href',
    'attribute-alt',
];
const DIMENSION_LABELS = {
    'text-level':     'Text-level field-flow',
    'network-level':  'Network-level request body',
    'attribute-src':  'Attribute-level: `<img src>`',
    'attribute-href': 'Attribute-level: `<a href>`',
    'attribute-alt':  'Attribute-level: `<img alt>` (a11y)',
};

// Group entries by dimension, preserving natural-sort order within
// each group.
const grouped = new Map(DIMENSION_ORDER.map((d) => [d, []]));
for (const e of entries) {
    grouped.get(e.dimension)?.push(e);
}
for (const arr of grouped.values()) arr.sort((a, b) => naturalCompare(a.id, b.id));

// Build the markdown output.
const idColWidth = Math.max(5, ...entries.map((e) => e.id.length));

const lines = [
    '# Cross-layer DOM↔API invariants — catalog',
    '',
    '_Auto-generated by `scripts/invariants-catalog.mjs`. Do not edit by hand;',
    'run `npm run invariants:catalog` to regenerate after adding or changing an invariant._',
    '',
    'Each row corresponds to one Playwright `test(...)` in',
    '`flows/dom-api-invariant.spec.mjs`. The "slice id" matches the',
    'commit-history references and the PROGRESS.md entries that introduced it.',
    'Entries are grouped by **coverage dimension** — the kind of bug-class each test',
    'is designed to catch (see "Coverage dimensions" footer for definitions).',
    '',
    `**Total invariants: ${entries.length}**`,
    '',
];

// Summary line: counts per dimension.
const summary = DIMENSION_ORDER
    .map((d) => `${grouped.get(d).length} ${DIMENSION_LABELS[d]
        .replace(/^[A-Z]/, (c) => c.toLowerCase())
        .replace(/`/g, '')}`)
    .filter((s) => !s.startsWith('0 '))
    .join(' · ');
lines.push(`Breakdown: ${summary}`);
lines.push('');

// One section per dimension, skip empty dimensions.
for (const dim of DIMENSION_ORDER) {
    const rows = grouped.get(dim);
    if (rows.length === 0) continue;
    lines.push(`## ${DIMENSION_LABELS[dim]} (${rows.length})`);
    lines.push('');
    lines.push(`| ${'slice'.padEnd(idColWidth, ' ')} | description |`);
    lines.push(`|${'-'.repeat(idColWidth + 2)}|${'-'.repeat(13)}|`);
    for (const { id, summary } of rows) {
        lines.push(`| ${id.padEnd(idColWidth, ' ')} | ${escapePipes(summary)} |`);
    }
    lines.push('');
}

lines.push('## Coverage dimensions (definitions)');
lines.push('');
lines.push('- **Text-level field-flow**: assert mocked data appears as DOM text');
lines.push('  (org name, counts, chain badge, prices, title fallbacks).');
lines.push('- **Network-level request body**: assert the page issues GraphQL');
lines.push('  queries containing expected fields (pool addresses, etc.).');
lines.push('- **Attribute-level rendering**: assert DOM attributes derived');
lines.push('  from API data — split into three sub-dimensions:');
lines.push('  - `<img src>` (image cascade and fallback paths)');
lines.push('  - `<a href>` (navigation URL construction)');
lines.push('  - `<img alt>` (accessibility / screen-reader content)');
lines.push('');
lines.push('Refer to `interface/auto-qa/harness/PROGRESS.md` for each slice\'s');
lines.push('detailed bug-shape rationale.');
lines.push('');

writeFileSync(OUTPUT_FILE, lines.join('\n'));
console.log(`✓ Wrote ${OUTPUT_FILE} (${entries.length} invariants)`);
