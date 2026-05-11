// smoke-scenarios-chaos-matrix — smoke test for
// scripts/scenarios-chaos-matrix.mjs.
//
// The script classifies each scenario by (page, endpoint,
// failure_mode) and prints a 2D coverage matrix per page. No
// network, no fixtures — just static catalog inspection.
// Sister to smoke-scenarios-by-route + smoke-scenarios-catalog.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, '..', 'scripts', 'scenarios-chaos-matrix.mjs');

test('scenarios-chaos-matrix CLI — prints per-page chaos coverage matrix', () => {
    const r = spawnSync('node', [SCRIPT], { encoding: 'utf8' });
    assert.equal(r.status, 0, `exit status: ${r.status}, stderr: ${r.stderr}`);

    // Header — total + per-endpoint count + page count.
    assert.match(r.stdout, /# Chaos coverage matrix/);
    assert.match(r.stdout, /\d+ scenarios total · \d+ per-endpoint chaos scenarios across \d+ pages/);

    // At least one per-page matrix appears, with both registry +
    // candles columns and all 6 canonical failure-mode rows.
    assert.match(r.stdout, /## Page: \/\w+.*\d+\/12 cells filled/);
    assert.match(r.stdout, /\| failure mode\s+\| registry\s+\| candles\s+\|/);
    for (const mode of [
        'hard 502',
        'partial response',
        'empty 200',
        'malformed body',
        'per-row corrupt',
        'slow valid resp',
    ]) {
        assert.match(r.stdout, new RegExp(`\\| ${mode}\\s+\\|`));
    }

    // Sanity: well-known scenarios appear in their expected cells.
    assert.match(r.stdout, /02-registry-down/);
    assert.match(r.stdout, /03-candles-down/);

    // The cross-endpoint section catches #06.
    assert.match(r.stdout, /## Cross-endpoint chaos scenarios/);
    assert.match(r.stdout, /06-both-endpoints-down/);

    // Non-chaos scenarios are reported in their own section.
    assert.match(r.stdout, /## Non-chaos scenarios/);
    assert.match(r.stdout, /01-stale-price-shape/);

    // Footer total reconciles.
    assert.match(r.stdout, /Total: \d+ scenarios — \d+ chaos .* \d+ non-chaos/);
});

test('scenarios-chaos-matrix CLI — both /companies and /markets matrices reach 12/12', () => {
    // The current state of the harness is 12/12 cells filled on
    // both pages. This assertion pins that state — if a new
    // scenario shifts the count, the test surfaces it (so the
    // author can update PROGRESS.md or the test deliberately).
    // Loosen if the matrix legitimately grows beyond 12/12 per
    // page (e.g., new failure-mode rows added).
    const r = spawnSync('node', [SCRIPT], { encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Page: \/companies — 12\/12 cells filled/);
    assert.match(r.stdout, /Page: \/markets\/\[address\] — 12\/12 cells filled/);
});
