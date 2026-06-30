/**
 * 89-visibility-hidden-cascade-companies.scenario.mjs — sixth
 * cascading-property catch in **KIND 6 (Visual / Computed CSS)**.
 * Sister of scenarios 62 + 80 + 81 + 82 + 87 on /companies;
 * introduces a sixth cascading CSS property: `visibility`.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * `visibility: hidden` cascade. CSS `visibility` is an inherited
 * property — a value set on a parent propagates to descendants
 * unless explicitly overridden. When `hidden` cascades from a
 * page-level wrapper (PageLayout root, an overlay wrapper, a
 * loading shim that doesn't release), the entire page becomes
 * INVISIBLE while the layout space stays reserved.
 *
 * Distinct from `display: none` (which collapses the box and
 * doesn't cascade in the same way), `visibility: hidden`
 * preserves the layout footprint — buttons stay where they were,
 * but they can't be seen OR interacted with. Worse than
 * `pointer-events: none` (which leaves elements visible but
 * non-clickable) and worse than `opacity: 0` (which is similar
 * but keeps elements clickable).
 *
 * Bug shapes caught:
 *
 *   1. **Tailwind `invisible` class pasted at PageLayout root**
 *      — Tailwind's `invisible` utility maps to
 *      `visibility: hidden`. Adjacent in naming to `hidden`
 *      (which maps to `display: none`); easy paste typo.
 *
 *   2. **Loading-shim element doesn't release** — a wrapper
 *      that's supposed to fade in via `visibility: visible`
 *      after data loads but stays at `visibility: hidden`
 *      because the state transition broke.
 *
 *   3. **Theme-conditional visibility token wrong** — a CSS-
 *      in-JS theme variable like `--page-visibility` set to
 *      `hidden` for a state the page is in inadvertently.
 *
 *   4. **Stylesheet rule like `.dark { visibility: hidden; }`**
 *      added during a theme refactor and never narrowed.
 *
 * ── Slot in KIND 6 — sixth cascading property ───────────────────────
 * KIND 6 (Visual/Computed CSS) catches before this scenario:
 *   62: user-select cascade on /companies (slice 99)
 *   80: pointer-events cascade on /companies (slice 308)
 *   81: cursor cascade on /companies (slice 309)
 *   82: text-transform cascade on /companies (slice 311)
 *   83: pointer-events on /markets (slice 312)
 *   84: pointer-events on /milestones (slice 313)
 *   85: cursor on /markets (slice 315)
 *   86: cursor on /milestones (slice 316)
 *   87: direction:rtl cascade on /companies (slice 317)
 *
 * Slice 319 (this scenario): introduces a 6th cascading property
 * to the /companies row. Property axis grows 5 → 6 properties.
 * Surface axis stays at 3 surfaces. Total possible cells in the
 * matrix grows 15 → 18. Cells filled grows 9 → 10.
 *
 * Surface-by-property matrix after this slice:
 *   user-select:    /companies (62)                                = 1/3
 *   pointer-events: /companies (80) + /markets (83) + milestones (84) = 3/3 ✓
 *   cursor:         /companies (81) + /markets (85) + milestones (86) = 3/3 ✓
 *   text-transform: /companies (82)                                = 1/3
 *   direction:      /companies (87)                                = 1/3
 *   visibility:     /companies (89)                                = 1/3 ← THIS SLICE
 *
 * ── Why `visibility: hidden` for the 6th property ───────────────────
 *   - Different bug shape from existing 5 cascade catches:
 *     visibility-hiding (page invisible but layout reserved).
 *     Distinct from interactivity (pointer-events), aesthetics
 *     (text-transform, direction), and copy/cursor concerns.
 *   - Tailwind utility class `invisible` is real and adjacent
 *     to `hidden` (display:none) in naming — typo risk is
 *     concrete.
 *   - Worst of both worlds vs the prior catches: layout
 *     footprint kept (so users see "empty space" where
 *     content should be), AND content non-interactive (no
 *     clicks on hidden buttons). Both signals at once.
 *   - 1-liner with slice-310 helper.
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to /companies.
 *   2. Wait for CompaniesListCarousel heading (same anchor as
 *      62, 80, 81, 82, 87).
 *   3. Call `assertPageLayoutCascadeStyleIsNot(page, {
 *      propertyName: 'visibility', expectedNot: 'hidden',
 *      scenarioLabel: 'Scenario 89' })`.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: assertion passes (`visibility: 'visible'`).
 *   2. Mutate `src/components/layout/PageLayout.jsx:5`:
 *         `<div className="flex flex-col invisible flex-grow">`
 *      → assertion FAILS with `visibility: 'hidden'` at
 *      `<main>`, ancestor chain identifies the PageLayout
 *      root div as cascade source.
 *   3. Restore → passes.
 *
 * ── What this scenario does NOT cover ───────────────────────────────
 *   - `display: none` (different mechanism — collapses box,
 *     doesn't cascade through `visibility`).
 *   - `opacity: 0` (related visual-hiding regression, but
 *     leaves elements clickable). Could be a 7th cascade
 *     catch.
 *   - Per-element `visibility: hidden` (legitimate for
 *     overlay-state hidden elements). Catch only fires when
 *     cascade reaches PageLayout `<main>`.
 *   - /markets and /milestones sisters (deferred; would lift
 *     visibility toward 3-surface coverage).
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
    name:        '89-visibility-hidden-cascade-companies',
    description: 'KIND 6 (Visual/Computed CSS), 10th scenario; 6th cascading property in the matrix. Navigate to /companies, assert getComputedStyle(<main>).visibility !== "hidden". A `visibility: hidden` cascade from a layout-level wrapper (Tailwind `invisible` typo, loading shim that doesn\'t release, theme-conditional regression) makes the entire page invisible while the layout footprint stays reserved. Worst of both worlds: users see empty space where content should be, AND content is non-interactive.',
    bugShape:    'invisible class pasted at PageLayout root or any ancestor of <main>: every descendant inherits visibility:hidden — page renders as empty space (layout reserved, content invisible, non-interactive). Tailwind `invisible` (visibility:hidden) is one typo away from `hidden` (display:none). No DOM diff, no errors, no network change — pure visibility regression.',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakePoolBearingProposal({})],
        }),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({}),
    },

    assertions: [
        // Mirror 62/80/81/82/87's anchor — wait for the page-
        // shell to mount past the loading state.
        async (page) => {
            await expect(
                page.getByRole('heading', { name: /Organizations|Active Milestones/i }).first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Core: 1-liner with slice-310 helper. 6th distinct
        // property in the cascade-catch matrix. Validates the
        // helper handles ANOTHER cascading property unchanged.
        async (page) => {
            await assertPageLayoutCascadeStyleIsNot(page, {
                propertyName:  'visibility',
                expectedNot:   'hidden',
                scenarioLabel: 'Scenario 89',
            });
        },
    ],

    timeout: 60_000,
};
