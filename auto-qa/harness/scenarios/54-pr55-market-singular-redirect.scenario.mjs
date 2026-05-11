/**
 * 54-pr55-market-singular-redirect.scenario.mjs — catches PR #55
 * (404 redirect: `/market/<addr>` → `/market?proposalId=<addr>`).
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * URL-state-evolution regression — sibling to scenario 49 (PR #52
 * milestones-hash rewrite). Different mechanism, same KIND: a
 * useEffect rewrites the URL after mount. If the redirect breaks,
 * the page never reaches the proposalId-bound MarketPageShowcase,
 * users land on the 404 page indefinitely.
 *
 * ── PR #55 in one paragraph ─────────────────────────────────────────
 * `futarchy.fi/market/0x...` (singular) used to 404 because:
 *   - `pages/market.js` only matches the bare path `/market`
 *   - `pages/markets/[address].js` (plural) only generates static
 *     paths for addresses listed in `src/config/markets.js`
 *   - Static export (`output: 'export'`) means `next.config.mjs`
 *     redirects don't apply
 *
 * Fix (`src/pages/404.js`): on the 404 page mount, regex-extract
 * `0x[a-fA-F0-9]{40}` from `/market/<addr>` (or `/markets/<unconfigured-
 * addr>`), `window.location.replace('/market?proposalId=<addr>')`.
 * Net effect: external links / shared URLs of the form
 * `/market/0x...` redirect through 404 to the canonical
 * `?proposalId=` form within ~200ms.
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to `/market/${probeAddress}` — a real address from
 *      MARKETS_CONFIG that the 404 page still redirects (the
 *      redirect target is independent of MARKETS_CONFIG; it always
 *      writes to the bare `/market?proposalId=...` route).
 *
 *   2. Wait for the 404 page's useEffect to run
 *      `window.location.replace(...)`. This causes a fresh
 *      navigation, so `page.url()` will transition through:
 *        - `/market/<addr>`               (initial nav, 404 page)
 *        - `/market?proposalId=<addr>`    (after redirect)
 *
 *   3. `expect.poll(page.url())` until it contains
 *      `?proposalId=<addr>`. Pre-PR-55 (or after deleting
 *      `src/pages/404.js`) this would never appear — page stays at
 *      the bare `/market/<addr>` URL on the 404 view forever.
 *
 * ── Mocks ───────────────────────────────────────────────────────────
 * After the redirect, the page lands on `/market?proposalId=<addr>`
 * which mounts MarketPageShowcase and queries registry + candles.
 * Same mocks as scenario 10 / 49 — let those queries succeed so
 * the redirect's effect is observable past the navigation.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *
 *   1. Current code: assertion passes (URL contains
 *      `?proposalId=<addr>` within 15s of mount).
 *
 *   2. Mutate `src/pages/404.js` by commenting out the
 *      `window.location.replace(...)` call (or deleting the
 *      `useEffect` body entirely) → assertion FAILS (page stays
 *      at `/market/<addr>` showing the 404 view).
 *
 *   3. Restore → passes.
 *
 * Distinct from scenario 49: PR #52 was an in-page query-string
 * rewrite via `history.replaceState` (no navigation). PR #55 is a
 * full navigation via `window.location.replace`. The polling
 * approach handles both — what we assert is identical: "the URL
 * eventually contains the canonical form."
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
    name:        '54-pr55-market-singular-redirect',
    description: 'Catches PR #55 (404-page redirect for /market/<addr>). Navigate to /market/0x...; wait for the 404 useEffect to fire window.location.replace; assert page.url() contains ?proposalId=<addr>. Reverting the redirect leaves the page stuck on /market/<addr> 404 view.',
    bugShape:    '404 redirect for /market/<addr> → /market?proposalId=<addr> missing or broken: external links land on the 404 view permanently, MarketPageShowcase never mounts',
    route:       `/market/${MARKET_PROBE_ADDRESS}`,

    // Prod-mode only: `next dev` serves its own built-in 404 page
    // for unmatched paths, which doesn't include `src/pages/404.js`.
    // The redirect useEffect only runs against the static export
    // produced by `npm run build` (output: 'export' mode). Slice 85
    // built the prod-mode infrastructure for exactly this case.
    // `ui:prod` sets HARNESS_PROD_MODE=1; scenarios.spec.mjs skips
    // this scenario when that flag is absent.
    prodModeOnly: true,

    mocks: {
        // After the redirect lands on /market?proposalId=<addr>,
        // useContractConfig fires its usual registry + candles
        // queries. Same surface as scenario 10 / 49.
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    assertions: [
        // URL-state assertion. Poll because the redirect is async
        // (404 page mounts, useEffect fires window.location.replace,
        // browser navigates to /market?proposalId=...). 15s timeout
        // is generous; in practice the redirect happens in ~200ms.
        // Case-insensitive substring check on the lowercase form —
        // Next.js may normalize URL casing.
        async (page) => {
            await expect.poll(
                () => page.url().toLowerCase(),
                {
                    message: 'expected /market/<addr> to redirect to /market?proposalId=<addr> via 404 page useEffect',
                    timeout: 15_000,
                },
            ).toContain(`proposalid=${MARKET_PROBE_ADDRESS.toLowerCase()}`);
        },

        // Sanity: the URL should NO LONGER contain the bare
        // /market/<addr> path. Catches a regression where the
        // proposalId query is appended without replacing the bare
        // path (would produce a malformed URL the page can't read).
        async (page) => {
            const url = page.url().toLowerCase();
            expect(url).not.toMatch(/\/market\/0x[0-9a-f]{40}/);
        },
    ],

    timeout: 180_000,
};
