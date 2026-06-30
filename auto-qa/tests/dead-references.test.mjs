/**
 * Dead-references lint test (auto-qa).
 *
 * Pins references that should not appear (tickspread.com, PR #43) and
 * tracks the count of legacy references that DO still appear (supabase
 * imports, PR #47's cleanup was partial). Same baseline pattern as
 * the graphql-compat test.
 *
 * Why count rather than zero:
 *   PR #43 cleanup is complete — assert exact zero.
 *   PR #47 cleanup was partial — 5 files still import @supabase/supabase-js
 *   even though most should be using the subgraph fetcher. Per /loop
 *   directive we don't fix production; we record the baseline so any
 *   regression (more imports added) AND any progress (imports removed)
 *   trips the test.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const SRC = join(REPO_ROOT, 'src');
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'coverage']);
const EXTS = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx', '.css']);

function* walk(dir) {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
        if (SKIP_DIRS.has(name)) continue;
        const full = join(dir, name);
        let st; try { st = statSync(full); } catch { continue; }
        if (st.isDirectory()) yield* walk(full);
        else if (st.isFile()) yield full;
    }
}

function findHits(pattern) {
    const re = new RegExp(pattern);
    const hits = [];
    for (const file of walk(SRC)) {
        const ext = '.' + file.split('.').pop();
        if (!EXTS.has(ext)) continue;
        let text; try { text = readFileSync(file, 'utf8'); } catch { continue; }
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (re.test(lines[i])) {
                hits.push({ file: relative(REPO_ROOT, file), line: i + 1, text: lines[i].trim() });
            }
        }
    }
    return hits;
}

// ────────────────────────────────────────────────────────────────────────
// PR #43 — Remove tickspread.com URL references (cleanup is complete)
// ────────────────────────────────────────────────────────────────────────
test('PR #43 — no tickspread.com URLs remain in src/', () => {
    const hits = findHits('tickspread\\.com');
    assert.equal(hits.length, 0,
        `Found ${hits.length} tickspread.com references that shouldn't exist:\n${
            hits.map(h => `  ${h.file}:${h.line}  ${h.text}`).join('\n')
        }`);
});

// ────────────────────────────────────────────────────────────────────────
// PR #47 — Remove dead Supabase code (cleanup is PARTIAL)
//
// Baseline = the count of imports as of this iteration. If new ones get
// added: test fails (regression). If real-fix work removes some: test
// fails (forces the baseline to be lowered, ratcheting the cleanup).
// ────────────────────────────────────────────────────────────────────────
const SUPABASE_IMPORT_BASELINE = 10;

test('PR #47 — supabase import count matches baseline', () => {
    const hits = findHits("from\\s+['\"]@supabase/supabase-js['\"]");
    const msg = `Supabase imports remaining (${hits.length}):\n${
        hits.map(h => `  ${h.file}:${h.line}`).join('\n')
    }`;
    if (hits.length > SUPABASE_IMPORT_BASELINE) {
        assert.fail(`REGRESSION: count rose from ${SUPABASE_IMPORT_BASELINE} to ${hits.length}.\n${msg}`);
    } else if (hits.length < SUPABASE_IMPORT_BASELINE) {
        assert.fail(`PROGRESS: count fell from ${SUPABASE_IMPORT_BASELINE} to ${hits.length} — update the baseline in this test (lower the constant) and the entry in PROGRESS.md.\n${msg}`);
    }
    assert.equal(hits.length, SUPABASE_IMPORT_BASELINE);
});
