/**
 * JSON config validity test (auto-qa).
 *
 * Walks every JSON file in src/, public/, and the repo root (excluding
 * package-lock.json + node_modules) and asserts:
 *
 *   1. The file parses cleanly as JSON (catches trailing commas,
 *      missing braces, BOM markers, accidental Markdown fences)
 *   2. For known structural files (manifest.json, package.json,
 *      mapped-seo.json), specific shape invariants hold
 *
 * A bad JSON file in src/ or public/ silently breaks SSR or static
 * asset serving — Next.js may throw a vague "Unexpected token" with
 * no file path. This test surfaces it with a clear file:line message.
 *
 * The mapped-seo.json key-shape check pins that every proposal-id
 * key is a valid 0x-prefixed 42-char address — guards against a
 * search/replace that mangles addresses.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

function walk(dir, results = []) {
    for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
        const full = join(dir, name);
        const st = statSync(full);
        if (st.isDirectory()) walk(full, results);
        else if (name.endsWith('.json') && name !== 'package-lock.json') results.push(full);
    }
    return results;
}

// Top-level files only (no walk into directories) — repo root has many
// scratch JSON files that aren't shipped.
function topLevelJson(dir) {
    return readdirSync(dir)
        .filter(n => n.endsWith('.json') && n !== 'package-lock.json')
        .map(n => join(dir, n));
}

const SRC_FILES    = walk(join(REPO_ROOT, 'src'));
const PUBLIC_FILES = walk(join(REPO_ROOT, 'public'));
const ROOT_FILES   = topLevelJson(REPO_ROOT);

// ---------------------------------------------------------------------------
// Universal: every JSON file must parse
// ---------------------------------------------------------------------------

test('JSON validity — extractor finds non-trivial number of files', () => {
    const total = SRC_FILES.length + PUBLIC_FILES.length + ROOT_FILES.length;
    assert.ok(total >= 5,
        `extractor found only ${total} JSON files — walker / filter likely broken`);
});

const allFiles = [...SRC_FILES, ...PUBLIC_FILES, ...ROOT_FILES];
for (const file of allFiles) {
    const rel = relative(REPO_ROOT, file);
    test(`JSON validity — ${rel} parses`, () => {
        const raw = readFileSync(file, 'utf8');
        // Detect BOM (sometimes added by Windows editors → JSON.parse throws).
        assert.ok(raw.charCodeAt(0) !== 0xFEFF,
            `${rel} starts with a UTF-8 BOM marker — strip it`);
        // Try to parse; surface a rich error if it fails.
        try {
            JSON.parse(raw);
        } catch (e) {
            assert.fail(`${rel} failed to parse as JSON: ${e.message}`);
        }
    });
}

// ---------------------------------------------------------------------------
// public/manifest.json — Web App Manifest minimal shape
// ---------------------------------------------------------------------------

test('manifest.json — has name + description fields', () => {
    const m = JSON.parse(readFileSync(join(REPO_ROOT, 'public/manifest.json'), 'utf8'));
    assert.ok(typeof m.name === 'string' && m.name.length > 0,
        `manifest.json must have a name field`);
    assert.ok(typeof m.description === 'string' && m.description.length > 0,
        `manifest.json must have a description field`);
});

test('safe-app-manifest.json — has name + iconPath fields', () => {
    const m = JSON.parse(readFileSync(join(REPO_ROOT, 'public/safe-app-manifest.json'), 'utf8'));
    // Safe (Gnosis Safe) app manifest spec: name, description, iconPath.
    for (const k of ['name', 'description', 'iconPath']) {
        assert.ok(typeof m[k] === 'string' && m[k].length > 0,
            `safe-app-manifest.json must have a non-empty "${k}" field`);
    }
});

// ---------------------------------------------------------------------------
// src/config/mapped-seo.json — every key is a 0x-address
// ---------------------------------------------------------------------------

test('mapped-seo.json — every key is a valid 0x + 40 hex chars address', () => {
    const m = JSON.parse(readFileSync(join(REPO_ROOT, 'src/config/mapped-seo.json'), 'utf8'));
    const ADDR = /^0x[a-fA-F0-9]{40}$/;
    const bad = Object.keys(m).filter(k => !ADDR.test(k));
    assert.equal(bad.length, 0,
        `${bad.length} mapped-seo.json key(s) failed address shape check:\n${bad.map(k => '  ' + k).join('\n')}`);
});

test('mapped-seo.json — every value is a path-relative string', () => {
    const m = JSON.parse(readFileSync(join(REPO_ROOT, 'src/config/mapped-seo.json'), 'utf8'));
    const bad = [];
    for (const [k, v] of Object.entries(m)) {
        if (typeof v !== 'string') { bad.push(`${k}: not string (${typeof v})`); continue; }
        if (!v.startsWith('/'))     { bad.push(`${k}: not path-relative ("${v}")`); }
    }
    assert.equal(bad.length, 0,
        `${bad.length} mapped-seo.json value(s) failed shape check:\n${bad.slice(0, 10).map(b => '  ' + b).join('\n')}`);
});

test('mapped-seo.json — non-trivial number of entries', () => {
    const m = JSON.parse(readFileSync(join(REPO_ROOT, 'src/config/mapped-seo.json'), 'utf8'));
    const n = Object.keys(m).length;
    assert.ok(n >= 10, `mapped-seo.json has ${n} entries — likely truncated`);
});

// ---------------------------------------------------------------------------
// Root package.json — required dev/runtime dep names + scripts
// ---------------------------------------------------------------------------

test('package.json — has required scripts (dev, build, lint, auto-qa:test)', () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
    for (const s of ['dev', 'build', 'lint', 'auto-qa:test']) {
        assert.ok(pkg.scripts?.[s], `package.json missing script "${s}"`);
    }
});

test('package.json — declares ethers and next as dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
    const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    for (const dep of ['ethers', 'next']) {
        assert.ok(all[dep], `package.json missing dep "${dep}"`);
    }
});
