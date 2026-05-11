#!/usr/bin/env node
// scenarios-chaos-matrix — derive the chaos coverage matrix from
// the captured Playwright scenarios and print it grouped by route.
//
// Sister to `scenarios-by-route.mjs` (groups by route) and the
// api-side `scenarios-by-layer.mjs` (groups by data layer). This
// script groups by (route, endpoint, failure_mode) — the natural
// 2D chart for chaos coverage.
//
// Why dynamic vs hand-maintained: PROGRESS.md tracks the matrix
// as a hand-written table; that drifts whenever a scenario is
// added/removed. This script regenerates the matrix from the
// actual scenarios on disk so it's drift-resistant. Each new
// chaos scenario shows up in the matrix immediately on the next
// `npm run scenarios:chaos-matrix` run.
//
// Classification heuristic (filename-based, fallback to bugShape):
//   1. Parse the file name. Format:
//        `NN-[<page-prefix>-]<endpoint>-<failure-mode>.scenario.mjs`
//      where:
//        - page-prefix: optional, identifies a non-default page
//          (e.g., `market-page-`); absent prefix = /companies
//        - endpoint:    `registry` or `candles`
//        - failure-mode: `down`, `empty[-orgs]`, `malformed-body`,
//          `corrupt-org`, `corrupt-row`, `corrupt-pool`,
//          `partial`, `slow`, `mutation`/`update`, `canary`/`happy`/
//          `trading`/etc. (non-chaos scenarios are reported under
//          a separate "non-chaos" section)
//   2. Bug-shape regex fallback for scenarios whose name doesn't
//      match the strict pattern (e.g., `01-stale-price-shape`).
//   3. Anything that can't be classified lands under "uncategorised".
//
// Output: plain text, deliberately scriptable. Pipe into grep/awk
// for filtering.
//
// Run via:  npm run scenarios:chaos-matrix
//      or:  npm run auto-qa:e2e:scenarios:chaos-matrix (root)

import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENARIOS_DIR = join(__dirname, '..', 'scenarios');

// Canonical failure-mode labels and the keyword(s) in the file
// name that trigger each. Order matters — the FIRST matching key
// wins so multi-word modes like `corrupt-pool` shadow `corrupt`.
const FAILURE_MODE_KEYWORDS = [
    ['hard 502',          ['-down', '-both-endpoints-down']],
    ['malformed body',    ['malformed', 'malformed-body']],
    ['empty 200',         ['-empty']],
    ['per-row corrupt',   ['corrupt-org', 'corrupt-row', 'corrupt-pool']],
    ['partial response',  ['-partial']],
    ['slow valid resp',   ['-slow']],
];

// Failure modes that count toward the chaos matrix. Listed in the
// order they appear as rows in the printed table.
const CANONICAL_FAILURE_MODES = [
    'hard 502',
    'partial response',
    'empty 200',
    'malformed body',
    'per-row corrupt',
    'slow valid resp',
];

// Canonical endpoints (the columns of the chaos matrix).
const CANONICAL_ENDPOINTS = ['registry', 'candles'];

// Map a parsed scenario to (page, endpoint, failure_mode) or null
// if the scenario isn't a chaos scenario.
function classifyScenario({ file, route }) {
    // Strip the NN- prefix and the .scenario.mjs suffix.
    const stem = file.replace(/^\d+-/, '').replace(/\.scenario\.mjs$/, '');

    // Endpoint detection: name contains 'registry' or 'candles'.
    let endpoint = null;
    if (stem.includes('registry')) endpoint = 'registry';
    else if (stem.includes('candles')) endpoint = 'candles';
    else if (stem.includes('both-endpoints')) endpoint = 'both';

    // Failure-mode detection: first matching keyword wins.
    let failureMode = null;
    for (const [mode, keywords] of FAILURE_MODE_KEYWORDS) {
        if (keywords.some((k) => stem.includes(k))) {
            failureMode = mode;
            break;
        }
    }

    if (!endpoint || !failureMode) return null;

    return { page: route, endpoint, failureMode };
}

// Load every scenario.
const files = readdirSync(SCENARIOS_DIR)
    .filter((f) => f.endsWith('.scenario.mjs'))
    .sort();

if (files.length === 0) {
    console.error('scenarios-chaos-matrix: no *.scenario.mjs files found in', SCENARIOS_DIR);
    process.exit(1);
}

const scenarios = await Promise.all(
    files.map(async (file) => {
        const url = pathToFileURL(join(SCENARIOS_DIR, file)).href;
        const mod = await import(url);
        const sc = mod.default;
        if (!sc?.name || !sc?.route) {
            throw new Error(`scenarios/${file}: missing default export name/route`);
        }
        return { file, name: sc.name, route: sc.route };
    }),
);

// Normalize a route to a stable display key. The market page
// uses an in-config probe address that's a full 0x... — fold it
// to the symbolic `/markets/[address]` so the printed table
// header doesn't bake in an implementation detail.
function displayRoute(route) {
    return route.replace(/^\/markets\/0x[a-fA-F0-9]{40}$/, '/markets/[address]');
}

