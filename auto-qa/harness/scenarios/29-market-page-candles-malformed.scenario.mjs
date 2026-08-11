/**
 * 29-market-page-candles-malformed.scenario.mjs — chaos:
 * malformed body on /markets/[address] from the CANDLES side.
 *
 * Where #28 covers REGISTRY malformed-body on the market page,
 * this slice covers the SAME failure shape on the CANDLES side.
 * Distinct from #25 (candles 502 → `.catch`) and #27 (candles
 * empty-200 → `.then([])`) because the response body is
 * text/html — `response.json()` throws SyntaxError before any
 * `.then` chain runs. Mirrors #08 (candles-malformed-body on
 * /companies) on the market page.
 *
 * The market page's candles consumers (`usePoolData`,
 * `useYesNoPoolData`, chart-fetch chain) all parse the candles
 * response through `response.json()`. A SyntaxError thrown
 * there bypasses any `.catch` that's only wired to the
 * `.then(parsed)` rejection branch — see #28's detailed
 * explanation of the form-1 vs form-2 fetch handling pattern.
 *
 * Why the chart-fetch chain is the most likely surface to
 * crash: per `src/utils/SubgraphPoolFetcher.js` and
 * `getSubgraphEndpoint(chainId)`, the same candles endpoint
 * feeds BOTH the bulk-prefetch and the per-pool fallback
 * fetcher. ALL of them call `.json()` on the response. ANY
 * caller that uses the `await fetch + await json` pattern
 * surfaces an unhandled rejection.
 *
 * Distinct from #28 (registry-malformed): #28 breaks proposal
 * metadata fetch; #29 breaks chart panel + price displays.
 * Two different surfaces of the page hit the same root failure
 * mode via independent code paths. A regression that fixes
 * #28 (registry malformed-body handling) might still leave
 * #29 broken — they're at different abstraction layers.
 *
 * Bug-shapes guarded:
 *   - Market-page CRASHES on candles malformed-body
 *     (SyntaxError thrown by `response.json()` in the chart-
 *     fetch chain bypasses outer `.catch`)
 *   - HTML body content LEAKS into the chart panel placeholder
 *     ("503 Service Unavailable" rendered as text where the
 *     chart should be)
 *   - Hung loading spinner on the chart panel from SyntaxError
 *     outside the `.then` chain not triggering loading=false
 *   - WHOLE PAGE crashes from missing chart-panel error
 *     boundary (collateral damage taking down trading +
 *     allowances + positions panels too; same shape as #25
 *     but via SyntaxError rather than 502)
 *   - Per-pool spot-price displays render raw "[object Object]"
 *     or "undefined" because the formatter received the
 *     SyntaxError's `message` field instead of a price value
 *
 * Why no `useAnvilRpcProxy: true`: same rationale as prior
 * market-page chaos slices.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    MARKET_PROBE_ADDRESS,
    fakeMarketProposalEntity,
    makeGraphqlMockHandler,
} from '../fixtures/api-mocks.mjs';

// Same HTML body shape as #07/#08/#28 — keeps the failure mode
// recognisable across all four malformed-body scenarios so a
// bisecting developer can quickly identify the class of bug.
const HTML_ERROR_PAGE = `<!DOCTYPE html>
<html><head><title>503 Service Unavailable</title></head>
<body><h1>Service Unavailable</h1>
<p>The server is temporarily unable to handle the request.</p>
<p>Reference: chaos-market-page-candles-malformed-29</p>
</body></html>`;

export default {
    name:        '29-market-page-candles-malformed',
    description: 'REGISTRY happy + CANDLES responds 200 + content-type:text/html + an HTML error page body on /markets/<probe>. Asserts the page-shell still mounts (Trading Pair + wallet shorthand visible). Distinct from #25 (candles 502 → .catch) and #27 (candles empty-200 → .then-with-empty) because response.json() throws SyntaxError before any .then chain runs. Mirror of #08 on /companies, applied to the market page\'s 4-query-shape candles contract.',
    bugShape:    'market-page crashes on candles malformed-body / HTML body content leaks into chart panel placeholder / hung chart loading spinner from SyntaxError bypassing .catch / whole-page crash from missing chart-panel error boundary (collateral damage to trading/allowances/positions) / per-pool spot-price renders "[object Object]" or "undefined" from formatter receiving SyntaxError fields',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: HTML_ERROR_PAGE,
            });
        },
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
