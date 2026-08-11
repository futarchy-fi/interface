/**
 * 56-pr61-filter-archived-orgs.scenario.mjs — catches PR #61 (filter
 * archived / hidden orgs on the Companies page).
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Same DOM-absence KIND as scenario 55 (slice 88), but the gate is
 * at the ORG level rather than the proposal level. Two distinct
 * filter sites in PR #61's diff:
 *   - `EventsHighlightDataTransformer.jsx:25-32` — Active Milestones
 *     carousel skips proposals whose org metadata is `archived: true`
 *     or `visibility: 'hidden'`.
 *   - `ResolvedEventsDataTransformer.jsx:19-23` — Resolved Events
 *     carousel applies the same org-level rule.
 *
 * Without this filter, a proposal from an org marked as a dead /
 * staging org leaks back into the carousels even though the org
 * itself should be hidden from /companies.
 *
 * ── Sister to scenario 55 ───────────────────────────────────────────
 * Scenario 55 (PR #46) catches the PER-PROPOSAL archived flag; this
 * scenario catches the PER-ORG archived flag. Together they pin
 * both branches of the archived/hidden filter chain. Reverting
 * either filter site trips the corresponding scenario; both pass on
 * current src.
 *
 * ── How this scenario catches it ────────────────────────────────────
 * Two probe organizations:
 *   - ACTIVE_ORG (id PROBE_ORG_ID, no archived flag)
 *   - ARCHIVED_ORG (distinct id, metadata `archived: true`)
 *
 * Two probe proposals, one in each org, with distinct titles:
 *   - `HARNESS-ACTIVE-ORG-EVENT-001` (in ACTIVE_ORG)
 *   - `HARNESS-ARCHIVED-ORG-EVENT-001` (in ARCHIVED_ORG)
 *
 * Navigate /companies. Assert:
 *   - ACTIVE_ORG event title IS visible (sanity)
 *   - ARCHIVED_ORG event title is NOT visible (the catch signal)
 *
 * Pre-PR-61 (or after deleting either filter site), the archived
 * org's proposal renders in the Active Milestones carousel right
 * next to the active one.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *
 *   1. Current code: assertion passes (active visible, archived
 *      org's proposal not).
 *
 *   2. Mutate `src/components/futarchyFi/companyList/page/
 *      EventsHighlightDataTransformer.jsx` line 30 by deleting
 *      `if (orgMeta.archived === true) return false;` → assertion
 *      FAILS (archived org's event appears in the carousel).
 *
 *   3. Restore → passes.
 *
 * Operational note (from slice 88): the `next dev` reuseExistingServer
 * flow caches modules. After src edits like the regression above,
 * kill the dev server (`lsof -i :3000 -t | xargs kill`) before
 * re-running, or HMR may not pick up the change.
 *
 * ── Mocks ───────────────────────────────────────────────────────────
 * Registry mock returns BOTH orgs explicitly (custom `organizations`
 * array) and BOTH proposals (each pointing to its own org via the
 * new `organizationId` option on `fakePoolBearingProposal`). Candles
 * mock permissive — both probes have conditional_pools metadata.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    PROBE_ORG_ID,
    PROBE_AGG_ID,
    fakePoolBearingProposal,
    makeGraphqlMockHandler,
    makeCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';

const ACTIVE_ORG_ID    = PROBE_ORG_ID;
const ARCHIVED_ORG_ID  = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeee'; // last char e (vs default f)
const ACTIVE_ORG_NAME  = 'HARNESS-ACTIVE-ORG-001';
const ARCHIVED_ORG_NAME = 'HARNESS-ARCHIVED-ORG-001';

const ACTIVE_TITLE   = 'HARNESS-ACTIVE-ORG-EVENT-001';
const ARCHIVED_TITLE = 'HARNESS-ARCHIVED-ORG-EVENT-001';

export default {
    name:        '56-pr61-filter-archived-orgs',
    description: 'Catches PR #61 (filter archived orgs from carousels). Two probe orgs (one archived: true in metadata), each with one proposal. Scenario asserts active org\'s proposal renders and archived org\'s proposal does NOT. Sister to scenario 55 — that one filters at proposal level, this one at org level.',
    bugShape:    'archived: true filter missing from EventsHighlightDataTransformer / ResolvedEventsDataTransformer org-level filters: proposals from dead/staging orgs re-appear in Active Milestones / Resolved Events',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            // Custom organizations array — TWO orgs, one archived.
            // The mock spreads `organizations` directly into the
            // organizations query response.
            organizations: [
                {
                    id:           ACTIVE_ORG_ID,
                    name:         ACTIVE_ORG_NAME,
                    description:  'Active org (harness)',
                    metadata:     null,
                    metadataURI:  null,
                    owner:        '0x0000000000000000000000000000000000000000',
                    editor:       '0x0000000000000000000000000000000000000000',
                },
                {
                    id:           ARCHIVED_ORG_ID,
                    name:         ARCHIVED_ORG_NAME,
                    description:  'Archived org (harness)',
                    // The org-level archived flag lives in metadata.
                    metadata:     JSON.stringify({ archived: true }),
                    metadataURI:  null,
                    owner:        '0x0000000000000000000000000000000000000000',
                    editor:       '0x0000000000000000000000000000000000000000',
                },
            ],
            proposals: [
                fakePoolBearingProposal({
                    idSuffix:        '1a',
                    title:           ACTIVE_TITLE,
                    proposalAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb1a',
                    organizationId:  ACTIVE_ORG_ID,
                }),
                fakePoolBearingProposal({
                    idSuffix:        '1b',
                    title:           ARCHIVED_TITLE,
                    proposalAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb1b',
                    organizationId:  ARCHIVED_ORG_ID,
                }),
            ],
        }),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({}),
    },

    assertions: [
        async (page) => {
            await expect(
                page.getByText(ACTIVE_TITLE).first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Core assertion: the ARCHIVED org's event title should NOT
        // be visible. If the org-level archived filter is reverted,
        // this fails (`Received: N elements`).
        async (page) => {
            await page.waitForTimeout(2000);
            await expect(
                page.getByText(ARCHIVED_TITLE),
            ).toHaveCount(0);
        },
    ],

    timeout: 180_000,
};
