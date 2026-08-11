/**
 * 94-text-transform-cascade-milestones.scenario.mjs — closes the
 * text-transform 3-surface grid in **KIND 6 (Visual / Computed
 * CSS)**. Sister of scenario 82 (/companies) and scenario 93
 * (/markets) on the /milestones surface. Establishes KIND 6's
 * THIRD property with full 3-surface coverage (after
 * pointer-events + cursor).
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Same `text-transform: uppercase` cascade catch as scenarios
 * 82 + 93, surfacing on /milestones. Catches a /milestones-
 * specific cascade that scenarios 82 (/companies) + 93 (/markets)
 * would both miss.
 *
 * Bug shapes specific to /milestones:
 *   - Milestone-list-card component refactor that adds an
 *     `uppercase` Tailwind class to a wrapper above the list
 *     (e.g., for "branding consistency" with the company
 *     header) but breaks descendant text rendering.
 *   - Slug-resolution loading-shim element that applies
 *     `text-transform: uppercase` while loading and doesn't
 *     release after data resolves.
 *   - A /milestones-only feature flag (e.g., "campaign mode"
 *     for seasonal display) that scopes uppercase to the
 *     wrong wrapper level.
 *
 * ── Slot in KIND 6 — closes text-transform 3-surface grid ───────────
 * KIND 6 (Visual/Computed CSS) catches before this scenario:
 *   62: user-select cascade on /companies (slice 99)
 *   80: pointer-events on /companies (slice 308)
 *   81: cursor on /companies (slice 309)
 *   82: text-transform on /companies (slice 311)
 *   83-86: pointer-events + cursor on /markets + /milestones
 *   87: direction:rtl on /companies (slice 317)
 *   89: visibility:hidden on /companies (slice 319)
 *   92: opacity:0 on /companies (slice 323)
 *   93: text-transform on /markets (slice 325)
 *
 * Slice 326 (this scenario): closes text-transform 3-surface
 * grid. After this slice, KIND 6 has THREE properties at
 * full 3-surface coverage: pointer-events (80+83+84), cursor
 * (81+85+86), AND text-transform (82+93+94 — this scenario).
 *
 * Surface-by-property matrix after this slice:
 *   user-select:    /companies (62)                                = 1/3
 *   pointer-events: /companies (80) + /markets (83) + milestones (84) = 3/3 ✓
 *   cursor:         /companies (81) + /markets (85) + milestones (86) = 3/3 ✓
 *   text-transform: /companies (82) + /markets (93) + milestones (94) = 3/3 ✓ ← THIS SLICE
 *   direction:      /companies (87)                                = 1/3
 *   visibility:     /companies (89)                                = 1/3
 *   opacity:        /companies (92)                                = 1/3
 *
 * ── Strategic significance: KIND 6 sub-grid count 2 → 3 ─────────────
 * Slice 313 closed the pointer-events 3-surface grid (1st
 * sub-grid). Slice 316 closed the cursor 3-surface grid (2nd
 * sub-grid). Slice 326 closes the text-transform 3-surface grid
 * (3rd sub-grid). The sub-grid framework introduced slice 316
 * keeps growing.
 *
 * After slice 326, KIND 6 has 3 of 7 properties at full
 * 3-surface coverage and 4 of 7 at 1-surface (user-select,
 * direction, visibility, opacity — all /companies-only). 4 more
 * /markets sisters + 4 /milestones sisters = 8 slices to fully
 * fill the 7×3 matrix.
 *
 * The harness's per-surface chaos-matrix doctrine
 * (introduced slice 316) is now empirically established:
 * **3 sub-grids closed across 6 slices** (313, 316, 326) at
 * roughly 1 sub-grid per 3-4 slices. Future surface-fill
 * slices should follow the same pattern.
 *
 * ── Why pin on /milestones (mirroring scenarios 70, 71, 72, 75, 84, 86) ──
 *   /milestones uses PageLayout — same `<main>` signature as
 *   /companies + /markets. The slice-310 helper's PageLayout
 *   `<main>` selection (Tailwind `mt-20 bg-white`) hits
 *   MilestonesPage's `<main>` unchanged (proven by slices 313,
 *   316).
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to /milestones?company_id=gnosis (mirrors
 *      scenarios 84, 86 boilerplate).
 *   2. Wait for "Connect Wallet" (shared Header anchor).
 *   3. Sleep 2s — gives milestones-specific elements time
 *      to mount past the loading state.
 *   4. Call `assertPageLayoutCascadeStyleIsNot(page, {
 *      propertyName: 'textTransform', expectedNot: 'uppercase',
 *      scenarioLabel: 'Scenario 94' })`.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: assertion passes (`text-transform: 'none'`).
 *   2. Mutate any /milestones-only wrapper component (e.g.,
 *      milestones-list container or slug-resolution Suspense
 *      fallback) to include `className="uppercase"` →
 *      assertion FAILS, ancestor chain identifies the
 *      milestones-side cascade source.
 *   3. Restore → passes.
 *
 * ── What this scenario does NOT cover ───────────────────────────────
 *   - Other cascading properties on /milestones (user-select,
 *     direction, visibility, opacity). Each could get a
 *     /milestones sister.
 *   - Per-element `uppercase` on a specific button/label
 *     (legitimate). Catch only fires when cascade reaches
 *     PageLayout `<main>`.
 *   - Other text-transform values (`lowercase`, `capitalize`).
 *     Helper checks one specific value at a time.
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
    name:        '94-text-transform-cascade-milestones',
    description: 'KIND 6 (Visual/Computed CSS), 13th scenario; closes text-transform 3-surface grid. Sister of 82 (/companies) + 93 (/markets) on /milestones?company_id=gnosis. Establishes KIND 6\'s THIRD property at full 3-surface coverage (after pointer-events + cursor). Sub-grid count 2 → 3.',
    bugShape:    'uppercase class added to a milestones-list wrapper, slug-resolution Suspense fallback, useOrganization fallback overlay, or any /milestones-only feature-flag-gated wrapper: every text node on the milestones surface renders UPPERCASE. Untriggered by /companies-scoped (82) or /markets-scoped (93) sisters.',
    route:       '/milestones?company_id=gnosis',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({}),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({ prices: {} }),
    },

    assertions: [
        // Mount anchor — shared Header across /companies, /markets,
        // /milestones (proven by scenarios 69, 70, 84, 86).
        async (page) => {
            await expect(
                page.getByText('Connect Wallet').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Settle: same pattern as scenarios 84 + 86 — give
        // /milestones-specific elements time to mount past
        // loading state.
        async (page) => {
            await page.waitForTimeout(2000);
        },

        // Core: same helper call as scenarios 82 + 93. Closes
        // the text-transform 3-surface grid for KIND 6.
        async (page) => {
            await assertPageLayoutCascadeStyleIsNot(page, {
                propertyName:  'textTransform',
                expectedNot:   'uppercase',
                scenarioLabel: 'Scenario 94',
            });
        },
    ],

    timeout: 180_000,
};
