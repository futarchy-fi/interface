/**
 * 96-user-select-cascade-milestones.scenario.mjs — closes the
 * user-select 3-surface grid in **KIND 6 (Visual / Computed
 * CSS)**. Sister of scenario 62 (/companies) and scenario 95
 * (/markets) on the /milestones surface. Establishes KIND 6's
 * FOURTH property with full 3-surface coverage (after
 * pointer-events + cursor + text-transform).
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Same `user-select: none` cascade catch as scenarios 62 + 95,
 * surfacing on /milestones. Catches a /milestones-specific
 * cascade that scenarios 62 (/companies) + 95 (/markets) would
 * both miss.
 *
 * Bug shapes specific to /milestones:
 *   - Milestone-list-card refactor adds `select-none` to a
 *     wrapper above the list (e.g., to prevent text drag-select
 *     during scroll) but breaks descendant text selection.
 *   - Slug-resolution loading-shim element applies
 *     `user-select: none` while loading and doesn't release.
 *   - A campaign-mode feature-flag wrapper that scopes
 *     `select-none` too broadly.
 *
 * /milestones-specific copy targets:
 *   - Milestone titles (users share via copy-paste).
 *   - Company addresses or slugs visible in milestone-card
 *     metadata.
 *   - Outcome / probability values for analysis.
 *
 * ── Slot in KIND 6 — closes user-select 3-surface grid ──────────────
 * KIND 6 catches before this scenario:
 *   62: user-select on /companies (slice 99)
 *   80-86: pointer-events + cursor matrices closed
 *   82, 87, 89, 92, 93, 94: text-transform + others
 *   95: user-select on /markets (slice 327, lifts 1/3 → 2/3)
 *
 * Slice 328 (this scenario): closes user-select 3-surface
 * grid. After this slice, KIND 6 has FOUR properties at full
 * 3-surface coverage:
 *   - pointer-events (80+83+84) — closed slice 313
 *   - cursor (81+85+86) — closed slice 316
 *   - text-transform (82+93+94) — closed slice 326
 *   - **user-select (62+95+96) — closed THIS SLICE**
 *
 * Surface-by-property matrix after this slice:
 *   user-select:    /companies (62) + /markets (95) + milestones (96) = 3/3 ✓ ← THIS
 *   pointer-events: 3/3 ✓
 *   cursor:         3/3 ✓
 *   text-transform: 3/3 ✓
 *   direction:      /companies (87)                                = 1/3
 *   visibility:     /companies (89)                                = 1/3
 *   opacity:        /companies (92)                                = 1/3
 *
 * ── Strategic significance: KIND 6 sub-grid count 3 → 4 ─────────────
 * Sub-grid closure trail:
 *   Slice 313: pointer-events 3-surface closed (1st sub-grid).
 *   Slice 316: cursor 3-surface closed (2nd sub-grid).
 *   Slice 326: text-transform 3-surface closed (3rd sub-grid).
 *   **Slice 328: user-select 3-surface closed (4th sub-grid).**
 *
 * Cadence: sub-grids close every ~3-4 slices in surface-fill
 * phase (326 → 328 = 2-slice gap; 316 → 326 = 10-slice gap
 * during property-axis growth phase; 313 → 316 = 3-slice gap).
 *
 * 4 of 7 properties now structurally complete. 3 properties
 * remain single-surface: direction, visibility, opacity.
 * Continuing the 2-slice cadence (1/3 → 2/3 → 3/3) per
 * property: 6 more slices to fully fill the 7×3 matrix
 * (KIND 6's structural completion).
 *
 * ── Backup-catch synergy with text-selection KIND ──────────────────
 * After this slice, BOTH KIND 6 (computed-CSS read) AND the
 * text-selection KIND (interactive triple-click) cover
 * `user-select: none` at full 3-surface coverage:
 *
 *   text-selection KIND: 51 (/companies), 68 (/markets), 72
 *     (/milestones)
 *   KIND 6 user-select:  62 (/companies), 95 (/markets), **96
 *     (/milestones — THIS)**
 *
 * Both mechanisms now redundantly catch the same regression
 * across all 3 surfaces. Maximum robustness against either
 * mechanism path failing.
 *
 * ── Why pin on /milestones (mirroring scenarios 70, 71, 72, 75, 84, 86, 94) ──
 *   /milestones uses PageLayout. Helper's PageLayout `<main>`
 *   selection (Tailwind `mt-20 bg-white`) hits MilestonesPage's
 *   `<main>` unchanged.
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to /milestones?company_id=gnosis (mirrors
 *      scenarios 84, 86, 94 boilerplate).
 *   2. Wait for "Connect Wallet" (shared Header anchor).
 *   3. Sleep 2s — gives /milestones-specific elements time
 *      to mount past the loading state.
 *   4. Call `assertPageLayoutCascadeStyleIsNot(page, {
 *      propertyName: 'userSelect', expectedNot: 'none',
 *      scenarioLabel: 'Scenario 96' })`.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: assertion passes (`user-select: 'auto'`
 *      or `'text'`).
 *   2. Mutate any /milestones-only wrapper (milestones-list
 *      container or slug-resolution Suspense fallback) to
 *      include `className="select-none"` → assertion FAILS,
 *      ancestor chain identifies the milestones-side cascade
 *      source.
 *   3. Restore → passes.
 *
 * ── What this scenario does NOT cover ───────────────────────────────
 *   - Per-element `user-select: none` (legitimate for chart
 *     hover-interaction, drag handles). Catch only fires when
 *     cascade reaches PageLayout `<main>`.
 *   - Other user-select values (`text`, `all`, `contain`).
 *     Helper checks one specific value at a time.
 *   - User-select regressions on non-PageLayout pages.
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
    name:        '96-user-select-cascade-milestones',
    description: 'KIND 6 (Visual/Computed CSS), 15th scenario; closes user-select 3-surface grid. Sister of 62 (/companies) + 95 (/markets) on /milestones. Establishes KIND 6\'s FOURTH property at full 3-surface coverage (after pointer-events + cursor + text-transform). Sub-grid count 3 → 4. Backup-catch synergy with text-selection KIND now at full 3-surface for both mechanisms.',
    bugShape:    'select-none class added to a milestones-list wrapper, slug-resolution Suspense fallback, useOrganization fallback overlay, or any /milestones-only feature-flag-gated wrapper: every text node on the milestones surface becomes unselectable. Users see milestone titles, company addresses, outcome values but can\'t copy them. Untriggered by /companies-scoped (62) or /markets-scoped (95) sisters.',
    route:       '/milestones?company_id=gnosis',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({}),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({ prices: {} }),
    },

    assertions: [
        // Mount anchor — shared Header across /companies, /markets,
        // /milestones (proven by scenarios 69, 70, 84, 86, 94).
        async (page) => {
            await expect(
                page.getByText('Connect Wallet').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Settle: same pattern as scenarios 84/86/94 — give
        // /milestones-specific elements time to mount past
        // loading state.
        async (page) => {
            await page.waitForTimeout(2000);
        },

        // Core: same helper call as scenarios 62 + 95. Closes
        // the user-select 3-surface grid for KIND 6.
        async (page) => {
            await assertPageLayoutCascadeStyleIsNot(page, {
                propertyName:  'userSelect',
                expectedNot:   'none',
                scenarioLabel: 'Scenario 96',
            });
        },
    ],

    timeout: 180_000,
};
