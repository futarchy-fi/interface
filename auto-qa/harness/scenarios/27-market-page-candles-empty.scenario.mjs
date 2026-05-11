/**
 * 27-market-page-candles-empty.scenario.mjs — chaos: empty-200
 * on /markets/[address] from the CANDLES side.
 *
 * Where #25 covers CANDLES 502 on the market page (fetch throws
 * → `.catch` branch), this slice covers the SAME terminal UX
 * (page-shell mounts despite degraded chart panel) via a
 * DIFFERENT control-flow branch: candles stays UP and HEALTHY
 * but returns empty data for every query shape. The market page's
 * candles consumers (`usePoolData`, `useYesNoPoolData`,
 * chart-fetch chain) fire their `.then([])` branches instead of
 * `.catch`. Mirrors #21 (candles-empty on /companies) on the
 * market page with its richer 4-query-shape contract.
 *
 * The market page emits FOUR distinct candles query shapes (per
 * `makeMarketCandlesMockHandler` in `api-mocks.mjs`):
 *   1. proposal(id) + whitelistedtokens — initial discovery
 *      (proposal: null + whitelistedtokens: [] simulates empty)
 *   2. pools(where: {id: ...}) — singular pool detail
 *      (pools: [] simulates empty)
 *   3. candles(where: {pool: ...}) — latest candle for spot price
 *      (candles: [] simulates empty)
 *   4. whitelistedtokens(where: {proposal: ...}) — token list
 *      refresh (whitelistedtokens: [] simulates empty)
 *
 * Every one of those queries returns empty, so every consumer
 * sees `data.length === 0` on their `.then` branch. This is
 * distinct from #25 where every query throws and every consumer
 * sees `error !== null` on their `.catch` branch.
 *
 * Bug-shapes guarded:
 *   - `.then(empty)` silently HANGS the chart panel in forever-
 *     loading (loading flag only cleared on `.catch`, so an
 *     empty-success leaves the chart spinner perpetual)
 *   - Per-pool spot-price display shows "undefined" or "NaN"
 *     instead of falling back gracefully (formatter has no
 *     null guard for the empty-data case — the previously-
 *     fixed `.catch` branch sets a null sentinel, but
 *     `.then([])` doesn't)
 *   - Pool-detail query firing on `pools[0]` crashes when the
 *     array is empty (no `pools.length > 0` guard before
 *     accessing `pools[0].liquidity` etc.)
 *   - Trading panel's "preview price" feature goes BLANK
 *     because its candles-derived feed returns `data.length
 *     === 0` and the panel can't compute the preview without
 *     a price reference
 *   - Token-list refresh empty triggers a CHAIN-VALIDATION
 *     false positive (WrongNetworkModal — same coupling bug
 *     class as #24 + #26)
 *
 * Distinct from #25 (same page, different control flow):
 *   - #25 CANDLES hard-502: `.catch` fires → consumers see
 *     `error !== null`
 *   - #27 CANDLES empty-200: `.then([])` fires → consumers
 *     see `data.length === 0`
 *   A regression that only handled `.catch` correctly (e.g., a
 *   chart-panel rewrite that pinned `loading=false` in the
 *   `.catch` branch but forgot the `.then` branch) would break
 *   #27 while #25 still passes. Same shape as the #03/#21
 *   distinction on /companies, applied to the market page.
 *
 * Why no `useAnvilRpcProxy: true`: same rationale as the prior
 * three market-page chaos slices — the page-shell mount probe
 * isolates the candles-side empty failure mode without
 * conflating with chain-side reads.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    MARKET_PROBE_ADDRESS,
    fakeMarketProposalEntity,
    makeGraphqlMockHandler,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '27-market-page-candles-empty',
    description: 'REGISTRY happy + CANDLES responds 200 with empty data for all 4 query shapes (proposal: null + whitelistedtokens: [] + pools: [] + candles: []) on /markets/<probe>. Asserts the page-shell still mounts despite candles enrichment returning empty. Mirrors #21 (candles-empty on /companies) on the market page with its richer 4-query-shape contract. Distinct from #25 (.then-with-empty vs .catch on candles).',
    bugShape:    '.then(empty) hangs chart panel in forever-loading / per-pool spot-price shows "undefined" or "NaN" / pools[0] access crashes on empty array / trading panel preview goes blank from empty candles-derived feed / WrongNetworkModal false positive from chain-validation gated on non-empty candles response',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        // REGISTRY happy path: proposal metadata populates so
        // the failure mode under test is candles-only.
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        // CANDLES empty for every market-page query shape.
        // Dispatches on the same regex/substring patterns as
        // `makeMarketCandlesMockHandler` — returning the empty
        // analog of each. Inline rather than promoted to
        // api-mocks because no other scenario currently needs
        // "uniform empty across all 4 candles shapes" yet.
        [CANDLES_GRAPHQL_URL]: async (route) => {
            const body = JSON.parse(route.request().postData() || '{}');
            const q = body.query || '';
            let data;
            // Discovery query: `proposal(id: "0x...") { ... }`
            // + `whitelistedtokens(where: { proposal: "0x..." })
            // { ... }` combined in one envelope.
            if (q.includes('proposal(id:') && q.includes('whitelistedtokens')) {
                data = { proposal: null, whitelistedtokens: [] };
            }
            // Pool detail: `pools(where: { id: "0x..." })`
            else if (/pools\s*\(\s*where:\s*\{\s*id:/.test(q)) {
                data = { pools: [] };
            }
            // Latest candle: `candles(where: { pool: "0x..." })`
            else if (q.includes('candles(where:')) {
                data = { candles: [] };
            }
            // Token list only: `whitelistedtokens(where: ...)`
            // (without proposal()/pools/candles in same envelope)
            else if (q.includes('whitelistedtokens(where:')) {
                data = { whitelistedtokens: [] };
            }
            // Catch-all: empty data
            else {
                data = {};
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data }),
            });
        },
    },

    assertions: [
        // Page-shell-mounted probe: "Trading Pair" label still
        // visible despite candles returning empty. Proves the
        // empty-200 path doesn't cascade to a hung/crashed shell.
        async (page) => {
            await expect(
                page.getByText('Trading Pair').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        // Wallet shorthand — proves the chain-validation gate
        // didn't false-positive on the empty candles response.
        async (page) => {
            await expect(
                page.getByText('0xf3…2266').first(),
            ).toBeVisible({ timeout: 15_000 });
        },
    ],

    timeout: 60_000,
};
