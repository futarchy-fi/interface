/**
 * 62-pr59-text-selection-pagelayout.scenario.mjs — catches PR #59
 * (allow text selection across all pages using PageLayout).
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Computed-CSS-property assertion. Pre-PR-59, `PageLayout.jsx`
 * applied the Tailwind class `select-none` to its root container,
 * which sets `user-select: none` — that style CASCADES to every
 * descendant unless explicitly overridden, so the user can't
 * select or copy any text on Companies, MarketShowcase, etc. PR #59
 * removes the global `select-none`, restoring the default
 * `user-select: auto` everywhere PageLayout wraps content.
 *
 * The catch is NOT a DOM-text presence assertion — the same text
 * renders either way. It's NOT a screenshot assertion either —
 * `user-select` doesn't change pixel output. It IS a runtime
 * `getComputedStyle` check evaluated inside the page context,
 * which is a NEW assertion shape within the existing visual KIND
 * (slice 83 introduced computed-style queries for state-aware
 * pseudo-selectors; this slice applies the same primitive to a
 * cascading CSS property).
 *
 * ── Why this catch is worth the slot ────────────────────────────────
 * `select-none` regressions are easy to re-introduce. A future
 * engineer adding Tailwind classes to PageLayout — say, to disable
 * accidental drag-selection during a swipe interaction — could
 * paste `select-none` back at the root and re-break the entire
 * cluster of wrapped pages. Without this catch, the regression
 * would only surface as user complaints ("I can't copy the
 * proposal address from the URL bar"). The catch costs almost
 * nothing to run (a single page.evaluate call).
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to `/companies` (a clean PageLayout consumer:
 *      `CompaniesPage` wraps with `<PageLayout>` and does NOT pass
 *      a `contentClassName` containing `select-none`, so the only
 *      source of `user-select: none` would be the PageLayout root
 *      itself).
 *   2. Wait for the page-shell to mount (carousel heading visible).
 *   3. `page.evaluate(() => getComputedStyle(document.querySelector(
 *      'main')).userSelect)` — inspect the live computed style of
 *      the `<main>` element, which is a direct child of the
 *      PageLayout root. `user-select` cascades, so a `select-none`
 *      on the parent shows up here as `'none'`.
 *   4. Assert the resolved value is NOT `'none'`. Permissive
 *      because browsers can return `'auto'`, `'text'`, or vendor-
 *      prefixed equivalents depending on engine version — only
 *      `'none'` is the regression signal.
 *
 * ── Why NOT /markets ─────────────────────────────────────────────────
 *   `MarketPageShowcase` ALSO wraps with `<PageLayout>` with no
 *   `select-none` opt-in, so it's an equally valid target. But the
 *   market-page route adds heavy boilerplate (anvil-required RPC,
 *   contract-config resolution, etc.) and a wallet stub. The
 *   /companies route reaches the assertion in ~6s with zero
 *   chain-side dependencies. We pin the catch on /companies and let
 *   the same regression surface across /markets be inferred —
 *   PageLayout is one component, exercising it once is enough.
 *
 * ── Why NOT /proposals ───────────────────────────────────────────────
 *   `ProposalsPage.jsx:356` explicitly opts INTO `select-none` via
 *   `contentClassName="pt-10 z-10 select-none"`. So on /proposals
 *   the computed user-select would be `'none'` REGARDLESS of
 *   whether PR #59 is reverted — a false positive. /companies has
 *   no such local opt-in.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *
 *   1. Current code: assertion passes (user-select !== 'none').
 *
 *   2. Mutate `src/components/layout/PageLayout.jsx:5` to re-add
 *      the `select-none` class to the root div:
 *         `<div className="flex flex-col select-none flex-grow">`
 *      → assertion FAILS with `Received: "none"`.
 *
 *   3. Restore → passes.
 *
 * ── What this DOESN'T cover ─────────────────────────────────────────
 *   - Components that explicitly opt OUT of selection (e.g., a
 *     swipe-handler that legitimately wants `select-none` on its
 *     own wrapper). Those continue to work — the cascade only
 *     defaults to `auto`, individual subtrees can still pin
 *     `'none'` locally.
 *   - The Tailwind class itself drifting (e.g., if `select-none`
 *     gets renamed in a future Tailwind major). That would
 *     surface as the class not being recognized → user-select
 *     resolves to default `auto` → catch test passes incorrectly.
 *     A more defensive test would inspect `className.includes(
 *     'select-none')` directly, but that's brittle to
 *     refactors. Computed-style is more durable.
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
    name:        '62-pr59-text-selection-pagelayout',
    description: 'Catches PR #59 (allow text selection across all pages using PageLayout). Navigate to /companies, assert getComputedStyle(main).userSelect !== "none". Reverting the PR re-adds select-none to the PageLayout root → user-select cascades to descendants → main\'s computed style becomes "none" → assertion fails. First scenario asserting on a computed CSS property of a live DOM node.',
    bugShape:    'select-none re-added to PageLayout root: every page wrapped by PageLayout (Companies, MarketShowcase) loses ability to select or copy text; users cannot copy addresses, IDs, or descriptions out of the UI',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakePoolBearingProposal({})],
        }),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({}),
    },

    assertions: [
        // Sanity: the page mounted past the loading state. The
        // CompaniesListCarousel's heading is a reliable post-mount
        // anchor. Without this, an evaluate() call against a still-
        // loading shell could resolve to the default user-select
        // of the document <html> element (which is `auto`), masking
        // a regression that's only present on the actual page tree.
        async (page) => {
            await expect(
                page.getByRole('heading', { name: /Organizations|Active Milestones/i }).first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Core: inspect computed user-select at PageLayout's
        // <main> (a direct child of the PageLayout root — see
        // src/components/layout/PageLayout.jsx:14). user-select
        // cascades, so a `select-none` on the parent div
        // surfaces here as the resolved value `'none'`.
        //
        // Slice 310: shared cascade helper. Selection logic and
        // ancestor-chain dump live in fixtures/cascading-css.mjs
        // and are reused by scenarios 80 + 81 — single source of
        // truth for all cascade catches.
        async (page) => {
            await assertPageLayoutCascadeStyleIsNot(page, {
                propertyName:  'userSelect',
                expectedNot:   'none',
                scenarioLabel: 'Scenario 62',
            });
        },
    ],

    timeout: 60_000,
};
