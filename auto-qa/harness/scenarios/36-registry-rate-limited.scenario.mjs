/**
 * 36-registry-rate-limited.scenario.mjs — chaos: HTTP 429 from
 * the REGISTRY side, with `Retry-After: 1` header.
 *
 * Opens a NEW failure-mode row in the chaos matrix:
 * "rate-limited (429)". Distinct from #02 (hard 502) and #07
 * (malformed body) because:
 *   - 429 status semantically means "try again soon" rather
 *     than "the request itself was wrong" (4xx) or "the
 *     server is broken" (5xx). Clients with auto-retry-on-
 *     429 take a DIFFERENT code path than they do for 5xx
 *     errors.
 *   - The `Retry-After` header is actionable: clients SHOULD
 *     respect it (wait the specified seconds before retrying)
 *     but many implementations don't, leading to thundering-
 *     herd retry storms when the rate limiter clears.
 *   - Real-world parallel: production registry endpoint
 *     fronted by an Nginx/CDN rate limiter that clamps at
 *     N requests/minute. A spike in /companies traffic
 *     (e.g., a new market launch) triggers 429s for some
 *     visitors. The page must degrade gracefully without
 *     hammering the upstream after the limiter clears.
 *
 * Strategy: respond 429 + Retry-After: 1 + a JSON-shape
 * error body (most production rate limiters return
 * `{"errors": [{"message": "rate limited"}]}` or similar
 * — keeping the body parseable lets us isolate the
 * "status-code-only" handling from the "body-parse-also-
 * fails" handling that #07 covers).
 *
 * Bug-shapes guarded:
 *   - Page CRASHES on 429 — fetch's `.then` branch fires
 *     (status 429 is "successful" from a Promise standpoint)
 *     and the consumer doesn't check `response.ok`, treating
 *     the rate-limit body as if it were valid registry data
 *   - Page treats 429 as IF the request succeeded with empty
 *     data (skips the "errors" field, sees `data: {}`,
 *     falls into the empty-state path silently — no
 *     telemetry, no retry, no user-visible signal that
 *     anything went wrong)
 *   - Page IMMEDIATELY RETRIES (no respect for Retry-After
 *     header) — thundering-herd shape, hammers the upstream
 *     while it's already overloaded. Without good infra
 *     instrumentation this is invisible to the developer
 *     until the rate limiter starts blocking on stricter
 *     thresholds.
 *   - Page renders raw JSON-RPC error message ("rate
 *     limited") in the org list — leaks infra error to UX
 *     surface
 *   - Page hangs in loading state forever — the .then
 *     branch fires but if the consumer requires
 *     `data.organizations` to be an array and gets the
 *     error envelope instead, a downstream `.map` or
 *     `.length` access throws unhandled
 *
 * Why no `useAnvilRpcProxy: true`: same rationale as the
 * prior chaos scenarios — this isolates the registry-side
 * failure mode without conflating with chain-side reads.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '36-registry-rate-limited',
    description: 'Registry GraphQL responds 429 + Retry-After: 1 + a JSON-shape error body. Asserts /companies degrades to "No organizations found" empty state — proves the page handles HTTP 429 like other client-side 4xx/5xx (graceful empty fallback) rather than crashing, hanging, hammering upstream with retries, or leaking the raw error to UX. Distinct from #02 (5xx hard down) and #07 (malformed body). Opens the rate-limited row of the chaos matrix.',
    bugShape:    'page crashes on 429 (treats response.json() as valid registry data) / page hangs in loading state forever (downstream consumer crashes on error envelope where data.organizations expected) / page hammers upstream with retries (no Retry-After respect; thundering-herd shape) / page renders raw "rate limited" error in UI / page silently empties orgs list (no signal that anything went wrong)',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: async (route) => {
            await route.fulfill({
                status: 429,
                // Retry-After: 1 second. Most production rate
                // limiters set this between 1-60s. Setting it
                // to 1 keeps the test fast while still
                // exercising the parsing path for clients that
                // honor the header.
                headers: { 'Retry-After': '1' },
                contentType: 'application/json',
                body: JSON.stringify({
                    errors: [{
                        message: 'rate limited (chaos: registry-rate-limited)',
                        extensions: { code: 'RATE_LIMITED', retryAfter: 1 },
                    }],
                }),
            });
        },
    },

    assertions: [
        // Same terminal-state assertion as #02 (hard 502) and
        // #05 (empty 200) — the page should land at the
        // graceful empty state regardless of which
        // failure-mode triggered the data-fetch fail. Distinct
        // CONTROL FLOW from those scenarios (4xx-with-
        // Retry-After path), same UX terminal.
        async (page) => {
            await expect(
                page.getByText('No organizations found').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
    ],

    timeout: 60_000,
};
