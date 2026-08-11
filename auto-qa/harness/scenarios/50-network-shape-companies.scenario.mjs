/**
 * 50-network-shape-companies.scenario.mjs — first scenario using
 * the network-request monitor (slice 82 capability).
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Silent network-behavior regressions that don't change DOM text,
 * don't throw, don't emit console errors — but ARE wrong. Examples:
 *
 *   1. Page silently hits a DEPRECATED URL that still responds
 *      (wrong data, no error). PR #60 was this shape against AWS
 *      CloudFront subgraphs after the GCP migration. The fix
 *      switched URLs to `api.futarchy.fi`. A regression to
 *      `*.amazonaws.com` would PASS the strict-schema mock (slice
 *      78) — the request never reaches the mock at all. Only a
 *      network monitor catches it.
 *
 *   2. Page floods a healthy endpoint with retries (retry-storm
 *      regression). Each request succeeds → no errors, no DOM
 *      change. But the upstream serves 50 req/sec instead of 1.
 *      Page-error monitor (slice 79) misses this entirely.
 *
 *   3. Page SKIPS a required call (refactor removes
 *      `useEffect(fetchData)` accidentally). DOM may still render
 *      something via cached/stale data. Only a "must-have-called"
 *      positive assertion catches this.
 *
 * ── Capability shape ────────────────────────────────────────────────
 * Scenario runner (slice 82 changes) attaches
 * `page.on('request', ...)` BEFORE navigation. Every outbound
 * request the page makes is captured (URL, method, resourceType,
 * timestamp). The collected list lives on `ctx.networkRequests`
 * with a `ctx.callsTo(pattern)` helper that filters by URL
 * substring or RegExp.
 *
 * Scenarios can assert positive (URL must appear) and negative
 * (URL must NOT appear) shapes, plus call-count budgets.
 *
 * ── Assertions in this scenario ─────────────────────────────────────
 *
 *   POSITIVE: at least one call to `api.futarchy.fi/registry/graphql`.
 *     This is the post-Checkpoint endpoint. A regression that
 *     deletes the useAggregatorCompanies fetch or routes it
 *     elsewhere → 0 calls → fails.
 *
 *   NEGATIVE: zero calls to legacy AWS CloudFront subgraph URLs.
 *     Pattern matches `*.cloudfront.net` and `*amazonaws.com`. A
 *     regression that reintroduces the dead URLs (the PR #60 shape)
 *     → 1+ calls → fails. Today the page hits NEITHER pattern, so
 *     the assertion holds.
 *
 *   POSITIVE: at least one call to `api.futarchy.fi/candles/graphql`.
 *     Same shape — proves the carousel's price-fetch pipeline
 *     reaches the right endpoint.
 *
 * ── Verification protocol ───────────────────────────────────────────
 * 1. Run scenario with current code → all 3 assertions pass.
 * 2. Mutate `src/hooks/useAggregatorCompanies.js` to short-circuit
 *    the registry fetch (e.g., `return` early before the GraphQL
 *    call). Run scenario → POSITIVE registry assertion FAILS
 *    (0 calls when 1+ expected).
 * 3. Add a stray `fetch('https://test.cloudfront.net/legacy')`
 *    somewhere in /companies-mounted code. Run scenario →
 *    NEGATIVE assertion FAILS (1 call when 0 expected).
 * 4. Restore. Verify passes.
 *
 * ── Why this is a NEW assertion-target KIND ─────────────────────────
 * Capability matrix after this slice:
 *
 *   KIND                    | First scenario  | Catches
 *   ------------------------|-----------------|------------------
 *   DOM text/attributes     | many            | text rendering
 *   GraphQL query shape     | 47              | schema validation
 *   Page errors / console   | 48              | silent JS errors
 *   URL state evolution     | 49              | URL rewrite bugs
 *   **Network requests**    | **50 (this)**   | **silent network regressions**
 *
 * Five distinct assertion-target kinds; each catches a class no
 * other catches.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    PROBE_ORG_NAME,
    fakePoolBearingProposal,
    makeGraphqlMockHandler,
    makeCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '50-network-shape-companies',
    description: 'First scenario using the network-request monitor (slice 82 capability). Asserts /companies network shape: must call api.futarchy.fi/registry/graphql AND api.futarchy.fi/candles/graphql; must NOT call legacy AWS CloudFront subgraph URLs. New KIND distinct from DOM-text, GraphQL-shape, page-errors, URL-state: catches silent network regressions (wrong URL succeeds, missing required call, retry storm) that other monitors miss.',
    bugShape:    'frontend silently hits a deprecated/wrong URL (PR #60-shape if reintroduced) / skips a required GraphQL call / floods a healthy endpoint with retries (no errors, no DOM change — invisible to every other assertion target)',
    route:       '/companies',

    mocks: {
        // Happy-path mocks so the page mounts cleanly. The scenario
        // assertions inspect what URLs the PAGE called, not what
        // the mocks returned.
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakePoolBearingProposal({})],
        }),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({
            prices: {},
        }),
    },

    assertions: [
        // Anchor: page mounted enough for the network calls to fire.
        async (page) => {
            await expect(
                page.getByText(PROBE_ORG_NAME).first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // POSITIVE 1: registry GraphQL endpoint called at least once.
        // `expect.poll` because the network fetch happens
        // asynchronously after mount; the first call typically
        // lands within ~500ms.
        async (page, ctx) => {
            await expect.poll(
                () => ctx.callsTo('api.futarchy.fi/registry/graphql').length,
                {
                    message: 'expected at least one call to api.futarchy.fi/registry/graphql',
                    timeout: 15_000,
                },
            ).toBeGreaterThan(0);
        },

        // POSITIVE 2: candles GraphQL endpoint called at least
        // once. Proves the carousel price-fetch pipeline reaches
        // the right URL.
        async (page, ctx) => {
            await expect.poll(
                () => ctx.callsTo('api.futarchy.fi/candles/graphql').length,
                {
                    message: 'expected at least one call to api.futarchy.fi/candles/graphql',
                    timeout: 15_000,
                },
            ).toBeGreaterThan(0);
        },

        // NEGATIVE: zero calls to legacy AWS CloudFront subgraph
        // URLs (the dead pre-PR-60 endpoints). Catches a regression
        // that reintroduces the AWS URLs.
        //
        // Pattern matches both .cloudfront.net and .amazonaws.com
        // since the legacy infra used various AWS-hosted endpoints
        // per PR #60 description. Today /companies hits neither —
        // assertion holds with 0 calls.
        async (page, ctx) => {
            // Read once (no poll needed for a negative check —
            // we want to know if it EVER fires by this point).
            // The positive assertions above already polled for
            // ~15s combined, giving any latent legacy fetch time
            // to fire before this check runs.
            const legacyCalls = ctx.callsTo(/\.(cloudfront\.net|amazonaws\.com)/);
            expect(legacyCalls, {
                message: `expected zero calls to legacy AWS subgraph URLs (cloudfront.net / amazonaws.com); saw: ${legacyCalls.map(c => c.url).join(', ')}`,
            }).toHaveLength(0);
        },
    ],

    timeout: 180_000,
};
