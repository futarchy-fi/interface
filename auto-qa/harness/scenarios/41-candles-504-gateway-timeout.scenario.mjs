/**
 * 41-candles-504-gateway-timeout.scenario.mjs — chaos: HTTP 504
 * Gateway Timeout from the CANDLES side on /companies, with an
 * HTML body (NOT JSON) — the realistic shape that load balancers
 * (AWS ALB, nginx, Cloudflare, GCP HTTPS LB) emit by default
 * when the upstream origin fails to respond within the LB's
 * idle timeout.
 *
 * Companion to #40 (registry-504-gateway-timeout): same failure
 * mode on the symmetric endpoint. Where #40 leaves the carousel
 * unable to mount any cards (registry empty → no events to
 * render), #41 keeps registry healthy so the carousel mounts
 * — but the per-pool price-fetch hits the gateway-timeout
 * candles endpoint and falls through to the same "0.00 SDAI"
 * fallback shape as #03 (hard 502) and #37 (rate-limited 429).
 *
 * Distinct from #03 (502 + JSON body, same fallback UX):
 *   - #03 fetch resolves with `!response.ok` AND a JSON-shape
 *     body — `.json()` parses cleanly so the consumer sees
 *     the structured error envelope and hits the documented
 *     `.catch` branch.
 *   - #41 fetch resolves with `!response.ok` AND a non-JSON
 *     HTML body — `.json()` THROWS SyntaxError BEFORE the
 *     consumer's status-check or error-envelope-handler runs,
 *     so the bug surface is the parse-error path, not the
 *     status-error path.
 *
 * Distinct from #37 (rate-limited 429 + JSON body, same
 * fallback UX):
 *   - #37 status 429 has explicit `Retry-After` header — the
 *     contract is "wait then retry"; consumers SHOULD respect
 *     it but often don't (thundering-herd shape).
 *   - #41 status 504 has NO Retry-After (LBs don't typically
 *     emit one for gateway timeouts) — the contract is "we
 *     gave up waiting; you decide" — consumers should retry
 *     once or twice with jitter and then give up. A consumer
 *     that conflates 429 and 504 would either ignore
 *     Retry-After on 429 OR fail to retry on 504 — different
 *     bug shapes than the body-parse-error path #41 primarily
 *     guards.
 *
 * Distinct from #40 (same failure mode, registry side):
 *   - #40 takes the carousel-data-source out (registry empty
 *     → no event cards mount → page hits "No organizations
 *     found"); #41 keeps the carousel data source healthy
 *     (event cards mount) but takes the per-card price-fetch
 *     out — exercises the SECOND-tier data-fetch failure
 *     path with the same 504+HTML control flow.
 *
 * Real-world parallel: production candles GraphQL endpoint
 * fronted by an LB with a 60s timeout. Origin Postgres has a
 * slow query (e.g., aggregate query against a partitioned
 * candles table that's missing an index). Some pool-price
 * requests time out at the LB → 504; the page must NOT crash,
 * must NOT show stale prices, and must NOT spin forever.
 *
 * Bug-shapes guarded:
 *   - Per-pool fetcher CRASHES because `response.json()`
 *     throws on the HTML body (SyntaxError → uncaught
 *     promise rejection → React error boundary in the price
 *     card → "Card error" placeholder)
 *   - Per-pool fetcher renders the HTML body raw in the
 *     price card (consumer falls back to `response.text()`
 *     and renders the LB error page literally — leaks infra
 *     error to UX surface)
 *   - Per-pool fetcher treats 504 as IF the request
 *     succeeded with empty data (silent broken state — no
 *     telemetry, no retry, no user-visible signal)
 *   - Per-pool fetcher IMMEDIATELY retries in a tight loop
 *     (no exponential backoff, hammers origin while it's
 *     already overloaded; thundering-herd shape worse than
 *     #37 because there's no Retry-After to respect)
 *   - Card hangs on LoadingSpinner forever — the .then
 *     handler fires (fetch resolves on 5xx), but the
 *     downstream consumer doesn't transition `loading=false`
 *     because the JSON-parse error throws before the
 *     loading-cleanup code runs
 *   - Bulk-prefetch races per-pool fallback: one branch
 *     gets 504 + parse error, the other gets a different
 *     state, and which one wins determines whether the
 *     page renders the price or the fallback (race
 *     condition under partial gateway-timeout)
 *
 * Strategy: respond 504 + `Content-Type: text/html` + a
 * generic nginx-style HTML 504 page. No `Retry-After` (504s
 * typically lack one).
 *
 * Asserts /companies still renders the event card (registry
 * intact) but the price degrades to "0.00 SDAI" — same
 * terminal UX as #03 (502) and #37 (429) but DIFFERENT
 * control flow (status-error + parse-error vs status-error
 * + valid-error-envelope vs status-error + Retry-After +
 * valid-error-envelope).
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    makeGraphqlMockHandler,
    fakePoolBearingProposal,
} from '../fixtures/api-mocks.mjs';

const HTML_504_BODY = `<!DOCTYPE html>
<html>
<head><title>504 Gateway Timeout</title></head>
<body>
<center><h1>504 Gateway Timeout</h1></center>
<hr><center>nginx (chaos: candles-504-gateway-timeout)</center>
</body>
</html>
`;

export default {
    name:        '41-candles-504-gateway-timeout',
    description: 'REGISTRY healthy + CANDLES GraphQL responds 504 + Content-Type: text/html + HTML body (no JSON). Asserts the carousel still renders the event card but the price degrades to "0.00 SDAI" — same terminal UX as #03 (502) and #37 (429) but DIFFERENT control flow (status-error + JSON-parse-error vs status-error + valid-error-envelope vs status-error + Retry-After). Fills the 2nd cell of the new "gateway timeout 504" matrix row on /companies.',
    bugShape:    'per-pool fetcher crashes on JSON.parse(html) throwing SyntaxError / per-pool fetcher renders raw HTML body in price card / per-pool fetcher treats 504 as success with empty data / per-pool fetcher hammers candles upstream with retries (no backoff, no Retry-After to respect — worse than #37) / card hangs on LoadingSpinner forever (parse error before loading-cleanup) / bulk-prefetch vs per-pool fallback race wins/loses unpredictably under partial 504',
    route:       '/companies',

    mocks: {
        // REGISTRY happy path: carousel renders our pool-bearing
        // proposal so a card actually mounts. Same as #03/#20/#37.
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakePoolBearingProposal({})],
        }),
        // CANDLES gateway-timeout: 504 + HTML body. Both bulk
        // prefetch AND per-pool fallback hit this same endpoint,
        // so both paths see the parse-error path on the HTML.
        [CANDLES_GRAPHQL_URL]: async (route) => {
            await route.fulfill({
                status: 504,
                contentType: 'text/html',
                body: HTML_504_BODY,
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
        // Same terminal-state as #03 (hard 502) and #37 (429): the
        // price formatter ends up at the "no price" fallback string
        // (`\`0.00 ${baseTokenSymbol}\``). Distinct CONTROL FLOW
        // from both: 504+HTML hits the JSON-parse-error path,
        // distinct from 502+JSON (.catch on status) and 429+JSON
        // (.catch on Retry-After-aware status).
        async (page) => {
            await expect(
                page.getByText('0.00 SDAI').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
    ],

    timeout: 60_000,
};
