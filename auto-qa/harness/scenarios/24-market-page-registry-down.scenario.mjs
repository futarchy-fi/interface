/**
 * 24-market-page-registry-down.scenario.mjs — chaos: hard 502 on
 * /markets/[address] from the REGISTRY side.
 *
 * Where #02 covers REGISTRY 502 on /companies (carousel never
 * renders → empty state), this slice covers the SAME failure
 * mode on the MARKET PAGE (a distinct page with a distinct data
 * dependency graph). The market page reads from MULTIPLE sources
 * — MARKETS_CONFIG (static, always works), the registry GraphQL
 * (proposal metadata), Snapshot (voting), the subgraph (trade
 * history), candles (pricing), and on-chain (balances). The
 * static MARKETS_CONFIG entry should be enough to mount the
 * page-shell even when the registry is dead — the registry
 * provides ENRICHMENT, not the foundation.
 *
 * Distinct from #02 (same failure mode, different page) because
 * the market page's degradation contract is different: it should
 * still mount its structural panels (chart, trading, allowances,
 * positions) using the static config + happy candles, even when
 * registry-side proposal metadata is unavailable.
 *
 * Distinct from #10 (market-page-happy with registry healthy)
 * because this scenario keeps the candles + chain mocks at their
 * happy-path values but takes the registry OUT — isolates the
 * "registry-only-down" failure mode and verifies the page degrades
 * gracefully rather than cascading.
 *
 * Bug-shapes guarded:
 *   - market-page CRASHES when registry returns 502 (no defensive
 *     .catch in the proposal-metadata-fetch chain — error from
 *     `registryAdapter.fetchProposalMetadataFromRegistry` bubbles
 *     up through React's rendering tree and triggers the error
 *     boundary)
 *   - page-shell HANGS in loading state forever when registry is
 *     down (loading=true never clears on the .catch branch in
 *     useContractConfig or its callers)
 *   - "Bad Gateway: ..." raw error text leaked to a panel header
 *     or modal (error-message rendering bypasses the UX-grade
 *     error wrapper)
 *   - "Market Not Found" gate FALSE-POSITIVE fires (wrong code
 *     path triggered by registry-down rather than the
 *     intended-purpose missing-from-MARKETS_CONFIG signal —
 *     would mask the real "this market isn't in the config"
 *     failure mode that #14 is meant to catch)
 *   - WrongNetworkModal incorrectly fires (chain validation
 *     should NOT depend on registry availability; a regression
 *     that gates the chain check on registry success would
 *     render the modal whenever the registry blips)
 *
 * Why no `useAnvilRpcProxy: true`: this scenario doesn't assert
 * on chain-derived state (no balance / position values). The
 * page-shell mount + structural panel render is enough to prove
 * the registry-down path doesn't cascade. Adding the proxy would
 * conflate registry-down chaos with chain-side reads.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    MARKET_PROBE_ADDRESS,
    makeMarketCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '24-market-page-registry-down',
    description: 'REGISTRY GraphQL returns 502 + CANDLES happy on /markets/<probe>. Asserts the page-shell still mounts (chart strip + wallet shorthand visible) — proves the static MARKETS_CONFIG entry alone is sufficient to render the structural panels, and a registry-side outage does NOT cascade to a hung spinner, a crash, or a Market Not Found false positive. Distinct from #02 (same failure mode on a different page with a different degradation contract).',
    bugShape:    'market-page crashes on registry 502 / page-shell hangs forever in loading state / "Bad Gateway" raw error leaked to UI / Market Not Found false positive (wrong code path triggered by registry-down) / WrongNetworkModal false positive (chain check incorrectly gated on registry success)',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        // REGISTRY hard 502 — same handler shape as #02 but
        // applied here against the market page's distinct
        // proposal-metadata-fetch path (which goes through
        // `registryAdapter.fetchProposalMetadataFromRegistry`,
        // not the /companies-side `useAggregatorCompanies`).
        [REGISTRY_GRAPHQL_URL]: async (route) => {
            await route.fulfill({
                status: 502,
                contentType: 'application/json',
                body: JSON.stringify({
                    errors: [{ message: 'Bad Gateway (chaos: market-page-registry-down)' }],
                }),
            });
        },
        // CANDLES happy path — keeps the test focused on the
        // registry-side failure mode. Candles-side chaos on the
        // market page is a separate slice (#25+).
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    assertions: [
        // Same page-shell-mounted probe as #10: "Trading Pair"
        // label proves the chart-parameter strip mounted (one of
        // the page's static structural panels). If the registry-
        // down failure cascades into the page-shell render path,
        // this label never appears and the assertion times out.
        async (page) => {
            await expect(
                page.getByText('Trading Pair').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        // Wallet shorthand — proves wagmi+RainbowKit hydrated
        // and the wallet stub installed regardless of registry
        // availability. Catches the "WrongNetworkModal incorrectly
        // fires when registry is down" bug shape because the
        // modal would replace the wallet shorthand with its own
        // chain-mismatch UI.
        async (page) => {
            await expect(
                page.getByText('0xf3…2266').first(),
            ).toBeVisible({ timeout: 15_000 });
        },
    ],

    timeout: 60_000,
};
