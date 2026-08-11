/**
 * 87-direction-rtl-cascade-companies.scenario.mjs — fifth
 * cascading-property catch in **KIND 6 (Visual / Computed CSS)**.
 * Sister of scenarios 62 + 80 + 81 + 82 on /companies; introduces
 * a fifth cascading CSS property: `direction`.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * `direction: rtl` cascade. CSS `direction` is an inherited
 * property — a value set on a parent propagates to descendants
 * unless explicitly overridden. When `rtl` cascades from a
 * page-level wrapper (PageLayout root, an i18n-utility wrapper
 * that scoped too broadly), EVERY text node renders right-to-left
 * AND all flex/grid containers reverse their cross-axis direction.
 *
 * Distinct from the four prior cascade catches (user-select,
 * pointer-events, cursor, text-transform) because the regression
 * shape is INTERNATIONALIZATION, not aesthetics or interactivity.
 * The futarchy interface targets LTR languages; an accidental
 * cascade to RTL would silently flip every layout element.
 *
 * Bug shapes caught:
 *
 *   1. **Tailwind `rtl` class pasted at PageLayout root** — Tailwind
 *      has the `rtl` utility class for opt-in RTL support per
 *      element. Pasting it at a layout wrapper applies RTL
 *      styling globally, which the codebase isn't designed for.
 *
 *   2. **i18n library configuration scope drift** — a "global RTL
 *      mode" toggle accidentally enabled on layout root instead of
 *      a specific RTL-language section.
 *
 *   3. **Stylesheet rule like `body { direction: rtl; }`** added
 *      during a refactor and never narrowed.
 *
 *   4. **CSS-in-JS theme variable like `--text-direction: rtl`**
 *      pulled in at root level via a misplaced theme-token
 *      import.
 *
 * Why this matters even on an LTR-only app:
 *   - Numbers, dates, currency formatting flip in unexpected
 *     ways under `direction: rtl` (`bidi-override` cases).
 *   - Flexbox/Grid `flex-direction: row` flips to right-to-left,
 *     breaking visual hierarchy (Connect Wallet button moves
 *     to the wrong side, navigation order reversed).
 *   - Symbols like `>` (arrow) keep their glyph but the
 *     surrounding context flips, making them point the wrong
 *     way semantically.
 *
 * ── Slot in KIND 6 — fifth cascading property ───────────────────────
 * KIND 6 (Visual/Computed CSS) catches before this scenario:
 *   62: user-select cascade on /companies (slice 99)
 *   80: pointer-events cascade on /companies (slice 308)
 *   81: cursor cascade on /companies (slice 309)
 *   82: text-transform cascade on /companies (slice 311)
 *   83: pointer-events on /markets (slice 312)
 *   84: pointer-events on /milestones (slice 313)
 *   85: cursor on /markets (slice 315)
 *   86: cursor on /milestones (slice 316)
 *
 * Slice 317 (this scenario): introduces a 5th cascading property
 * to the /companies /companies row. Property axis grows
 * 4 → 5 properties. Surface axis stays at 3 surfaces. Total
 * possible cells in the matrix grows 12 → 15 (5 × 3). Cells
 * filled grows 8 → 9.
 *
 * Surface-by-property matrix after this slice:
 *   user-select:    /companies (62)                                = 1/3
 *   pointer-events: /companies (80) + /markets (83) + milestones (84) = 3/3 ✓
 *   cursor:         /companies (81) + /markets (85) + milestones (86) = 3/3 ✓
 *   text-transform: /companies (82)                                = 1/3
 *   direction:      /companies (87)                                = 1/3 ← THIS SLICE
 *
 * ── Why `direction: rtl` for the 5th property ───────────────────────
 *   - Different bug shape from existing 4 (interactivity,
 *     aesthetics) — internationalization. Adds genuine
 *     diversity to the property axis.
 *   - Real Tailwind utility class (`rtl`) — paste-prone like
 *     `select-none`, `pointer-events-none`, `cursor-not-allowed`,
 *     `uppercase`.
 *   - Catches a regression class that NO other harness scenario
 *     touches. The text-selection / a11y / network catches don't
 *     surface RTL flips.
 *   - 1-liner with slice-310 helper — consistent with the
 *     established cascade-catch pattern.
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to `/companies`.
 *   2. Wait for CompaniesListCarousel heading (same anchor as
 *      62, 80, 81, 82).
 *   3. Call `assertPageLayoutCascadeStyleIsNot(page, {
 *      propertyName: 'direction', expectedNot: 'rtl',
 *      scenarioLabel: 'Scenario 87' })`.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: assertion passes (`direction: 'ltr'`).
 *   2. Mutate `src/components/layout/PageLayout.jsx:5`:
 *         `<div className="flex flex-col rtl flex-grow">`
 *      → assertion FAILS with `direction: 'rtl'` at `<main>`,
 *      ancestor chain identifies the PageLayout root div as
 *      cascade source.
 *   3. Restore → passes.
 *
 * ── What this scenario does NOT cover ───────────────────────────────
 *   - Per-element `direction: rtl` (legitimate for a specific
 *     RTL-language section). Catch only fires when cascade
 *     reaches PageLayout `<main>`.
 *   - `unicode-bidi: bidi-override` regressions (different
 *     property; would need its own catch).
 *   - Logical-property regressions (`margin-inline-start` vs
 *     `margin-left`) — these don't cascade in the same way.
 *   - /markets and /milestones sisters (deferred; would lift
 *     direction toward 3-surface coverage if surface-specific
 *     RTL risk materializes).
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    makeGraphqlMockHandler,
    makeCandlesMockHandler,
    fakePoolBearingProposal,
} from '../fixtures/api-mocks.mjs';
import { assertPageLayoutCascadeStyleIsNot } from '../fixtures/cascading-css.mjs';

export default {
    name:        '87-direction-rtl-cascade-companies',
    description: 'KIND 6 (Visual/Computed CSS), 9th scenario; 5th cascading property in the matrix. Navigate to /companies, assert getComputedStyle(<main>).direction !== "rtl". A `direction: rtl` cascade from a layout-level wrapper (Tailwind `rtl` utility class pasted, i18n scope drift, theme token at root) flips every text node + reverses flex/grid layouts on an LTR-only app. Internationalization catch — different bug shape from the prior 4 cascade catches.',
    bugShape:    'rtl class added to PageLayout root or any ancestor of <main>: every text node renders right-to-left, flex/grid layouts reverse direction, Connect Wallet button moves to wrong side, navigation order flips, numbers/currency formatting shifts unexpectedly. Total layout flip on an LTR-targeted app. No DOM diff, no errors, no network change — visual-only regression.',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakePoolBearingProposal({})],
        }),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({}),
    },

    assertions: [
        // Mirror 62/80/81/82's anchor — wait for the page-shell
        // to mount past the loading state. Same boilerplate as
        // every other /companies cascade catch.
        async (page) => {
            await expect(
                page.getByRole('heading', { name: /Organizations|Active Milestones/i }).first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Core: 1-liner with slice-310 helper. Different
        // property + regression marker from prior 4 catches.
        // Validates the helper handles the 5th cascading
        // property unchanged.
        async (page) => {
            await assertPageLayoutCascadeStyleIsNot(page, {
                propertyName:  'direction',
                expectedNot:   'rtl',
                scenarioLabel: 'Scenario 87',
            });
        },
    ],

    timeout: 60_000,
};
