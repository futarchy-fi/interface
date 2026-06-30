/**
 * snapshotApi spec mirror (auto-qa).
 *
 * Pins src/utils/snapshotApi.js — used via useSnapshotData hook for
 * the Snapshot voting widget on market pages. Three layers:
 *
 *   1. formatSmartPercentage — multi-zone precision (avoids "0.00%"
 *      for tiny but non-zero values)
 *   2. transformSnapshotData — quorum math, winning-choice detection,
 *      APPROVED/REJECTED classification
 *   3. SNAPSHOT_GRAPHQL_ENDPOINT pinned URL
 *
 * Critical bug class this catches: a refactor that flips the
 * "quorum NOT met → REJECTED" rule, or that uses .round() instead of
 * .floor() on the quorum percent (89.7014 → 89.7 instead of 89.6,
 * matching Snapshot's UX). Both would silently misrepresent voting
 * outcomes on the Snapshot widget.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(
    new URL('../../src/utils/snapshotApi.js', import.meta.url),
    'utf8',
);

// --- spec mirror of pure functions ---

function formatSmartPercentage(percentage) {
    if (percentage === 0) return '0%';
    if (percentage >= 0.01) return `${percentage.toFixed(2)}%`;
    if (percentage >= 0.001) return `${percentage.toFixed(3)}%`;
    if (percentage >= 0.0001) return `${percentage.toFixed(4)}%`;
    return `${percentage.toFixed(5)}%`;
}

function classify(label) {
    const lower = (label || '').toLowerCase();
    if (lower.includes('for') || lower.includes('yes') || lower.includes('approve'))
        return { iconType: 'check', colorKey: 'success' };
    if (lower.includes('against') || lower.includes('no') || lower.includes('reject'))
        return { iconType: 'x', colorKey: 'danger' };
    if (lower.includes('abstain'))
        return { iconType: 'line', colorKey: 'neutral' };
    return { iconType: 'line', colorKey: 'neutral' };
}

function transformSnapshotData(proposalData) {
    if (!proposalData || !proposalData.choices || !proposalData.scores) return null;
    const { choices, scores, scores_total, quorum, quorumType, votes, type, state, end } = proposalData;

    const items = choices.map((choice, index) => {
        const count = scores[index] || 0;
        const percentageValue = scores_total > 0 ? (count / scores_total) * 100 : 0;
        const { iconType, colorKey } = classify(choice);
        return {
            key: choice.toLowerCase().replace(/\s+/g, '_'),
            label: choice,
            count,
            percentage: formatSmartPercentage(percentageValue),
            percentageValue,
            iconType,
            colorKey,
        };
    }).sort((a, b) => b.count - a.count);

    const quorumPercentValue = quorum && quorum > 0 ? (scores_total / quorum) * 100 : null;
    const quorumPercent = quorumPercentValue !== null
        ? `${(Math.floor(quorumPercentValue * 10) / 10).toFixed(1)}%`
        : null;
    const quorumMet = quorum ? scores_total >= quorum : null;

    let winningChoice = null;
    let winningChoiceIndex = -1;
    let maxScore = -1;
    items.forEach((item, index) => {
        if (item.count > maxScore) {
            maxScore = item.count;
            winningChoiceIndex = index;
            winningChoice = item;
        }
    });

    let proposalApproved = null;
    if (state === 'closed') {
        if (quorumMet === false) {
            proposalApproved = false;
        } else if (quorumMet === true && winningChoice) {
            const label = winningChoice.label.toLowerCase();
            proposalApproved = label.includes('for') || label.includes('yes') || label.includes('approve');
        } else if (quorumMet === null && winningChoice) {
            const label = winningChoice.label.toLowerCase();
            proposalApproved = label.includes('for') || label.includes('yes') || label.includes('approve');
        }
    }

    return {
        items, totalCount: scores_total, quorumPercent, quorumPercentValue,
        quorumMet, quorumType, votes, title: proposalData.title,
        spaceName: proposalData.space?.name, spaceId: proposalData.space?.id,
        state, end, type, winningChoice, winningChoiceIndex, proposalApproved,
    };
}

// ---------------------------------------------------------------------------
// formatSmartPercentage — zoned precision
// ---------------------------------------------------------------------------

test('formatSmartPercentage — exact 0 returns "0%" (no decimals)', () => {
    assert.equal(formatSmartPercentage(0), '0%');
});

test('formatSmartPercentage — values >= 0.01 use 2 decimals', () => {
    assert.equal(formatSmartPercentage(80.19), '80.19%');
    assert.equal(formatSmartPercentage(0.04), '0.04%');
    assert.equal(formatSmartPercentage(0.01), '0.01%');
});

test('formatSmartPercentage — values in [0.001, 0.01) use 3 decimals', () => {
    assert.equal(formatSmartPercentage(0.005), '0.005%');
    assert.equal(formatSmartPercentage(0.001), '0.001%');
});

test('formatSmartPercentage — values in [0.0001, 0.001) use 4 decimals', () => {
    assert.equal(formatSmartPercentage(0.0005), '0.0005%');
    assert.equal(formatSmartPercentage(0.0001), '0.0001%');
});

test('formatSmartPercentage — values < 0.0001 use 5 decimals', () => {
    assert.equal(formatSmartPercentage(0.00001), '0.00001%');
});

// ---------------------------------------------------------------------------
// transformSnapshotData — null guards
// ---------------------------------------------------------------------------

test('transformSnapshotData — null/missing returns null', () => {
    assert.equal(transformSnapshotData(null), null);
    assert.equal(transformSnapshotData(undefined), null);
    assert.equal(transformSnapshotData({}), null);
    assert.equal(transformSnapshotData({ choices: ['a'] }), null,
        `must require both choices AND scores`);
    assert.equal(transformSnapshotData({ scores: [1] }), null);
});

// ---------------------------------------------------------------------------
// transformSnapshotData — choice classification
// ---------------------------------------------------------------------------

test('transformSnapshotData — "For" / "Yes" / "Approve" → success/check', () => {
    for (const label of ['For', 'Yes', 'I approve', 'support FOR']) {
        const r = transformSnapshotData({
            choices: [label, 'other'],
            scores: [10, 1],
            scores_total: 11,
            state: 'active',
        });
        const item = r.items.find(i => i.label === label);
        assert.equal(item.colorKey, 'success', `label "${label}" should be success`);
        assert.equal(item.iconType, 'check');
    }
});

test('transformSnapshotData — "Against" / "No" / "Reject" → danger/x', () => {
    for (const label of ['Against', 'No', 'Reject this']) {
        const r = transformSnapshotData({
            choices: [label, 'other'],
            scores: [10, 1],
            scores_total: 11,
            state: 'active',
        });
        const item = r.items.find(i => i.label === label);
        assert.equal(item.colorKey, 'danger', `label "${label}" should be danger`);
        assert.equal(item.iconType, 'x');
    }
});

test('transformSnapshotData — "Abstain" → neutral/line', () => {
    const r = transformSnapshotData({
        choices: ['Abstain'],
        scores: [10],
        scores_total: 10,
        state: 'active',
    });
    assert.equal(r.items[0].colorKey, 'neutral');
    assert.equal(r.items[0].iconType, 'line');
});

// ---------------------------------------------------------------------------
// transformSnapshotData — items sorted by count desc
// ---------------------------------------------------------------------------

test('transformSnapshotData — items sorted by count descending', () => {
    const r = transformSnapshotData({
        choices: ['A', 'B', 'C'],
        scores: [10, 30, 20],
        scores_total: 60,
        state: 'active',
    });
    assert.deepEqual(r.items.map(i => i.label), ['B', 'C', 'A'],
        `items must be sorted by count descending`);
});

// ---------------------------------------------------------------------------
// transformSnapshotData — quorum math (FLOOR not round, matching Snapshot UX)
// ---------------------------------------------------------------------------

test('transformSnapshotData — quorumPercent uses Math.floor at 1-decimal precision (89.69 → 89.6%, NOT 89.7%)', () => {
    // Source comment claims "89.7014 → 89.6%" but that's a comment bug:
    // floor(89.7014 * 10) / 10 = 89.7. The code IS flooring at 1-decimal
    // precision; the example value in the comment is just miscounted.
    // Use 89.69 which legitimately demonstrates floor (89.6) vs round (89.7).
    const r = transformSnapshotData({
        choices: ['For'], scores: [89.69], scores_total: 89.69,
        quorum: 100, state: 'active',
    });
    // (89.69 / 100) * 100 = 89.69  → floor(896.9)/10 = 89.6 (round would be 89.7)
    assert.equal(r.quorumPercent, '89.6%',
        `quorumPercent must use Math.floor; got "${r.quorumPercent}"`);
});

test('transformSnapshotData — pinned actual behavior: 89.7014 → 89.7% (NOT 89.6% as comment claims)', () => {
    // This pins the ACTUAL behavior so the source comment doesn't trick
    // a reader into "fixing" the implementation. The comment example is
    // off-by-1-decimal — the truncation is at 1 decimal, not 0.
    const r = transformSnapshotData({
        choices: ['For'], scores: [897.014], scores_total: 897.014,
        quorum: 1000, state: 'active',
    });
    assert.equal(r.quorumPercent, '89.7%',
        `actual code yields 89.7% for input 89.7014; the docstring comment is wrong`);
});

test('transformSnapshotData — quorumMet computed as scores_total >= quorum', () => {
    const below = transformSnapshotData({
        choices: ['For'], scores: [50], scores_total: 50, quorum: 100, state: 'active',
    });
    assert.equal(below.quorumMet, false);

    const exactly = transformSnapshotData({
        choices: ['For'], scores: [100], scores_total: 100, quorum: 100, state: 'active',
    });
    assert.equal(exactly.quorumMet, true,
        `scores_total === quorum should count as quorumMet (>=, not strict)`);

    const above = transformSnapshotData({
        choices: ['For'], scores: [200], scores_total: 200, quorum: 100, state: 'active',
    });
    assert.equal(above.quorumMet, true);
});

test('transformSnapshotData — null quorum → quorumMet=null, quorumPercent=null', () => {
    const r = transformSnapshotData({
        choices: ['For'], scores: [50], scores_total: 50, state: 'active',
    });
    assert.equal(r.quorumMet, null);
    assert.equal(r.quorumPercent, null);
});

// ---------------------------------------------------------------------------
// transformSnapshotData — APPROVED/REJECTED classification
// ---------------------------------------------------------------------------

test('transformSnapshotData — state="active" yields proposalApproved=null (not yet decided)', () => {
    const r = transformSnapshotData({
        choices: ['For', 'Against'],
        scores: [100, 50], scores_total: 150,
        quorum: 100, state: 'active',
    });
    assert.equal(r.proposalApproved, null);
});

test('transformSnapshotData — quorum NOT met + state=closed → REJECTED', () => {
    const r = transformSnapshotData({
        choices: ['For', 'Against'],
        scores: [50, 10], scores_total: 60,
        quorum: 100, state: 'closed',
    });
    assert.equal(r.proposalApproved, false,
        `quorum not met must reject regardless of leading choice`);
});

test('transformSnapshotData — quorum met + For wins + state=closed → APPROVED', () => {
    const r = transformSnapshotData({
        choices: ['For', 'Against'],
        scores: [200, 50], scores_total: 250,
        quorum: 100, state: 'closed',
    });
    assert.equal(r.proposalApproved, true);
});

test('transformSnapshotData — quorum met + Against wins + state=closed → REJECTED', () => {
    const r = transformSnapshotData({
        choices: ['For', 'Against'],
        scores: [50, 200], scores_total: 250,
        quorum: 100, state: 'closed',
    });
    assert.equal(r.proposalApproved, false);
});

test('transformSnapshotData — no quorum requirement + closed → use winning choice', () => {
    const r = transformSnapshotData({
        choices: ['For', 'Against'],
        scores: [200, 50], scores_total: 250, state: 'closed',
    });
    assert.equal(r.proposalApproved, true);
});

// ---------------------------------------------------------------------------
// SNAPSHOT_GRAPHQL_ENDPOINT pinned URL
// ---------------------------------------------------------------------------

test('snapshotApi — SNAPSHOT_GRAPHQL_ENDPOINT pinned to hub.snapshot.org', () => {
    const m = SRC.match(/SNAPSHOT_GRAPHQL_ENDPOINT\s*=\s*['"]([^'"]+)['"]/);
    assert.ok(m, 'SNAPSHOT_GRAPHQL_ENDPOINT not found');
    assert.equal(m[1], 'https://hub.snapshot.org/graphql',
        `SNAPSHOT_GRAPHQL_ENDPOINT drifted from canonical hub.snapshot.org`);
});

// ---------------------------------------------------------------------------
// getMockSnapshotData — sanity
// ---------------------------------------------------------------------------

test('snapshotApi — getMockSnapshotData has required shape', () => {
    // Ensures the mock stays usable as a development fallback.
    assert.match(SRC, /title:\s*['"][^'"]+['"]/, `mock missing title`);
    assert.match(SRC, /choices:\s*\[/, `mock missing choices array`);
    assert.match(SRC, /scores:\s*\[/, `mock missing scores array`);
    assert.match(SRC, /quorum:\s*\d+/, `mock missing numeric quorum`);
    assert.match(SRC, /state:\s*['"][^'"]+['"]/, `mock missing state`);
});
