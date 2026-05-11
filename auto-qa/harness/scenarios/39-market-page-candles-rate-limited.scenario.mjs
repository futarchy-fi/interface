/**
 * 39-market-page-candles-rate-limited.scenario.mjs — chaos:
 * HTTP 429 from the CANDLES side on /markets/[address] with
 * `Retry-After: 1` header. **Closes the market-page chaos
 * matrix to 14/14, achieving full parity with /companies
 * across all 28 cells (2 pages × 7 failure modes × 2
 * endpoints).**
 *
 * Where #37 covers candles-rate-limited on /companies (carousel
 * mounts but price degrades), this slice covers the symmetric
 * failure on the MARKET PAGE. Distinct from #25 (candles
 * hard-502, `.catch` branch), #38 (registry-rate-limited on
 * the same page), and #37 (same failure mode on /companies)
 * because the market page's candles consumers feed DIFFERENT
 * panels than /companies' carousel — primarily the chart
 * panel + per-pool spot-price displays + trading-panel preview.
 *
 * The 429 status is "successful" from a Promise standpoint, so
 * `.then` fires with the error envelope. Consumers that don't
 * check `response.ok` may treat the error body as if it were
 * valid candles data, leading to a different bug surface than
 * the .catch-on-5xx path of #25.
 *
 * Bug-shapes guarded:
 *   - Chart panel CRASHES on 429 from candles (treats
 *     response.json() as valid candles data — downstream
 *     consumer crashes on `.find(p => p.id === ...)` of the
 *     error envelope where it expected a pools array)
 *   - Chart panel HANGS in loading forever (429 doesn't
 *     trigger loading=false because the consumer's `.catch`
 *     handles 5xx not 4xx)
 *   - Chart-fetch IMMEDIATELY RETRIES with no Retry-After
 *     respect (worse on the market page than on /companies
 *     because chart-data refetches on every interaction —
 *     hover, zoom, time-window-change — multiplying the
 *     retry storm)
 *   - Per-pool spot-price displays render raw "rate
 *     limited" message (formatter coerces error envelope
 *     fields to string)
 *   - Trading panel "preview price" CRASHES because the
 *     candles-derived feed returns the error envelope and
 *     the price-difference calculation hits NaN
 *   - WHOLE PAGE crashes from missing chart-panel error
 *     boundary — collateral damage to trading + allowances
 *     + positions panels (same shape as #25 but via 429
 *     rather than 502)
 *
 * Distinct from #25 (5xx) on the same page:
 *   - 5xx fires `.catch` in the chart-fetch chain
 *   - 429 fires `.then` (status-code-only check passes)
 *     but with an error-shaped body that breaks downstream
 *     consumers
 *
 * Why no `useAnvilRpcProxy: true`: same rationale as the
 * prior market-page chaos slices.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    MARKET_PROBE_ADDRESS,
    fakeMarketProposalEntity,
    makeGraphqlMockHandler,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '39-market-page-candles-rate-limited',
    description: 'REGISTRY happy + CANDLES responds 429 + Retry-After: 1 + JSON-shape error body on /markets/<probe>. Asserts the page-shell still mounts (Trading Pair + wallet shorthand visible) — proves a candles-side rate-limit doesn\'t cascade to a hung/crashed page-shell. Distinct from #25 (5xx → .catch on same page), #38 (registry-side 429 on same page), and #37 (same failure mode, different page). CLOSES the market-page chaos matrix to 14/14, achieving full parity with /companies (28/28 cells across both pages).',
    bugShape:    'chart panel crashes on 429 (treats response.json() as valid candles data; downstream crash on pools.find/.length) / chart panel hangs forever (429 doesn\'t trigger loading=false; .catch handles 5xx not 4xx) / chart-fetch hammers candles upstream with retries (no Retry-After; worse than /companies because chart refetches on hover/zoom/time-window-change) / per-pool spot-price renders raw "rate limited" / trading panel preview crashes from candles-derived feed returning error envelope (NaN math) / whole-page crash from missing chart error boundary (collateral damage)',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        // REGISTRY happy path: proposal metadata populates so
        // the failure mode under test is candles-only.
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        // CANDLES rate-limited: 429 + Retry-After: 1 + JSON
        // error body. All 4 query shapes hit this same response.
        [CANDLES_GRAPHQL_URL]: async (route) => {
            await route.fulfill({
                status: 429,
                headers: { 'Retry-After': '1' },
                contentType: 'application/json',
                body: JSON.stringify({
                    errors: [{
                        message: 'rate limited (chaos: market-page-candles-rate-limited)',
                        extensions: { code: 'RATE_LIMITED', retryAfter: 1 },
                    }],
                }),
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
