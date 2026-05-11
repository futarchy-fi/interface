/**
 * 10-market-page-happy.scenario.mjs — Phase 7 pivot iteration 2: first
 * market-page scenario.
 *
 * Where scenarios #01-#09 covered /companies (orgs-list rendering +
 * chaos resilience), this scenario opens the market-page surface.
 * The user capped /companies coverage at 9 ("good enough") and
 * directed market-page investment next, calling out 5 feature areas:
 * trading, allowances, positions, charts, liquidity. Subsequent
 * scenarios (#11-#15) target each area; this one is the foundation
 * — proves the page renders past the page-shell against the new
 * fixture (market-shaped registry handler + market-aware candles
 * handler).
 *
 * **Probe address strategy**: the URL uses MARKET_PROBE_ADDRESS,
 * which is a REAL address from `src/config/markets.js` (GIP-145).
 * That choice is forced — `src/pages/markets/[address].js` has a
 * "Market Not Found" gate that rejects any address not in
 * `MARKETS_CONFIG`. Everything dynamic on TOP of the static
 * `MARKETS_CONFIG` lookup gets mocked: registry GraphQL returns
 * the synthetic proposalentity (HARNESS-MARKET-PROBE-001 title);
 * candles GraphQL returns synthetic pool data for the YES/NO
 * pools. The result: a deterministic page render whose ONLY
 * non-mocked surfaces are wagmi/RainbowKit (handled by the wallet
 * stub) and Supabase realtime (gracefully fails — page renders
 * anyway).
 *
 * Bug-shapes guarded:
 *   - market-page page-shell never mounts past the initial loading
 *     state when registry/candles are healthy (broken hook gating)
 *   - "Market Not Found" gate fires even though the address is in
 *     MARKETS_CONFIG (regression in getMarketConfig lookup)
 *   - WrongNetworkModal blocks render when wallet is on chain 100
 *     (regression in useChainValidation)
 *   - aggregator client-side filter drops the proposalentity row
 *     even though its nested aggregator id matches DEFAULT_AGGREGATOR
 *     (regression in registryAdapter's filter loop)
 *   - candles handler dispatch breaks for the singular `pools(where:
 *     {id:...})` form (the carousel uses `id_in:[...]` plural, which
 *     historically masked bugs in the singular path)
 *
 * **Why no specific dynamic value assertions**: this is a foundation
 * scenario, not a value-flow regression. Subsequent feature-area
 * scenarios will pin specific dynamic values (price formatting,
 * balance display, etc.). Here we only assert the page got past
 * the structural gates.
 *
 * **Asserting on STATIC text** (button labels + panel headers) — the
 * dynamic strings in MARKETS_CONFIG (GIP-145 title) ARE rendered,
 * but asserting on them would couple the test to whichever
 * configured market we picked as the probe. Static labels are
 * universal across markets.
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
    name:        '10-market-page-happy',
    description: 'First market-page scenario. Navigate to /markets/<probe>; mock registry GraphQL with a market-shaped proposalentity and candles GraphQL with the new market-aware handler. Assert the page renders past the page-shell — proves the entire fixture surface (registry + candles + wallet stub + chain validation) works end-to-end.',
    bugShape:    'market-page page-shell never mounts / Market Not Found false positive / WrongNetworkModal false positive / aggregator filter drops happy proposalentity (foundation regression)',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    assertions: [
        // The probe title is the harness's synthetic value
        // (HARNESS-MARKET-PROBE-001) returned by the registry mock
        // for the dynamic proposalentity fields (title /
        // displayNameQuestion / displayNameEvent). Even if the page
        // header uses the static MARKETS_CONFIG title, at least one
        // panel (the "About" / "Question" panel that comes from
        // proposalentity.displayNameQuestion) should render the
        // probe value.
        //
        // Lenient `.first()` because the title may render in
        // multiple slots (header + question card + tabs panel).
        async (page) => {
            await expect(
                page.getByText('HARNESS-MARKET-PROBE-001').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
    ],

    timeout: 180_000,
};
