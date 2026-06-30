/**
 * 61-pr49-no-supabase-pool-fetcher.scenario.mjs — catches PR #49
 * (Replace SupabasePoolFetcher with subgraph-based fetcher).
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Negative network assertion (same KIND as scenario 57 / PR #48):
 * the page must NOT issue requests to a deprecated Supabase REST
 * endpoint. Pre-PR-49, four consumers (`EventHighlightCard`,
 * `HighlightCards`, `ProposalsCard`, `MarketPageShowcase`) used
 * `createSupabasePoolFetcher` to issue `pools.candle limit:1` calls
 * — each one resolved to a `GET ${SUPABASE_URL}/rest/v1/pool_candles
 * ?...` request. Post-PR-49 those calls go through
 * `createSubgraphPoolFetcher` against
 * `algebra-proposal-candles-v1` and the `pool_candles` Supabase
 * table sees zero traffic from these components.
 *
 * The DOM behavior is identical pre/post — both fetchers ultimately
 * resolve to the same YES/NO probability values rendered on the
 * EventHighlightCard. Only the network shape differs, so this is
 * the same KIND of catch as scenario 57: the deprecated data path
 * being re-introduced wouldn't trip any DOM assertion, but the
 * network monitor surfaces it immediately.
 *
 * ── Why /companies and not /markets ─────────────────────────────────
 *   1. Three of the four PR #49 consumers (`EventHighlightCard`,
 *      `HighlightCards`, `ProposalsCard`) render on the
 *      `/companies` page. The market-page consumer
 *      (`MarketPageShowcase`) coexists with `TripleChart`, which
 *      ALSO queries `pool_candles` independently (lines
 *      275-422) — TripleChart was NOT in the PR #49 scope and
 *      legitimately keeps hitting Supabase. So a
 *      `ctx.callsTo(/pool_candles/) === 0` assertion on
 *      `/markets/...` would false-trip every time.
 *   2. `/companies` cleanly isolates the PR #49 consumers from the
 *      remaining Supabase-using surfaces.
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to `/companies`.
 *   2. Mock registry GraphQL with a probe organization +
 *      `fakePoolBearingProposal` (which embeds
 *      `metadata.conditional_pools.{yes,no}.address` so the
 *      EventHighlightCard's `useLatestPoolPrices` effect fires
 *      with real pool addresses to query).
 *   3. Mock candles GraphQL with the standard handler.
 *   4. Wait for the carousel to mount (probe event visible).
 *   5. Wait 3s for the per-card price-fetch effects to settle.
 *   6. Assert `ctx.callsTo(/pool_candles/).length === 0`.
 *
 * A regression that re-imports `supabasePoolFetcher` and calls
 * `fetch('pools.candle', ...)` in ANY of the three /companies-side
 * consumers (`EventHighlightCard`, `HighlightCards`, `ProposalsCard`)
 * would trip the assertion — even though the rendered probability
 * values would still match (the failing-DNS Supabase request
 * eventually times out and the page falls back to whatever the
 * prefetched-price path provided).
 *
 * ── Verification protocol ───────────────────────────────────────────
 *
 *   1. Current code: assertion passes (zero `pool_candles` requests
 *      from /companies).
 *
 *   2. Mutate
 *      `src/components/futarchyFi/companyList/cards/highlightCards/
 *      EventHighlightCard.jsx` — inject a direct
 *      `fetch(${SUPABASE_URL}/rest/v1/pool_candles?select=...)`
 *      in `useLatestPoolPrices`'s mount effect (simulates the
 *      pre-fix `supabasePoolFetcher.fetch('pools.candle')` path).
 *      → assertion FAILS with `Scenario 61 found N request(s) to
 *      the deprecated Supabase pool_candles endpoint`.
 *
 *   3. Restore → passes.
 *
 * ── Why this catch is high value ────────────────────────────────────
 * SupabasePoolFetcher.js was DELETED in PR #49. A future engineer
 * may re-introduce a `from('pool_candles')` call thinking the
 * shape "just works" — and the DOM would render the right numbers
 * (because the failing call is on a slow path with fallback). The
 * regression would only show up as production-Supabase load OR
 * extra DNS failures in logs. This scenario catches it pre-merge.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    makeGraphqlMockHandler,
    makeCandlesMockHandler,
    fakePoolBearingProposal,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '61-pr49-no-supabase-pool-fetcher',
    description: 'Catches PR #49 (replace SupabasePoolFetcher with subgraph-based fetcher). Navigate to /companies, mount the carousel of EventHighlightCards with pool addresses, assert NO request to the deprecated Supabase pool_candles table. Reverting any consumer to supabasePoolFetcher.fetch("pools.candle") re-introduces the request and trips ctx.callsTo. Negative network assertion KIND, reuses slice 82\'s ctx.callsTo + slice 92\'s URL-pattern shape.',
    bugShape:    'Supabase pool_candles lookup re-introduced in EventHighlightCard / HighlightCards / ProposalsCard: every /companies mount issues extra failing-DNS requests to harness-supabase.invalid; deprecated data path silently back in service while DOM looks healthy',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakePoolBearingProposal({})],
        }),
        // EMPTY price map on purpose: the bulk subgraph fetcher
        // (`fetchPoolsBatch` via `SubgraphBulkPriceFetcher`) returns
        // an empty pool array → `attachPrefetchedPrices` skips, so
        // `event.prefetchedPrices` stays undefined → each
        // EventHighlightCard's `useLatestPoolPrices` no longer
        // early-returns and instead runs its per-pool fetch. The
        // per-pool fetch is the exact path PR #49 migrated from
        // Supabase to subgraph; this is the only configuration in
        // which a revert to `supabasePoolFetcher.fetch('pools.candle')`
        // would actually fire and trip the assertion below. With
        // prefetched prices present (slice 1/scenario 01-style),
        // both pre- and post-fix code skip the fetch entirely and
        // the catch is invisible.
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({
            prices: {},
        }),
    },

    assertions: [
        // Sanity: the carousel mounted the probe event card. Without
        // this anchor, an empty `callsTo` could be vacuously true
        // (page failed before any card rendered, so no
        // useLatestPoolPrices effect ran).
        async (page) => {
            await expect(
                page.getByText('HARNESS-PROBE-EVENT-001').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Wait for useLatestPoolPrices mount effects to settle. The
        // effect fires immediately on card mount; the pre-fix
        // Supabase call would land in the first ~1s. 3s slack
        // covers React StrictMode double-mount + slow CI.
        async (page) => {
            await page.waitForTimeout(3000);
        },

        // Core assertion: NO request to the Supabase pool_candles
        // table. The regex is forgiving — matches any URL
        // containing the table name, so different REST shapes
        // (?select=*, ?address=eq.0x..., etc.) all match.
        async (page, ctx) => {
            const supabaseLookups = ctx.callsTo(/pool_candles/);
            if (supabaseLookups.length > 0) {
                const summary = supabaseLookups
                    .slice(0, 3)
                    .map((r, i) => `  ${i + 1}. ${r.method} ${r.url}`)
                    .join('\n');
                throw new Error(
                    `Scenario 61 found ${supabaseLookups.length} request(s) to the deprecated ` +
                    `Supabase pool_candles endpoint (PR #49 removed this code path):\n${summary}`,
                );
            }
        },
    ],

    timeout: 180_000,
};
