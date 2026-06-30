/**
 * 47-checkpoint-schema-strictness.scenario.mjs — first scenario using
 * the strict-schema GraphQL mock. Catches a NEW KIND of bug: legacy
 * GraphQL queries against the Checkpoint indexer's stricter schema.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Six merged fix-PRs (#45, #60, #61, #62, #63, #65) share one bug
 * shape: code issues a GraphQL query that worked against the old
 * AWS Graph-Node subgraph but fails against the Checkpoint indexer
 * because:
 *
 *   - Checkpoint doesn't auto-generate reverse-relation fields
 *     (e.g., `Aggregator.organizations`, `Organization.proposals`).
 *     The pre-PR-60 code used a single nested query that relied on
 *     these. Post-PR-60 issues three flat queries.
 *
 *   - Checkpoint's schema doesn't include legacy fields like
 *     `ProposalEntity.metadataContract` (PR #45's bug — the modal
 *     selected the field, Checkpoint rejected the whole query,
 *     `result.data.organization` came back undefined, the modal
 *     showed "Entity not found").
 *
 * Existing scenarios with the permissive `makeGraphqlMockHandler`
 * CAN'T mechanically catch regressions of this kind: the permissive
 * mock pattern-matches on the operation name and returns a stub
 * regardless of which fields are selected. A regression to the
 * legacy query shape would still get a fake-OK response → tests
 * pass → bug ships.
 *
 * `makeStrictCheckpointGraphqlMockHandler` simulates Checkpoint's
 * schema enforcement. Legacy queries trip a GraphQL error envelope;
 * downstream consumers handle the error (or fail to) and the page
 * renders broken state. The assertion below — PROBE_ORG_NAME visible
 * in the orgs table — fails when ANY of the three queries
 * `useAggregatorProposals` issues regresses to the legacy shape, OR
 * when an unknown field is added to any of them.
 *
 * ── Empirical verification protocol (slice 74/75/76/77 pattern) ──
 *
 * Test current code passes → introduce ONE regression → assert
 * fails. Restore. Examples of regressions this should catch:
 *
 *   (a) Revert `AGGREGATOR_QUERY` in `useAggregatorProposals.js`
 *       to the nested form `aggregator(id) { organizations { ... } }`.
 *       Strict mock rejects → result.errors populated → consumer
 *       throws → PROBE_ORG_NAME not visible → assertion FAILS.
 *
 *   (b) Add `metadataContract` to the `PROPOSALS_QUERY` selection
 *       in `useAggregatorProposals.js`. Strict mock rejects (PR
 *       #45-class violation) → same failure mode.
 *
 *   (c) Restore the legacy `proposals { ... }` nesting under
 *       `organizations` query in `useAggregatorCompanies.js`.
 *       Strict mock rejects → orgs table empty → assertion FAILS.
 *
 * Each (a)/(b)/(c) is a separate PR regression class; all three
 * caught by the same scenario.
 *
 * ── What this scenario DOESN'T catch ────────────────────────────────
 *
 *   - Subtler Checkpoint-schema gaps (e.g., a field renamed but
 *     still selected). The current regex list catches three
 *     concrete legacy patterns; extending coverage is a follow-up.
 *
 *   - Bugs INSIDE the Checkpoint indexer or api proxy themselves
 *     (the harness mocks the wire; real indexer behavior is out
 *     of scope until Phase 7 slice 4e full-stack docker compose).
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    PROBE_ORG_NAME,
    fakePoolBearingProposal,
    makeStrictCheckpointGraphqlMockHandler,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '47-checkpoint-schema-strictness',
    description: 'First scenario using the strict-schema GraphQL mock. Catches the KIND behind 6 PRs (#45, #60, #61, #62, #63, #65): legacy GraphQL queries against the post-Checkpoint schema. Strict mock rejects reverse-relation fields (Aggregator.organizations, Organization.proposals) and unknown fields (ProposalEntity.metadataContract). TWO assertions span all 3 post-Checkpoint queries — org name (organizations query) AND probe event title (proposalentities query) — so any of the 3 regressing trips the scenario.',
    bugShape:    'Legacy GraphQL query against Checkpoint schema (reverse-relation or unknown field) — KIND covers PRs #45, #60, #61, #62, #63, #65',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeStrictCheckpointGraphqlMockHandler({
            proposals: [fakePoolBearingProposal({})],
        }),
    },

    assertions: [
        // Anchor 1: organizations-query data flows in. If the
        // organizations query regresses (e.g., legacy
        // `aggregator { organizations { proposals { ... } } }`
        // nested form), the strict mock returns a GraphQL error
        // and PROBE_ORG_NAME doesn't render.
        async (page) => {
            await expect(
                page.getByText(PROBE_ORG_NAME).first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        // Anchor 2: proposalentities-query data flows in. If THAT
        // query regresses (e.g., reintroduces `metadataContract`
        // field per PR #45, or any other Checkpoint-invalid field),
        // the strict mock errors → no probe event renders →
        // assertion fails. This catches the proposalentities
        // class of regressions specifically, separate from the
        // organizations-class above.
        async (page) => {
            await expect(
                page.getByText('HARNESS-PROBE-EVENT-001').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
    ],

    timeout: 180_000,
};
