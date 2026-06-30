/**
 * 40-registry-504-gateway-timeout.scenario.mjs — chaos: HTTP 504
 * Gateway Timeout from the REGISTRY side on /companies, with an
 * HTML body (NOT JSON) — the realistic shape that load balancers
 * (AWS ALB, nginx, Cloudflare, GCP HTTPS LB) emit by default when
 * the upstream origin fails to respond within the LB's idle
 * timeout.
 *
 * Opens a NEW failure-mode row in the chaos matrix:
 * "gateway timeout 504". This is the FIRST cell of a new row,
 * after the prior matrix expansion to 7 rows × 2 endpoints × 2
 * pages = 28 cells reached parity at slice 43. Distinct from
 * every prior chaos row because:
 *
 *   - vs #02 (hard 502 + JSON error body):
 *     * 502 means "upstream sent a bad response" (origin is
 *       broken right now); 504 means "upstream took too long"
 *       (origin may be healthy but slow, network slow, or
 *       genuinely dead). Different operational signal entirely.
 *     * 502 here returns a JSON `{errors: [...]}` body — the
 *       consumer's `.json()` parses cleanly and the error path
 *       sees a structured envelope. 504 from a real LB returns
 *       an HTML page (`<html>...504 Gateway Timeout...</html>`)
 *       — the consumer's `response.json()` THROWS a SyntaxError
 *       because the body isn't JSON. Hits a different bug-class
 *       than #02.
 *
 *   - vs #07 (malformed body — registry returns HTTP 200 with
 *     non-JSON body):
 *     * #07 has status 200 (consumer's `response.ok` is true),
 *       so the failure surfaces ONLY on JSON-parse. #40 has
 *       status 504 (response.ok is false) AND a non-JSON body
 *       — so EITHER the status check OR the parse path can fire
 *       depending on the consumer's order of checks. Bugs that
 *       check `.ok` first would degrade differently than bugs
 *       that try `.json()` first.
 *
 *   - vs #19 (slow valid response — registry eventually returns
 *     valid data after a delay):
 *     * #19 ultimately returns 200 + valid data; the page must
 *       wait it out. #40 returns 504 — the upstream is signaling
 *       that the wait already happened and exceeded LB timeout.
 *       Consumers with retry logic should treat 504 as
 *       transient (retry) but NOT spin while waiting.
 *
 *   - vs #36 (rate-limited 429 + Retry-After: 1):
 *     * 429 is a CLIENT-fault status (rate limiter telling you
 *       to slow down); 504 is an INFRASTRUCTURE-fault status
 *       (the LB couldn't reach the origin in time). Different
 *       client-side handling: 429 → respect Retry-After + back
 *       off; 504 → retry once or twice with jitter. A consumer
 *       that conflates them (e.g., treats every 4xx/5xx the
 *       same) would fail to back off on 429 OR fail to retry
 *       on 504 — both bugs surface as performance/reliability
 *       regressions only visible under chaos.
 *
 * Real-world parallel: production registry endpoint is fronted
 * by a load balancer with a 60s idle timeout. Origin Postgres
 * is behind a slow query (e.g., a missing index causes a
 * full-table scan on a write-heavy table). The first request
 * after a deploy takes >60s; LB sends 504 to the user. The
 * page must NOT crash, must NOT show stale-success state, and
 * must surface the failure cleanly so the user can refresh.
 *
 * Bug-shapes guarded:
 *   - Page CRASHES on 504 because `response.json()` throws on
 *     the HTML body — `.then(j => j.errors)` hits the
 *     SyntaxError-catch path that may not be wired up
 *     (uncaught promise rejection → React error boundary →
 *     "Application error" screen)
 *   - Page renders the HTML body raw in the org list (consumer
 *     reads `response.text()` as a fallback and renders
 *     `"<html>504 Gateway Timeout</html>"` literally — leaks
 *     LB error page to UX surface)
 *   - Page treats 504 as IF the request succeeded with empty
 *     data (skips status check, sees `data: undefined`, falls
 *     into the empty-state path silently — no telemetry, no
 *     retry, no user-visible signal that anything went wrong)
 *   - Page IMMEDIATELY retries in a tight loop (no exponential
 *     backoff, no jitter — hammers the origin while it's
 *     already overloaded; thundering-herd shape)
 *   - Page hangs in loading state forever — the .then handler
 *     fires (fetch resolves successfully even on 5xx), but the
 *     downstream consumer doesn't transition `loading=false`
 *     because the JSON-parse error throws before the
 *     loading-cleanup code runs
 *   - "Application error" rendered globally (page-shell collapse
 *     from missing error boundary at the top of the page) —
 *     same shape as #25 but via 504 + HTML body rather than
 *     502 + JSON body
 *
 * Strategy: respond 504 + `Content-Type: text/html` + an HTML
 * `504 Gateway Timeout` page (modeling a generic LB default).
 * No `Retry-After` header (504 typically lacks one; clients
 * are expected to back off via their own logic, distinct from
 * the explicit-Retry-After contract of 429/503).
 *
 * Asserts /companies still degrades gracefully to the "No
 * organizations found" empty state — same terminal UX as #02
 * (502) but via a fundamentally different control-flow path
 * (status-error + parse-error vs status-error + valid-error-
 * envelope).
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
} from '../fixtures/api-mocks.mjs';

const HTML_504_BODY = `<!DOCTYPE html>
<html>
<head><title>504 Gateway Timeout</title></head>
<body>
<center><h1>504 Gateway Timeout</h1></center>
<hr><center>nginx (chaos: registry-504-gateway-timeout)</center>
</body>
</html>
`;

export default {
    name:        '40-registry-504-gateway-timeout',
    description: 'REGISTRY GraphQL responds 504 + Content-Type: text/html + HTML body (no JSON). Asserts /companies degrades to "No organizations found" — same terminal UX as #02 (502) but DIFFERENT control flow (status-error + JSON-parse-error vs status-error + valid-error-envelope). Opens a NEW failure-mode row "gateway timeout 504" — first cell of the new row.',
    bugShape:    'page crashes on 504 from JSON.parse(html) throwing SyntaxError / page renders raw HTML body in org list / page treats 504 as success with empty data (silent broken state) / page immediately retries in tight loop without backoff / page hangs in loading forever (parse error throws before loading-cleanup) / "Application error" from missing top-level error boundary (collateral collapse to whole page)',
    route:       '/companies',

    mocks: {
        // REGISTRY 504 with HTML body — models a real LB default
        // when the upstream origin times out. Both
        // useAggregatorCompanies AND fetchProposalsFromAggregator
        // hit this URL. With 504 + HTML on every request, EITHER
        // the status check OR the .json() parse path can fire
        // depending on consumer code order. The page must degrade
        // to the same empty-state branch as #02.
        [REGISTRY_GRAPHQL_URL]: async (route) => {
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
                page.getByText('No organizations found').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
    ],

    timeout: 60_000,
};
