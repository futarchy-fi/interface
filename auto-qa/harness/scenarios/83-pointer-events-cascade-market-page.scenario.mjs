/**
 * 83-pointer-events-cascade-market-page.scenario.mjs — first
 * cross-surface sister in **KIND 6 (Visual / Computed CSS)**.
 * Sister of scenario 80 (pointer-events cascade on /companies)
 * lifted to the /markets/<probe> surface.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Same `pointer-events: none` cascade catch as scenario 80, but
 * surfacing on the MarketPageShowcase surface. Catches a
 * MarketPage-specific cascade that scenarios 80 (/companies) +
 * the /companies-scoped sisters (62, 81, 82) would all miss.
 *
 * Per scenario 62's docs: "MarketPageShowcase ALSO wraps with
 * PageLayout with no select-none opt-in, so it's an equally valid
 * target." Same logic applies for `pointer-events`. If a regression
 * adds `pointer-events-none` to:
 *
 *   - MarketPageShowcase root (or any of its market-only
 *     descendants — chart strip, trading panel, badges row)
 *   - A market-only overlay wrapper
 *   - A loading-state shim that's supposed to release after data
 *     resolves but doesn't
 *
 * ...the cascade reaches PageLayout's `<main>` and the helper
 * detects it. Scenarios 80/81/82 (all on /companies) would stay
 * green — they navigate a different route and their
 * MarketPage-specific cascade source is invisible to them.
 *
 * ── Slot in KIND 6 — first cross-surface sister ─────────────────────
 * KIND 6 (Visual/Computed CSS) catches before this scenario:
 *   62: user-select cascade on /companies (slice 99)
 *   80: pointer-events cascade on /companies (slice 308)
 *   81: cursor cascade on /companies (slice 309)
 *   82: text-transform cascade on /companies (slice 311)
 *   [helper extracted slice 310]
 *
 * Slice 312 (this scenario): first cross-surface sister, on
 * /markets/<probe>. Validates that the helper's PageLayout-`<main>`
 * selection (Tailwind `mt-20 bg-white` signature) works
 * UNCHANGED on a MarketPage route. If the assertion fires, the
 * helper API is portable across every PageLayout consumer
 * without needing a `targetSelector` parameter.
 *
 * ── Why pick `pointer-events` for the cross-surface sister ──────────
 *   - `pointer-events: none` cascading on /markets is the most
 *     consequential of the four KIND 6 catches: every interactive
 *     element on the trading surface (Buy/Sell, Confirm Swap,
 *     amount input, chart hover) becomes non-clickable. Total
 *     UX break with no visual signal.
 *   - The catch direction (assert NOT `'none'`) is identical to
 *     scenario 80, so the cross-surface lift is mechanically
 *     identical — only the route + mocks differ. Tests cleanly
 *     whether the helper is route-agnostic.
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to /markets/<MARKET_PROBE_ADDRESS> with the
 *      market-page fixture (REGISTRY proposals + candles
 *      handler — mirrors scenarios 67, 68, 74).
 *   2. Wait for "Trading Pair" heading (proven mount signal,
 *      same anchor used by scenarios 10/24/57/60/66/67/68/74).
 *   3. Call `assertPageLayoutCascadeStyleIsNot(page, {
 *      propertyName: 'pointerEvents', expectedNot: 'none',
 *      scenarioLabel: 'Scenario 83' })` — same call as
 *      scenario 80, just on a different route + post-different-
 *      anchor.
 *   4. The helper's PageLayout `<main>` selection (Tailwind
 *      `mt-20 bg-white`) hits MarketPageShowcase's <main>
 *      (since MarketPageShowcase wraps with PageLayout per
 *      scenario 62's docs). Reads the computed pointer-events,
 *      asserts NOT `'none'`. Ancestor-chain dump on failure.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: assertion passes (`pointer-events: 'auto'`).
 *   2. Mutate `src/components/refactor/MarketPageShowcase.jsx`
 *      root or any wrapping div to include
 *      `className="pointer-events-none"` → assertion FAILS with
 *      `pointer-events: 'none'` at `<main>`, ancestor chain
 *      identifies the MarketPage-side cascade source.
 *   3. Restore → passes.
 *
 * ── What this scenario does NOT cover ───────────────────────────────
 *   - /milestones-side cascade — would need scenario 84+ (sister
 *     on /milestones) to close the 3-surface grid for KIND 6.
 *   - Per-element `pointer-events: none` (legitimate on disabled
 *     buttons). The catch only fires when the cascade reaches
 *     PageLayout `<main>`.
 *   - Cascade catches in the inverse direction (assert
 *     pointer-events IS `'none'` for an intentionally-disabled
 *     overlay) — scenarios pin healthy state, not intent.
 *
 * ── Why this matters for the helper API ─────────────────────────────
 * If this scenario passes, the `assertPageLayoutCascadeStyleIsNot`
 * helper proves to be route-agnostic — caller-side anchors differ
 * (CompaniesListCarousel heading vs Trading Pair heading) but
 * the helper itself needs no route awareness because both routes
 * share PageLayout's `<main>` signature. Validates slice 310's
 * design hypothesis: "future surfaces using a different layout
 * would need either a custom `targetSelector` parameter OR a
 * separate helper" — but PageLayout consumers (the vast majority
 * of the app) all work with the unmodified helper.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    MARKET_PROBE_ADDRESS,
    fakeMarketProposalEntity,
    makeGraphqlMockHandler,
    makeMarketCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';
import { assertPageLayoutCascadeStyleIsNot } from '../fixtures/cascading-css.mjs';

export default {
    name:        '83-pointer-events-cascade-market-page',
    description: 'KIND 6 (Visual/Computed CSS), 5th scenario; FIRST cross-surface sister. Mirrors scenario 80\'s pointer-events catch on the /markets/<probe> surface. Validates that the slice-310 helper\'s PageLayout `<main>` selection is route-agnostic — works UNCHANGED on a MarketPage route. Catches MarketPage-specific pointer-events-none cascades that scenarios 80/81/82 (all /companies-scoped) would miss.',
    bugShape:    'pointer-events-none added to MarketPageShowcase root, a chart-strip wrapper, a trading-panel parent, or a market-only loading shim: every interactive element on the trading surface becomes non-clickable — Buy/Sell button, Confirm Swap, amount input, chart hover. Total trading-UX break with no visual signal, untriggered by /companies-scoped sisters.',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    assertions: [
        // Anchor: confirm "Trading Pair" heading mounted before
        // running the cascade probe. Same anchor as 10/24/57/60/
        // 66/67/68/74 — reliable across market-page rendering
        // paths. Without this, the evaluate could resolve against
        // a still-loading shell with no MarketPage <main> mounted.
        async (page) => {
            await expect(
                page.getByText('Trading Pair').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Core: the slice-310 helper does all the work. Same
        // call signature as scenario 80 — just a different route
        // + anchor in the surrounding scenario. Validates the
        // helper is route-agnostic across PageLayout consumers.
        async (page) => {
            await assertPageLayoutCascadeStyleIsNot(page, {
                propertyName:  'pointerEvents',
                expectedNot:   'none',
                scenarioLabel: 'Scenario 83',
            });
        },
    ],

    timeout: 180_000,
};
