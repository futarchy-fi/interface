// architecture-sync - assert this repo's ARCHITECTURE.md has the expected
// replay command. The optional sister-repo byte comparison is opt-in because
// this harness unit tier must be self-contained in CI and in one-repo clones.
//
// Phase 0 acceptance gate (CHECKLIST item 41): "Sister-link verified:
// a fresh checkout of both repos in `~/code/futarchy-fi/` runs
// docker compose config cleanly". The doc-side equivalent is
// keeping ARCHITECTURE.md in lockstep — Phase 0 explicitly required
// `diff` to report identical across both repos.
//
// Set HARNESS_CHECK_SISTER_ARCH=1 to also compare against the sibling
// futarchy-api checkout.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// tests/ → harness/ → auto-qa/ → repo-root/ → parent-of-repo-root/
const REPO_PARENT = resolve(__dirname, '..', '..', '..', '..');
const LOCAL_ARCH = resolve(__dirname, '..', 'ARCHITECTURE.md');
const SISTER_ARCH = resolve(REPO_PARENT, 'futarchy-api', 'auto-qa', 'harness', 'ARCHITECTURE.md');

test('ARCHITECTURE.md replay command uses explicit tier selection', () => {
    const local = readFileSync(LOCAL_ARCH, 'utf8');

    assert.match(local, /npm run auto-qa:e2e:replay -- --tier interaction/);
    assert.doesNotMatch(local, /npm run auto-qa:e2e:replay -- --scenario /);
});

test('ARCHITECTURE.md sister-link - byte-identical to futarchy-api-side copy', (t) => {
    if (process.env.HARNESS_CHECK_SISTER_ARCH !== '1') {
        t.skip('set HARNESS_CHECK_SISTER_ARCH=1 to enable the sibling-repo architecture comparison');
        return;
    }

    if (!existsSync(SISTER_ARCH)) {
        t.skip(`sister ARCHITECTURE.md not found at ${SISTER_ARCH}; clone the sibling repo to enable this check`);
        return;
    }

    const local = readFileSync(LOCAL_ARCH, 'utf8');
    const sister = readFileSync(SISTER_ARCH, 'utf8');

    // Phase 0 says diff reports identical. If this fails, the shared
    // spec drifted between repos — pick one side as source of truth
    // and `cp` to the other, then commit on both.
    assert.equal(
        sister,
        local,
        `ARCHITECTURE.md drift between this repo and sister at ${SISTER_ARCH} — mirrored docs must stay byte-identical`,
    );
});
