/**
 * 07-registry-malformed-body.scenario.mjs — Phase 7 slice 2: malformed-body chaos.
 *
 * Where #02/#05 take the registry endpoint OUT (5xx) or RETURN
 * empty (200+empty-data), this scenario returns a NON-JSON BODY
 * with a 200 status. Real-world parallel: a CDN/proxy intercepts
 * the request and returns an HTML error page ("503 Service
 * Unavailable", a Cloudflare challenge page, an "Origin DNS error"
 * page) — the upstream might be healthy but the proxy substituted
 * its own response. Status code is 200 (proxy's own status) but
 * the content-type is `text/html` and the body is HTML, not the
 * GraphQL JSON the client expects.
 *
 * This is a distinct code path from BOTH the 5xx scenario (#02)
 * and the empty-200 scenario (#05):
 *   * 5xx → fetch() resolves but `response.ok === false` →
 *     hook fires .catch with HTTP-status-based error
 *   * empty-200 → fetch() resolves, response.ok === true,
 *     response.json() resolves to { data: { organizations: [] } }
 *     → .then(empty) branch
 *   * THIS scenario → fetch() resolves, response.ok === true,
 *     response.json() THROWS SyntaxError (body is HTML, not JSON)
 *     → unhandled rejection unless explicitly caught
 *
 * The third branch is the one most likely to crash the page.
 * Many GraphQL clients .json() the body unconditionally because
 * a 200 status is interpreted as "success", and the resulting
 * SyntaxError can propagate up to the React tree as an unhandled
 * promise rejection — bypassing the hook's .catch entirely.
 *
 * Bug-shapes guarded:
 *   - JSON.parse SyntaxError surfaces as "Application error" or
 *     a React error boundary's red banner — distinct from the
 *     graceful "No organizations found" empty state
 *   - hung spinner because the SyntaxError doesn't trigger
 *     loading=false (the hook's .catch only catches errors
 *     that propagate via the .then chain; a SyntaxError thrown
 *     outside the chain bypasses it)
 *   - HTML body content leaks into the UI ("503 Service
 *     Unavailable" rendered as text in the org list)
 *   - silent broken state — status 200 made the hook think it
 *     succeeded, so it set companies=[] without calling
 *     setError, but the .then receiver expected an object and
 *     crashed downstream
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
} from '../fixtures/api-mocks.mjs';

const HTML_ERROR_PAGE = `<!DOCTYPE html>
<html><head><title>503 Service Unavailable</title></head>
<body><h1>Service Unavailable</h1>
<p>The server is temporarily unable to handle the request.</p>
<p>Reference: chaos-malformed-body-07</p>
</body></html>`;

export default {
    name:        '07-registry-malformed-body',
    description: 'Registry GraphQL responds 200 + content-type:text/html + an HTML error page body (CDN/proxy intercepted the request). Asserts /companies degrades to "No organizations found" — distinct from the 5xx (#02) and empty-200 (#05) paths because response.json() throws SyntaxError before the .then chain runs.',
    bugShape:    'json-parse-syntaxerror crashes / hangs / leaks HTML to UI when proxy returns 200 with HTML body (the third code branch alongside 5xx and empty-200; most likely to crash because SyntaxError can bypass .catch)',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: async (route) => {
            // Proxy/CDN returned an HTML error page with a 200
            // status. content-type is text/html; body is HTML.
            // The fetch() resolves successfully; the .json() call
            // throws SyntaxError. Hooks that don't wrap .json()
            // in a try/catch surface unhandled rejections.
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
                page.getByText('No organizations found').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
    ],

    timeout: 180_000,
};
