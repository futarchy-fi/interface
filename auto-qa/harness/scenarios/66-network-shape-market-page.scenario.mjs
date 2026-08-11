/**
 * 66-network-shape-market-page.scenario.mjs — sister of scenario 50
 * (network-shape /companies) on the market-page surface.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Silent network-behavior regressions on the /markets surface that
 * don't change DOM text, don't throw, don't emit console errors —
 * but ARE wrong. Same KIND as scenario 50 on /companies; this one
 * pins the market-page network contract independently.
 *
 * Why a SEPARATE scenario is needed even though 50 exists:
 *
 *   - /companies and /markets/<addr> mount DIFFERENT hook trees. The
 *     carousel hook (useAggregatorCompanies) and the market-page
 *     hooks (useContractConfig + useBalanceManager + chart-data hook)
 *     fetch separately. A regression that reintroduces a legacy
 *     CloudFront URL in market-only code paths would PASS scenario
 *     50 (which only navigates /companies) and slip past every
 *     existing market-page scenario (whose DOM/eth_call assertions
 *     don't inspect network shape).
 *
 *   - The post-GCP-migration positive URLs are the same
 *     (api.futarchy.fi/registry/graphql + api.futarchy.fi/candles/
 *     graphql), but the FETCH SITES differ. Pinning each surface
 *     separately gives a per-surface guarantee.
 *
 *   - The PR #60 migration spanned both /companies AND market pages.
 *     Scenario 50 catches a /companies regression; this catches the
 *     market-page half. Together they pin the full migration arc.
 *
 * ── Specific assertions ─────────────────────────────────────────────
 *
 *   POSITIVE 1: at least one call to api.futarchy.fi/registry/graphql.
 *     Proves useContractConfig / aggregator-side fetch reaches the
 *     new registry endpoint. A refactor that drops the registry
 *     fetch (e.g., relies on MARKETS_CONFIG only) → 0 calls → fails.
 *
 *   POSITIVE 2: at least one call to api.futarchy.fi/candles/graphql.
 *     Proves the chart-data + per-pool-price pipeline reaches the
 *     new candles endpoint. A refactor that bypasses candles for the
 *     market page → 0 calls → fails.
 *
 *   NEGATIVE: zero calls to legacy AWS CloudFront / amazonaws.com.
 *     Same dead URLs as scenario 50. A regression that reintroduces
 *     the legacy URL in market-page-only code → 1+ calls → fails.
 *     The legacy URL might successfully respond with stale data, so
 *     this assertion is the ONLY way to catch a silent revert in
 *     market-page-only code (DOM assertions would still pass on
 *     mocked or cached data).
 *
 * ── Why no Supabase negative here ───────────────────────────────────
 * Scenarios 57 (market_event_proposal_links) and 61 (pool_candles)
 * already cover the Supabase negatives. Folding them into this one
 * would couple the network-shape catch to PR-specific bug shapes;
 * keeping them as dedicated PR catches preserves the bug-shape
 * → scenario mapping that the catalog depends on.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *
 *   1. Current code: all 3 assertions pass.
 *
 *   2. Mutate `src/hooks/useContractConfig.js` to short-circuit the
 *      registry fetch (return early before the GraphQL call). Run
 *      scenario → POSITIVE 1 FAILS (0 calls when 1+ expected).
 *
 *   3. Add a stray `fetch('https://test.cloudfront.net/legacy')`
 *      inside any market-page-mounted code (e.g., a useEffect in
 *      MarketPageShowcase.jsx). Run scenario → NEGATIVE FAILS
 *      (1 call when 0 expected).
 *
 *   4. Restore. Verify all 3 pass.
 *
 * ── Mocks ───────────────────────────────────────────────────────────
 * Same registry + candles mocks as scenarios 10 / 57. Happy path so
 * the page mounts cleanly and all expected fetches fire. The
 * assertions inspect what URLs the PAGE called, not the mock
 * payloads.
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
    name:        '66-network-shape-market-page',
    description: 'Sister of scenario 50 on the market-page surface. Asserts /markets/<probe> network shape: must call api.futarchy.fi/registry/graphql AND api.futarchy.fi/candles/graphql; must NOT call legacy AWS CloudFront subgraph URLs. Catches silent network regressions in market-page-only code paths that scenario 50 (/companies-only) would miss.',
    bugShape:    'market-page silently hits a deprecated/wrong URL (PR #60-shape if reintroduced in market-only code) / skips a required GraphQL call on the market surface / floods a healthy endpoint with retries from market-only hooks (no errors, no DOM change — invisible to every other market-page assertion target)',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    assertions: [
        // Anchor: page mounted enough for the network calls to fire.
        // Without this, an empty `callsTo` could be vacuously true
        // (page crashed before any fetch).
        async (page) => {
            await expect(
                page.getByText('Trading Pair').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // POSITIVE 1: registry GraphQL endpoint called at least once
        // on the market surface. `expect.poll` because the fetch
        // happens asynchronously after mount.
        async (page, ctx) => {
            await expect.poll(
                () => ctx.callsTo('api.futarchy.fi/registry/graphql').length,
                {
                    message: 'expected at least one call to api.futarchy.fi/registry/graphql from the market page',
                    timeout: 15_000,
                },
            ).toBeGreaterThan(0);
        },

        // POSITIVE 2: candles GraphQL endpoint called at least once
        // on the market surface. Proves the chart-data + per-pool-
        // price pipeline reaches the right URL.
        async (page, ctx) => {
            await expect.poll(
                () => ctx.callsTo('api.futarchy.fi/candles/graphql').length,
                {
                    message: 'expected at least one call to api.futarchy.fi/candles/graphql from the market page',
                    timeout: 15_000,
                },
            ).toBeGreaterThan(0);
        },

        // NEGATIVE: zero calls to legacy AWS CloudFront / amazonaws
        // subgraph URLs. Same pattern as scenario 50 (catches a
        // PR #60-shape revert in market-page-only code paths).
        async (page, ctx) => {
            const legacyCalls = ctx.callsTo(/\.(cloudfront\.net|amazonaws\.com)/);
            expect(legacyCalls, {
                message: `expected zero calls to legacy AWS subgraph URLs (cloudfront.net / amazonaws.com) from the market page; saw: ${legacyCalls.map(c => c.url).join(', ')}`,
            }).toHaveLength(0);
        },
    ],

    timeout: 180_000,
};
