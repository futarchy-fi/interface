/**
 * 82-text-transform-cascade-companies.scenario.mjs — fourth catch
 * in **KIND 6 (Visual / Computed CSS)**, first to be authored AS
 * a 1-liner using the slice-310 `cascading-css.mjs` helper.
 * Sister of scenarios 62 + 80 + 81 on the same surface
 * (/companies); fourth cascading CSS property: `text-transform`.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * `text-transform: uppercase` cascade. CSS `text-transform` is an
 * inherited property — a value set on a parent propagates to
 * descendants unless explicitly overridden. When `uppercase`
 * cascades from a page-level wrapper (PageLayout root, an
 * unintentional section wrapper), EVERY text node in the page
 * renders as UPPERCASE.
 *
 * Subtle but jarring: the page is still readable, no errors fire,
 * pixel-screenshot diff would catch it but a visual-regression
 * test isn't running at this layer. The catch surfaces the
 * regression mechanically via `getComputedStyle`.
 *
 * Bug shapes caught:
 *
 *   1. **Tailwind `uppercase` pasted at PageLayout root** — `uppercase`
 *      is one of the most common Tailwind utility classes, used on
 *      labels, buttons, table headers, etc. If a designer copies a
 *      button-class string (e.g., `"text-xs font-medium uppercase
 *      tracking-wide"`) and pastes it onto a wrapper `<div>`
 *      instead of the intended button, the entire subtree
 *      uppercases.
 *
 *   2. **Brand-style refactor that scopes too broadly** — a
 *      "header style" intended for `<header>` elements gets
 *      applied to a layout container, so all text under that
 *      layout uppercases.
 *
 *   3. **CSS-in-JS theme variable drift** — a theme token like
 *      `--text-transform-default: uppercase` accidentally pulled
 *      in at root level via a misplaced import.
 *
 * ── Slot in KIND 6 — first 1-liner using the slice-310 helper ──────
 * KIND 6 (Visual/Computed CSS) catches before this scenario:
 *   62: user-select cascade (slice 99)
 *   80: pointer-events cascade (slice 308)
 *   81: cursor cascade (slice 309)
 *
 * Slice 310 extracted the shared cascade helper:
 *   `assertPageLayoutCascadeStyleIsNot(page, opts)`
 *
 * This scenario (slice 311) is the FIRST authored AS a 1-liner
 * using that helper — proves the API design carries the load.
 * The catch's entire body is now ~6 lines (helper call + the
 * surrounding async wrapper). Future cascade catches (visibility,
 * opacity, font-size:0, direction:rtl) follow the same
 * 1-line-per-catch pattern.
 *
 * ── Why pin on /companies (mirrors 62/80/81) ────────────────────────
 *   `/companies` is a clean PageLayout consumer with no local
 *   `text-transform` opt-in. Default text-transform resolves to
 *   `'none'` at `<main>`. Keeping all 4 sisters on /companies
 *   reuses the helper's hardcoded PageLayout `<main>` selection
 *   (Tailwind `mt-20 bg-white` signature) without needing to
 *   extend the helper with a `targetSelector` parameter.
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to `/companies`.
 *   2. Wait for CompaniesListCarousel heading (same anchor as
 *      62 + 80 + 81 — proves the PageLayout tree mounted, not
 *      the bare _app.js shell).
 *   3. Call `assertPageLayoutCascadeStyleIsNot(page, {
 *      propertyName: 'textTransform', expectedNot: 'uppercase',
 *      scenarioLabel: 'Scenario 82' })`.
 *   4. The helper finds PageLayout's `<main>` (matching the
 *      Tailwind signature), reads `getComputedStyle(<main>).
 *      textTransform`, asserts NOT `'uppercase'`. On failure,
 *      dumps the ancestor chain so the cascade source is obvious.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: assertion passes (`text-transform: 'none'`).
 *   2. Mutate `src/components/layout/PageLayout.jsx:5`:
 *         `<div className="flex flex-col uppercase flex-grow">`
 *      → assertion FAILS with `text-transform: 'uppercase'` at
 *      `<main>`, ancestor chain identifies the PageLayout root
 *      div as the cascade source.
 *   3. Restore → passes.
 *
 * ── What this scenario does NOT cover ───────────────────────────────
 *   - `text-transform: lowercase` or `capitalize` (the helper
 *     checks one specific value at a time; a future slice could
 *     extend the helper to accept multiple markers OR add sister
 *     scenarios for each value).
 *   - Per-element `uppercase` on a specific button or label
 *     (legitimate, expected). The catch fires only when the
 *     cascade reaches `<main>` — page-level regression only.
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
    name:        '82-text-transform-cascade-companies',
    description: 'KIND 6 (Visual/Computed CSS), 4th scenario; FIRST authored AS a 1-liner using slice 310\'s cascading-css helper. Navigate to /companies, assert getComputedStyle(<main>).textTransform !== "uppercase". Tailwind `uppercase` pasted at a layout-level wrapper makes every text node render UPPERCASE — page still readable but jarring UX. Proves the slice-310 helper API carries the load for new cascade catches.',
    bugShape:    'text-transform: uppercase added to a PageLayout-level wrapper (or any ancestor of <main>): every text node on every page renders UPPERCASE. Subtle (no errors, content still visible) but jarring — no developer would intentionally ship this.',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakePoolBearingProposal({})],
        }),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({}),
    },

    assertions: [
        // Mirror 62/80/81's anchor — wait for the page-shell to
        // mount past the loading state. Without this, evaluate()
        // could resolve against a still-loading shell with no
        // PageLayout `<main>` mounted yet.
        async (page) => {
            await expect(
                page.getByRole('heading', { name: /Organizations|Active Milestones/i }).first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Core: the slice-310 helper does all the work. Same
        // PageLayout `<main>` selection, same ancestor-chain
        // dump, just a different cascading property + regression
        // marker. This is the first scenario authored AS a
        // 1-liner using the helper — proves the API design.
        async (page) => {
            await assertPageLayoutCascadeStyleIsNot(page, {
                propertyName:  'textTransform',
                expectedNot:   'uppercase',
                scenarioLabel: 'Scenario 82',
            });
        },
    ],

    timeout: 60_000,
};
