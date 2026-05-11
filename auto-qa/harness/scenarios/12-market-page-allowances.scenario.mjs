/**
 * 12-market-page-allowances.scenario.mjs — Phase 7 pivot iteration 4:
 * second market-page feature-area scenario.
 *
 * Where #11 covered the trading panel structure (ShowcaseSwapComponent
 * outcome tabs + action buttons), this asserts the **allowances/
 * collateral surface** mounted with its interactive controls visible.
 * Allowances is the user's second-listed feature area; this scenario
 * locks in the rendering contract for `MarketBalancePanel` and the
 * Collateral dropdown that opens `CollateralModal`.
 *
 * **Why "allowances" maps to MarketBalancePanel** — on the live market
 * page, the user's path to approving / wrapping / splitting collateral
 * runs through:
 *   1. `MarketBalancePanel` shows the user's positions + a "Collateral"
 *      dropdown
 *   2. Selecting "Split Collateral" or "Merge Collateral" from the
 *      dropdown opens `CollateralModal`
 *   3. `CollateralModal` triggers the on-chain approval + split/merge
 *      flow (the actual ERC20 allowance + setApprovalForAll calls)
 *
 * The static structural anchors for the surface are the panel's
 * "Balance" header + the "Collateral" dropdown button — both are
 * React-rendered constants in `MarketBalancePanel.jsx` lines 103 +
 * 259, independent of the user's wallet balance or any dynamic
 * state.
 *
 * **Same mocks as #10/#11**. The allowance surface mounts off the
 * same registry + candles GraphQL responses; the actual ERC20
 * `allowance()` call is wallet-stub RPC routed and doesn't need
 * additional mocks for the structural assertion. (A future
 * scenario will mock the allowance result and assert specific
 * UI changes — e.g., the Approve button vs the Confirm Swap
 * button.)
 *
 * Bug-shapes guarded:
 *   - MarketBalancePanel never mounts (gating regression that
 *     skips the panel when `address` is null at first render)
 *   - "Balance" header dropped (i18n breakage; PanelLayout refactor
 *     that removes panel titles)
 *   - "Collateral" dropdown trigger missing (a refactor that
 *     splits the dropdown into separate buttons — would silently
 *     remove the dropdown affordance)
 *   - Collateral panel rendered as a different component shape
 *     (sister panel takes its slot — assert proves identity)
 *
 * **Why no Split/Merge dropdown-item assertions**: those labels
 * only render after the user clicks the "Collateral" button. The
 * `getByText` happy-path assertion stays at the top-level static
 * surface; click-driven assertions belong to a follow-up
 * interaction-style scenario.
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

export default {
    name:        '12-market-page-allowances',
    description: 'Asserts the allowances/collateral surface (MarketBalancePanel) mounted with the static "Balance" header + "Collateral" dropdown trigger visible. Same mocks as #11; the assertion reaches a different structural slice of the page (the panel that gates the on-chain approve/split/merge flow).',
    bugShape:    'MarketBalancePanel never mounts / Balance header dropped / Collateral dropdown missing / sister panel takes the allowance slot (foundation regression for the allowances feature area)',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    assertions: [
        // Panel header — proves MarketBalancePanel mounted at all.
        // Lenient `.first()` because "Balance" is a common short word
        // that may also appear in tab labels (e.g., a sub-tab inside
        // the trading panel).
        async (page) => {
            await expect(
                page.getByText('Balance').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        // Collateral dropdown trigger — proves the interactive
        // collateral control is present (not just the panel header).
        // Role-based locator anchors to the actual <button>
        // element, avoiding matches inside informational copy
        // elsewhere on the page.
        async (page) => {
            await expect(
                page.getByRole('button', { name: /Collateral/ }).first(),
            ).toBeVisible({ timeout: 15_000 });
        },
    ],

    timeout: 180_000,
};
