// smoke-invariants-catalog — smoke test for
// scripts/invariants-catalog.mjs. Sister to
// smoke-scenarios-catalog.
//
// Two things this test guards:
//
//   1. The script itself runs cleanly (exit 0, writes INVARIANTS.md,
//      mentions the file in stdout).
//
//   2. **Drift detection** — the committed INVARIANTS.md is byte-
//      identical to what the script regenerates today. Catches the
//      bug "added an invariant but forgot to run invariants:catalog"
//      — analogous to the scenarios:catalog drift trap. If a future
//      contributor adds a test('slice 4z — ...') and forgets to
//      regenerate, this test fails CI with a clear pointer to the fix.
//
// Mechanism: snapshot the committed INVARIANTS.md → run the script
// → assert the regenerated content equals the snapshot → restore
// the snapshot in finally so the working tree is left untouched.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, '..', 'scripts', 'invariants-catalog.mjs');
const OUTPUT = resolve(__dirname, '..', 'flows', 'INVARIANTS.md');

test('invariants-catalog CLI — runs cleanly + committed INVARIANTS.md is in sync', () => {
    const existed = existsSync(OUTPUT);
    const before = existed ? readFileSync(OUTPUT, 'utf8') : null;

    try {
        const r = spawnSync('node', [SCRIPT], { encoding: 'utf8' });
        assert.equal(r.status, 0, `exit status: ${r.status}, stderr: ${r.stderr}`);

        // Stdout reports the file write (the script prints
        // "✓ Wrote <path> (<n> invariants)").
        assert.match(r.stdout, /Wrote .*INVARIANTS\.md/);
        assert.match(r.stdout, /\(\d+ invariants\)/);

        const after = readFileSync(OUTPUT, 'utf8');

        // Drift detection. If this fails, the committed catalog is
        // stale — somebody added/renamed a test but forgot to
        // regenerate. Fix: `npm run invariants:catalog` from the
        // harness dir and commit the result.
        if (before !== null) {
            assert.equal(
                after,
                before,
                'INVARIANTS.md is out of sync with scripts/invariants-catalog.mjs — run `npm run invariants:catalog` to regenerate, then commit',
            );
        }

        // Sanity: well-known invariant ids appear in the regenerated
        // output. If this fails AND the drift check passed, the
        // script's output format silently changed.
        assert.match(after, /\| 4b\s+\|/);
        assert.match(after, /\| 4m\s+\|/);
        assert.match(after, /\| 4y\s+\|/);

        // Footer mentions the three coverage dimensions.
        assert.match(after, /Text-level field-flow/);
        assert.match(after, /Network-level request body/);
        assert.match(after, /Attribute-level rendering/);
    } finally {
        // Restore the snapshot regardless of test outcome.
        if (before !== null) {
            writeFileSync(OUTPUT, before);
        } else if (existsSync(OUTPUT)) {
            unlinkSync(OUTPUT);
        }
    }
});
