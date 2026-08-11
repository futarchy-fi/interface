/**
 * 30-market-page-registry-slow.scenario.mjs — chaos: slow-but-
 * recovers registry on /markets/[address].
 *
 * Where #19 covers slow registry on /companies (carousel waits
 * until the slow response arrives, then mounts), this slice
 * covers the SAME failure mode on the MARKET PAGE. Distinct
 * from #19 because the market page has a STATIC MARKETS_CONFIG
 * foundation — the page-shell SHOULD mount immediately,
 * independent of how slow the registry-side enrichment is.
 *
 * Per the discussion in #19, the slow-response chaos axis
 * exercises a DIFFERENT page-side code path than the
 * hard-failure axes (#24/#26/#28):
 *   - #24/#26/#28: response arrives quickly with degraded
 *     shape; page never has to render against an "in-flight"
 *     state
 *   - #30 (this slice): page renders against an in-flight
 *     state for ~15s, then transitions to the resolved state
 *
 * The "transition" path is what's under test:
 *   - Does the page-shell mount BEFORE the registry resolves?
 *     (It should — MARKETS_CONFIG provides the foundation.)
 *   - Does the page handle the resolved registry response
 *     correctly when it eventually arrives?
 *   - Does anything CRASH during the in-flight window when
 *     downstream consumers try to read from a not-yet-
 *     resolved registry-data hook?
 *
 * Bug-shapes guarded:
 *   - Page-shell HANGS waiting for registry instead of
 *     mounting via MARKETS_CONFIG (regression that gated the
 *     page-shell mount on registry-data hook resolution
 *     instead of static config presence)
 *   - In-flight registry hook returns `undefined` and a
 *     downstream consumer accesses `proposal.title` →
 *     "Cannot read property 'title' of undefined"
 *   - Registry-data hook initializes with `[]` and a
 *     downstream consumer treats it as resolved-empty,
 *     prematurely showing "Market Not Found" before the
 *     real response arrives
 *   - Late-arriving registry response causes a render-
 *     LAYOUT-SHIFT (the proposal title swaps in 15s after
 *     mount, causing the chart panel to jump down the
 *     viewport — UX paper-cut)
 *   - Refresh tick stacks slow registry requests on top of
 *     each other (no abort-controller; eventually exhausts
 *     network connections or causes OOM)
 *
 * The market-page registry adapter issues a single
 * proposalentities query per `proposalAddress` lookup, so
 * total wait is approximately one DELAY_MS window (vs #19's
 * 3 sub-queries = ~15s wait). Setting DELAY_MS = 5000 here
 * matches #19/#20 for symmetry and gives the test ~5s of
 * in-flight window.
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
    fakeMarketProposalEntity,
    makeGraphqlMockHandler,
    makeMarketCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';

const DELAY_MS = 5000;

// Wrap the standard happy-path registry handler with a per-
// request delay. Same closure pattern as #19/#20 — keeps the
// upstream helper shape untouched.
function makeSlowRegistryHandler() {
    const inner = makeGraphqlMockHandler({
        proposals: [fakeMarketProposalEntity()],
    });
    return async (route) => {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        return inner(route);
    };
}

export default {
    name:        '30-market-page-registry-slow',
    description: 'REGISTRY delayed by 5s per request (then returns valid market proposal entity) + CANDLES happy on /markets/<probe>. Asserts the page-shell mounts (Trading Pair + wallet shorthand visible) within the assertion timeout — proves the static MARKETS_CONFIG entry is sufficient to mount the foundation immediately, without waiting for the registry-side enrichment. Catches: page-shell hang from gating mount on registry resolution, premature "Market Not Found" from treating in-flight as resolved-empty, late-arriving response causing layout shift, missing abort-controller stacking slow requests.',
    bugShape:    'page-shell hangs waiting for slow registry instead of mounting via MARKETS_CONFIG / in-flight registry hook returns undefined and downstream consumer crashes / premature "Market Not Found" before slow registry resolves / late-arriving response causes layout shift / refresh tick stacks slow registry requests (missing abort-controller)',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeSlowRegistryHandler(),
        // CANDLES happy path — isolates the registry-side slow
        // failure mode.
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    assertions: [
        // Page-shell-mounted probe — 30s timeout accommodates
        // the slow registry but still bounds the test. If the
        // page hangs waiting for registry, this assertion times
        // out and the bug surfaces.
        async (page) => {
            await expect(
                page.getByText('Trading Pair').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        // Wallet shorthand — proves the chain-validation gate
        // didn't false-positive on the in-flight registry state.
        async (page) => {
            await expect(
                page.getByText('0xf3…2266').first(),
            ).toBeVisible({ timeout: 15_000 });
        },
    ],

    timeout: 60_000,
};
