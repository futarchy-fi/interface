/**
 * 03-candles-down.scenario.mjs — Phase 7 slice 2: candles chaos.
 *
 * Companion to scenario 02 (registry-down). Where 02 takes the
 * REGISTRY out (so the carousel renders nothing), this scenario
 * keeps REGISTRY healthy (so the carousel renders our event card)
 * but takes the CANDLES endpoint out — exercising the SECOND-tier
 * data dependency.
 *
 * Critical observation: per `src/utils/SubgraphPoolFetcher.js`, the
 * per-pool fallback fetcher (`poolFetcher.fetch(...)` inside
 * `useLatestPoolPrices`) calls `getSubgraphEndpoint(chainId)` →
 * `https://api.futarchy.fi/candles/graphql` — the SAME endpoint
 * `collectAndFetchPoolPrices` hits in the bulk-prefetch step.
 * So mocking CANDLES → 502 fails BOTH the bulk prefetch AND the
 * per-pool fallback. Both `prices.yes` and `prices.no` stay null;
 * the card formatter ends up at:
 *   `prices.yes !== null ? '...' : '0.00 ${baseTokenSymbol}'`
 * → "0.00 SDAI" rendered.
 *
 * Bug-shapes guarded:
 *   - card hangs on LoadingSpinner forever when CANDLES is dead
 *     (loading state not unwound when fetch errors)
 *   - card crashes when prices come back null (formatter assumes
 *     non-null without the fallback branch)
 *   - card shows stale or fake numbers (silent fallback to a
 *     different pricing source that's not visibly distinguishable)
 *
 * Naming note: this scenario also acts as a NEGATIVE companion
 * to scenario 01 — if scenario 01 starts passing without the
 * candles mock (because someone wired a non-mocked default), this
 * test fails because "0.00 SDAI" appears even though candles is
 * formally up. Helps pin the DOM↔API invariant tighter.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    makeGraphqlMockHandler,
    fakePoolBearingProposal,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '03-candles-down',
    description: 'REGISTRY healthy + CANDLES 502; assert the carousel still renders our event but the price degrades to "0.00 SDAI" (per-pool fallback ALSO hits the dead candles endpoint).',
    bugShape:    'price card hangs / crashes / shows fake number when candles down',
    route:       '/companies',

    mocks: {
        // REGISTRY happy path: carousel renders our pool-bearing
        // proposal so a card actually mounts.
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakePoolBearingProposal({})],
        }),
        // CANDLES dead: bulk prefetch fails AND per-pool fallback
        // fails (same endpoint).
        [CANDLES_GRAPHQL_URL]: async (route) => {
            await route.fulfill({
                status: 502,
                contentType: 'application/json',
                body: JSON.stringify({
                    errors: [{ message: 'Bad Gateway (chaos: candles-down)' }],
                }),
            });
        },
    },

    assertions: [
        // Carousel rendered our event (REGISTRY worked).
        async (page) => {
            await expect(
                page.getByText('HARNESS-PROBE-EVENT-001').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        // Graceful degradation: price formatter ends up at the
        // "no price" fallback string. Asserting "0.00 SDAI" is
        // appropriate because EventHighlightCard's formatter for
        // prices.yes === null is `\`0.00 ${baseTokenSymbol}\``.
        async (page) => {
            await expect(
                page.getByText('0.00 SDAI').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
    ],

    timeout: 180_000,
};