// Classify + bucket. `chaos[page][failureMode][endpoint] = scenarioName`
const chaos = new Map();
const crossEndpoint = []; // multi-endpoint scenarios (e.g., #06)
const nonChaos = [];

for (const sc of scenarios) {
    const cls = classifyScenario(sc);
    if (!cls) {
        nonChaos.push(sc);
        continue;
    }
    const { page, endpoint, failureMode } = cls;
    const displayPage = displayRoute(page);
    // 'both' endpoints don't fit a registry/candles column —
    // bucket separately so the cell count stays accurate.
    if (!CANONICAL_ENDPOINTS.includes(endpoint)) {
        crossEndpoint.push({ ...sc, page: displayPage, failureMode, endpoint });
        continue;
    }
    if (!chaos.has(displayPage)) chaos.set(displayPage, new Map());
    const pageMap = chaos.get(displayPage);
    if (!pageMap.has(failureMode)) pageMap.set(failureMode, new Map());
    pageMap.get(failureMode).set(endpoint, sc.name);
}

// ── Render: per-page chaos matrices + summary ──

const padCell = (s, w) => s.padEnd(w, ' ');
const colWidthMode     = Math.max('failure mode'.length, ...CANONICAL_FAILURE_MODES.map((m) => m.length));
const colWidthEndpoint = Math.max(
    ...CANONICAL_ENDPOINTS.map((e) => e.length),
    // Allow long scenario names in cells (e.g.,
    // "23-candles-corrupt-pool") without wrapping.
    ...Array.from(chaos.values()).flatMap((pageMap) =>
        Array.from(pageMap.values()).flatMap((row) =>
            Array.from(row.values()).map((name) => name.length),
        ),
    ),
    20, // floor
);

const perEndpointCount = [...chaos.values()].reduce(
    (sum, p) => sum + [...p.values()].reduce((s, r) => s + r.size, 0), 0,
);
console.log('# Chaos coverage matrix\n');
console.log(
    `${scenarios.length} scenarios total · ` +
    `${perEndpointCount} per-endpoint chaos scenarios across ${chaos.size} pages` +
    (crossEndpoint.length > 0 ? ` · ${crossEndpoint.length} cross-endpoint chaos scenarios` : '') +
    `\n`,
);

// Sort pages alphabetically for deterministic output.
const pageNames = [...chaos.keys()].sort();
for (const page of pageNames) {
    const pageMap = chaos.get(page);

    // Count cells filled.
    let filled = 0;
    for (const row of pageMap.values()) {
        for (const _ of row.values()) filled += 1;
    }
    const total = CANONICAL_FAILURE_MODES.length * CANONICAL_ENDPOINTS.length;

    console.log(`## Page: ${page} — ${filled}/${total} cells filled\n`);

    // Header row.
    const header = ['failure mode'.padEnd(colWidthMode), ...CANONICAL_ENDPOINTS.map((e) => padCell(e, colWidthEndpoint))];
    console.log(`| ${header.join(' | ')} |`);
    console.log(`|${'-'.repeat(colWidthMode + 2)}|${CANONICAL_ENDPOINTS.map(() => '-'.repeat(colWidthEndpoint + 2)).join('|')}|`);

    for (const mode of CANONICAL_FAILURE_MODES) {
        const row = pageMap.get(mode) ?? new Map();
        const cells = [
            padCell(mode, colWidthMode),
            ...CANONICAL_ENDPOINTS.map((endpoint) => padCell(row.get(endpoint) ?? '—', colWidthEndpoint)),
        ];
        console.log(`| ${cells.join(' | ')} |`);
    }
    console.log();
}

// Cross-endpoint scenarios (e.g., #06 both-endpoints-down) — out
// of the per-endpoint matrix but still chaos coverage.
if (crossEndpoint.length > 0) {
    console.log(`## Cross-endpoint chaos scenarios (${crossEndpoint.length})\n`);
    for (const sc of crossEndpoint) {
        console.log(`  ${sc.name}  (${sc.page}, ${sc.failureMode} on ${sc.endpoint})`);
    }
    console.log();
}

// Non-chaos scenarios — happy paths, mutation tests, canaries.
if (nonChaos.length > 0) {
    console.log(`## Non-chaos scenarios (${nonChaos.length})\n`);
    for (const sc of nonChaos) {
        console.log(`  ${sc.name}  (${displayRoute(sc.route)})`);
    }
    console.log();
}

const chaosCount = [...chaos.values()].reduce(
    (sum, p) => sum + [...p.values()].reduce((s, r) => s + r.size, 0), 0,
) + crossEndpoint.length;
console.log(
    `Total: ${scenarios.length} scenarios — ${chaosCount} chaos ` +
    `(${chaosCount - crossEndpoint.length} per-endpoint + ${crossEndpoint.length} cross-endpoint), ` +
    `${nonChaos.length} non-chaos`,
);
