import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(here, '../../src/utils/proposalLifecycle.js');
const source = await readFile(sourcePath, 'utf8');
const lifecycle = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`);

const {
    getProposalEndTime,
    hasResolutionOutcome,
    isClosedProposal,
    isProposalActive,
    isProposalClosed,
    isProposalResolved,
    isResolvedProposal,
    normalizeUnixTimestamp,
} = lifecycle;

const NOW = 1_780_000_000;
const FUTURE = NOW + 86_400;
const PAST = NOW - 60;

test('normalizeUnixTimestamp accepts seconds, milliseconds, numeric strings, and dates', () => {
    assert.equal(normalizeUnixTimestamp(1_700_000_000), 1_700_000_000);
    assert.equal(normalizeUnixTimestamp(1_700_000_000_123), 1_700_000_000);
    assert.equal(normalizeUnixTimestamp('1700000000'), 1_700_000_000);
    assert.equal(normalizeUnixTimestamp('2026-06-30T00:00:00.000Z'), 1_782_777_600);
});

test('normalizeUnixTimestamp rejects empty, invalid, and non-positive values', () => {
    for (const value of [null, undefined, '', 'not a date', 0, -1, Number.POSITIVE_INFINITY]) {
        assert.equal(normalizeUnixTimestamp(value), null, `${String(value)} should normalize to null`);
    }
});

test('active metadata excludes archived, hidden, resolved, and already-ended proposals', () => {
    assert.equal(isProposalActive({ closeTimestamp: FUTURE }, NOW), true);
    assert.equal(isProposalActive({ archived: true, closeTimestamp: FUTURE }, NOW), false);
    assert.equal(isProposalActive({ archived: 'true', closeTimestamp: FUTURE }, NOW), false);
    assert.equal(isProposalActive({ visibility: 'hidden', closeTimestamp: FUTURE }, NOW), false);
    assert.equal(isProposalActive({ resolution_status: 'resolved', closeTimestamp: FUTURE }, NOW), false);
    assert.equal(isProposalActive({ resolution_outcome: 'yes', closeTimestamp: FUTURE }, NOW), false);
    assert.equal(isProposalActive({ closeTimestamp: PAST }, NOW), false);
});

test('ended but unresolved metadata is not active and is closed', () => {
    const staleMetadata = {
        resolution_status: 'pending',
        resolution_outcome: '',
        closeTimestamp: PAST,
    };

    assert.equal(isProposalResolved(staleMetadata), false);
    assert.equal(isProposalClosed(staleMetadata, NOW), true);
    assert.equal(isProposalActive(staleMetadata, NOW), false);
});

test('recently closed predicate includes ended proposals even without resolution metadata', () => {
    const staleEndedProposal = {
        proposalAddress: '0xeCe80208CB8376Be311cE0f5Ea4eF73850a0dcF0',
        resolution_status: 'pending',
        metadata: {
            title: 'GIP-151 stale metadata regression shape',
            closeTimestamp: PAST,
        },
    };

    assert.equal(isResolvedProposal(staleEndedProposal), false);
    assert.equal(isClosedProposal(staleEndedProposal, NOW), true);
    assert.equal(
        isResolvedProposal(staleEndedProposal) || isClosedProposal(staleEndedProposal, NOW),
        true,
        'ended proposals with stale resolution metadata must route to Recently Closed'
    );
});

test('active and recently closed predicates do not overlap for ended or resolved proposals', () => {
    const cases = [
        { metadata: { closeTimestamp: PAST }, proposal: { metadata: { closeTimestamp: PAST } } },
        {
            metadata: { closeTimestamp: FUTURE, resolution_status: 'resolved', resolution_outcome: 'yes' },
            proposal: { closeTimestamp: FUTURE, resolution_status: 'resolved', resolution_outcome: 'yes' },
        },
        {
            metadata: { closeTimestamp: FUTURE, finalOutcome: 'no' },
            proposal: { closeTimestamp: FUTURE, finalOutcome: 'no' },
        },
    ];

    for (const { metadata, proposal } of cases) {
        assert.equal(isProposalActive(metadata, NOW), false);
        assert.equal(isResolvedProposal(proposal) || isClosedProposal(proposal, NOW), true);
    }
});

test('proposal end time supports top-level and nested metadata shapes', () => {
    assert.equal(getProposalEndTime({ endTime: FUTURE }), FUTURE);
    assert.equal(getProposalEndTime({ closeTimestamp: FUTURE }), FUTURE);
    assert.equal(getProposalEndTime({ end_time: FUTURE }), FUTURE);
    assert.equal(getProposalEndTime({ metadata: { endTime: FUTURE } }), FUTURE);
    assert.equal(getProposalEndTime({ metadata: { closeTimestamp: FUTURE } }), FUTURE);
    assert.equal(getProposalEndTime({}), null);
});

test('resolved proposal predicate supports status and outcome aliases', () => {
    assert.equal(isResolvedProposal({ resolution_status: 'resolved' }), true);
    assert.equal(isResolvedProposal({ resolutionStatus: 'resolved' }), true);
    assert.equal(isResolvedProposal({ status: 'resolved' }), true);
    assert.equal(isResolvedProposal({ resolution_outcome: 'yes' }), true);
    assert.equal(isResolvedProposal({ resolutionOutcome: 'no' }), true);
    assert.equal(isResolvedProposal({ finalOutcome: 0 }), true);
    assert.equal(isResolvedProposal({ metadata: { resolution_status: 'resolved' } }), true);
    assert.equal(isResolvedProposal({ metadata: { finalOutcome: 'yes' } }), true);
    assert.equal(isResolvedProposal({ resolution_status: 'pending', resolution_outcome: '' }), false);
});

test('hasResolutionOutcome treats null, undefined, and empty string as missing only', () => {
    assert.equal(hasResolutionOutcome({ resolution_outcome: null }), false);
    assert.equal(hasResolutionOutcome({ resolution_outcome: undefined }), false);
    assert.equal(hasResolutionOutcome({ resolution_outcome: '' }), false);
    assert.equal(hasResolutionOutcome({ resolution_outcome: 0 }), true);
    assert.equal(hasResolutionOutcome({ metadata: { finalOutcome: 'no' } }), true);
});
