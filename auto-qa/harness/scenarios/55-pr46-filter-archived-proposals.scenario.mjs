/**
 * 55-pr46-filter-archived-proposals.scenario.mjs — catches PR #46
 * (filter archived proposals from companies and proposals lists).
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * DOM-list filter regression. Some on-chain proposals are
 * test/abandoned markets (e.g. AAVE token alignment, CIP-83, GIP-150
 * with wrong-year timestamps) that should never appear in the live
 * UI. PR #46 added an `archived: true` metadata flag and made BOTH
 * `useAggregatorCompanies.transformOrgToCard` and
 * `useAggregatorProposals.fetchProposalsFromAggregator` skip these
 * rows. A regression would let archived proposals re-appear in
 * Active Milestones / Resolved Events / the Companies grid.
 *
 * Distinct from scenario 47's strict-schema KIND: that fails on a
 * query-shape regression at the wire level. THIS scenario fails on
 * a CLIENT-side filter regression — the query returns both rows;
 * the consumer's filter is what decides which to render.
 *
 * ── PR #46 in one paragraph ─────────────────────────────────────────
 * Two filter additions:
 *   1. `useAggregatorCompanies.js:transformOrgToCard` —
 *      `proposals` array filtered by `meta.archived !== true`
 *      before the active-count compute. Affects the organizations
 *      grid (active count + which proposals roll up into orgs).
 *   2. `useAggregatorProposals.js:fetchProposalsFromAggregator` —
 *      explicit `continue` if `proposalMeta.archived === true`.
 *      Affects Active Milestones carousel + Resolved Events
 *      carousel.
 *
 * ── How this scenario catches it ────────────────────────────────────
 * Two probe proposals injected into the registry mock:
 *   - ACTIVE: title `HARNESS-ACTIVE-PROBE-001`, no archived flag
 *   - ARCHIVED: title `HARNESS-ARCHIVED-PROBE-001`, metadata
 *     `archived: true`
 *
 * Navigate /companies. Assert:
 *   - ACTIVE title IS visible (sanity — mock + filter machinery
 *     works for at least the happy row)
 *   - ARCHIVED title is NOT visible anywhere on the page
 *
 * Pre-PR-46 (or after deleting the filter), BOTH titles render in
 * the carousels. Post-PR-46 only ACTIVE renders.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *
 *   1. Current code: assertion passes (ACTIVE visible, ARCHIVED not).
 *
 *   2. Mutate `src/hooks/useAggregatorProposals.js` line 411-415 by
 *      removing the `if (proposalMeta.archived === true) continue;`
 *      block → assertion FAILS (ARCHIVED title appears in the
 *      Active Milestones carousel).
 *
 *   3. Restore → passes.
 *
 *   4. Sister mutation: `src/hooks/useAggregatorCompanies.js`
 *      line 69-74 — replace the filter with `org.proposals || []`
 *      (pre-fix shape) → if the scenario covered the org-card
 *      count too, that would fail. (Current assertion only catches
 *      the proposals-carousel filter; a future iteration could add
 *      org-card-count assertions.)
 *
 * ── Mocks ───────────────────────────────────────────────────────────
 * Registry GraphQL returns BOTH probes. Candles GraphQL returns
 * synthetic pool data for both. Same surface as scenarios 47 / 50.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    fakePoolBearingProposal,
    makeGraphqlMockHandler,
    makeCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';

const ACTIVE_TITLE   = 'HARNESS-ACTIVE-PROBE-001';
const ARCHIVED_TITLE = 'HARNESS-ARCHIVED-PROBE-001';

export default {
    name:        '55-pr46-filter-archived-proposals',
    description: 'Catches PR #46 (filter archived proposals from carousels). Two probe proposals (one active, one archived: true) returned by the registry mock; scenario asserts the active title renders and the archived title does NOT. Reverting the filter lets the archived row leak into the Active Milestones carousel.',
    bugShape:    'archived: true filter missing from fetchProposalsFromAggregator: test/abandoned proposals (AAVE token alignment, CIP-83, broken GIP-150) re-appear in Active Milestones / Resolved Events / Companies grid',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [
                fakePoolBearingProposal({
                    idSuffix:        '0a',
                    title:           ACTIVE_TITLE,
                    proposalAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0a',
                }),
                fakePoolBearingProposal({
                    idSuffix:        '0b',
                    title:           ARCHIVED_TITLE,
                    proposalAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0b',
                    metadataExtra:   { archived: true },
                }),
            ],
        }),
        // Candles permissive — both probe rows have conditional_pools
        // metadata; some carousels look up pool prices for them.
        // Returning an empty pool map is fine (carousels render the
        // event title regardless).
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({}),
    },

    assertions: [
        async (page) => {
            await expect(
                page.getByText(ACTIVE_TITLE).first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Core assertion: the ARCHIVED title should NOT be visible
        // anywhere on the page. If the archived-filter is reverted,
        // this fails — the archived proposal renders in the
        // Active Milestones carousel right next to the active one.
        // We give the page extra settle time before asserting
        // absence, otherwise we'd false-pass on slow renders.
        async (page) => {
            await page.waitForTimeout(2000);
            await expect(
                page.getByText(ARCHIVED_TITLE),
            ).toHaveCount(0);
        },
    ],

    timeout: 180_000,
};
