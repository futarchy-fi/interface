/**
 * 17-market-page-position-update.scenario.mjs — Phase 7 step 12:
 * SECOND fork-MUTATING scenario; first to mutate ERC1155 position
 * state.
 *
 * Where #15 mutated an ERC20 wallet balance (sDAI) and asserted the
 * trading panel's "Available" line picked up the change, this
 * scenario mutates ERC1155 conditional-token positions (the YES +
 * NO outcomes) and asserts the SAME line picks up THAT change. Two
 * different mutation paths converge into the same display
 * pipeline; both have to work for the page to be correct.
 *
 * **What the scenario does**:
 *   1. Navigate to /markets/<probe>; wait for the trading panel's
 *      "Available 1100 sDAI" line (the pre-mutation state: wallet
 *      1000 + min(YES 100, NO 100) = 1100).
 *   2. Mutate fork state: increase BOTH YES + NO positions from
 *      100 to 200 via `setConditionalPosition` writing directly to
 *      the CT contract's `_balances` mapping. Targets the
 *      `currencyYes` + `currencyNo` IDs in
 *      `HOOK_FALLBACK_POSITION_IDS` because that's what the page's
 *      `useContractConfig.MERGE_CONFIG` actually reads (see step
 *      5c PROGRESS notes).
 *   3. Wait for the page's auto-refresh tick (≤15s; assertion
 *      timeout 30s for headroom).
 *   4. Assert "Available 1200 sDAI" appears (wallet 1000 +
 *      min(YES 200, NO 200) = 1200).
 *
 * **Why mutate BOTH outcomes** — the panel computes `min(YES, NO)`,
 * so mutating only YES would still show 100 (the unchanged NO is
 * the min). Mutating both lifts the floor from 100 → 200 and the
 * resulting Available value (1200) is unique on the page.
 *
 * **Why NOT use `deriveYesNoPositionIds()`** — those derive IDs
 * from `proposal.conditionId()` against MARKET_PROBE_ADDRESS on the
 * fork, which produces a DIFFERENT set than the hook hard-codes.
 * The page reads the hook's hard-coded IDs (lines 400, 408 of
 * `useContractConfig.js`); funding the derived IDs alone wouldn't
 * affect what the page renders. Step 5c documented this asymmetry.
 *
 * Bug-shapes captured (DISTINCT from #15's wallet-mutation
 * coverage):
 *   - ERC1155 position-balance refetch breaks (e.g., a refactor
 *     that gates balanceOfBatch on a missing flag while leaving
 *     the ERC20 path intact)
 *   - position render path memoizes against stale dep so YES + NO
 *     never recommit even after fetched
 *   - `min(YES, NO)` aggregation regression (max() instead of
 *     min(), or unsigned overflow on subtraction)
 *   - `formatWith(200, 'balance')` regression that mishandles
 *     non-100-aligned values (200 has different significant-figure
 *     handling than 100 in some formatter regressions)
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
import { setConditionalPosition, HOOK_FALLBACK_POSITION_IDS } from '../fixtures/fork-state.mjs';

const NEW_POSITION_AMOUNT_WEI = 200n * 10n ** 18n;

export default {
    name:        '17-market-page-position-update',
    description: 'SECOND fork-MUTATING scenario; first to mutate ERC1155 positions. Loads the page, asserts the pre-mutation "Available 1100 sDAI" line, then increases YES + NO positions from 100 to 200 each via setConditionalPosition at the hook-fallback IDs, waits for the 15s auto-refresh, asserts "Available 1200 sDAI". Distinct from #15 (which mutates ERC20 wallet balance) — same display pipeline, different mutation source.',
    bugShape:    'ERC1155 position-balance refetch breaks while ERC20 path stays intact / min(YES, NO) aggregation regression (max() instead, unsigned overflow) / position render memoizes against stale dep / formatWith(200) regression on non-100-aligned values',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    useAnvilRpcProxy: true,

    assertions: [
        // Step 1: pre-mutation baseline. Same assertion as #11 + #16.
        async (page) => {
            await expect(
                page.getByText('1100 sDAI').first(),
            ).toBeVisible({ timeout: 60_000 });
        },
        // Step 2: mutate fork. setConditionalPosition writes
        // directly to the CT contract's _balances slot — no tx
        // submission, no mining required. Both YES + NO must be
        // raised together because the panel reads min(YES, NO).
        async (_page, { wallet, anvilUrl }) => {
            await setConditionalPosition(
                anvilUrl,
                wallet.address,
                BigInt(HOOK_FALLBACK_POSITION_IDS.currencyYes),
                NEW_POSITION_AMOUNT_WEI,
            );
            await setConditionalPosition(
                anvilUrl,
                wallet.address,
                BigInt(HOOK_FALLBACK_POSITION_IDS.currencyNo),
                NEW_POSITION_AMOUNT_WEI,
            );
        },
        // Step 3: post-mutation assert. Wallet sDAI = 1000 + min(YES
        // 200, NO 200) = 1200. 30s timeout = 2× the auto-refresh
        // interval for variance headroom.
        async (page) => {
            await expect(
                page.getByText('1200 sDAI').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
    ],

    timeout: 180_000,
};
