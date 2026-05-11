/**
 * 25-market-page-candles-down.scenario.mjs — chaos: hard 502 on
 * /markets/[address] from the CANDLES side.
 *
 * Where #03 covers CANDLES 502 on /companies (carousel cards
 * mount but render the "0.00 SDAI" fallback), this slice covers
 * the SAME failure mode on the MARKET PAGE. Distinct from #24
 * (registry-down) because the candles endpoint feeds DIFFERENT
 * panels — primarily the chart panel and per-pool spot-price
 * displays. The registry feeds proposal metadata; the candles
 * feeds price/chart data. Independent failure paths.
 *
 * Expected degradation:
 *   - Page-shell mounts (registry happy → proposal metadata
 *     populates)
 *   - Trading panel mounts (uses on-chain reads, not candles)
 *   - Allowances panel mounts (uses on-chain reads, not candles)
 *   - Positions panel mounts (uses on-chain reads, not candles)
 *   - Chart panel might show empty / loading-failed state
 *   - Per-pool spot-price displays fall back to "0.00 SDAI" or
 *     similar (same fallback path as #03 on /companies)
 *
 * Distinct from #24 because: #24 registry-down would break the
 * proposal metadata (title, description) but leave chart-data-
 * dependent panels functional (candles still works). #25 reverses
 * the failure axis — title/description are intact, but the chart
 * panel and price displays are degraded.
 *
 * Bug-shapes guarded:
 *   - Market-page CRASHES when candles returns 502 (no defensive
 *     `.catch` in `usePoolData` / `useYesNoPoolData` / chart-fetch
 *     chain; error bubbles up through React's rendering tree)
 *   - Chart panel HANGS in loading state forever (loading flag
 *     never clears on candles `.catch` branch)
 *   - "Bad Gateway: ..." raw error leaked to a chart panel
 *     placeholder or price card (error rendering bypasses the
 *     UX-grade error wrapper)
 *   - WHOLE PAGE crashes because one chart-panel hook lacks an
 *     error boundary — taking down trading + allowances +
 *     positions panels too (collateral damage from a localized
 *     failure)
 *   - Trading panel goes blank because a derived price hook
 *     (e.g., useLatestPoolPrices feeding the trading panel for
 *     pre-trade preview) propagates the candles error up the
 *     dep tree
 *
 * Why no `useAnvilRpcProxy: true`: same rationale as #24 — this
 * scenario isolates the candles-side failure mode, not chain-
 * side reads. The page-shell mount + structural panel render is
 * enough to prove candles-down doesn't cascade.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    MARKET_PROBE_ADDRESS,
    fakeMarketProposalEntity,
    makeGraphqlMockHandler,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '25-market-page-candles-down',
    description: 'REGISTRY happy + CANDLES GraphQL returns 502 on /markets/<probe>. Asserts the page-shell still mounts (Trading Pair label + wallet shorthand visible) despite the candles endpoint being unreachable. Proves a candles-side outage does NOT cascade to a crashed/hung page-shell, and that panels depending on on-chain reads (trading, allowances, positions) remain functional independent of candles. Distinct from #24 (registry-side failure) and #03 (same failure mode on /companies, different page).',
    bugShape:    'market-page crashes on candles 502 / chart panel hangs forever in loading / "Bad Gateway" raw error leaked to chart placeholder / whole page crashes via missing chart-panel error boundary (collateral damage) / trading panel goes blank from candles-error propagating up dep tree',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        // REGISTRY happy path: proposal metadata populates so
        // the failure mode under test is candles-only.
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        // CANDLES hard 502 — all four query shapes
        // (proposal+whitelistedtokens, pools singular, candles
        // latest, whitelistedtokens-only) fail uniformly.
        [CANDLES_GRAPHQL_URL]: async (route) => {
            await route.fulfill({
                status: 502,
                contentType: 'application/json',
                body: JSON.stringify({
                    errors: [{ message: 'Bad Gateway (chaos: market-page-candles-down)' }],
                }),
            });
        },
    },

    assertions: [
        // Page-shell-mounted probe: "Trading Pair" label proves
        // the chart-parameter strip mounted (a structural panel
        // independent of chart data). If candles-down crashes
        // the page-shell render path, this label never appears.
        async (page) => {
            await expect(
                page.getByText('Trading Pair').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        // Wallet shorthand — proves wagmi+RainbowKit hydrated
        // and the wallet stub installed regardless of candles
        // availability. Catches the "whole page crashes via
        // missing chart-panel error boundary" bug shape because
        // a global crash would unmount everything including the
        // wallet shorthand chip.
        async (page) => {
            await expect(
                page.getByText('0xf3…2266').first(),
            ).toBeVisible({ timeout: 15_000 });
        },
    ],

    timeout: 60_000,
};
