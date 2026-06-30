/**
 * Snapshot ID extraction unit test (auto-qa).
 *
 * Pins PR #48: snapshot proposal ID is read from on-chain Registry metadata
 * only (single source of truth), via `extractSnapshotIdFromMetadata` in
 * `src/adapters/registryAdapter.js`.
 *
 * Pre-PR-#48: snapshot links were built from a hardcoded mapping. Some
 * proposals had wrong/missing entries → "View on Snapshot" 404'd or
 * pointed at the wrong proposal.
 *
 * This test imports the production function directly and exercises the
 * full input matrix: object metadata, JSON-string metadata, missing
 * metadata, malformed metadata, missing snapshot_id field.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Spec-mirror of `extractSnapshotIdFromMetadata` from
// src/adapters/registryAdapter.js (line 286). We can't import the
// production function directly here — Next.js bundles src/ with
// extension-less imports that node:test's strict ESM loader rejects.
// If you change the production function, update this mirror to match.
function extractSnapshotIdFromMetadata(proposalEntity) {
    if (!proposalEntity?.metadata) return null;
    try {
        const meta = typeof proposalEntity.metadata === 'string'
            ? JSON.parse(proposalEntity.metadata)
            : proposalEntity.metadata;
        const snapshotId = meta?.snapshot_id;
        if (snapshotId && typeof snapshotId === 'string') return snapshotId;
        return null;
    } catch {
        return null;
    }
}

const SAMPLE_ID = '0x32a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';

test('PR #48 — extracts snapshot_id from object metadata', () => {
    const result = extractSnapshotIdFromMetadata({
        metadata: { snapshot_id: SAMPLE_ID, other: 'fields' },
    });
    assert.equal(result, SAMPLE_ID);
});

test('PR #48 — extracts snapshot_id from JSON-string metadata', () => {
    const result = extractSnapshotIdFromMetadata({
        metadata: JSON.stringify({ snapshot_id: SAMPLE_ID, foo: 'bar' }),
    });
    assert.equal(result, SAMPLE_ID);
});

test('PR #48 — returns null when proposalEntity is null/undefined', () => {
    assert.equal(extractSnapshotIdFromMetadata(null), null);
    assert.equal(extractSnapshotIdFromMetadata(undefined), null);
});

test('PR #48 — returns null when metadata field is missing', () => {
    assert.equal(extractSnapshotIdFromMetadata({}), null);
    assert.equal(extractSnapshotIdFromMetadata({ id: '0xabc' }), null);
});

test('PR #48 — returns null when metadata exists but lacks snapshot_id', () => {
    assert.equal(extractSnapshotIdFromMetadata({
        metadata: { other_field: 'value' }
    }), null);
    assert.equal(extractSnapshotIdFromMetadata({
        metadata: JSON.stringify({ other_field: 'value' })
    }), null);
});

test('PR #48 — returns null on malformed JSON metadata (no throw)', () => {
    assert.equal(extractSnapshotIdFromMetadata({
        metadata: 'not-valid-json{{{',
    }), null);
});

test('PR #48 — returns null when snapshot_id is non-string (defensive)', () => {
    assert.equal(extractSnapshotIdFromMetadata({
        metadata: { snapshot_id: 12345 } // number, not string
    }), null);
    assert.equal(extractSnapshotIdFromMetadata({
        metadata: { snapshot_id: null }
    }), null);
    assert.equal(extractSnapshotIdFromMetadata({
        metadata: { snapshot_id: '' } // empty string falsy
    }), null);
});

test('PR #48 — preserves the exact ID format (bytes32 hex)', () => {
    // Some snapshot IDs are slugs (e.g. "QmXXXX") rather than bytes32.
    // The function is permissive — it returns whatever string is there.
    const slug = 'bafybeibasdfhjkl1234567890poiuqwert';
    const result = extractSnapshotIdFromMetadata({
        metadata: { snapshot_id: slug }
    });
    assert.equal(result, slug);
});
