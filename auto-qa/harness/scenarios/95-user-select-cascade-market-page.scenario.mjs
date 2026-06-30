/**
 * 95-user-select-cascade-market-page.scenario.mjs — sister of
 * scenario 62 (user-select cascade on /companies) on the
 * /markets surface. Lifts user-select sub-grid from 1/3 to 2/3
 * in **KIND 6 (Visual / Computed CSS)**.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Same `user-select: none` cascade catch as scenario 62,
 * surfacing on MarketPageShowcase. Catches a MarketPage-specific
 * cascade that scenario 62 (/companies) would miss.
 *
 * The /markets surface is uniquely sensitive to user-select
 * regressions:
 *   - Users frequently copy POOL ADDRESSES from the trading
 *     panel to share or verify on block explorers.
 *   - Users copy AMOUNTS from result panels (e.g., the price
 *     they got for a trade) to paste into other UI fields.
 *   - Users copy CONDITIONAL TOKEN addresses for manual
 *     verification.
 *
 * If `user-select: none` cascades from MarketPageShowcase root
 * or any wrapper above `<main>`, ALL the above copy actions
 * silently fail — users see text but can't select it.
 *
 * Bug shapes specific to /markets:
 *   - A "trading-card" CSS module that defines
 *     `.tradingCard { user-select: none; }` at a too-high
 *     level (intended to prevent text selection during chart
 *     hover-interaction, but applied to a wrapper that
 *     contains the trading-result panel too).
 *   - A swap-modal portal element that scopes `select-none`
 *     to its root and leaks to the underlying page via
 *     ancestor-cascade.
 *   - A theme-conditional rule like `.dark-mode-market {
 *     user-select: none; }` that's supposed to be scoped to
 *     decorative animations but isn't.
 *
 * ── Slot in KIND 6 — fills user-select 2/3 cell ─────────────────────
 * KIND 6 surface-by-property matrix BEFORE this slice:
 * ```
 *                   /companies  /markets  /milestones
 *   user-select         62          —          —         (1/3)
 * ```
 *
 * AFTER this slice:
 * ```
 *                   /companies  /markets  /milestones
 *   user-select         62          95         —         (2/3)
 * ```
 *
 * Closes the 2-surface coverage for user-select. One more
 * sister on /milestones would close its 3-surface grid (would
 * be KIND 6's FOURTH sub-grid at 3/3, joining pointer-events,
 * cursor, text-transform).
 *
 * Strategic note: user-select is the OLDEST single-surface
 * property in KIND 6 — scenario 62 landed slice 99, and 87
 * sister-scenarios have passed without anyone lifting it
 * beyond /companies until now. The surface-axis fill phase
 * (introduced slice 325) finally addresses this backlog.
 *
 * ── Relationship to KIND "user-CSS interactive" (text-selection) ────
 * The same `user-select: none` regression is ALSO caught by
 * the text-selection KIND (scenarios 51, 68, 72) across all
 * 3 surfaces via interactive triple-click + getSelection.
 * Both KINDs catch the same bug shape:
 *
 *   - KIND 6 (this scenario): computed-CSS read via
 *     getComputedStyle. Mechanically faster, no user
 *     simulation. Robust against browser-level click event
 *     delivery edge cases (cf. slice 318 click-nav
 *     investigation).
 *   - text-selection KIND: interactive triple-click +
 *     window.getSelection(). Tests the FULL user flow
 *     (browser actually computes selection state).
 *
 * Both have value as backup catches. Either one regressing
 * could miss bugs the other catches — e.g., a regression
 * that breaks BROWSER selection logic but not the computed
 * style would slip past KIND 6 but be caught by text-
 * selection. Vice versa for regressions that break the
 * computed-style read path but not browser selection.
 *
 * ── Why user-select first (vs direction / visibility / opacity) ─────
 *   - **Oldest 1-surface property** (slice 99 → slice 327
     = 228 slices since scenario 62 landed; longest backlog).
 *   - **Highest real-world impact** of the 4 remaining
 *     single-surface properties: users copy addresses /
 *     amounts on /markets all the time. direction:rtl,
 *     visibility:hidden, opacity:0 are obvious-once-they-
 *     happen bugs; user-select:none is SILENT until a user
 *     tries to copy something.
 *   - **Backup-catch synergy** with the text-selection
 *     KIND (51/68/72) — having both mechanisms at multi-
 *     surface coverage means a regression in either path
 *     gets caught.
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to /markets/<MARKET_PROBE_ADDRESS> with
 *      market-page mocks (mirrors scenarios 83, 85, 91, 93).
 *   2. Wait for "Trading Pair" heading (proven mount signal).
 *   3. Call `assertPageLayoutCascadeStyleIsNot(page, {
 *      propertyName: 'userSelect', expectedNot: 'none',
 *      scenarioLabel: 'Scenario 95' })`.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: assertion passes (`user-select: 'auto'`
 *      or `'text'`).
 *   2. Mutate `MarketPageShowcase.jsx` root to add
 *      `className="select-none"` → assertion FAILS,
 *      ancestor chain identifies the MarketPage-side
 *      cascade source.
 *   3. Restore → passes.
 *
 * ── What this scenario does NOT cover ───────────────────────────────
 *   - /milestones-side user-select cascade (would close
 *     3-surface grid; deferred).
 *   - Per-element `user-select: none` (legitimate for
 *     chart hover-interaction, drag handles). Catch only
 *     fires when cascade reaches PageLayout `<main>`.
 *   - `user-select` regressions on non-PageLayout pages
 *     (helper hardcodes PageLayout selection).
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
    name:        '95-user-select-cascade-market-page',
    description: 'KIND 6 (Visual/Computed CSS), 14th scenario; lifts user-select sub-grid from 1/3 to 2/3 surfaces. Sister of 62 on /markets/<probe>. Catches MarketPage-specific user-select:none cascade — trading-card CSS module scoped too broadly, swap-modal portal leakage, theme-conditional rule misapplied. Users copy pool addresses, amounts, and CT addresses on /markets all the time — silent UX break if user-select cascades to <main>. Backup catch for the same regression that text-selection scenarios 51/68/72 catch via interactive triple-click.',
    bugShape:    'select-none class added to MarketPageShowcase root, a trading-card wrapper, swap-modal portal, or any ancestor of <main>: every text node on the trading surface becomes unselectable. Users see addresses and amounts but can\'t copy them. Untriggered by /companies-scoped scenario 62 if the regression is MarketPage-specific.',
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
        // 83, 85, 91, 93.
        async (page) => {
            await expect(
                page.getByText('Trading Pair').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Core: same helper call as scenario 62 — just on
        // /markets. Validates the helper works for user-select
        // on a different surface. Lifts user-select sub-grid
        // 1/3 → 2/3.
        async (page) => {
            await assertPageLayoutCascadeStyleIsNot(page, {
                propertyName:  'userSelect',
                expectedNot:   'none',
                scenarioLabel: 'Scenario 95',
            });
        },
    ],

    timeout: 180_000,
};
