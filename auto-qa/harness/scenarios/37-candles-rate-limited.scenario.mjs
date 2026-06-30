/**
 * 37-candles-rate-limited.scenario.mjs — chaos: HTTP 429 from
 * the CANDLES side on /companies, with `Retry-After: 1` header.
 *
 * Companion to #36 (registry-rate-limited): same failure mode
 * on the symmetric endpoint. Where #36 leaves the carousel
 * unable to mount any cards (registry empty → no events to
 * render), #37 keeps registry healthy so the carousel mounts
 * — but the per-pool price-fetch hits the rate-limited candles
 * endpoint and falls through to the same "0.00 SDAI" fallback
 * shape as #03 (hard 502).
 *
 * Distinct from #03 (same fallback UX, different control flow):
 *   - #03 hard 502: `fetch` resolves with `!response.ok` →
 *     `.catch` branch in the price-fetch chain
 *   - #37 (this slice): `fetch` resolves with `response.ok =
 *     false` (status 429) but with a JSON-shape error body —
 *     clients with auto-retry-on-429 take a different code
 *     path than they do for 5xx
 *
 * Real-world parallel: production candles endpoint fronted by
 * a per-IP rate limiter that clamps at N requests/minute. A
 * page-load that fans out to N pool-price queries (one per
 * card on the carousel) trips the limiter mid-flight; some
 * cards get 200, others get 429. The page must degrade
 * gracefully without re-firing the rate-limited requests on
 * the next refresh tick (which would just hammer the upstream
 * after the limiter clears).
 *
 * Bug-shapes guarded:
 *   - Per-pool fetcher CRASHES on 429 (treats response.json()
 *     as valid pool data, downstream `.map` or `.length`
 *     access throws on the error envelope shape)
 *   - Per-pool fetcher IMMEDIATELY RETRIES on 429 with no
 *     Retry-After respect (thundering-herd shape; invisible
 *     without infra instrumentation)
 *   - Per-pool fetcher renders raw "rate limited" error
 *     message in the price card (leaks infra error to UX
 *     surface)
 *   - Card stays on LoadingSpinner forever (loading flag
 *     never clears on 429 — the consumer's `.catch` only
 *     handles 5xx not 4xx)
 *   - Bulk prefetch races per-pool fallback: one branch
 *     gets 429, the other gets 200, and which one wins
 *     determines whether the page renders the price or the
 *     fallback (race condition under partial rate-limiting)
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    makeGraphqlMockHandler,
    fakePoolBearingProposal,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '37-candles-rate-limited',
    description: 'REGISTRY healthy + CANDLES GraphQL responds 429 + Retry-After: 1 + JSON-shape error body. Asserts the carousel still renders the event card (registry data intact) but the price degrades to "0.00 SDAI" — same terminal UX as #03 (hard 502) but DIFFERENT control flow (4xx-with-Retry-After vs 5xx). Catches: per-pool fetcher crash on 429, immediate-retry without Retry-After respect, raw error leaked to UI, forever-LoadingSpinner from 429 not triggering loading=false, bulk-vs-fallback race under partial rate-limiting.',
    bugShape:    'per-pool fetcher crashes on 429 (treats response.json() as valid pool data) / per-pool fetcher hammers candles upstream with retries (no Retry-After respect; thundering-herd) / raw "rate limited" error rendered in price card / card forever-LoadingSpinner (429 doesn\'t trigger loading=false) / bulk-prefetch vs per-pool fallback race wins/loses unpredictably under partial rate-limiting',
    route:       '/companies',

    mocks: {
        // REGISTRY happy path: carousel renders our pool-bearing
        // proposal so a card actually mounts. Same as #03/#20.
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakePoolBearingProposal({})],
        }),
        // CANDLES rate-limited: 429 + Retry-After: 1 + JSON
        // error body. Both bulk prefetch AND per-pool fallback
        // hit this same endpoint, so both paths see the 429.
        [CANDLES_GRAPHQL_URL]: async (route) => {
            await route.fulfill({
                status: 429,
                headers: { 'Retry-After': '1' },
                contentType: 'application/json',
                body: JSON.stringify({
                    errors: [{
                        message: 'rate limited (chaos: candles-rate-limited)',
                        extensions: { code: 'RATE_LIMITED', retryAfter: 1 },
                    }],
                }),
            });
        },
    },

    assertions: [
        // Carousel rendered our event (REGISTRY healthy).
        async (page) => {
            await expect(
                page.getByText('HARNESS-PROBE-EVENT-001').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        // Same terminal-state as #03 (hard 502): the price
        // formatter ends up at the "no price" fallback string
        // (`\`0.00 ${baseTokenSymbol}\``). Distinct CONTROL FLOW
        // from #03 (4xx-with-Retry-After vs 5xx).
        async (page) => {
            await expect(
                page.getByText('0.00 SDAI').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
    ],

    timeout: 60_000,
};
