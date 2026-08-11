/**
 * 68-text-selection-market-page.scenario.mjs — sister of scenario 51
 * (text-selection on /companies) on the /markets/<probe> surface.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Same KIND as scenarios 51 + 62 (CSS-driven user-interaction
 * regressions) — on a different surface that exercises a different
 * portion of the component tree.
 *
 * The {51, 62, 68} triangle pins three distinct catches around
 * PR #59:
 *
 *   - **Scenario 51** (/companies + triple-click): catches PR #59's
 *     original PageLayout `select-none` regression via real user
 *     interaction. Asserts the dynamic browser SELECTION state, not
 *     just the computed style.
 *
 *   - **Scenario 62** (/companies + getComputedStyle): catches the
 *     SAME PageLayout regression via the static CSS computed
 *     property on `<main>`. Structural rather than interactive —
 *     stricter (no whitespace fuzz) and complements 51.
 *
 *   - **Scenario 68 (this)** (/markets + triple-click): catches a
 *     market-page-specific cascade — a `select-none` added INSIDE
 *     MarketPageShowcase or any of its market-only descendants
 *     (chart strip, trading panel, badges row). Scenarios 51 + 62
 *     would BOTH stay green under such a regression (51 navigates
 *     /companies; 62 inspects PageLayout's `<main>` which is the
 *     shared root, unaffected by a market-only descendant override).
 *
 * Specifically catches:
 *   - Adding `select-none` Tailwind class to MarketPageShowcase.jsx
 *     root or any of its descendants
 *   - A new CSS module rule like `.tradingPanel { user-select: none; }`
 *   - Pointer-events: none on a parent that wraps proposal text
 *   - A z-index'd overlay element capturing the click before
 *     selection registers
 *
 * ── How the scenario catches it ─────────────────────────────────────
 *   1. Navigate to /markets/<probe> with the market-page fixture.
 *   2. Wait for "Trading Pair" to render (proven mount signal,
 *      same anchor used by scenarios 10/24/57/60/66/67).
 *   3. Clear any inherited selection from page navigation.
 *   4. Triple-click on "Trading Pair" — browser word/line selection
 *      respects `user-select: none` regardless of which descendant
 *      sets it.
 *   5. Read `window.getSelection().toString()` and assert it
 *      contains the heading text.
 *
 * Under PR #59 fix + no market-specific override: selection works,
 * passes. Under a regression that adds select-none anywhere in
 * MarketPageShowcase's tree: selection is empty, fails.
 *
 * ── Verification protocol ───────────────────────────────────────────
 * 1. Current code: scenario PASSES.
 * 2. Add `style={{userSelect: 'none'}}` to ANY MarketPageShowcase.jsx
 *    parent of the "Trading Pair" element (e.g., the ChartParameters
 *    wrapper div) → scenario FAILS with empty selection.
 * 3. Restore → PASSES.
 *
 * ── Why triple-click (matching scenario 51) ─────────────────────────
 * Triple-click selects the whole text line on the element regardless
 * of whether the click coordinate lands on a word or whitespace.
 * `dblclick` would only select a word and could return empty if
 * the click lands between words (especially in the chart-strip's
 * tightly-packed labels). Triple-click is sturdier; respects
 * `user-select: none` exactly the same way.
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
import { assertTripleClickSelects } from '../fixtures/text-selection.mjs';

export default {
    name:        '68-text-selection-market-page',
    description: 'Sister of scenario 51 on /markets/<probe>. Triple-click "Trading Pair" heading, assert browser selection captured the text. Catches CSS user-select-none cascade from a MarketPageShowcase-side regression that scenarios 51 (/companies-only) and 62 (PageLayout root only) would both miss.',
    bugShape:    'Market-page-specific CSS rule blocks user-level text selection (e.g., select-none Tailwind class added to MarketPageShowcase.jsx root or a chart-strip / trading-panel descendant). User-visible UX breakage on the market surface with no DOM diff, no errors, no network change, and untriggered by /companies-scoped scenarios 51/62.',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    assertions: [
        // Anchor: confirm the heading is on the page before we try
        // to interact with it. Same anchor as scenarios 10/24/57/60/
        // 66/67 — reliable across market-page rendering paths.
        async (page) => {
            await expect(
                page.getByText('Trading Pair').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // The market-page text-selection catch — slice 296
        // extracted to shared helper. Triple-clicks "Trading
        // Pair" anchor, asserts window.getSelection() captured
        // it. Empty under any select-none cascade in
        // MarketPageShowcase's tree above the heading.
        async (page) => {
            await assertTripleClickSelects(
                page,
                page.getByText('Trading Pair').first(),
                'Trading Pair',
            );
        },
    ],

    timeout: 180_000,
};
