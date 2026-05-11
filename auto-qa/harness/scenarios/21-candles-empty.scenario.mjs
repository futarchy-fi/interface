/**
 * 21-candles-empty.scenario.mjs — chaos: empty-200 candles.
 *
 * Where #03 takes CANDLES out via a HARD 502 (fetch throws → .catch
 * branch fires → prices stay null), this scenario keeps the
 * candles endpoint UP and HEALTHY but the pools array is EMPTY.
 * Distinct code path through `useLatestPoolPrices` /
 * `collectAndFetchPoolPrices`: this scenario fires the `.then`
 * branch (success with `{ data: { pools: [] } }`) instead of the
 * `.catch` branch.
 *
 * Both should land at the SAME terminal UX state ("0.00 SDAI"
 * fallback render), but exercise DIFFERENT control flow. Pinning
 * the empty-200 path catches a bug class where:
 *   - the `.then(empty)` branch silently HANGS on a forever-
 *     LoadingSpinner (the hook only clears `loading=false` on the
 *     `.catch` branch, so an empty-success leaves `loading=true`)
 *   - the price-card formatter assumes `pools[0]` exists and
 *     CRASHES on the empty array — "Cannot read property 'price'
 *     of undefined"
 *   - the card shows a DIFFERENT fallback text than #03 — same
 *     dead-data shape, divergent UX surface, user can't tell
 *     whether to retry or whether candles is genuinely empty
 *   - the card silently shows a STALE cached price (if a previous
 *     fetch populated the cache and the empty-success doesn't
 *     invalidate it) — wrong number rendered with high confidence
 *
 * This completes the "empty-200" axis on /companies alongside #05
 * (registry-empty-orgs). The full chaos matrix on /companies is
 * now {REGISTRY, CANDLES} × {5xx, partial, empty-200, malformed,
 * per-row-corrupt, slow}; this slice fills the empty cell at
 * (CANDLES, empty-200).
 *
 * Naming note: "empty" here means "valid 200 OK but the pools
 * array has zero entries", NOT "empty body" or "empty 204 No
 * Content". The point is to test the .then-with-empty-data branch
 * specifically.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    makeGraphqlMockHandler,
    fakePoolBearingProposal,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '21-candles-empty',
    description: 'REGISTRY healthy + CANDLES responds 200 with `{ data: { pools: [] } }` (the empty-but-valid response shape); assert the carousel still mounts and the price card degrades to "0.00 SDAI" — same terminal UX as #03 (hard 502) but a DIFFERENT control-flow branch (.then-with-empty vs .catch). Catches: .then(empty) hangs forever-spinner, formatter crashes on pools[0] of empty array, card shows divergent fallback text from #03, card uses stale cached price.',
    bugShape:    'empty-200 candles hangs forever-LoadingSpinner / formatter crashes on pools[0] of empty array / divergent fallback text vs #03 / card silently uses stale cached price (success with empty fails to invalidate cache)',
    route:       '/companies',

    mocks: {
        // REGISTRY happy path: carousel renders our pool-bearing
        // proposal so a card actually mounts. Same as #03 + #20 +
        // #04 — keeps the test focused on the candles-side
        // failure mode.
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakePoolBearingProposal({})],
        }),
        // CANDLES empty-but-valid: every pools query returns an
        // empty array. The /companies-side bulk-prefetch via
        // `collectAndFetchPoolPrices` issues a `pools(where: {
        // id_in: [...] })` query; returning empty drives the
        // .then(empty) branch instead of .catch.
        //
        // Per-pool fallback fetcher (`useLatestPoolPrices`) hits
        // the SAME endpoint with a different query shape — also
        // returning empty pools so its .then(empty) ALSO fires.
        // Both paths exercised → no surface escapes the test.
        [CANDLES_GRAPHQL_URL]: async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: { pools: [] } }),
            });
        },
    },

    assertions: [
        // Pre-flight: carousel card mounted (registry path
        // unaffected by candles-side empty response).
        async (page) => {
            await expect(
                page.getByText('HARNESS-PROBE-EVENT-001').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        // Canonical assertion: with no pool data available, the
        // formatter ends up at the "no price" fallback string
        // — `\`0.00 ${baseTokenSymbol}\``. Same expected string
        // as #03, distinct underlying control flow.
        async (page) => {
            await expect(
                page.getByText('0.00 SDAI').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
    ],

    timeout: 60_000,
};
