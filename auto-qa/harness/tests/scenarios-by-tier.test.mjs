// scenarios-by-tier - unit check for scripts/scenarios-by-tier.mjs.
//
// This guards the CI promotion metadata used by the interaction and fork
// workflows. It is static catalog inspection only: no browser, no network,
// and no Anvil fork.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, '..', 'scripts', 'scenarios-by-tier.mjs');

test('scenarios-by-tier CLI - prints tier groups and unassigned count', () => {
    const r = spawnSync('node', [SCRIPT], { encoding: 'utf8' });
    assert.equal(r.status, 0, `exit status: ${r.status}, stderr: ${r.stderr}`);

    assert.match(r.stdout, /scenarios catalog: \d+ total/);
    assert.match(r.stdout, /-- interaction \(\d+\) --/);
    assert.match(r.stdout, /-- fork \(\d+\) --/);
    assert.match(r.stdout, /unassigned: \d+/);
    assert.match(r.stdout, /anvil-required unpromoted: \d+/);

    assert.match(r.stdout, /73-keyboard-nav-companies/);
    assert.match(r.stdout, /58-time-evolution-foundation/);
});
