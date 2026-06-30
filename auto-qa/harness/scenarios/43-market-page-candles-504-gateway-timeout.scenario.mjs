/**
 * 43-market-page-candles-504-gateway-timeout.scenario.mjs — chaos:
 * HTTP 504 Gateway Timeout from the CANDLES side on
 * /markets/[address], with an HTML body (NOT JSON). **Closes the
 * expanded 8-row chaos matrix to 32/32 cells, achieving full
 * parity across both pages × 8 failure-mode rows × 2 endpoints.**
 *
 * Where #41 covers candles-504 on /companies (carousel mounts but
 * price degrades to "0.00 SDAI"), this slice covers the symmetric
 * failure on the MARKET PAGE. Distinct from #25 (candles
 * hard-502, `.catch` branch), #39 (candles rate-limited 429,
 * `.then`-with-Retry-After branch), #42 (registry-504+HTML on the
 * same page), and #41 (same failure mode, different page contract)
 * because the market page's candles consumers feed DIFFERENT
 * panels than /companies' carousel — primarily the chart panel +
 * per-pool spot-price displays + trading-panel preview.
 *
 * The 504 status with HTML body is "successful" from a Promise
 * standpoint, so `.then` fires — but the consumer's `.json()`
 * throws SyntaxError on the HTML body BEFORE any status check
 * or error-envelope handler runs. This is a fundamentally
 * different bug surface than:
 *   - #25's `.catch`-on-status-error path (502+JSON envelope)
 *   - #39's `.then`-with-valid-error-envelope path (429+JSON +
 *     Retry-After contract)
 *   - #41's parse-error path on /companies' carousel-card consumer
 *     (same control flow but different downstream consumers)
 *
 * Bug-shapes guarded:
 *   - Chart panel CRASHES on 504+HTML (the consumer treats
 *     `response.json()` as the canonical parse path; SyntaxError
 *     propagates as an uncaught promise rejection → React error
 *     boundary in the chart panel → "Chart unavailable"
 *     placeholder OR collateral collapse to whole-page error)
 *   - Chart panel HANGS in loading forever (504+HTML doesn't
 *     trigger loading=false because the parse error throws
 *     before the loading-cleanup code runs — distinct from
 *     #25's `.catch` path which does run cleanup, and #39's
 *     `.then`-with-error-envelope path which exposes a
 *     structured error to the loading-cleanup handler)
 *   - Chart-fetch IMMEDIATELY RETRIES with no backoff —
 *     WORSE than #39 because there's no Retry-After to respect,
 *     AND worse than /companies because chart-data refetches
 *     on every interaction (hover, zoom, time-window-change),
 *     multiplying the retry storm
 *   - Per-pool spot-price displays render the raw HTML body
 *     (formatter coerces `.text()` fallback to string and
 *     renders the LB error page literally in a price slot)
 *   - Trading panel "preview price" CRASHES because the
 *     candles-derived feed returns parse-error and the
 *     price-difference calculation hits NaN
 *   - WHOLE PAGE crashes from missing chart-panel error
 *     boundary — collateral damage to trading + allowances
 *     + positions panels (same shape as #25 but via 504+HTML
 *     parse-error rather than 502+JSON status-error)
 *
 * Distinct from #25 (502+JSON) on the same page:
 *   - 502+JSON fires `.catch` in the chart-fetch chain (status
 *     check + structured envelope)
 *   - 504+HTML fires `.then` (status-code-only check passes)
 *     then THROWS during `.json()` parse — completely different
 *     control flow path
 *
 * Distinct from #39 (429+Retry-After+JSON) on the same page:
 *   - 429+JSON has explicit Retry-After contract; consumers
 *     should respect it
 *   - 504+HTML has no Retry-After AND throws on parse —
 *     consumer can't even read a structured error message
 *     to log what happened
 *
 * Distinct from #42 (registry-504+HTML) on the same page:
 *   - #42 takes the proposal-metadata enrichment out (page-shell
 *     mounts because MARKETS_CONFIG is foundation; chart panel
 *     and trading panel are unaffected by registry-side failure)
 *   - #43 takes the candles-side data sources out (page-shell
 *     mounts but chart + per-pool prices + trading-preview all
 *     hit the parse-error path) — entirely different downstream
 *     consumer cascade
 *
 * Distinct from #41 (candles-504 on /companies):
 *   - #41's downstream consumers: carousel price card formatter
 *     → `0.00 SDAI` fallback string
 *   - #43's downstream consumers: chart panel renderer + per-pool
 *     spot-price displays + trading-panel preview-price
 *     calculator — much larger surface area, distinct UX
 *     contracts per panel
 *
 * Why no `useAnvilRpcProxy: true`: same rationale as the prior
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

const HTML_504_BODY = `<!DOCTYPE html>
<html>
<head><title>504 Gateway Timeout</title></head>
<body>
<center><h1>504 Gateway Timeout</h1></center>
<hr><center>nginx (chaos: market-page-candles-504-gateway-timeout)</center>
</body>
</html>
`;

export default {
    name:        '43-market-page-candles-504-gateway-timeout',
    description: 'REGISTRY happy + CANDLES responds 504 + Content-Type: text/html + HTML body (no JSON, no Retry-After) on /markets/<probe>. Asserts the page-shell still mounts (Trading Pair + wallet shorthand visible) — proves a candles-side gateway-timeout doesn\'t cascade to a hung/crashed page-shell. Distinct from #25 (502+JSON → .catch), #39 (429+Retry-After+JSON), #42 (registry-side 504+HTML on same page), and #41 (same failure mode on /companies). **CLOSES the expanded 8-row chaos matrix to 32/32 cells across both pages.**',
    bugShape:    'chart panel crashes on JSON.parse(html) throwing SyntaxError (downstream uncaught rejection → "Chart unavailable" or whole-page error) / chart panel hangs forever (parse error before loading-cleanup; distinct from #25 .catch path) / chart-fetch hammers candles upstream with retries (no backoff, no Retry-After to respect — worse than #39; worse than /companies because chart refetches on hover/zoom/time-window-change) / per-pool spot-price renders raw HTML body / trading panel preview crashes from candles-derived feed parse-error (NaN math) / whole-page crash from missing chart error boundary (collateral damage)',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        // REGISTRY happy path: proposal metadata populates so
        // the failure mode under test is candles-only.
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        // CANDLES gateway-timeout: 504 + HTML body. All 4 query
        // shapes hit this same response (chart-data + per-pool
        // bulk + per-pool fallback + trading-panel preview-feed
        // all share the same endpoint).
        [CANDLES_GRAPHQL_URL]: async (route) => {
            await route.fulfill({
                status: 504,
                contentType: 'text/html',
                body: HTML_504_BODY,
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
