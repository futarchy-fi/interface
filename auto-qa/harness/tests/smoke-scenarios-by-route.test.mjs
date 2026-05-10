// smoke-scenarios-by-route — smoke test for scripts/scenarios-by-route.mjs.
//
// The script imports each scenario module, groups by `route`, prints
// summary + per-route detail. No network, no fixtures — just static
// catalog inspection.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, '..', 'scripts', 'scenarios-by-route.mjs');

test('scenarios-by-route CLI — prints summary table + per-route detail', () => {
    const r = spawnSync('node', [SCRIPT], { encoding: 'utf8' });
    assert.equal(r.status, 0, `exit status: ${r.status}, stderr: ${r.stderr}`);

    // Header line: total + route count.
    assert.match(r.stdout, /scenarios catalog: \d+ total across \d+ routes/);

    // Summary table — at least one route line with count + bar.
    assert.match(r.stdout, /summary by route:/);
    assert.match(r.stdout, /\/\w+ +\d+ +#+/);

    // Per-route detail section. /companies has been the only route
    // for the current set of scenarios; this assertion will need
    // updating when other routes get scenarios but that's fine.
    assert.match(r.stdout, /── \/companies \(\d+\) ──/);

    // Sanity: at least one well-known scenario name appears under
    // its route block (the chaos 2x2 corner).
    assert.match(r.stdout, /02-registry-down/);
});
