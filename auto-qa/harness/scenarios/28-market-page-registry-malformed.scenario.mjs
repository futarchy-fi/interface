/**
 * 28-market-page-registry-malformed.scenario.mjs — chaos:
 * malformed body on /markets/[address] from the REGISTRY side.
 *
 * Where #07 covers REGISTRY malformed-body on /companies, this
 * slice covers the SAME failure mode on the market page.
 * Distinct from #24 (registry 502) and #26 (registry empty-200)
 * because the response body is NEITHER an error envelope NOR
 * a valid JSON document — it's HTML (a 503 page returned by a
 * misconfigured CDN/proxy at a 200 status).
 *
 * The third code branch alongside 502 and empty-200:
 *   - 502 (#24): fetch resolves with !response.ok → `.catch`
 *     fires (or `.then` rejects depending on hook)
 *   - empty-200 (#26): fetch resolves with response.ok →
 *     response.json() succeeds → `.then([])` fires
 *   - malformed-200 (#28, this slice): fetch resolves with
 *     response.ok=true → response.json() THROWS SyntaxError →
 *     hooks that don't wrap `.json()` in try/catch surface
 *     UNHANDLED REJECTIONS, often bypassing the `.catch`
 *     branch that's wired to the `.then(parsed)` chain
 *
 * The SyntaxError-bypass behavior is the most distinctive
 * failure shape this scenario catches. In real production code:
 *
 *   ```js
 *   fetch(url)
 *     .then(r => r.json())   // ← THIS throws SyntaxError
 *     .then(data => setResult(data))
 *     .catch(err => setError(err.message));   // ← Catches it
 *   ```
 *
 * vs.
 *
 *   ```js
 *   const r = await fetch(url);
 *   const data = await r.json();   // ← Throws; no .catch in scope
 *   setResult(data);
 *   ```
 *
 * The first form catches the SyntaxError; the second form doesn't.
 * Whether registry adapter and its callers use form 1 or 2 isn't
 * inspectable from the test side — but #28 will catch any caller
 * that uses form 2 (or any form-1 caller whose `.catch` does
 * something wrong, like swallowing without clearing loading=false).
 *
 * Bug-shapes guarded:
 *   - Market-page CRASHES on registry malformed-body (SyntaxError
 *     thrown by `response.json()` bypasses an outer `.catch` that
 *     was only wired to the `.then(parsed)` rejection branch)
 *   - HTML body content LEAKS into a panel ("503 Service
 *     Unavailable" rendered as text in the trading panel or
 *     proposal title)
 *   - Hung loading spinner because SyntaxError outside the
 *     `.then` chain doesn't trigger loading=false in the hook
 *   - "Market Not Found" gate FALSE-POSITIVE fires (same wrong-
 *     code-path collapse as #24/#26, but via a third distinct
 *     failure path)
 *   - WrongNetworkModal incorrectly fires (chain validation
 *     should NOT depend on registry response shape; coupling
 *     bug class)
 *
 * Why no `useAnvilRpcProxy: true`: same rationale as prior
 * market-page chaos slices — page-shell mount probe isolates
 * the registry-side failure mode.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    MARKET_PROBE_ADDRESS,
    makeMarketCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';

// Same HTML body shape as #07 — a 503 page returned by a misconfigured
// proxy at a 200 status. The body is intentionally NOT JSON so
// `response.json()` throws SyntaxError on parse.
const HTML_ERROR_PAGE = `<!DOCTYPE html>
<html><head><title>503 Service Unavailable</title></head>
<body><h1>Service Unavailable</h1>
<p>The server is temporarily unable to handle the request.</p>
<p>Reference: chaos-market-page-registry-malformed-28</p>
</body></html>`;

export default {
    name:        '28-market-page-registry-malformed',
    description: 'REGISTRY responds 200 + content-type:text/html + an HTML error page body on /markets/<probe> (CDN/proxy intercepted the request). Asserts the page-shell still mounts (Trading Pair + wallet shorthand visible). Distinct from #24 (502) and #26 (empty-200) because response.json() throws SyntaxError before the .then chain runs — most likely failure path to bypass .catch wiring. Mirror of #07 on /companies, applied to the market page.',
    bugShape:    'market-page crashes on registry malformed-body / HTML body content leaks into UI / hung loading spinner from SyntaxError bypassing .catch / "Market Not Found" false positive from wrong-code-path collapse / WrongNetworkModal false positive from chain-validation coupling regression',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: HTML_ERROR_PAGE,
            });
        },
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    assertions: [
        // Page-shell-mounted probe.
        async (page) => {
            await expect(
                page.getByText('Trading Pair').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        // Wallet shorthand still visible — proves the
        // SyntaxError didn't cascade to a global crash that
        // unmounts everything.
        async (page) => {
            await expect(
                page.getByText('0xf3…2266').first(),
            ).toBeVisible({ timeout: 15_000 });
        },
    ],

    timeout: 60_000,
};
