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
    description: 'Asserts the trading panel (ShowcaseSwapComponent) mounted with both outcome tabs ("If Yes" / "If No") and both action buttons ("Buy" / "Sell") visible, AND the "Available 1100 sDAI" line — fork-derived aggregate (wallet sDAI 1000 + min(YES 100, NO 100) position = 1100). Same registry/candles mocks as #10; opts into the anvil RPC proxy so wallet-balance reads see the fork-funded state.',
    bugShape:    'trading panel never mounts / outcome tab collapsed / action buttons missing or swapped / Connect Wallet renders SOLO instead of the panel (foundation regression for the trading feature area)',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    // Phase 7 step 8: opt into the anvil RPC proxy so the trading
    // panel's "Available" line reads from the fork-funded wallet
    // (1000 sDAI + 100 YES + 100 NO position from globalSetup) and
    // the assertion below can target the AGGREGATE value
    // (wallet sDAI + min(YES, NO) = 1100 sDAI). Without the proxy,
    // unifiedBalanceFetcher reads from real Gnosis mainnet and the
    // wallet has zero balances → the line shows "1000 sDAI"
    // (wallet only) or "0 sDAI" depending on which RPC wins.
    useAnvilRpcProxy: true,

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
        // Phase 7 step 8: AGGREGATE value-flow assertion. With the
        // RPC proxy installed (useAnvilRpcProxy: true above), the
        // page's `unifiedBalanceFetcher` reads from the local anvil
        // fork and sees the wallet's funded state. The trading
        // panel's "Available" line aggregates wallet sDAI + the
        // wallet's MIN(YES position, NO position) — the largest
        // amount the user could BUY of an outcome (since each buy
        // consumes 1 sDAI from the wallet OR redeems 1 unit of the
        // OPPOSING position to free up sDAI). With wallet=1000 sDAI
        // and YES=100 + NO=100, the value is 1000 + min(100, 100)
        // = 1100. Distinct from #14's "100 GNO" assertion: that one
        // covers RAW per-outcome position rendering; this one covers
        // a DERIVED aggregate (the same `formatWith` formatter is
        // hit, but through a different code path that sums values
        // before formatting).
        async (page) => {
            await expect(
                page.getByText('1100 sDAI').first(),
            ).toBeVisible({ timeout: 60_000 });
        },
    ],

    timeout: 180_000,
};
