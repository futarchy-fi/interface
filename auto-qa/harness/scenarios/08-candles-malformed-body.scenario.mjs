/**
 * 08-candles-malformed-body.scenario.mjs — Phase 7 slice 2: candles HTML-not-JSON chaos.
 *
 * Sister to #07 (registry-malformed-body) on the candles side, AND
 * sister to #03 (candles-down/5xx) — completes the candles-side
 * failure-mode coverage:
 *
 *   | Mode             | Status | Body              | Scenario |
 *   |------------------|--------|-------------------|----------|
 *   | 5xx down         | 502    | error envelope    | #03      |
 *   | partial-200      | 200    | subset of pools   | #04      |
 *   | malformed body   | 200    | HTML              | **#08**  |
 *
 * Why the candles malformed-body case is distinct from the registry
 * malformed-body (#07) case:
 *   * Different hook chain — the candles fetch happens in
 *     `attachPrefetchedPrices` (called by useAggregatorCompanies)
 *     rather than in the orgs/proposals fetch chain. Different
 *     .catch placement; different downstream consumers.
 *   * Different fallback path — when candles fails, the page can
 *     STILL render the carousel card (registry data is intact);
 *     only the price fallback fires. The malformed-body
 *     SyntaxError must therefore be caught WITHOUT taking down
 *     the cards that registry already produced.
 *   * Different blast radius — registry malformed body breaks
 *     the entire page (no orgs to render); candles malformed
 *     body breaks only the price overlay. A bug that crashes
 *     the whole page on candles malformed body is a regression
 *     even if registry malformed body is correctly handled.
 *
 * Bug-shapes guarded:
 *   - JSON.parse SyntaxError on candles takes down the carousel
 *     entirely (instead of just suppressing the price overlay)
 *   - HTML body content leaks into the price overlay ("503
 *     Service Unavailable" rendered where "0.00 SDAI" should be)
 *   - hung price spinner because the SyntaxError doesn't trigger
 *     the per-pool fallback's loading=false
 *   - silent broken state — status 200 made the price hook
 *     think it succeeded, set prices.yes to undefined, and
 *     downstream formatter rendered "undefined SDAI" or "NaN SDAI"
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    makeGraphqlMockHandler,
    fakePoolBearingProposal,
} from '../fixtures/api-mocks.mjs';

const HTML_ERROR_PAGE = `<!DOCTYPE html>
<html><head><title>503 Service Unavailable</title></head>
<body><h1>Service Unavailable</h1>
<p>The server is temporarily unable to handle the request.</p>
<p>Reference: chaos-candles-malformed-body-08</p>
</body></html>`;

export default {
    name:        '08-candles-malformed-body',
    description: 'REGISTRY healthy + CANDLES returns 200 with HTML body (CDN/proxy intercepted candles request). Assert the carousel still renders the event card (registry data intact) but the price degrades to "0.00 SDAI" — JSON.parse SyntaxError on candles must NOT take down the carousel.',
    bugShape:    'json-parse-syntaxerror on candles crashes carousel / leaks HTML to price overlay / hangs price spinner (distinct from #03 5xx-down because the SyntaxError can bypass the .catch the same way #07\'s registry malformed-body can)',
    route:       '/companies',

    mocks: {
        // REGISTRY happy path: carousel renders our pool-bearing
        // proposal so a card actually mounts.
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakePoolBearingProposal({})],
        }),
        // CANDLES returns an HTML error page with 200 status.
        // Both the bulk prefetch AND the per-pool fallback hit
        // this same endpoint, so both .json() calls throw
        // SyntaxError. The price hook must catch BOTH without
        // taking down the carousel that registry already rendered.
        [CANDLES_GRAPHQL_URL]: async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: HTML_ERROR_PAGE,
            });
        },
    },

    assertions: [
        // Carousel rendered our event (REGISTRY worked; the candles
        // SyntaxError did NOT cascade up to the orgs fetch).
        async (page) => {
            await expect(
                page.getByText('HARNESS-PROBE-EVENT-001').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        // Graceful degradation: price formatter falls back to
        // "0.00 SDAI" exactly like #03 — the formatter doesn't
        // care WHY prices.yes is null, only that it is.
        async (page) => {
            await expect(
                page.getByText('0.00 SDAI').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
    ],

    timeout: 180_000,
};
