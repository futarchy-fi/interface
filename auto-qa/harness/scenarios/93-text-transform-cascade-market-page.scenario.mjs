/**
 * 93-text-transform-cascade-market-page.scenario.mjs — sister of
 * scenario 82 (text-transform cascade on /companies) on the
 * /markets surface. Lifts text-transform sub-grid from 1/3 to
 * 2/3 surfaces in **KIND 6 (Visual / Computed CSS)**.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Same `text-transform: uppercase` cascade catch as scenario 82,
 * surfacing on the MarketPageShowcase surface. Catches a
 * MarketPage-specific cascade that scenario 82 (/companies)
 * would miss.
 *
 * The /markets surface has button labels, table headers, and
 * trading-panel widgets that extensively use Tailwind's
 * `uppercase` utility class for visual styling. If a refactor
 * pastes `uppercase` at MarketPageShowcase root or a wrapper
 * that scopes too broadly, EVERY text node on the trading
 * surface uppercases — including amount inputs, currency
 * labels, asset names. Visual chaos on the most stake-sensitive
 * surface in the app.
 *
 * Bug shapes specific to /markets:
 *   - A "minimal trading mode" feature flag that adds
 *     `uppercase` to the page wrapper for branding consistency
 *     but breaks input rendering.
 *   - A trading-panel CSS module that defines `.trading {
 *     text-transform: uppercase; }` at a too-high level.
 *   - A theme refactor that swaps Tailwind classes — `font-bold
 *     uppercase` → `font-bold` accidentally moves uppercase to
 *     a parent.
 *
 * ── Slot in KIND 6 — fills text-transform 2/3 cell ──────────────────
 * KIND 6 surface-by-property matrix BEFORE this slice:
 * ```
 *                   /companies  /markets  /milestones
 *   text-transform      82          —          —         (1/3)
 * ```
 *
 * AFTER this slice:
 * ```
 *                   /companies  /markets  /milestones
 *   text-transform      82          93         —         (2/3)
 * ```
 *
 * Closes the 2-surface coverage for text-transform. One more
 * sister on /milestones would close its 3-surface grid (would
 * be KIND 6's THIRD sub-grid at 3/3 — joining pointer-events
 * and cursor).
 *
 * Strategic note: filling matrix CELLS (this slice) vs adding
 * property COLUMNS (slices 308-323) are two different growth
 * directions for KIND 6. The N=10 catches before slice 325 had
 * grown the property axis aggressively (1 → 7 properties) but
 * left 4 properties single-surface. This slice begins the
 * surface-axis fill phase, which has higher per-slice diversity
 * payoff than a 8th property column.
 *
 * ── Why text-transform specifically (vs direction / visibility / opacity) ──
 *   - text-transform is the property MOST adjacent to real
 *     /markets risk: trading buttons, amount inputs, currency
 *     labels all use text styling. An `uppercase` cascade
 *     would visually wreck the most stake-sensitive surface.
 *   - direction: rtl is unlikely on an LTR-only app at any
 *     surface; lower priority.
 *   - visibility: hidden / opacity: 0 are pure visibility
 *     regressions; impact identical across surfaces.
 *   - text-transform: uppercase has surface-specific
 *     impact (visual chaos on trading inputs >> on
 *     companies cards), so the /markets sister is the
 *     highest-value first lift among the 4 single-surface
 *     properties.
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to /markets/<MARKET_PROBE_ADDRESS> with
 *      market-page mocks (mirrors scenarios 83, 85, 91).
 *   2. Wait for "Trading Pair" heading (proven mount signal).
 *   3. Call `assertPageLayoutCascadeStyleIsNot(page, {
 *      propertyName: 'textTransform', expectedNot: 'uppercase',
 *      scenarioLabel: 'Scenario 93' })`.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: assertion passes (`text-transform: 'none'`).
 *   2. Mutate `MarketPageShowcase.jsx` root to add
 *      `className="uppercase"` → assertion FAILS,
 *      ancestor chain identifies the MarketPage-side
 *      cascade source.
 *   3. Restore → passes.
 *
 * ── What this scenario does NOT cover ───────────────────────────────
 *   - /milestones-side text-transform cascade (would close
 *     3-surface grid; deferred).
 *   - text-transform: lowercase / capitalize (different
 *     regression markers; helper checks one value at a time).
 *   - Per-element `uppercase` on a specific button (legitimate).
 *     Catch only fires when cascade reaches PageLayout `<main>`.
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
    name:        '93-text-transform-cascade-market-page',
    description: 'KIND 6 (Visual/Computed CSS), 12th scenario; lifts text-transform sub-grid from 1/3 to 2/3 surfaces. Sister of 82 on /markets/<probe>. Catches MarketPage-specific text-transform:uppercase cascade — Tailwind `uppercase` class pasted at MarketPageShowcase root, trading-panel CSS module scoped too broadly, or theme refactor accidentally moving uppercase to a parent. Visual chaos on the most stake-sensitive surface in the app — trading inputs, amount labels, currency names all uppercase.',
    bugShape:    'uppercase class added to MarketPageShowcase root or any wrapper above <main>: every text node on the trading surface renders UPPERCASE. Buy/Sell button text, amount input labels, currency names, table headers all flip to caps. Untriggered by /companies-scoped scenario 82 if the regression is MarketPage-specific.',
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
        // 83, 85, 91.
        async (page) => {
            await expect(
                page.getByText('Trading Pair').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Core: same helper call as scenario 82 (text-transform
        // on /companies) — just on /markets. Validates the
        // helper works for text-transform on a different
        // surface. Lifts text-transform sub-grid 1/3 → 2/3.
        async (page) => {
            await assertPageLayoutCascadeStyleIsNot(page, {
                propertyName:  'textTransform',
                expectedNot:   'uppercase',
                scenarioLabel: 'Scenario 93',
            });
        },
    ],

    timeout: 180_000,
};
