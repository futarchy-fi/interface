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
    // Algebra V3 pool shape TUNED so post-fix vs pre-fix
    // formatSubgraphPoolData outputs land at distinguishable
    // rendered strings after passing through
    // normalizeTokenAmount and formatLiquidity.
    //
    // liquidity = 7.5025e20 wei, tick = 0 → sqrtPrice = 1.0.
    //
    //   POST-FIX per pool:
    //     adjustedLiquidity = (7.5025e20 × 1.0 × 2) / 1e18 = 1500.5
    //     .toString() = "1500.5"  (has '.')
    //     normalizeTokenAmount keeps as decimal → 1500.5
    //     YES+NO sum  = 3001
    //     formatLiquidity(3001) → "3.00K"     ← marker string
    //
    //   PRE-FIX per pool:
    //     adjustedLiquidity = 7.5025e20 × 1.0 = 7.5025e20
    //     toLocaleString('fullwide') = "750250000000000000000" (no '.')
    //     normalizeTokenAmount sees integer string → /1e18 → 750.25
    //     YES+NO sum  = 1500.5
    //     formatLiquidity(1500.5) → "1.50K"   ← bug-shape string
    //
    // Both render with K suffix but at different leading values.
    // Asserting the EXACT marker string "3.00K" catches a regression
    // that flips the math back to the pre-fix form (the value
    // becomes "1.50K" and the exact-match assertion fails).
    //
    // Choice of 7.5025e20:
    //   - Below 1e21 so `.toString()` keeps the integer form
    //     (no scientific-notation precision concern in pre-fix).
    //   - Multiplied by 2 → 1.5005e21 (still well below JS
    //     double precision cliff at ~9e15-significand for
    //     integer arithmetic, but division by 1e18 lands inside
    //     safe range so 1500.5 is exact).
    //   - Yields a non-integer post-fix output (1500.5), which
    //     forces the `.toString()` branch to retain '.'.
    const defaultPool = {
        liquidity:    '750250000000000000000', // 7.5025e20
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
    name:        '46-pr51-liquidity-magnitude',
    description: 'Catches PR #51 (Algebra V3 Liquidity-widget magnitude bug). Mock liquidity=7.5025e20 wei + tick=0 chosen so the post-fix math (×2/1e18 + .toString) produces "1500.5" per pool (decimal string preserved through normalizeTokenAmount), summed to 3001 → formatLiquidity → "3.00K". Reverting the math line in formatSubgraphPoolData makes adjustedLiquidity=7.5025e20 → "750250000000000000000" (integer string) → normalizeTokenAmount divides by 1e18 → 750.25 → sum 1500.5 → "1.50K". Exact-match assertion on "3.00K" fails under the regression.',
    bugShape:    'PR #51 Algebra V3 raw-L wrong-magnitude in Liquidity widget (drop ×2 /1e18 in formatSubgraphPoolData)',
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

        // Path-mount marker. With `poolData?.source === 'subgraph'`
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

        // PR #51 catch — the load-bearing assertion. "3.00K" is the
        // formatLiquidity output for sum=3001 (precision=2 from
        // PRECISION_CONFIG.display.default + keep-trailing-zeros in
        // precisionFormatter.js:79). Under the pre-fix math the
        // rendered string becomes "1.50K" (sum=1500.5), so this
        // exact-match assertion fails.
        async (page) => {
            await expect(
                page.getByText('3.00K', { exact: true }).first(),
            ).toBeVisible({ timeout: 30_000 });
        },
    ],

    timeout: 180_000,
};
