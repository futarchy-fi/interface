/**
 * 38-market-page-registry-rate-limited.scenario.mjs — chaos:
 * HTTP 429 from the REGISTRY side on /markets/[address] with
 * `Retry-After: 1` header.
 *
 * Where #36 covers registry-rate-limited on /companies (carousel
 * shows empty state), this slice covers the symmetric failure
 * on the MARKET PAGE. Distinct from #24 (registry hard-502) and
 * #36 (same failure mode, different page) because:
 *   - #24 covers 5xx control flow on the market page
 *   - #36 covers 429 control flow on /companies (where registry
 *     is the foundation — empty registry means empty carousel)
 *   - #38 (this slice) covers 429 control flow on the market
 *     page where registry is ENRICHMENT (page-shell mounts
 *     from static MARKETS_CONFIG regardless of registry state)
 *
 * The 429 status is "successful" from a Promise standpoint, so
 * `.then` fires with the error envelope. Consumers that don't
 * check `response.ok` may treat the error body as if it were
 * valid registry data, leading to a different bug surface than
 * the .catch-on-5xx path of #24.
 *
 * Bug-shapes guarded:
 *   - Page CRASHES on 429 from registry (treats response.json()
 *     as valid registry data — downstream consumer sees the
 *     error envelope where it expected proposalentities array
 *     and crashes on a `.find()` or `.length` access)
 *   - Page-shell HANGS in loading state forever (429 doesn't
 *     trigger the loading=false setter that's wired to .catch
 *     branches but not to .then-with-error)
 *   - Page IMMEDIATELY RETRIES with no Retry-After respect
 *     (thundering-herd shape — even worse on the market page
 *     than on /companies because the page polls registry on
 *     every state change for proposal-metadata refresh)
 *   - Raw "rate limited" error message rendered in proposal
 *     title or chart panel placeholder
 *   - "Market Not Found" FALSE-POSITIVE (the 429-error code
 *     path collapses with the missing-from-MARKETS_CONFIG
 *     gate — same wrong-code-path collapse class as
 *     #24/#26/#28/#34)
 *
 * Distinct from #24 (5xx) on the same page:
 *   - 5xx fires `.catch` in the proposal-metadata-fetch chain
 *   - 429 fires `.then` (status-code-only check passes) but
 *     with an error-shaped body that breaks downstream
 *     consumers
 *
 * Why no `useAnvilRpcProxy: true`: same rationale as the prior
 * market-page chaos slices.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    MARKET_PROBE_ADDRESS,
    makeMarketCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '38-market-page-registry-rate-limited',
    description: 'REGISTRY responds 429 + Retry-After: 1 + JSON-shape error body + CANDLES happy on /markets/<probe>. Asserts the page-shell still mounts (Trading Pair + wallet shorthand visible) — proves the static MARKETS_CONFIG entry is sufficient even when registry is rate-limited. Distinct from #24 (5xx → .catch) and #36 (same failure mode, different page contract). Catches: 429 treated as valid data downstream crash, forever-loading from 429 not triggering loading=false, retry-storm without Retry-After respect, error message leak to UI, "Market Not Found" wrong-code-path collapse.',
    bugShape:    'page crashes on 429 from registry (treats response.json() as valid registry data) / page-shell hangs forever (429 doesn\'t trigger loading=false) / page hammers registry with retries (no Retry-After respect; thundering-herd) / raw "rate limited" error rendered in proposal title or chart placeholder / "Market Not Found" false-positive from 429 wrong-code-path collapse',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        // REGISTRY rate-limited: same handler shape as #36 but
        // applied here against the market page's distinct
        // proposal-metadata-fetch path.
        [REGISTRY_GRAPHQL_URL]: async (route) => {
            await route.fulfill({
                status: 429,
                headers: { 'Retry-After': '1' },
                contentType: 'application/json',
                body: JSON.stringify({
                    errors: [{
                        message: 'rate limited (chaos: market-page-registry-rate-limited)',
                        extensions: { code: 'RATE_LIMITED', retryAfter: 1 },
                    }],
                }),
            });
        },
        // CANDLES happy path — isolates the registry-side
        // failure mode.
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
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
