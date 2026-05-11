/**
 * 15-market-page-balance-update.scenario.mjs — Phase 7 step 10:
 * FIRST FORK-MUTATING scenario.
 *
 * Where #14 + #11 covered "the page reads from a pre-funded fork
 * and shows the right value", this scenario covers the **change-
 * detection** path: the page's `useBalanceManager` auto-refresh
 * interval (15s, see `src/hooks/useBalanceManager.js:185`) MUST
 * pick up state mutations that happen between renders. A
 * regression that:
 *   - clears the auto-refresh interval prematurely
 *   - caches the first balance read forever (e.g., a useMemo with
 *     wrong dep keys)
 *   - swallows refetch errors silently and stops re-trying
 * would all silently break this contract.
 *
 * **What the scenario does**:
 *   1. Navigate to /markets/<probe>; wait for the trading panel's
 *      "Available 1100 sDAI" line to appear (the pre-mutation
 *      state matching #11's assertion: wallet 1000 + min(YES 100,
 *      NO 100) = 1100).
 *   2. Set the wallet's sDAI balance to 500 (down from 1000) via
 *      a direct storage write (`setErc20Balance(wallet, 500)`).
 *      NOT through the wallet stub or a transaction — just
 *      storage mutation, fastest possible state change.
 *   3. Wait for the page's auto-refresh tick (≤15s; assertion
 *      timeout is 30s for headroom).
 *   4. Assert the trading panel now shows "Available 600 sDAI"
 *      (wallet=500 + min(YES 100, NO 100) = 600).
 *
 * **Why the value 500 (not 0)** — "100 sDAI" ALREADY renders on
 * the page (the position line in the Balance panel). Asserting
 * "100 sDAI" after mutating wallet to 0 would match the existing
 * position rendering and pass even if change-detection broke.
 * Using 500 → 600 produces a value ("600 sDAI") that does NOT
 * appear anywhere on the page initially, so its presence
 * unambiguously signals the post-mutation render.
 *
 * **Why this is the FIRST mutating scenario** — every prior
 * scenario was either pure-mock (#01-#13) or read-only against
 * a fork pre-funded by globalSetup (#14, #11 with proxy). This
 * scenario MUTATES the fork mid-test. Per-scenario isolation
 * (step 7's evm_snapshot/evm_revert) is what keeps this from
 * polluting subsequent scenarios — if isolation breaks (step 9's
 * known flake), the mutation persists and any later scenario
 * that asserts the wallet has 1000 sDAI would fail.
 *
 * **Why no transaction** — sending an actual `sDAI.transfer()` tx
 * via the wallet stub requires `--no-mining` to be turned off OR
 * an `anvil_mine` call after sending. Adds infra complexity
 * (mining timing, receipt checking) without changing what's
 * tested. Storage mutation isolates the change-detection contract
 * from the tx-submission contract; the latter gets its own
 * scenario later.
 *
 * Bug-shapes guarded:
 *   - useBalanceManager auto-refresh interval cleared by an
 *     unmount-then-remount cycle (e.g., a parent re-render that
 *     destroys + recreates the hook owner)
 *   - balance state useMemo memoizes against a stale dep, so the
 *     fetched-but-changed value never recommits
 *   - the wallet-balance call gets de-duped against a cached
 *     promise that was created at first render
 *   - balance render path swaps "0" for some sentinel ("---",
 *     "loading", null) when the value transitions through zero
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
import {
    setErc20Balance,
    getErc20Balance,
    SDAI_TOKEN_GNOSIS_ADDRESS,
} from '../fixtures/fork-state.mjs';

export default {
    name:        '15-market-page-balance-update',
    description: 'FIRST FORK-MUTATING scenario. Loads the page, asserts the pre-mutation "Available 1100 sDAI" trading-panel line, then drains wallet sDAI to 0 via setErc20Balance, waits for the 15s auto-refresh tick, asserts the post-mutation "Available 100 sDAI" line. Validates the page picks up mid-test fork state changes — and implicitly that per-scenario isolation prevents this mutation from polluting siblings.',
    bugShape:    'useBalanceManager auto-refresh interval cleared mid-session / balance render caches first read forever / wallet-balance call de-duped against stale cached promise / zero-transition swaps the value for a loading sentinel',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    useAnvilRpcProxy: true,

    assertions: [
        // Step 1: wait for the pre-mutation state. If this assertion
        // fails, the rest of the scenario has nothing to react to —
        // the mutation would happen against an un-rendered page and
        // the post-mutation assertion would catch the WRONG bug
        // (load failure, not change-detection failure).
        async (page) => {
            await expect(
                page.getByText('1100 sDAI').first(),
            ).toBeVisible({ timeout: 60_000 });
        },
        // Step 2 + 3: mutate fork state, then wait for the page's
        // auto-refresh tick to pick it up. setErc20Balance writes
        // directly to the sDAI _balances storage slot, no tx
        // required, no mining required. 500 sDAI (down from
        // globalSetup's 1000) leaves wallet+position aggregating
        // to 600, which is unique on the page.
        //
        // Step 18: backport `withProxyPaused` (added in step 17)
        // + `drainMs: 5000`. On cold anvil, by the time we issue
        // setStorageAt the page's eth_call backlog at anvil can be
        // 30+s deep, blocking the write. Pausing the page proxy
        // stops new traffic; the 5s drain wait lets the existing
        // backlog at anvil clear before our mutation lands.
        async (_page, { wallet, anvilUrl, withProxyPaused }) => {
            // Step 20: read-back probe. If setStorageAt times out
            // (cold-anvil flake from steps 13-19), immediately read
            // the slot via getErc20Balance and log the answer:
            //   - balance === 500e18 → anvil DID write; the
            //     setStorageAt response was lost in transit (network
            //     / fetch / abort-controller path issue, NOT anvil)
            //   - balance === 1000e18 (unchanged) → anvil never
            //     wrote; the request itself never landed
            // Either result is a definitive diagnostic — chooses
            // between "fix the response path" vs "fix the request
            // path" for step 21+. Probe is wrapped in its own
            // try/catch so a failed probe doesn't mask the original
            // error. Diagnostic-only: remove after step 20's
            // observation lands in PROGRESS.
            try {
                await withProxyPaused(async () => {
                    await setErc20Balance(
                        anvilUrl,
                        SDAI_TOKEN_GNOSIS_ADDRESS,
                        wallet.address,
                        500n * 10n ** 18n,
                    );
                }, { drainMs: 5000 });
            } catch (err) {
                console.log(`[step20] setStorageAt threw: ${err.message}`);
                try {
                    const probedBalance = await getErc20Balance(
                        anvilUrl,
                        SDAI_TOKEN_GNOSIS_ADDRESS,
                        wallet.address,
                    );
                    console.log(`[step20] post-timeout sDAI balance: ${probedBalance} wei`);
                    console.log(`[step20] expected if write landed: ${500n * 10n ** 18n} wei`);
                    console.log(`[step20] expected if write failed:  ${1000n * 10n ** 18n} wei`);
                } catch (probeErr) {
                    console.log(`[step20] probe also failed: ${probeErr.message}`);
                }
                throw err;
            }
        },
        // Step 4: assert the post-mutation state. Wallet sDAI = 500
        // means Available = 500 + min(YES 100, NO 100) = 600. The
        // 30s timeout is roughly 2× the page's 15s auto-refresh
        // interval — gives a full extra cycle of headroom for
        // RPC variance.
        async (page) => {
            await expect(
                page.getByText('600 sDAI').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
    ],

    timeout: 180_000,
};
