// smoke-scenarios-catalog — smoke test for scripts/scenarios-catalog.mjs.
//
// Two things this test guards:
//
//   1. The script itself runs cleanly (exit 0, writes SCENARIOS.md,
//      mentions the file in stdout).
//
//   2. **Drift detection** — the committed SCENARIOS.md is byte-
//      identical to what the script regenerates today. Catches the
//      bug "added a scenario but forgot to run scenarios:catalog" —
//      the doc rot the catalog script exists to prevent. If a future
//      contributor edits a scenario's description / bugShape / route
//      and forgets to regenerate, this test fails CI with a clear
//      pointer to the fix.
//
// Mechanism: snapshot the committed SCENARIOS.md → run the script
// → assert the regenerated content equals the snapshot → restore
// the snapshot in finally so the working tree is left untouched.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, '..', 'scripts', 'scenarios-catalog.mjs');
const OUTPUT = resolve(__dirname, '..', 'scenarios', 'SCENARIOS.md');

test('scenarios-catalog CLI — runs cleanly + committed SCENARIOS.md is in sync', () => {
    const existed = existsSync(OUTPUT);
    const before = existed ? readFileSync(OUTPUT, 'utf8') : null;

    try {
        const r = spawnSync('node', [SCRIPT], { encoding: 'utf8' });
        assert.equal(r.status, 0, `exit status: ${r.status}, stderr: ${r.stderr}`);

        // Stdout reports the file write (the script prints
        // "✓ Wrote <path> (<n> scenarios)").
        assert.match(r.stdout, /Wrote .*SCENARIOS\.md/);
        assert.match(r.stdout, /\(\d+ scenarios\)/);

        const after = readFileSync(OUTPUT, 'utf8');

        // Drift detection. If this fails, the committed catalog is
        // stale — somebody added/edited a scenario but forgot to
        // regenerate. Fix: `npm run scenarios:catalog` from the
        // harness dir (or `npm run auto-qa:e2e:scenarios:catalog`
        // from the interface root) and commit the result.
        if (before !== null) {
            assert.equal(
                after,
                before,
                'SCENARIOS.md is out of sync with scripts/scenarios-catalog.mjs — run `npm run scenarios:catalog` to regenerate, then commit',
            );
        }

        // Sanity: a well-known scenario appears in the regenerated
        // output. If this fails AND the drift check passed, the
        // script's output format silently changed (e.g., the table
        // row template stopped emitting filenames).
        assert.match(after, /02-registry-down/);
    } finally {
        // Restore the snapshot regardless of test outcome.
        if (before !== null) {
            writeFileSync(OUTPUT, before);
        } else if (existsSync(OUTPUT)) {
            // The script created the file from scratch (SCENARIOS.md
            // didn't exist before); remove it to leave the working
            // tree exactly as we found it.
            unlinkSync(OUTPUT);
        }
    }
});
