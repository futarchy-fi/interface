/**
 * 46-subgraph-pool-data-path.scenario.mjs — opens the subgraph-
 * sourced poolData code path on the market page.
 *
 * ── Original intent vs honest framing ───────────────────────────────
 * This started as an attempt to catch PR #51 (Algebra V3 Liquidity-
 * widget magnitude bug). Investigation surfaced two findings that
 * reframed the slice:
 *
 *   1. The shared `makeMarketCandlesMockHandler` doesn't return
 *      `pools` in its compound discovery-query response (only
 *      `proposal + whitelistedtokens`). That means
 *      `usePoolData.fetchBestPoolsForProposal` returns null →
 *      `formatSubgraphPoolData` (the PR #51 fix site) is NEVER
 *      called → the Liquidity widget renders via the legacy
 *      "(Total; ${currencySymbol})" path. Without fixing this, no
 *      scenario can catch PR #51.
 *
 *   2. Even with the compound handler fixed, PR #51's post-fix
 *      output (`adjustedLiquidity.toString()` = "2000" for the
 *      default mock data) flows through `normalizeTokenAmount`
 *      in `computeBreakdown` (MarketPageShowcase.jsx:2386), which
 *      sees the integer string lacking '.' or 'e' and DIVIDES BY
 *      1e18 — producing 2e-15 (~0). The Liquidity widget renders
 *      "0". The pre-fix output (`adjustedLiquidity.toLocaleString
 *      ('fullwide')` = "200000..." for some L/sqrtPrice products)
 *      may or may not contain a '.', determining whether
 *      `normalizeTokenAmount` skips or applies the /1e18.
 *
 * Mechanically catching PR #51 requires either:
 *   (a) Mock data tuned so post-fix produces a non-integer string
 *       (e.g., L × tick chosen so the multiplication has fractional
 *       residue), AND pre-fix produces the bug-shape large number
 *       with retained decimal — both at the same time.
 *   (b) Bypassing the normalizeTokenAmount layer entirely by
 *       asserting on the precomputed `liquiditySummary.yes.total`
 *       value via in-browser eval, not the rendered DOM.
 *
 * Neither (a) nor (b) is done in this slice. Instead, this slice
 * lands the COMPOUND-QUERY HANDLER EXTENSION as reusable
 * infrastructure and asserts the subgraph code path mounts —
 * proving that PR #51's fix-site function actually runs when the
 * page is exercised. Future slice will tune the mock data and
 * normalization-layer interaction to mechanically catch PR #51's
 * specific bug shape.
 *
 * ── What this scenario does catch ───────────────────────────────────
 * Regressions where:
 *   - the subgraph-sourced poolData path becomes unreachable
 *     (e.g., `PROPOSALS_USING_SUBGRAPH_DATA` whitelist regresses)
 *   - `fetchBestPoolsForProposal` rejects valid compound-query
 *     responses (e.g., schema rename of `proposal.id` /
 *     `pools.outcomeSide`)
 *   - the Liquidity widget label conditional flips
 *     (`poolData?.source === 'subgraph'` branch broken)
 *
 * The Liquidity widget label changes from "Liquidity (Total;
 * ${currencySymbol})" to plain "Liquidity" iff the subgraph path
 * succeeded. Asserting the exact label "Liquidity" (no parenthetical
 * suffix) is the marker.
 *
 * ── Infrastructure shipped: the compound-query handler ──────────────
 * Inline `makeMarketCandlesMockHandlerForPR51` is the same shape as
 * the shared handler EXCEPT the compound discovery query (`proposal
 * + whitelistedtokens + pools`) ALSO returns the `pools` array.
 * Once `formatSubgraphPoolData` exercises cleanly under this
 * handler, a future slice can refactor this handler into
 * `makeMarketCandlesMockHandler` with an opt-in flag, unblocking
 * the actual PR #51 catch.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    MARKET_PROBE_ADDRESS,
    MARKET_PROBE_CURRENCY_TKN,
    MARKET_PROBE_COMPANY_TKN,
    MARKET_PROBE_YES_POOL,
    MARKET_PROBE_NO_POOL,
    fakeMarketProposalEntity,
    makeGraphqlMockHandler,
} from '../fixtures/api-mocks.mjs';

// Custom market-page candles handler. Differs from the shared
// `makeMarketCandlesMockHandler` in ONE place: the compound discovery
// query (`proposal(id:) + whitelistedtokens + pools(where:proposal:)`)
// also returns `pools` in addition to `proposal + whitelistedtokens`.
//
// Why this matters for PR #51: `usePoolData.fetchBestPoolsForProposal`
// issues a single compound query and reads BOTH `data.proposal` AND
// `data.pools`. The shared handler only fills `proposal +
// whitelistedtokens` — so `data.pools` is undefined → the hook returns
// null → falls through to the legacy `(Total; ${currencySymbol})`
// branch → `formatSubgraphPoolData` (the PR #51 fix site) is NEVER
// called. Without this fix to the handler, the Liquidity widget
// renders via a different code path and the PR #51 regression is
// unreachable.
//
// All other query shapes (per-pool detail, candles, swaps, token-list
// refresh, id_in batch) are kept identical to the shared handler so
// existing scenarios that lean on them stay green.
function makeMarketCandlesMockHandlerForPR51({
    pool: poolOverrides = {},
} = {}) {
    const proposalAddress = MARKET_PROBE_ADDRESS;
    const currencyToken   = MARKET_PROBE_CURRENCY_TKN;
    const companyToken    = MARKET_PROBE_COMPANY_TKN;
    const yesPool         = MARKET_PROBE_YES_POOL;
    const noPool          = MARKET_PROBE_NO_POOL;
    // Default Algebra V3 pool shape that exercises the PR #51 math.
    // liquidity=1e21 wei, tick=0 → sqrtPrice=1.0 →
    //   post-fix: TVL = (1e21 × 1.0 × 2)/1e18 = 2000
    //   pre-fix:  TVL = 1e21 × 1.0          = 1e21 (raw magnitude)
    const defaultPool = {
        liquidity:    '1000000000000000000000', // 1e21
        volumeToken0: '1000000000000000000',
        volumeToken1: '1000000000000000000',
        tick:         '0',
    };
    const pool = { ...defaultPool, ...poolOverrides };
    const proposalLower = proposalAddress.toLowerCase();
    const tokens = [
        { address: currencyToken, symbol: 'sDAI', decimals: 18, role: 'YES_CURRENCY' },
        { address: yesPool,       symbol: 'YES',  decimals: 18, role: 'YES'          },
        { address: noPool,        symbol: 'NO',   decimals: 18, role: 'NO'           },
    ];

    const fakePool = (id, role) => ({
        id,
        liquidity:    pool.liquidity,
        volumeToken0: pool.volumeToken0,
        volumeToken1: pool.volumeToken1,
        token0:       currencyToken,
        token1:       role === 'YES' ? yesPool : noPool,
        tick:         pool.tick,
        proposal:     proposalLower,
        type:         'CONDITIONAL',
        outcomeSide:  role,
    });

    return async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        const q = body.query || '';

        let data;
        if (q.includes('proposal(id:') && q.includes('whitelistedtokens')) {
            // Compound discovery — INCLUDES `pools` so
            // `fetchBestPoolsForProposal` returns non-null and
            // `formatSubgraphPoolData` runs. This is the one
            // intentional divergence from the shared handler.
            const pools = [fakePool(yesPool, 'YES'), fakePool(noPool, 'NO')];
            data = {
                proposal: { id: proposalLower, currencyToken, companyToken },
                whitelistedtokens: tokens,
                pools,
            };
        } else if (q.includes('candles(where:')) {
            const poolMatch = q.match(/pool:\s*"(0x[a-fA-F0-9]{40})"/);
            const poolId = poolMatch ? poolMatch[1].toLowerCase() : null;
            const close = poolId === yesPool ? '0.5'
                        : poolId === noPool  ? '0.5'
                        : null;
            data = { candles: close == null ? [] : [{ close }] };
        } else if (q.includes('swaps(where:')) {
            data = { swaps: [] };
        } else if (q.includes('pools(where:') && q.includes('id_in:')) {
            const idMatches = [...q.matchAll(/"(0x[a-fA-F0-9]{40})"/g)]
                .map((m) => m[1].toLowerCase());
            const pools = idMatches
                .filter((addr) => addr === yesPool || addr === noPool)
                .map((addr) => ({
                    id:          addr,
                    name:        `harness-pool-${addr.slice(2, 10)}`,
                    type:        'CONDITIONAL',
                    outcomeSide: addr === yesPool ? 'YES' : 'NO',
                }));
            data = { pools };
        } else if (q.includes('pools(where:') && q.includes('proposal:')) {
            const propMatch = q.match(/proposal:\s*"(0x[a-fA-F0-9]{40})"/);
            const queryProposal = propMatch ? propMatch[1].toLowerCase() : null;
            const pools = queryProposal === proposalLower
                ? [fakePool(yesPool, 'YES'), fakePool(noPool, 'NO')]
                : [];
            data = { pools };
        } else if (q.includes('pools(where:') && q.includes('id:') && !q.includes('id_in:')) {
            const idMatch = q.match(/id:\s*"(0x[a-fA-F0-9]{40})"/);
            const poolId = idMatch ? idMatch[1].toLowerCase() : null;
            const p = poolId === yesPool ? fakePool(yesPool, 'YES')
                    : poolId === noPool  ? fakePool(noPool, 'NO')
                    : null;
            data = { pool: p ? [p] : [] };
        } else if (q.includes('whitelistedtokens')) {
            data = { whitelistedtokens: tokens };
        } else {
            data = {};
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data }),
        });
    };
}

export default {
    name:        '46-subgraph-pool-data-path',
    description: 'Opens the subgraph-sourced poolData code path on the market page. Inline candles handler returns `pools` in the compound discovery query (the shared handler does not), driving `usePoolData.fetchBestPoolsForProposal` → `formatSubgraphPoolData` (PR #51 fix site) to run. Asserts the Liquidity widget label changes from "Liquidity (Total; sDAI)" (legacy path) to plain "Liquidity" (subgraph path). Mechanically catching PR #51 itself requires tuning mock data so the post-fix vs pre-fix outputs differ at the `normalizeTokenAmount` layer — deferred to a future slice.',
    bugShape:    'subgraph-sourced poolData path unreachable / `formatSubgraphPoolData` fix site stops running / Liquidity widget label conditional regresses',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandlerForPR51(),
    },

    assertions: [
        // Page-shell anchor — same as scenarios #10–#13. If this
        // fails, the bug is upstream of poolData.
        async (page) => {
            await expect(
                page.getByText('Trading Pair').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // The marker assertion. With `poolData?.source === 'subgraph'`
        // (which only happens when `fetchBestPoolsForProposal`
        // returns non-null), the Liquidity widget label is the bare
        // string "Liquidity". Without the compound-query handler
        // extension, the label is "Liquidity (Total; sDAI)" — see
        // MarketPageShowcase.jsx:4847's conditional. Exact match
        // disambiguates from the legacy-path label and from the
        // "Insufficient Liquidity" button label that appears later.
        async (page) => {
            await expect(
                page.getByText('Liquidity', { exact: true }).first(),
            ).toBeVisible({ timeout: 30_000 });
        },
    ],

    timeout: 180_000,
};
