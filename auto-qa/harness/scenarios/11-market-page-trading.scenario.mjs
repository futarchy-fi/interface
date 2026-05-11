/**
 * 11-market-page-trading.scenario.mjs — Phase 7 pivot iteration 3:
 * first market-page feature-area scenario.
 *
 * Where #10 covered "page-shell rendered" (foundation), this asserts
 * the **trading panel** mounted with its interactive controls
 * visible. The user called out trading as the FIRST of 5 market-page
 * feature areas to cover; this scenario locks in the rendering
 * contract before subsequent scenarios stress its interaction
 * surface (slippage, cost/size mode toggle, limit-order panel,
 * confirm modal, transaction success/fail flows).
 *
 * **What the trading panel is** — `ShowcaseSwapComponent.jsx` renders
 * a tab-bar pair of outcome controls ("If Yes" / "If No") above an
 * action-button pair ("Buy" / "Sell"). Both pairs are static labels
 * — they don't depend on dynamic mock data — so their presence
 * proves the panel mounted past:
 *   - the chain-validation gate (WrongNetworkModal would replace it)
 *   - the proposal-discovery gate (a "no proposal" branch would
 *     replace it with a loader)
 *   - the wallet-connect gate (Connect Wallet button would be a
 *     SOLO render at line 1717 instead of the trading panel)
 *
 * **Mocks**: identical to #10 — registry GraphQL with the synthetic
 * proposalentity, candles GraphQL with the market-aware handler.
 * No new fixture surface. The mocks only have to be sufficient to
 * get past the page-shell gates; the trading panel's internal
 * state (selected outcome, selected action) is React-local so it
 * doesn't depend on additional mocks.
 *
 * Bug-shapes guarded:
 *   - trading panel never mounts (ShowcaseSwapComponent gating
 *     regression: e.g., requires non-null `selectedOutcome` at
 *     mount time, but a wallet-disconnected default makes it null)
 *   - outcome tabs collapsed to one (responsive-layout regression
 *     hides "If No" at viewport widths the harness uses)
 *   - action buttons swapped (Buy/Sell labels reversed; the
 *     handlers wire to the wrong action)
 *   - "Connect Wallet" button shows SOLO instead of the trading
 *     panel (wallet-stub injection regression — wagmi disconnects
 *     mid-render)
 *   - either label missing (i18n breakage that drops the English
 *     fallback string, or string-constants extraction regression)
 *
 * **Why no specific value assertions**: this scenario asserts
 * STRUCTURE only. Subsequent trading-area scenarios (#12+) will
 * assert specific dynamic values (mocked balance flows into the
 * "Available" line, mocked price flows into the "Price Now" panel,
 * etc.). Locking in the structure first means later iterations
 * have a known-good baseline to differentiate against.
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
    name:        '11-market-page-trading',
    description: 'Asserts the trading panel (ShowcaseSwapComponent) mounted with both outcome tabs ("If Yes" / "If No") and both action buttons ("Buy" / "Sell") visible. Same mocks as #10; the assertion reaches a structural slice of the page no scenario has covered yet.',
    bugShape:    'trading panel never mounts / outcome tab collapsed / action buttons missing or swapped / Connect Wallet renders SOLO instead of the panel (foundation regression for the trading feature area)',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    assertions: [
        // Outcome tabs — two static labels rendered side-by-side.
        // Asserting BOTH proves the tab pair didn't collapse.
        async (page) => {
            await expect(
                page.getByText('If Yes').first(),
            ).toBeVisible({ timeout: 30_000 });
            await expect(
                page.getByText('If No').first(),
            ).toBeVisible({ timeout: 15_000 });
        },
        // Action buttons — two static labels also rendered as a pair.
        // Targeting via role+name resolves to the actual <button>
        // elements (avoids matching the same words inside other
        // panels like a trade-history row that says "Sell" in the
        // type column).
        async (page) => {
            await expect(
                page.getByRole('button', { name: /^Buy$/ }).first(),
            ).toBeVisible({ timeout: 15_000 });
            await expect(
                page.getByRole('button', { name: /^Sell$/ }).first(),
            ).toBeVisible({ timeout: 15_000 });
        },
    ],

    timeout: 180_000,
};
