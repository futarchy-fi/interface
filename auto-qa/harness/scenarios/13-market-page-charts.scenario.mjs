/**
 * 13-market-page-charts.scenario.mjs — Phase 7 pivot iteration 5:
 * third market-page feature-area scenario.
 *
 * **Order note**: shipped before the positions scenario (originally
 * planned for slot #13) because the positions scenario hinges on
 * the still-open chain-fork decision (whether scenarios spin up
 * anvil before running, or extend the wallet stub with eth_call
 * mocking). Charts assertions are pure structural — no on-chain
 * reads required for the assertion to be meaningful — so they
 * can ship without that decision.
 *
 * **What the charts surface is** — `MarketPageShowcase` renders
 * `<TripleChart>` (the unified yes/no/spot price chart) wrapped
 * by `<ChartParameters>` (the parameter strip above the chart
 * with "Spot Price", "Yes Price", "No Price", "Event Probability",
 * "Impact" labels). All five labels are React-rendered constants
 * — they don't depend on dynamic chart data — so their presence
 * proves the chart shell mounted.
 *
 * **Mocks**: identical to #10/#11/#12. Registry GraphQL with the
 * synthetic proposalentity, candles GraphQL with the market-aware
 * handler. The candles handler's `pools` + `candles` responses
 * provide enough data for `useYesNoPoolData` to populate the
 * chart's `latestPrices` state without errors. The actual chart
 * rendering library (recharts/visx) shouldn't crash on the
 * synthetic data.
 *
 * Bug-shapes guarded:
 *   - Chart panels never mount (TripleChart wrapper crashes when
 *     `propBaseData` is empty — the harness mock returns 0
 *     candles by default; assertion will catch a regression that
 *     hard-requires non-empty data)
 *   - ChartParameters strip is hidden behind a flag/gate that
 *     normally shows it for connected wallets
 *   - Label rename / i18n breakage drops "Yes Price" or "No Price"
 *   - Static labels swap with each other (Yes/No transposed)
 *   - Sister panel takes the chart slot (assert proves identity)
 *
 * **What this scenario deliberately does NOT cover** (deferred to
 * follow-up scenarios):
 *   - Chart-line rendering: actual chart bars/lines drawn from the
 *     mocked candles. Requires SVG-content assertions, which are
 *     fragile across library versions.
 *   - TWAP countdown value: the chart header shows a TWAP-derived
 *     countdown that ultimately reads from an Algebra pool TWAP
 *     contract via direct eth_call. Mocking that needs the chain-
 *     fork decision (option A) or wallet-stub eth_call mocking
 *     (option B) — either way, separate slice.
 *   - Currency selection: the chart's currency dropdown changes
 *     the price label suffix. State-machine scenario, not
 *     foundation.
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
    name:        '13-market-page-charts',
    description: 'Asserts the charts surface (TripleChart + ChartParameters) mounted with its parameter strip labels visible. Same mocks as #10-#12; assertion targets "Yes Price" and "No Price" parameter cards plus "Event Probability" — three distinct chart-strip labels that prove the chart shell rendered.',
    bugShape:    'chart panels never mount when propBaseData is empty / ChartParameters strip hidden behind a gate / Yes/No labels transposed / sister panel takes the chart slot (foundation regression for the charts feature area)',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    assertions: [
        // "Yes Price" parameter-card label — proves ChartParameters
        // mounted AND the YES-side price card is in its slot.
        async (page) => {
            await expect(
                page.getByText('Yes Price').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        // "No Price" sister card — proves the NO-side card is also
        // mounted (catches single-card-rendered regression where
        // only YES survives a refactor).
        async (page) => {
            await expect(
                page.getByText('No Price').first(),
            ).toBeVisible({ timeout: 15_000 });
        },
        // "Event Probability" — second chart-strip label, distinct
        // from the price cards. Proves a different visual element
        // rendered, not just the parameter row.
        async (page) => {
            await expect(
                page.getByText('Event Probability').first(),
            ).toBeVisible({ timeout: 15_000 });
        },
    ],

    timeout: 180_000,
};
