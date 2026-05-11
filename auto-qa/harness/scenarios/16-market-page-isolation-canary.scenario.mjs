/**
 * 16-market-page-isolation-canary.scenario.mjs — Phase 7 step 11:
 * isolation-health canary.
 *
 * **Purpose** — validate that step 7's per-scenario state isolation
 * (`evm_snapshot`/`evm_revert` in `flows/scenarios.spec.mjs`'s
 * `beforeEach`) actually rolls back the mutation scenario #15 made
 * to fork state. Sorts alphabetically AFTER #15, so the runner
 * fires it next; without isolation, #15's `setErc20Balance(wallet,
 * 500e18)` would persist and this scenario would see "Available
 * 600 sDAI" instead of the expected baseline "1100 sDAI".
 *
 * **What this scenario does**:
 *   - Same mocks + proxy as #11 (the trading-panel value-flow
 *     scenario): registry GraphQL, candles GraphQL,
 *     `useAnvilRpcProxy: true`.
 *   - Single assertion: "Available 1100 sDAI" appears on the
 *     trading panel — the pre-mutation aggregate (wallet 1000 +
 *     min(YES 100, NO 100) = 1100).
 *
 * **Why this isn't redundant with #11** — #11 runs BEFORE #15
 * alphabetically. globalSetup gives every scenario a clean
 * baseline at start-of-suite. So #11 would pass even if revert
 * was a complete no-op (the state hasn't been mutated YET when
 * #11 runs). The discriminating test is a scenario that runs
 * AFTER a known-mutating scenario — the only way it sees the
 * baseline is if revert actually undid the mutation.
 *
 * **Why this is shipped as its own scenario** rather than as a
 * trailing assertion on #15 — Playwright reports each scenario
 * as a distinct test in the trace. When isolation breaks, the
 * harness should produce a clear failure named "isolation
 * canary" rather than a confusing "second assertion in the
 * mutation scenario". Also: #15's beforeEach is what produces
 * the snapshot we revert TO, but #15 itself doesn't validate
 * the revert — the validation has to happen in a SUBSEQUENT
 * scenario (this one).
 *
 * Bug-shapes captured:
 *   - per-scenario `beforeEach` revert silently fails (e.g.,
 *     anvil RPC timeout, snapshot ID file consumed); #15's
 *     mutation persists into next scenario.
 *   - the recovery-bail logic (step 9) deletes the snapshot
 *     file but doesn't reset wallet state; this scenario
 *     becomes the first to FAIL after the bail (correctly
 *     surfacing it).
 *   - a refactor of the runner's beforeEach (e.g., moving
 *     revert to afterEach by mistake) would let the mutation
 *     persist; this scenario fails first.
 *
 * Scenario ID 16 — chosen to sort after 15. Future scenarios
 * that need to run BEFORE this one should use IDs 16a, 16b,
 * etc., or be renumbered.
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
    name:        '16-market-page-isolation-canary',
    description: 'Isolation canary. Sorts alphabetically AFTER #15 (which mutates fork state). Asserts the trading panel shows the BASELINE "Available 1100 sDAI" line. If per-scenario revert worked, #15\'s mutation was undone and this passes. If isolation broke, the wallet still holds 500 sDAI and the assertion fails (surfacing the regression as a named failure rather than a hidden state pollution downstream).',
    bugShape:    'per-scenario revert silently fails / step 9 recovery-bail leaves wallet dirty / runner refactor moves revert to afterEach by mistake (#15 mutation persists into next scenario)',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    useAnvilRpcProxy: true,

    assertions: [
        async (page) => {
            await expect(
                page.getByText('1100 sDAI').first(),
            ).toBeVisible({ timeout: 60_000 });
        },
    ],

    timeout: 180_000,
};
