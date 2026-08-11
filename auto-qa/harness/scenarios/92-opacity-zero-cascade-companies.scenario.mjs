/**
 * 92-opacity-zero-cascade-companies.scenario.mjs — seventh
 * cascading-property catch in **KIND 6 (Visual / Computed CSS)**.
 * Sister of scenarios 62 + 80 + 81 + 82 + 87 + 89 on /companies;
 * introduces a seventh cascading CSS property: `opacity`.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * `opacity: 0` cascade. While CSS `opacity` is NOT a strictly-
 * inherited property in the same way as `cursor` or `direction`,
 * the visual effect IS effectively cascading — opacity composes
 * multiplicatively from parent to child. A parent's
 * `opacity: 0` makes ALL descendants completely transparent,
 * regardless of their own opacity values.
 *
 * Distinct from `visibility: hidden` (scenario 89): elements
 * remain interactive (clickable, focusable) under
 * `opacity: 0` but are completely invisible. Distinct from
 * `display: none`: layout space is preserved, just like with
 * visibility:hidden.
 *
 * Worst case: users can ACCIDENTALLY click invisible buttons
 * (because they're still pointer-events-active), triggering
 * unintended actions on a page that LOOKS empty. This is
 * worse than `visibility: hidden` (which also makes
 * pointer-events: none implicitly).
 *
 * Bug shapes caught:
 *
 *   1. **Tailwind `opacity-0` class pasted at PageLayout root**
 *      — Tailwind's `opacity-0` utility maps to `opacity: 0`.
 *      Easy paste from a fade-in animation utility class.
 *
 *   2. **Loading-state opacity that doesn't release** — a
 *      wrapper supposed to fade IN via opacity transition
 *      after data loads but stays at `opacity: 0` because
 *      the state transition broke.
 *
 *   3. **Theme transition mid-flight** — a CSS `transition:
 *      opacity 1s` mid-transition with the wrong end-state
 *      target.
 *
 *   4. **Animation @keyframes drift** — a fade-in @keyframes
 *      whose start-state cascades but whose end-state never
 *      fires because the animation got removed.
 *
 * ── Note: `opacity` and `getComputedStyle` ──────────────────────────
 * `getComputedStyle(el).opacity` returns the element's OWN
 * declared opacity, NOT the cumulative opacity from ancestors.
 * So a parent at `opacity: 0` with a child at `opacity: 1` would
 * report opacity `'1'` for the child — even though the child is
 * VISUALLY transparent due to the parent's opacity composing
 * down.
 *
 * However, our catch reads opacity AT the PageLayout `<main>`
 * directly. If the regression is `<PageLayout className="opacity-0">`
 * (a div above main), the `<main>` itself doesn't have
 * opacity:0 set on it — but `<main>` would visually be
 * transparent due to the cascade from its parent. The catch
 * doesn't fire on this bug shape.
 *
 * The catch DOES fire if the regression is on `<main>` itself
 * (Tailwind `opacity-0` added to PageLayout's `<main>`
 * directly) — that IS the most common paste-error pattern.
 *
 * For full opacity-cascade coverage, a follow-up could compute
 * "effective opacity" by walking the ancestor chain and
 * multiplying each level's opacity. Deferred — this slice
 * delivers the simpler direct-property catch.
 *
 * ── Slot in KIND 6 — seventh cascading property ─────────────────────
 * KIND 6 (Visual/Computed CSS) catches before this scenario:
 *   62: user-select cascade on /companies (slice 99)
 *   80: pointer-events cascade on /companies (slice 308)
 *   81: cursor cascade on /companies (slice 309)
 *   82: text-transform cascade on /companies (slice 311)
 *   83-86: pointer-events + cursor on /markets + /milestones
 *   87: direction:rtl cascade on /companies (slice 317)
 *   89: visibility:hidden cascade on /companies (slice 319)
 *
 * Slice 323 (this scenario): introduces a 7th property to the
 * /companies row. Property axis grows 6 → 7 properties. Surface
 * axis stays at 3 surfaces. Total possible cells in the matrix
 * grows 18 → 21. Cells filled grows 10 → 11.
 *
 * Surface-by-property matrix after this slice:
 *   user-select:    /companies (62)                                = 1/3
 *   pointer-events: /companies (80) + /markets (83) + milestones (84) = 3/3 ✓
 *   cursor:         /companies (81) + /markets (85) + milestones (86) = 3/3 ✓
 *   text-transform: /companies (82)                                = 1/3
 *   direction:      /companies (87)                                = 1/3
 *   visibility:     /companies (89)                                = 1/3
 *   opacity:        /companies (92)                                = 1/3 ← THIS SLICE
 *
 * ── Why `opacity: 0` for the 7th property ───────────────────────────
 *   - Different bug shape from existing 6 cascade catches:
 *     opacity-hiding (page transparent, layout reserved,
 *     elements still clickable). Distinct from visibility:
 *     hidden (elements not clickable).
 *   - Tailwind utility class `opacity-0` is real and very
 *     adjacent to `opacity-100` / `opacity-50` (transition
 *     end-states) — paste-prone in fade-in animations.
 *   - Worst case: invisible-but-clickable buttons → users
 *     trigger actions they can't see.
 *   - 1-liner with slice-310 helper.
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to /companies.
 *   2. Wait for CompaniesListCarousel heading.
 *   3. Call `assertPageLayoutCascadeStyleIsNot(page, {
 *      propertyName: 'opacity', expectedNot: '0',
 *      scenarioLabel: 'Scenario 92' })`.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: assertion passes (`opacity: '1'`).
 *   2. Mutate `src/components/layout/PageLayout.jsx` to add
 *      `opacity-0` to the `<main>` element directly:
 *         `<main className="bg-white ... opacity-0">`
 *      → assertion FAILS with `opacity: '0'` at `<main>`.
 *   3. Restore → passes.
 *
 * ── What this scenario does NOT cover ───────────────────────────────
 *   - Cascading opacity from an ancestor (`opacity` is not
 *     strictly inherited per CSS spec; the helper reads the
 *     element's OWN computed opacity, not the multiplied
 *     effective opacity). Deferred to a future slice with an
 *     opacity-walk helper if needed.
 *   - Per-element `opacity: 0` (legitimate for hidden-state
 *     elements). Catch only fires when the regression is at
 *     PageLayout `<main>` directly.
 *   - /markets and /milestones sisters (deferred).
 *   - Other partial-opacity regressions (`opacity: 0.1`,
 *     etc. — would need different `expectedNot` markers).
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
    name:        '92-opacity-zero-cascade-companies',
    description: 'KIND 6 (Visual/Computed CSS), 11th scenario; 7th cascading property in the matrix. Navigate to /companies, assert getComputedStyle(<main>).opacity !== "0". A `opacity: 0` regression on PageLayout `<main>` (Tailwind `opacity-0` paste, fade-in transition stuck, animation @keyframes drift) makes the entire page transparent while keeping layout space reserved AND elements still clickable — users trigger invisible buttons.',
    bugShape:    'opacity-0 added to PageLayout <main> directly: every descendant becomes invisible, layout reserved, elements remain clickable. Worst case: users trigger actions on invisible buttons. No DOM diff, no errors, no network change — pure visibility regression with interaction risk.',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakePoolBearingProposal({})],
        }),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({}),
    },

    assertions: [
        // Mirror 62/80/81/82/87/89's anchor — wait for the
        // page-shell to mount past the loading state.
        async (page) => {
            await expect(
                page.getByRole('heading', { name: /Organizations|Active Milestones/i }).first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Core: 1-liner with slice-310 helper. 7th distinct
        // property in the cascade-catch matrix. Note: opacity
        // is read as the element's OWN computed value (not
        // multiplied with ancestors); a future opacity-walk
        // helper could extend coverage to ancestor-cascade
        // opacity bugs.
        async (page) => {
            await assertPageLayoutCascadeStyleIsNot(page, {
                propertyName:  'opacity',
                expectedNot:   '0',
                scenarioLabel: 'Scenario 92',
            });
        },
    ],

    timeout: 60_000,
};
