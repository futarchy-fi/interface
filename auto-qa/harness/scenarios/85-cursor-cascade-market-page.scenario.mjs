/**
 * 85-cursor-cascade-market-page.scenario.mjs — sister of scenario
 * 81 (cursor cascade on /companies) on the /markets/<probe>
 * surface. Second cross-surface sister within **KIND 6 (Visual /
 * Computed CSS)**.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Same `cursor: not-allowed` cascade catch as scenario 81, but
 * surfacing on the MarketPageShowcase surface. Catches a
 * MarketPage-specific cascade that scenario 81 (/companies)
 * would miss.
 *
 * Bug shapes specific to /markets:
 *   - A `cursor-not-allowed` class added to MarketPageShowcase
 *     root or any market-only descendant (chart strip, trading
 *     panel) — every interactive element on the trading surface
 *     renders with the blocked cursor on hover.
 *   - A loading-shim element on the market page that's supposed
 *     to release after data resolves but doesn't, and applies
 *     `cursor: not-allowed` while "loading".
 *   - A "trading paused" overlay that scopes cursor too broadly
 *     (cascades through wrappers it shouldn't).
 *
 * ── Slot in KIND 6 — second cross-surface sister ────────────────────
 * KIND 6 (Visual/Computed CSS) catches before this scenario:
 *   62: user-select cascade on /companies (slice 99)
 *   80: pointer-events cascade on /companies (slice 308)
 *   81: cursor cascade on /companies (slice 309)
 *   82: text-transform cascade on /companies (slice 311)
 *   83: pointer-events cascade on /markets (slice 312, FIRST
 *       cross-surface)
 *   84: pointer-events cascade on /milestones (slice 313, closes
 *       pointer-events 3-surface grid)
 *
 * Slice 315 (this scenario): SECOND cross-surface sister, lifting
 * cursor from 1-surface (1/3) to 2-surface (2/3) coverage. After
 * a future /milestones cursor sister, KIND 6 would have 2 of 4
 * properties at full 3-surface coverage.
 *
 * Surface-by-property matrix after this slice:
 *   user-select:    /companies (62)
 *   pointer-events: /companies (80) + /markets (83) + /milestones (84) = 3/3 ✓
 *   cursor:         /companies (81) + /markets (85)                      = 2/3
 *   text-transform: /companies (82)
 *
 * ── Why pick `cursor` for the second cross-surface lift ─────────────
 *   - Cursor is the second-most-impactful cascade catch after
 *     pointer-events. Both make interactive surfaces feel
 *     "broken" — pointer-events functionally, cursor
 *     perceptually.
 *   - On /markets specifically, cursor regression would make
 *     the trading buttons (Buy/Sell, Confirm Swap) look
 *     unclickable even though they work — high abandonment
 *     risk for a financial action surface.
 *   - The catch direction (assert NOT `'not-allowed'`) is
 *     identical to scenario 81. Cross-surface lift is
 *     mechanically identical to slice 312's pointer-events
 *     lift — only the property and regression marker differ.
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to /markets/<MARKET_PROBE_ADDRESS> with the
 *      market-page fixture (mirrors scenarios 67, 68, 74, 83).
 *   2. Wait for "Trading Pair" heading (proven mount signal,
 *      same anchor as scenario 83).
 *   3. Call `assertPageLayoutCascadeStyleIsNot(page, {
 *      propertyName: 'cursor', expectedNot: 'not-allowed',
 *      scenarioLabel: 'Scenario 85' })`.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: assertion passes (`cursor: 'auto'`).
 *   2. Mutate `src/components/refactor/MarketPageShowcase.jsx`
 *      root or any wrapping div to include
 *      `className="cursor-not-allowed"` → assertion FAILS,
 *      ancestor chain identifies the MarketPage-side cascade
 *      source.
 *   3. Restore → passes.
 *
 * ── What this scenario does NOT cover ───────────────────────────────
 *   - /milestones-side cursor cascade — would need scenario 86+
 *     to close the 3-surface grid for cursor.
 *   - Per-element `cursor: not-allowed` (legitimate on disabled
 *     buttons). Catch only fires when cascade reaches PageLayout
 *     `<main>`.
 *   - Other regression markers (`cursor: wait`, `cursor: help`).
 *     Helper checks one specific value at a time.
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
    name:        '85-cursor-cascade-market-page',
    description: 'KIND 6 (Visual/Computed CSS), 7th scenario; second cross-surface sister. Mirrors scenario 81\'s cursor catch on /markets/<probe>. Lifts cursor cascade coverage from 1-surface (1/3) to 2-surface (2/3). Catches MarketPage-specific cursor-not-allowed cascades that scenario 81 (/companies) would miss.',
    bugShape:    'cursor-not-allowed added to MarketPageShowcase root, a chart-strip wrapper, a trading-panel parent, or a market-only loading shim/overlay: every interactive element on the trading surface renders with the blocked cursor on hover. Buy/Sell and Confirm Swap buttons LOOK unclickable even though they work — high abandonment risk on a financial-action surface. Untriggered by /companies-scoped scenario 81.',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    assertions: [
        // Anchor: confirm "Trading Pair" heading mounted before
        // running the cascade probe. Same anchor as scenarios
        // 10/24/57/60/66/67/68/74/83.
        async (page) => {
            await expect(
                page.getByText('Trading Pair').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Core: same helper call as scenario 81 (cursor on
        // /companies) — just on /markets. Validates the helper
        // works for cursor on a different surface (already
        // proven for pointer-events via slices 312 + 313).
        async (page) => {
            await assertPageLayoutCascadeStyleIsNot(page, {
                propertyName:  'cursor',
                expectedNot:   'not-allowed',
                scenarioLabel: 'Scenario 85',
            });
        },
    ],

    timeout: 180_000,
};
