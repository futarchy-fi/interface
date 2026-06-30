/**
 * 60-pr56-prediction-market-badge-gated.scenario.mjs — catches PR #56
 * (Prediction Market badge default-hide).
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * DOM-text *absence* assertion against a metadata-gated badge — same
 * KIND as scenario 55 (PR #46 archived-proposal absence) but on a
 * different surface (the market-page badge cluster, not the
 * /companies milestones carousel).
 *
 * Pre-PR-56, the "Prediction Market" badge appeared on every market
 * page whose `BASE_TOKENS_CONFIG.currency.address` AND any of the
 * `MERGE_CONFIG.currencyPositions.{yes,no}.wrap.wrappedCollateralToken
 * Address` were truthy — which is the case for every proposal with a
 * functioning collateral configuration, i.e. nearly every proposal
 * in production.
 *
 * Post-PR-56, the badge requires an EXPLICIT
 * `marketInfo.showPredictionMarket === true` flag (default false).
 * The motivation in the PR description: most futarchy proposals don't
 * have a usable prediction-market layer, so surfacing the badge by
 * default created clutter and false-discovery.
 *
 * ── How the scenario catches it ─────────────────────────────────────
 *
 *   1. Registry metadata is the default `fakeMarketProposalEntity()`
 *      — i.e. NO `showPredictionMarket` field at all. This is the
 *      common case for proposals stored against the harness probe.
 *
 *   2. Candles GraphQL uses `makeSubgraphAwareCandlesHandler` (the
 *      slice 95 fixture extracted from scenario 59) so the subgraph
 *      adapter populates `metadata.currencyTokens.{base,yes,no}` and
 *      `metadata.companyTokens.*` and `metadata.conditional_pools.*`.
 *      Without this enrichment, BASE_TOKENS_CONFIG.currency.address
 *      would be null → the badge wouldn't render REGARDLESS of the
 *      gate, making the regression-catch direction ambiguous. With
 *      enrichment, the badge SHOULD render pre-fix and SHOULDN'T
 *      render post-fix.
 *
 *   3. Sanity assertion: "Resolve Question" or "Track Progress" or
 *      similar badge IS visible (proves the badge cluster mounted at
 *      all). Without this we can't tell whether the absence of
 *      "Prediction Market" is from the gate firing correctly or from
 *      the page failing to mount the badge area entirely.
 *
 *   4. Catch assertion: `getByText('Prediction Market')` has count
 *      EXACTLY 0. A regression that re-enables the badge by default
 *      (removing the `showPredictionMarket === true` predicate) makes
 *      the count flip to >=1.
 *
 * ── Why this DOESN'T also cover the Arbitrage Contract badge ────────
 * PR #56 added BOTH the default-hide for Prediction Market AND a new
 * "Arbitrage Contract" badge whose render condition is
 * `marketInfo.arbitrageContractAddress`. That field flows through
 * useContractConfig from `metadata.arbitrageContractAddress` — but
 * the `metadata` variable there reads `data.metadata` (subgraph or
 * Supabase), NOT the registry-side metadata enrichment block
 * (`data._registryMetadata`). The subgraph adapter builds a fixed
 * metadata shape that doesn't pass arbitrary extra fields through,
 * so injecting `arbitrageContractAddress` via registry metadata
 * doesn't reach `marketInfo` in the harness's subgraph code path.
 * Catching the Arbitrage badge would require either:
 *   - A scenario that uses the Supabase data path (none exist today)
 *   - A future src/ change to pass `arbitrageContractAddress` through
 *     `_registryMetadata` enrichment
 * Either is out of scope for this slice. The Prediction Market
 * gate, however, IS the higher-value half of PR #56 because it
 * directly affects every existing market page; the Arbitrage badge
 * is opt-in additive and lower regression risk.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *
 *   1. Current code: assertion passes (badge ABSENT).
 *
 *   2. Mutate
 *      `src/components/futarchyFi/marketPage/MarketPageShowcase.jsx`:
 *      remove the `config?.marketInfo?.showPredictionMarket === true
 *      &&` predicate (the leading half of the if condition added in
 *      PR #56) → badge appears for every market page → assertion
 *      FAILS with count >= 1.
 *
 *   3. Restore → assertion passes.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    MARKET_PROBE_ADDRESS,
    fakeMarketProposalEntity,
    makeGraphqlMockHandler,
    makeSubgraphAwareCandlesHandler,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '60-pr56-prediction-market-badge-gated',
    description: 'Catches PR #56 (Prediction Market badge default-hide). Mounts /markets/<probe> with a default fakeMarketProposalEntity (no showPredictionMarket flag) and asserts the "Prediction Market" badge is ABSENT. A regression that removes the showPredictionMarket gate makes the badge reappear by default.',
    bugShape:    'Prediction Market badge default-show regresses: every market page surfaces the badge regardless of whether the proposal\'s metadata opts in via showPredictionMarket',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            // Default fixture — NO showPredictionMarket field. The
            // catch hinges on metadata NOT carrying the flag.
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makeSubgraphAwareCandlesHandler({
            marketName: 'Harness probe market — PR #56 badge gating',
        }),
    },

    assertions: [
        // Sanity: page mounted past the chain gate. The Trading Pair
        // text is rendered by ChartParameters even when the proposal
        // fetch returns minimal data, so it's a reliable
        // "page-shell mounted" signal independent of the badge
        // surface.
        async (page) => {
            await expect(
                page.getByText(/Trading Pair/i).first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // The badge cluster mounts AFTER useContractConfig settles —
        // wait for any badge to appear so we know the cluster has
        // had a chance to render. "Resolve Question" is one of the
        // legacy always-on badges when marketData.question_link is
        // truthy; the probe metadata doesn't set question_link, so
        // we wait on a different stable badge instead. The
        // MarketBadge container itself has a discoverable class, but
        // the most stable cross-version anchor is the per-badge
        // wrapper around any visible badge. Wait for the badges
        // div via its ancestor pattern + at least one badge text.
        // Concretely: wait for the page to settle for 3s post-
        // page-mount so the badge useEffect chain has time to
        // observe currencyTokens populating.
        async (page) => {
            await page.waitForTimeout(3000);
        },

        // Catch: badge MUST be absent. Pre-PR-56, the badge would
        // render for any proposal where currencyTokens are
        // configured (the case here, via
        // makeSubgraphAwareCandlesHandler). Post-PR-56, the badge
        // requires showPredictionMarket === true which the fixture
        // does NOT provide.
        async (page) => {
            await expect(
                page.getByText('Prediction Market'),
            ).toHaveCount(0);
        },
    ],

    timeout: 120_000,
};
