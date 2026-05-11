/**
 * 49-pr52-url-hash-rewrite.scenario.mjs — catches PR #52 (extract
 * proposalId from milestones URL hash to fix swap quoter).
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * URL-state-evolution regressions. Every other scenario tests
 * either:
 *   - DOM text/attributes (slice 4 family, scenarios 01-48)
 *   - GraphQL query shape (scenario 47)
 *   - Page-error monitor (scenarios 10, 48)
 *
 * None catches "the JS code that's supposed to rewrite the URL after
 * mount doesn't run, runs wrong, or fires in the wrong order." That's
 * the KIND PR #52 fixed.
 *
 * ── PR #52 in one paragraph ─────────────────────────────────────────
 * The `/milestones?company_id=…#milestone:0x…` route is the
 * legacy entry point into MarketPageShowcase. Pre-PR-52, the page
 * detected the hash and conditionally showed MarketPageShowcase,
 * but never extracted the proposal address from
 * `#milestone:0x…` into `?proposalId=0x…`. MarketPageShowcase reads
 * `proposalId` only from path or query string, so it got nothing
 * → useContractConfig returned null → swap quoter fell to the
 * Uniswap V3 fallback path → reverted → "Insufficient liquidity"
 * on YES side.
 *
 * Fix (`src/pages/milestones.js:37-61`): on mount + on `hashchange`,
 * regex-extract a `0x[a-fA-F0-9]{40}` from the hash, set
 * `urlParams.proposalId`, call `history.replaceState` to write the
 * rewritten URL without navigation.
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to `/milestones?company_id=gnosis#milestone:0x…`
 *      (real address from MARKETS_CONFIG so MarketPageShowcase
 *      mount doesn't immediately bail; but the URL rewrite is
 *      INDEPENDENT of MarketPageShowcase rendering — it runs in
 *      `/pages/milestones.js`'s mount useEffect).
 *
 *   2. Wait briefly for the useEffect that does the replaceState
 *      (it runs after `router.isReady` flips, post-mount).
 *
 *   3. Assert `page.url()` contains `proposalId=0x…` query param.
 *      Pre-PR-52 this would never appear. Post-PR-52 it appears
 *      within ~1s of mount.
 *
 * The address pattern is preserved in the hash too — the rewrite
 * is `path?...&proposalId=0x...#milestone:0x...` per the source:
 *     `window.location.pathname + '?' + urlParams.toString() +
 *      currentHash`
 *
 * ── Mocks ───────────────────────────────────────────────────────────
 * Same mocks as the market-page scenarios (#10–#13). MarketPageShowcase
 * will mount, query registry + candles via the mocks, render the
 * page shell. None of that matters for THIS scenario — we're only
 * inspecting `page.url()` after the rewrite useEffect ran.
 *
 * ── Verification protocol ───────────────────────────────────────────
 * 1. Current code: assertion passes (URL contains proposalId after
 *    rewrite).
 * 2. Mutate `src/pages/milestones.js` by removing the
 *    `urlParams.set('proposalId', ...)` + replaceState block at
 *    lines 53-60 → assertion FAILS (URL never rewritten).
 * 3. Restore → passes.
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

export default {
    name:        '49-pr52-url-hash-rewrite',
    description: 'Catches PR #52 (extract proposalId from milestones URL hash). Navigate to /milestones?company_id=gnosis#milestone:0x..., wait for the mount useEffect, assert the URL was rewritten to include ?proposalId=0x... New KIND of assertion: URL state evolution after mount, distinct from DOM text and console-error checks.',
    bugShape:    'URL-hash extraction useEffect missing or buggy: proposalId not written to query string, downstream MarketPageShowcase quoter falls back to v1 defaults, "Insufficient liquidity" shown',
    route:       `/milestones?company_id=gnosis#milestone:${MARKET_PROBE_ADDRESS}`,

    mocks: {
        // Same surface as scenarios #10–#13; MarketPageShowcase
        // will try to mount once the URL is rewritten. The mocks
        // let it do so without crashing (mostly — see #10's
        // exclusions for the test-mode-artifact errors).
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    assertions: [
        // The URL-rewrite assertion. Poll the page.url() because
        // the rewrite is async (runs in a useEffect after
        // router.isReady fires). 5s timeout is generous — in
        // practice the rewrite happens within ~200ms of mount.
        async (page) => {
            await expect.poll(
                () => page.url(),
                {
                    message: 'expected URL to be rewritten with ?proposalId=0x... after hash-extraction useEffect',
                    timeout: 15_000,
                },
            ).toContain(`proposalId=${MARKET_PROBE_ADDRESS}`);
        },

        // Sanity: the hash should ALSO still be in the URL. The
        // rewrite per source appends `currentHash` to the new URL,
        // so we don't lose the milestone:0x... fragment. Catches
        // a regression that incorrectly strips the hash during
        // rewrite.
        async (page) => {
            await expect.poll(
                () => page.url(),
                {
                    message: 'expected URL to retain the #milestone:0x... fragment after rewrite',
                    timeout: 5_000,
                },
            ).toContain(`#milestone:${MARKET_PROBE_ADDRESS}`);
        },
    ],

    timeout: 180_000,
};
