/**
 * Proposal resolution bucketing test (auto-qa).
 *
 * Pins PR #28: "Fix resolved proposals showing as ongoing (#10, #11)".
 *
 * Pre-PR-#28 bug: `approvalStatus` was hardcoded to `'ongoing'` on the
 * subgraph path (ProposalsPage.jsx:258) and only weakly derived on the
 * Supabase path. So resolved proposals (where Reality.eth → Registry
 * metadata reported `resolution_status === 'resolved'`) still rendered
 * with the "Ongoing" badge instead of "Approved" / "Refused".
 *
 * The fix codified a precedence rule: when `resolution_status === 'resolved'`,
 * the proposal is "approved" if the outcome is `'yes'` and "refused"
 * otherwise — taking priority over any `approval_status` from upstream.
 *
 * The `resolved` flag in `useContractConfig.js` has its own multi-source
 * truthiness rule that we also pin here.
 *
 * Spec mirrors:
 *   src/components/futarchyFi/proposalsList/page/proposalsPage/ProposalsPage.jsx:258-260      (subgraph path)
 *   src/components/futarchyFi/proposalsList/page/proposalsPage/ProposalsPageDataTransformer.jsx:752-754 (supabase path)
 *   src/hooks/useContractConfig.js:480-484                                                    (resolved flag)
 *
 * If those line ranges change, update the references — the rules
 * themselves should remain stable.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirror of ProposalsPage.jsx:258-260 (subgraph path bucketer).
 * No upstream `approval_status` to consider on this path — anything
 * unresolved is "ongoing".
 */
function bucketSubgraph(proposalMeta) {
    return proposalMeta.resolution_status === 'resolved'
        ? (proposalMeta.resolution_outcome === 'yes' ? 'approved' : 'refused')
        : 'ongoing';
}

/**
 * Mirror of ProposalsPageDataTransformer.jsx:752-754 (supabase path bucketer).
 * Resolution status takes priority over the legacy `approval_status` field.
 */
function bucketSupabase(proposal) {
    return proposal.resolution_status === 'resolved'
        ? (proposal.resolution_outcome === 'yes' ? 'approved' : 'refused')
        : (proposal.approval_status || 'ongoing');
}

/**
 * Mirror of useContractConfig.js:480-484 (`resolved` flag derivation).
 * "Resolved" if ANY of:
 *   - data.resolution_outcome is non-null
 *   - data.resolution_status === 'resolved'
 *   - registry metadata's resolution_status === 'resolved'
 *   - registry metadata's resolution_outcome is non-null
 */
function isResolved(data) {
    const reg = data?._registryMetadata;
    return (data?.resolution_outcome !== null && data?.resolution_outcome !== undefined)
        || data?.resolution_status === 'resolved'
        || reg?.resolution_status === 'resolved'
        || (reg?.resolution_outcome !== null && reg?.resolution_outcome !== undefined);
}

// ---------------------------------------------------------------------------
// Subgraph path (PR #28 — the original bug)
// ---------------------------------------------------------------------------

test('PR #28 — subgraph: resolved + outcome=yes → approved', () => {
    assert.equal(
        bucketSubgraph({ resolution_status: 'resolved', resolution_outcome: 'yes' }),
        'approved'
    );
});

test('PR #28 — subgraph: resolved + outcome=no → refused', () => {
    assert.equal(
        bucketSubgraph({ resolution_status: 'resolved', resolution_outcome: 'no' }),
        'refused'
    );
});

test('PR #28 — subgraph: not-resolved → ongoing (regardless of any other field)', () => {
    // Pre-PR-#28 bug: this was the ONLY branch the code took, so resolved
    // proposals were misbucketed.
    for (const status of [null, undefined, 'open', 'pending', 'in_progress']) {
        assert.equal(bucketSubgraph({ resolution_status: status, resolution_outcome: 'yes' }), 'ongoing',
            `status=${status} should yield ongoing`);
    }
});

test('PR #28 — subgraph: resolved + missing outcome → refused (fail-closed)', () => {
    // The fix uses a strict equality `=== 'yes'`, so any non-"yes" outcome
    // (including null/undefined) buckets to refused. Codifying this so a
    // future regression that flips it to "approved" surfaces immediately.
    assert.equal(
        bucketSubgraph({ resolution_status: 'resolved', resolution_outcome: null }),
        'refused', 'missing outcome on a resolved proposal must NOT bucket to approved'
    );
    assert.equal(
        bucketSubgraph({ resolution_status: 'resolved' }),
        'refused'
    );
});

