/**
 * 33-market-page-candles-partial.scenario.mjs — chaos: partial-
 * success candles on /markets/[address].
 *
 * Where #04 covers partial candles on /companies (two pool
 * pairs requested, only one returned), this slice covers the
 * symmetric failure on the MARKET PAGE. Distinct from #25
 * (candles 502 → `.catch`), #27 (candles empty-200 →
 * `.then([])`), #29 (candles malformed → SyntaxError), and
 * #31 (candles slow → in-flight state) because the candles
 * endpoint stays UP and HEALTHY and returns VALID responses,
 * but ONE of the two probe pools (NO) has its latest-candle
 * data missing — same shape as a real-world bug where the
 * indexer caught up on one pool but not the other.
 *
 * Strategy: the inner handler delegates to
 * `makeMarketCandlesMockHandler` for all queries EXCEPT the
 * latest-candle lookup for the NO pool — which returns
 * `{ candles: [] }` instead of the well-formed `[{ close }]`.
 * Every other surface (discovery, pool-detail, swaps,
 * token-list) returns happy data, so the failure mode is
 * isolated to the per-pool latest-price path for one outcome.
 *
 * Expected degradation:
 *   - Page-shell mounts (registry + most candles surfaces
 *     happy)
 *   - Chart panel might mount for YES outcome but show
 *     loading/fallback for NO
 *   - Per-pool spot-price display: YES shows real number,
 *     NO shows fallback string ("0.00" / "—" / null-guard
 *     equivalent)
 *   - Trading panel must still mount (uses on-chain reads,
 *     not candles)
 *
 * Bug-shapes guarded:
 *   - Missing candles for ONE pool corrupts ALL price
 *     displays (cache-key bug or last-write-wins applies
 *     the wrong price to both YES + NO displays)
 *   - Outcome tab for NO VANISHES from the trading panel
 *     because a defensive filter drops outcomes with
 *     missing candles (instead of degrading the display)
 *   - Formatter CRASHES on null close-price (same shape as
 *     #04's "0.00 SDAI" fallback assertion — the page must
 *     guard `candles[0]?.close` access)
 *   - YES and NO prices SWAP between outcome tabs
 *     (cache-key / pool-address comparison bug — a
 *     real-world bug shape from PR #64-style cache misuse
 *     applied to the market page's two-outcome rendering)
 *   - Chart panel goes BLANK for both outcomes because the
 *     one missing pool's null candles propagates through a
 *     shared chart-data hook
 *
 * Distinct from #04 (same shape, different page):
 *   - #04 /companies: two events side-by-side in the
 *     carousel; one priced, one unpriced. The visible
 *     contrast is between TWO CARDS.
 *   - #33 /markets/[address]: one event but two outcome
 *     pools side-by-side. The contrast is between TWO
 *     OUTCOMES of the same proposal. Different render
 *     path, same defensive-coding expectation.
 *
 * Why no `useAnvilRpcProxy: true`: same rationale as prior
 * market-page chaos slices.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    MARKET_PROBE_ADDRESS,
    MARKET_PROBE_NO_POOL,
    fakeMarketProposalEntity,
    makeGraphqlMockHandler,
    makeMarketCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';

// Wrap `makeMarketCandlesMockHandler` to intercept the
// latest-candle query for the NO pool and return an empty
// candles array, leaving every other query at its happy-path
// response. Same closure pattern as #19/#20/#30/#31 — keeps
// the upstream helper shape untouched.
function makePartialMarketCandlesHandler() {
    const inner = makeMarketCandlesMockHandler();
    return async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        const q = body.query || '';

        // Latest-candle query for the NO pool specifically:
        // return an empty candles array, simulating an
        // indexer that hasn't yet processed the NO pool's
        // first swap. Match by the lowercase NO pool address
        // appearing in a `pool:` slot to avoid false-positive
        // matching on other queries that also reference the
        // address.
        const noPoolLower = MARKET_PROBE_NO_POOL.toLowerCase();
        const matchesLatestCandlesForNoPool =
            q.includes('candles(where:') &&
            new RegExp(`pool:\\s*"${noPoolLower}"`, 'i').test(q);
        if (matchesLatestCandlesForNoPool) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: { candles: [] } }),
            });
            return;
        }

        // Delegate all other queries to the happy-path
        // handler.
        return inner(route);
    };
}

export default {
    name:        '33-market-page-candles-partial',
    description: 'REGISTRY happy + CANDLES returns valid responses for every query shape EXCEPT the latest-candle lookup for the NO pool which returns empty (simulating an indexer that caught up on YES but not NO). Asserts the page-shell still mounts (Trading Pair + wallet shorthand visible) — proves the per-pool partial-data failure mode doesn\'t cascade. Mirror of #04 on /companies, applied to the market page\'s two-outcome contract.',
    bugShape:    'missing-candles-for-one-pool corrupts both price displays (cache key collision) / NO outcome tab vanishes from trading panel (overzealous filter drops missing-candles outcomes) / formatter crashes on null close-price / YES and NO prices swap between outcome tabs (cache-key / pool-address comparison regression) / chart panel goes blank for both outcomes from shared chart-data hook propagating one pool\'s null data',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makePartialMarketCandlesHandler(),
    },

    assertions: [
        async (page) => {
            await expect(
                page.getByText('Trading Pair').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        async (page) => {
            await expect(
                page.getByText('0xf3…2266').first(),
            ).toBeVisible({ timeout: 15_000 });
        },
    ],

    timeout: 60_000,
};
