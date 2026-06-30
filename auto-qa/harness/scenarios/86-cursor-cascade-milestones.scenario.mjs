/**
 * 86-cursor-cascade-milestones.scenario.mjs — closes the cursor
 * 3-surface grid in **KIND 6 (Visual / Computed CSS)**. Sister
 * of scenario 81 (/companies) and scenario 85 (/markets) on the
 * /milestones surface. Establishes KIND 6's SECOND property
 * with full 3-surface coverage (after pointer-events).
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Same `cursor: not-allowed` cascade catch as scenarios 81 + 85,
 * surfacing on the /milestones page. Catches a /milestones-
 * specific cascade that scenarios 81 (/companies) + 85 (/markets)
 * would both miss.
 *
 * Bug shapes specific to /milestones:
 *   - A milestones-list-component wrapper getting
 *     `cursor-not-allowed` from a refactor (e.g., a "card grid"
 *     style accidentally including a disabled-state class).
 *   - The slug-resolution loading shim leaking its disabled
 *     cursor state to descendants AFTER the org loads.
 *   - A `useOrganization` fallback rendering a wrapped overlay
 *     with `cursor: not-allowed` that doesn't release.
 *   - Any /milestones-only feature flag rolling out a wrapper
 *     with bad cursor CSS.
 *
 * ── Slot in KIND 6 — closes cursor 3-surface grid ───────────────────
 * KIND 6 (Visual/Computed CSS) catches before this scenario:
 *   62: user-select cascade on /companies (slice 99)
 *   80: pointer-events cascade on /companies (slice 308)
 *   81: cursor cascade on /companies (slice 309)
 *   82: text-transform cascade on /companies (slice 311)
 *   83: pointer-events cascade on /markets (slice 312)
 *   84: pointer-events cascade on /milestones (slice 313 —
 *       closed pointer-events 3-surface grid; lifted KIND 6
 *       to "6/12 sister-pattern KINDs at 3-surface" tally)
 *   85: cursor cascade on /markets (slice 315)
 *   86: cursor cascade on /milestones (this scenario, slice
 *       316 — closes cursor 3-surface grid)
 *
 * After this scenario, KIND 6 has TWO properties at full
 * 3-surface coverage: pointer-events (80+83+84) and cursor
 * (81+85+86). Establishes the "sub-grid" framework explicitly:
 * a single KIND can host multiple properties each independently
 * at 3-surface coverage.
 *
 * Surface-by-property matrix after this slice:
 *   user-select:    /companies (62)                                = 1/3
 *   pointer-events: /companies (80) + /markets (83) + milestones (84) = 3/3 ✓
 *   cursor:         /companies (81) + /markets (85) + milestones (86) = 3/3 ✓ ← this slice
 *   text-transform: /companies (82)                                = 1/3
 *
 * ── Why pin on /milestones (mirroring scenarios 70, 71, 72, 75, 84) ──
 *   /milestones uses PageLayout — same `<main>` signature as
 *   /companies + /markets. The slice-310 helper's PageLayout
 *   `<main>` selection (Tailwind `mt-20 bg-white`) hits
 *   MilestonesPage's `<main>` unchanged (already proven by
 *   slice 313's scenario 84).
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to /milestones?company_id=gnosis (mirrors
 *      scenarios 70, 84 boilerplate).
 *   2. Wait for "Connect Wallet" (shared Header anchor).
 *   3. Sleep 2s — gives milestones-specific elements time to
 *      mount past the loading state.
 *   4. Call `assertPageLayoutCascadeStyleIsNot(page, {
 *      propertyName: 'cursor', expectedNot: 'not-allowed',
 *      scenarioLabel: 'Scenario 86' })`.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: assertion passes (`cursor: 'auto'`).
 *   2. Mutate any /milestones-only wrapper component (e.g., the
 *      milestones-list container or a slug-resolution
 *      <Suspense> fallback) to include
 *      `className="cursor-not-allowed"` → assertion FAILS,
 *      ancestor chain identifies the milestones-side cascade
 *      source.
 *   3. Restore → passes.
 *
 * ── Closing the cursor 3-surface grid: structural payoff ────────────
 * Before this slice, KIND 6 had ONE property at 3-surface
 * coverage (pointer-events). After this slice: TWO properties.
 *
 * The "sub-grid" framework matters because it shows that a
 * single KIND can scale on TWO axes:
 *   - Property axis (user-select, pointer-events, cursor,
 *     text-transform, etc.) — adds new cascade catches.
 *   - Surface axis (companies, markets, milestones) — adds
 *     cross-surface coverage per property.
 *
 * The slice-310 helper makes BOTH axes 1-liner expansions.
 * Scaling KIND 6 to N properties × M surfaces = N×M scenarios
 * each ~6 lines of catch logic. The harness's per-surface
 * chaos-matrix doctrine generalizes to per-(surface,property)
 * for KIND 6.
 *
 * ── What this scenario does NOT cover ───────────────────────────────
 *   - Other cascading properties on /milestones (user-select,
 *     text-transform). Each could get a /milestones sister to
 *     fill more cells of the matrix.
 *   - Per-element `cursor: not-allowed` (legitimate on
 *     disabled buttons). Catch only fires when cascade reaches
 *     PageLayout `<main>`.
 *   - Non-cascade cursor regressions (e.g., button-specific
 *     `cursor: pointer` removed). Different catch shape.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    makeGraphqlMockHandler,
    makeCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';
import { assertPageLayoutCascadeStyleIsNot } from '../fixtures/cascading-css.mjs';

export default {
    name:        '86-cursor-cascade-milestones',
    description: 'KIND 6 (Visual/Computed CSS), 8th scenario; closes cursor 3-surface grid. Sister of 81 (/companies) + 85 (/markets) on /milestones?company_id=gnosis. Establishes KIND 6\'s SECOND property at full 3-surface coverage (after pointer-events). Demonstrates the sub-grid framework: a single KIND scales independently on property axis and surface axis, both via 1-liner helper calls.',
    bugShape:    'cursor-not-allowed added to a milestones-list wrapper, slug-resolution Suspense fallback, useOrganization fallback overlay, or any /milestones-only feature-flag-gated wrapper: every interactive element on the milestones surface renders with the blocked cursor on hover. Untriggered by /companies-scoped (81) or /markets-scoped (85) sisters.',
    route:       '/milestones?company_id=gnosis',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({}),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({ prices: {} }),
    },

    assertions: [
        // Mount anchor — shared Header across /companies, /markets,
        // /milestones (proven by scenarios 69, 70, 84).
        async (page) => {
            await expect(
                page.getByText('Connect Wallet').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Settle: same pattern as scenario 84 — give /milestones-
        // specific elements time to mount past loading state. An
        // intermediate loading shim with `cursor: not-allowed`
        // could trigger a false positive without this.
        async (page) => {
            await page.waitForTimeout(2000);
        },

        // Core: same helper call as scenarios 81 + 85. Closes
        // the cursor 3-surface grid for KIND 6.
        async (page) => {
            await assertPageLayoutCascadeStyleIsNot(page, {
                propertyName:  'cursor',
                expectedNot:   'not-allowed',
                scenarioLabel: 'Scenario 86',
            });
        },
    ],

    timeout: 180_000,
};
