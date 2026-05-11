/**
 * 35-market-page-candles-corrupt-pool.scenario.mjs — chaos:
 * per-pool corruption on /markets/[address] from the CANDLES
 * side. **Closes the market-page chaos matrix to 12/12.**
 *
 * Where #23 covers per-row pool corruption on /companies (pools
 * array with one well-formed + one corrupt pool entry), this
 * slice covers the symmetric failure on the MARKET PAGE.
 * Distinct from #29 (entire candles response body non-JSON)
 * and #33 (one pool's latest-candle returns empty array)
 * because the candles response IS structurally valid AND
 * contains a row for the NO pool — but the row is missing
 * its required `close` field.
 *
 * Real-world parallel: an indexer migration that left the NO
 * pool's latest candle row with `close = NULL` because a
 * decimal-precision regression dropped the value mid-write;
 * the GraphQL server returned the row cleanly because the
 * schema marks `close` as nullable, but consumers that read
 * the field and try to format it crash on the null.
 *
 * Bug-shapes guarded:
 *   - Per-pool spot-price formatter CRASHES on null `close`
 *     (formatter assumes non-null after the empty-array
 *     guard but doesn't check for null fields within an
 *     array of length > 0)
 *   - YES outcome's price LEAKS into NO outcome's display
 *     (cache-key collision when the corrupt row's pool id
 *     matches both lookups, or when the formatter reuses
 *     the last seen price as a fallback)
 *   - NO outcome's display renders raw "null SDAI" or
 *     "undefined SDAI" or "NaN SDAI" (formatter coerces
 *     null/undefined to a string instead of falling back
 *     to a sentinel like "0.00 SDAI" or "—")
 *   - Chart panel goes BLANK for both outcomes because the
 *     corrupt-pool null close propagates through a shared
 *     chart-data hook and triggers a re-render bail
 *   - Trading panel "preview price" feature CRASHES because
 *     the price-difference calculation between YES and NO
 *     hits `null - 0.5 = NaN` and the formatter doesn't
 *     guard against NaN in the bps-formatting math
 *   - Outcome tab for NO VANISHES from the trading panel
 *     because a defensive filter drops outcomes with null
 *     prices (instead of degrading the display)
 *
 * Distinct from #33 (same page, different shape):
 *   - #33 partial: candles for NO returns `[]` (no rows
 *     at all) — tests `candles.length > 0` guard
 *   - #35 corrupt: candles for NO returns `[{ /* no close
 *     field *\/ }]` — tests `candles[0]?.close` guard
 *     (one row exists but its required field is missing)
 *
 * Distinct from #23 (same shape, different page):
 *   - #23 /companies: pools array with two entries, one
 *     missing `price` field — tests carousel's per-pool
 *     formatter
 *   - #35 /markets/[address]: candles latest array with
 *     one entry missing `close` field — tests market-page
 *     two-outcome formatter on a different
 *     defensive-coding surface
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
// latest-candle query for the NO pool and return ONE row that
// is structurally valid GraphQL-shape (an array with a single
// object) BUT missing the `close` field. Every other query
// goes through the happy-path handler unchanged.
function makeCorruptCandlesHandlerForMarketPage() {
    const inner = makeMarketCandlesMockHandler();
    return async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        const q = body.query || '';

        // Only intercept the latest-candle lookup for the NO
        // pool. Match by lowercased address in a `pool:` slot
        // to avoid false-positive matching on other queries
        // that reference the same address.
        const noPoolLower = MARKET_PROBE_NO_POOL.toLowerCase();
        const matchesLatestCandlesForNoPool =
            q.includes('candles(where:') &&
            new RegExp(`pool:\\s*"${noPoolLower}"`, 'i').test(q);
        if (matchesLatestCandlesForNoPool) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                // One candle row, structurally valid (it's
                // an object) but missing the `close` field —
                // GraphQL may have returned this if the
                // upstream marked `close` nullable and the
                // indexer wrote NULL. Consumers that don't
                // guard `candles[0]?.close` will see
                // undefined and propagate it through their
                // formatter chain.
                body: JSON.stringify({ data: { candles: [{}] } }),
            });
            return;
        }
        return inner(route);
    };
}

export default {
    name:        '35-market-page-candles-corrupt-pool',
    description: 'REGISTRY happy + CANDLES returns valid responses for every query EXCEPT the latest-candle lookup for the NO pool which returns `{ candles: [{}] }` — one row, structurally valid, missing the required `close` field. Asserts the page-shell still mounts (Trading Pair + wallet shorthand visible) — proves per-pool defensive coding works on the candles latest-row shape. CLOSES the market-page chaos matrix to 12/12 (mirroring step 26\'s closure of the /companies matrix).',
    bugShape:    'per-pool spot-price formatter crashes on null close field / YES price leaks into NO display via cache-key collision / NO display renders raw "null SDAI" or "undefined SDAI" or "NaN SDAI" / chart panel blank for both outcomes from corrupt pool propagating up shared chart-data hook / trading panel preview-price crashes on NaN math / NO outcome tab vanishes from defensive filter dropping null-price outcomes',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makeCorruptCandlesHandlerForMarketPage(),
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