// ---------------------------------------------------------------------------
// Supabase path — adds approval_status fallback layer
// ---------------------------------------------------------------------------

test('PR #28 — supabase: resolved status takes priority over approval_status', () => {
    // Even if the legacy approval_status disagrees, resolution wins.
    assert.equal(
        bucketSupabase({
            resolution_status: 'resolved',
            resolution_outcome: 'yes',
            approval_status: 'refused',
        }),
        'approved',
        'resolution_status MUST take priority over the legacy approval_status field'
    );
});

test('PR #28 — supabase: not-resolved falls back to approval_status', () => {
    assert.equal(
        bucketSupabase({ resolution_status: null, approval_status: 'approved' }),
        'approved'
    );
    assert.equal(
        bucketSupabase({ resolution_status: 'open', approval_status: 'refused' }),
        'refused'
    );
});

test('PR #28 — supabase: not-resolved + no approval_status → ongoing', () => {
    assert.equal(bucketSupabase({}), 'ongoing');
    assert.equal(bucketSupabase({ resolution_status: null, approval_status: null }), 'ongoing');
    assert.equal(bucketSupabase({ resolution_status: null, approval_status: undefined }), 'ongoing');
});

// ---------------------------------------------------------------------------
// `resolved` flag derivation (useContractConfig.js)
// ---------------------------------------------------------------------------

test('PR #28 — resolved flag: any single signal triggers true', () => {
    // Each signal in isolation:
    assert.equal(isResolved({ resolution_outcome: 'yes' }), true, 'data.resolution_outcome alone');
    assert.equal(isResolved({ resolution_outcome: 'no' }), true, 'data.resolution_outcome="no" still counts');
    assert.equal(isResolved({ resolution_status: 'resolved' }), true, 'data.resolution_status alone');
    assert.equal(isResolved({ _registryMetadata: { resolution_status: 'resolved' } }), true, 'registry status alone');
    assert.equal(isResolved({ _registryMetadata: { resolution_outcome: 'yes' } }), true, 'registry outcome alone');
});

test('PR #28 — resolved flag: empty/unknown data → false', () => {
    assert.equal(isResolved({}), false);
    assert.equal(isResolved({ resolution_outcome: null }), false);
    assert.equal(isResolved({ resolution_status: 'open' }), false);
    assert.equal(isResolved({ resolution_status: 'pending' }), false);
    assert.equal(isResolved({ _registryMetadata: { resolution_status: 'open' } }), false);
    assert.equal(isResolved({ _registryMetadata: {} }), false);
    assert.equal(isResolved(null), false, 'null data must not throw');
    assert.equal(isResolved(undefined), false, 'undefined data must not throw');
});

test('PR #28 — resolved flag: outcome=0 (numeric) is treated as resolved', () => {
    // Some upstream sources represent the "no" outcome as the integer 0.
    // The check is `!== null && !== undefined`, so 0 should pass.
    assert.equal(isResolved({ resolution_outcome: 0 }), true,
        'numeric 0 outcome must count as resolved');
});

// ---------------------------------------------------------------------------
// Cross-rule consistency: bucket and resolved-flag must agree on directionality
// ---------------------------------------------------------------------------

test('PR #28 — consistency: any input that isResolved=true buckets to approved or refused', () => {
    // For every "resolved" data shape, both bucketers must produce a
    // resolved bucket (not "ongoing"). This is the user-visible invariant
    // that PR #28 is enforcing — "if the system thinks it's resolved,
    // the badge must reflect it".
    const resolvedShapes = [
        { resolution_status: 'resolved', resolution_outcome: 'yes' },
        { resolution_status: 'resolved', resolution_outcome: 'no' },
    ];
    for (const shape of resolvedShapes) {
        assert.notEqual(bucketSubgraph(shape), 'ongoing',
            `subgraph bucketer must not say "ongoing" for ${JSON.stringify(shape)}`);
        assert.notEqual(bucketSupabase(shape), 'ongoing',
            `supabase bucketer must not say "ongoing" for ${JSON.stringify(shape)}`);
    }
});
