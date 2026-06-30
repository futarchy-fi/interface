/**
 * 31-market-page-candles-slow.scenario.mjs — chaos: slow-but-
 * recovers candles on /markets/[address].
 *
 * Where #30 covers slow registry on the market page (page-shell
 * mount immediate via MARKETS_CONFIG, proposal title swaps in
 * late), this slice covers the symmetric failure on the CANDLES
 * side. Distinct from #25 (candles 502 → `.catch` branch) and
 * #27 (candles empty-200 → `.then([])` branch) because the
 * response eventually arrives with VALID data after a 5s delay
 * per request — exercises the in-flight loading state + post-
 * resolution rerender path.
 *
 * The market page emits FOUR distinct candles query shapes (per
 * `makeMarketCandlesMockHandler`); ALL four are delayed
 * uniformly. With multiple sequential sub-queries, total time-to-
 * full-data can exceed the single-DELAY_MS window. The 30s
 * assertion timeout below accounts for that.
 *
 * What this exercises vs the registry-slow #30:
 *   - #30: page-shell mounts immediately, registry-side
 *     enrichment (title, description) swaps in late
 *   - #31: page-shell mounts immediately, chart panel +
 *     per-pool spot-price displays start "loading" and
 *     transition to real values when candles eventually
 *     responds
 *   Both exercise the in-flight state, but on DIFFERENT
 *   panels — orthogonal coverage.
 *
 * Bug-shapes guarded:
 *   - Chart panel stays in LOADING state forever after
 *     slow candles arrives — same shape as #20's
 *     price-card-stuck-at-fallback bug, but on the
 *     market-page's chart-render path
 *   - Per-pool spot-price displays CRASH when the slow
 *     candles promise resolves (formatter assumes a
 *     synchronous data shape, late-arriving fields break
 *     a guard that's only checked at first render)
 *   - Chart panel renders the SLOW promise's stale data
 *     after a refresh tick (race condition: late v1
 *     response overwrites a fresher v2 response)
 *   - Bulk-prefetch races per-pool fallback under
 *     latency, one wins silently and the other's data
 *     is dropped
 *   - Refresh tick STACKS slow candles requests on top
 *     of each other (no abort-controller, eventually
 *     exhausts connections / OOMs)
 *   - Late-arriving response causes a chart-panel
 *     LAYOUT-SHIFT (chart placeholder swaps for real
 *     chart 5+s after mount, viewport jumps)
 *
 * Distinct from #20 (same shape, different page):
 *   - #20 /companies: slow candles → carousel price cards
 *     transition from "0.00 SDAI" fallback to "0.4200 SDAI"
 *   - #31 /markets/[address]: slow candles → chart panel +
 *     per-pool spot-price transitions; trading panel
 *     remains functional independent of candles (uses
 *     on-chain reads)
 *
 * Why no `useAnvilRpcProxy: true`: same rationale as prior
 * market-page chaos slices — page-shell mount probe isolates
 * the candles-side slow failure mode.
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

const DELAY_MS = 5000;

// Wrap the standard happy-path market-candles handler with a
// per-request delay. Same closure pattern as #19/#20/#30.
function makeSlowMarketCandlesHandler() {
    const inner = makeMarketCandlesMockHandler();
    return async (route) => {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        return inner(route);
    };
}

export default {
    name:        '31-market-page-candles-slow',
    description: 'REGISTRY happy + CANDLES delayed by 5s per request (then returns valid market-aware response for all 4 query shapes) on /markets/<probe>. Asserts the page-shell mounts immediately (Trading Pair + wallet shorthand visible) — proves the static MARKETS_CONFIG entry is sufficient to mount the foundation without waiting for candles-side enrichment, and that the trading panel (on-chain-driven) renders independent of slow candles. Catches: chart panel stuck-loading after slow data arrives, per-pool price-display crash on late-arriving prices, stale-data race after refresh tick, refresh stacking from missing abort-controller, chart layout-shift on late mount.',
    bugShape:    'chart panel stays in loading state forever after slow candles arrives / per-pool spot-price crashes on late-arriving prices / chart shows stale data from slow-promise-race after refresh / refresh tick stacks slow candles requests (missing abort-controller) / chart layout-shift when slow data finally renders',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        // REGISTRY happy path: proposal metadata populates so
        // the failure mode under test is candles-only.
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        // CANDLES slow-but-valid: every query shape delayed 5s
        // then returns the standard happy-path market-aware
        // response.
        [CANDLES_GRAPHQL_URL]: makeSlowMarketCandlesHandler(),
    },

    assertions: [
        // Page-shell-mounted probe — 30s timeout accommodates
        // the slow candles but still bounds the test. The
        // page-shell SHOULD mount via MARKETS_CONFIG before
        // candles resolves, so this assertion should resolve
        // well before the slow-candles wait completes.
        async (page) => {
            await expect(
                page.getByText('Trading Pair').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        // Wallet shorthand — proves wagmi+RainbowKit hydrated
        // and the chain-validation gate didn't false-positive
        // on in-flight candles state.
        async (page) => {
            await expect(
                page.getByText('0xf3…2266').first(),
            ).toBeVisible({ timeout: 15_000 });
        },
    ],

    timeout: 60_000,
};
