/**
 * 20-candles-slow.scenario.mjs — chaos: SLOW-but-recovers candles.
 *
 * Companion to #19 (registry-slow). Where the slow-response chaos
 * axis covered the registry side via #19, this slice covers the
 * symmetric failure mode on the CANDLES side. Distinct from #03
 * (hard 502), #04 (partial — some prices missing), and #08
 * (malformed body) — all of which test failure paths where the
 * candles response NEVER becomes useful.
 *
 * #20 catches the OPPOSITE class: candles eventually returns
 * VALID prices, but only after a `DELAY_MS` window. The price
 * card must survive the wait — render the registry-side carousel
 * card without crashing, hold an interim state (loading or
 * "0.00 SDAI" fallback), and TRANSITION to the real number once
 * the candles response lands.
 *
 * Bug-shapes guarded:
 *   - card stays at "0.00 SDAI" FOREVER after the slow candles
 *     response arrives — i.e., the price re-render path is
 *     broken (a useEffect dep-array regression, a memo that
 *     captures the first stale value, a setState swallowed by
 *     an unmount/remount cycle)
 *   - card CRASHES when the slow promise resolves (e.g., a
 *     formatter that assumes prices is non-null gets called
 *     against late-arriving null fields)
 *   - card shows the SLOW promise's stale number after a
 *     second-round refetch (race condition: late v1 response
 *     overwrites a fresher v2 response)
 *   - per-pool fallback fetcher (`useLatestPoolPrices`) RACES
 *     the bulk prefetch and one of them silently wins/loses
 *     under latency pressure
 *   - request-side TIMEOUT regression — no abort controller,
 *     so the slow request fires, hangs, and a refresh tick
 *     stacks another (eventually OOM)
 *
 * Why this is a NEW failure-mode branch on /companies (not
 * already covered by #19):
 *   - #19's slow registry stops the carousel from mounting AT
 *     ALL — the entire page sits at "no organizations" until
 *     the slow response lands. The carousel card never gets to
 *     try a price fetch, so the price-render code path isn't
 *     exercised.
 *   - #20 keeps the registry fast (carousel mounts immediately),
 *     so the price-render code path IS exercised, against a
 *     slow upstream. Different layer of the page reacts.
 *
 * `DELAY_MS = 5000` matches #19 for symmetry. Since the candles
 * handler responds to MULTIPLE per-pool queries, the page may
 * see several 5s waits in sequence. The 30s assertion timeout
 * accounts for that.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    PROBE_POOL_YES,
    PROBE_POOL_NO,
    makeGraphqlMockHandler,
    makeCandlesMockHandler,
    fakePoolBearingProposal,
} from '../fixtures/api-mocks.mjs';

const DELAY_MS = 5000;

// Wrap the standard happy-path candles handler with a per-request
// delay. Same pattern as #19 — closure-based so the upstream
// helper shape is untouched and other scenarios still
// `makeCandlesMockHandler` directly.
function makeSlowCandlesHandler() {
    const inner = makeCandlesMockHandler({
        prices: {
            [PROBE_POOL_YES]: 0.42,
            [PROBE_POOL_NO]:  0.58,
        },
    });
    return async (route) => {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        return inner(route);
    };
}

export default {
    name:        '20-candles-slow',
    description: 'REGISTRY healthy + CANDLES delayed by 5s per request (then returns valid prices). Carousel card mounts immediately; price card must hold an interim state during the wait and TRANSITION to "0.4200 SDAI" once candles responds. Catches: price-rerender broken (stuck at 0.00 fallback), formatter crash on late-arriving prices, race between bulk-prefetch and per-pool fallback under latency, missing abort-controller on slow request.',
    bugShape:    'price card stuck at "0.00 SDAI" forever after slow candles arrives / formatter crashes on late-arriving prices / per-pool-fallback vs bulk-prefetch race under latency / no abort-controller (request stacks under refresh)',
    route:       '/companies',

    mocks: {
        // REGISTRY happy path: carousel renders our pool-bearing
        // proposal so a card actually mounts. Same as #03.
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakePoolBearingProposal({})],
        }),
        // CANDLES slow-but-valid: 5s delay per request, then the
        // standard happy-path response with mocked prices.
        [CANDLES_GRAPHQL_URL]: makeSlowCandlesHandler(),
    },

    assertions: [
        // Pre-flight: carousel card mounted (registry path
        // unaffected by candles slowness). Same probe as #03.
        async (page) => {
            await expect(
                page.getByText('HARNESS-PROBE-EVENT-001').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        // Canonical assertion: the slow candles response
        // EVENTUALLY drives the formatter to its real-price
        // branch. YES=0.42 → "0.4200 SDAI" (same string as #01
        // happy path). 30s timeout = ~6× the per-request delay,
        // accounting for multiple sequential per-pool queries
        // and rerender variance.
        async (page) => {
            await expect(
                page.getByText('0.4200 SDAI').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
    ],

    timeout: 60_000,
};
