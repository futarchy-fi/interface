/**
 * 42-market-page-registry-504-gateway-timeout.scenario.mjs — chaos:
 * HTTP 504 Gateway Timeout from the REGISTRY side on
 * /markets/[address], with an HTML body (NOT JSON) — the realistic
 * shape that load balancers (AWS ALB, nginx, Cloudflare, GCP HTTPS
 * LB) emit by default when the upstream origin fails to respond
 * within the LB's idle timeout.
 *
 * Where #40 covers registry-504 on /companies (carousel never
 * mounts → empty state), this slice covers the symmetric failure
 * on the MARKET PAGE. Distinct from #24 (registry hard-502),
 * #38 (registry rate-limited 429), and #40 (same failure mode,
 * different page) because:
 *   - #24 covers 5xx control flow on the market page where the
 *     5xx body is JSON (.catch on structured envelope)
 *   - #38 covers 429 control flow on the same page (Retry-After
 *     contract; status-error + valid-error-envelope)
 *   - #40 covers 504+HTML on /companies (where registry is the
 *     foundation — empty registry means empty carousel)
 *   - #42 (this slice) covers 504+HTML on the MARKET PAGE
 *     (where registry is ENRICHMENT — the page-shell mounts
 *     from static MARKETS_CONFIG regardless of registry state),
 *     so the same control flow surfaces a DIFFERENT degradation
 *     contract than #40
 *
 * The 504 status with an HTML body is "successful" from a Promise
 * standpoint, so `.then` fires — but the consumer's `.json()`
 * throws SyntaxError on the HTML body BEFORE any status check or
 * error-envelope handler runs. This is a fundamentally different
 * bug surface than #24's `.catch`-on-status-error path or #38's
 * `.then`-with-valid-error-envelope path.
 *
 * Bug-shapes guarded:
 *   - Page CRASHES because `response.json()` throws SyntaxError
 *     on the HTML body — `.then(j => j.errors)` hits the
 *     SyntaxError-catch path that may not be wired up
 *     (uncaught promise rejection → React error boundary →
 *     "Application error" screen replaces the page-shell)
 *   - Page-shell HANGS in loading forever (504 doesn't trigger
 *     loading=false because the parse error throws before the
 *     loading-cleanup code runs)
 *   - Page renders the HTML body raw in a panel header or modal
 *     (consumer falls back to `.text()` and renders the LB error
 *     page literally — leaks infra error to UX surface)
 *   - Page IMMEDIATELY retries in a tight loop (no exponential
 *     backoff, no jitter — hammers the registry while it's
 *     already overloaded; thundering-herd shape WORSE than #38
 *     because there's no Retry-After to respect, AND worse than
 *     /companies because the market page polls registry on every
 *     state change for proposal-metadata refresh)
 *   - "Market Not Found" gate FALSE-POSITIVE fires (the 504-
 *     error code path collapses with the missing-from-MARKETS_
 *     CONFIG gate — same wrong-code-path collapse class as
 *     #24/#26/#28/#34/#38)
 *   - WrongNetworkModal incorrectly fires (chain validation
 *     should NOT depend on registry availability; a regression
 *     that gates the chain check on registry success would
 *     render the modal whenever the registry blips a 504)
 *
 * Distinct from #24 (502+JSON) on the same page:
 *   - 502+JSON fires `.catch` in the proposal-metadata-fetch
 *     chain (status check + structured envelope handling)
 *   - 504+HTML fires `.then` (status-code-only check passes)
 *     then THROWS during `.json()` parse — completely
 *     different control flow path
 *
 * Distinct from #38 (429+Retry-After+JSON) on the same page:
 *   - 429+JSON has explicit Retry-After contract; consumers
 *     should respect it
 *   - 504+HTML has no Retry-After AND throws on parse —
 *     consumer can't even read a structured error message
 *     to log what happened
 *
 * Why no `useAnvilRpcProxy: true`: same rationale as #24/#38 —
 * this scenario doesn't assert on chain-derived state.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    MARKET_PROBE_ADDRESS,
    makeMarketCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';

const HTML_504_BODY = `<!DOCTYPE html>
<html>
<head><title>504 Gateway Timeout</title></head>
<body>
<center><h1>504 Gateway Timeout</h1></center>
<hr><center>nginx (chaos: market-page-registry-504-gateway-timeout)</center>
</body>
</html>
`;

export default {
    name:        '42-market-page-registry-504-gateway-timeout',
    description: 'REGISTRY responds 504 + Content-Type: text/html + HTML body (no JSON, no Retry-After) + CANDLES happy on /markets/<probe>. Asserts the page-shell still mounts (Trading Pair + wallet shorthand visible) — proves the static MARKETS_CONFIG entry is sufficient even when registry returns a gateway-timeout with non-JSON body. Distinct from #24 (502+JSON → .catch), #38 (429+Retry-After+JSON), and #40 (same failure mode, different page contract).',
    bugShape:    'page crashes on JSON.parse(html) throwing SyntaxError / page-shell hangs forever (parse error before loading-cleanup) / page renders raw HTML body in panel header or modal / page hammers registry with retries (no backoff, no Retry-After — worse than #38; worse on market page than /companies because of state-change polling) / "Market Not Found" false-positive from 504 wrong-code-path collapse / WrongNetworkModal false positive (chain check incorrectly gated on registry success)',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        // REGISTRY 504+HTML — same handler shape as #40 but
        // applied here against the market page's distinct
        // proposal-metadata-fetch path. Models a real LB default
        // (nginx, AWS ALB, Cloudflare).
        [REGISTRY_GRAPHQL_URL]: async (route) => {
            await route.fulfill({
                status: 504,
                contentType: 'text/html',
                body: HTML_504_BODY,
            });
        },
        // CANDLES happy path — isolates the registry-side
        // failure mode. Candles-side 504 chaos on the market
        // page is the next slice (#43).
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
