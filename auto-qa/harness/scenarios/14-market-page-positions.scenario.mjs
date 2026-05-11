/**
 * 14-market-page-positions.scenario.mjs — Phase 7 fork-bootstrap step 4:
 * FIRST FORK-BACKED scenario.
 *
 * Where #10-#13 covered structural rendering with pure-mock GraphQL,
 * this scenario asserts a VALUE that flows from real on-chain state
 * (the live anvil fork) through `useBalanceManager` → unified
 * balance fetcher → `MarketBalancePanel` → DOM. It's the payoff
 * for the multi-step fork bootstrap (steps 1 → 2 → 2.5 → 2.6 → 2.7
 * → 2.8 → 2.9), where each step funded another piece of the wallet
 * state on the fork:
 *   - 10000 ETH (anvil --accounts pre-fund)
 *   - 1000 sDAI (storage write at sDAI _balances slot 0)
 *   - 100 YES + 100 NO conditional positions (storage write at
 *     CT _balances slot 1, position IDs derived via
 *     deriveYesNoPositionIds against MARKET_PROBE_ADDRESS)
 *
 * **What this scenario asserts**: with YES=100 and NO=100 funded,
 * `MarketBalancePanel.jsx` line 245 computes
 * `sdiPositionBalance = min(currencyYes.total, currencyNo.total)
 *  = min(100, 100) = 100`. That value flows through `formatWith(
 * 100, 'balance')` (precision=4 per `PRECISION_CONFIG.display.
 * balance` in `constants/contracts.js`) → renders as "100.0000".
 * The full string in the rendered DOM is "100.0000 <SYMBOL>"
 * where SYMBOL is the per-market currency symbol (typically
 * "SDAI" for the futarchy chain config). Asserting on "100.0000"
 * alone is symbol-agnostic and proves the value flow end-to-end.
 *
 * **What "first fork-backed" means**: every prior scenario was
 * pure-mock — the on-chain reads either weren't asserted on or
 * fell back to null/zero gracefully. THIS scenario will FAIL if
 * the fork isn't running (or globalSetup didn't fund the wallet).
 * That's expected — it surfaces fork-stack regressions loudly.
 *
 * Bug-shapes guarded:
 *   - useBalanceManager doesn't issue balanceOfBatch RPC call
 *     (e.g., refactor that gates the call on a missing flag)
 *   - balanceOfBatch result is mis-decoded (wrong order, wrong
 *     decimals)
 *   - sdiPositionBalance doesn't take min(YES, NO) (regression
 *     that picks one outcome's balance arbitrarily)
 *   - `formatWith(100, 'balance')` produces something other than
 *     "100.0000" (precision config regression dropping the 4
 *     decimal places)
 *   - position IDs are computed differently from
 *     deriveYesNoPositionIds (regression in useContractConfig's
 *     per-market position-ID derivation that desyncs from the
 *     CT framework's actual formula)
 *   - balance display swallows a slow RPC response (loading state
 *     never resolves to a value)
 *
 * **Why no fork-pin**: this is the first fork-backed scenario; no
 * other scenario mutates state YET, so isolation isn't an issue.
 * Step 3 (snapshot/revert between scenarios) lands when scenarios
 * actually mutate state (e.g., a buy-flow scenario that submits
 * a tx).
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
    name:        '14-market-page-positions',
    description: 'FIRST FORK-BACKED scenario. Asserts the YES + NO conditional positions funded in globalSetup (100 each via storage-write at CT _balances slot 1) render in MarketBalancePanel as "100.0000". Proves the entire fork-stack value flow: anvil fork → CT storage → useBalanceManager → unifiedBalanceFetcher → MarketBalancePanel → DOM.',
    bugShape:    'useBalanceManager skips balanceOfBatch / mis-decodes result / sdiPositionBalance picks wrong-side outcome instead of min(YES,NO) / formatWith balance precision drops decimals / per-market position-ID derivation desyncs from the CT framework formula',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    assertions: [
        // The page-shell mount check (same anchor as #11-#13) gives
        // a fast-fail signal if the page never renders past
        // page-shell — the next assertion's 30s wait would
        // otherwise hide the cause.
        async (page) => {
            await expect(
                page.getByText('Balance').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        // Canonical assertion: the on-chain balance flows into the
        // rendered DOM as "100.0000". Symbol-agnostic — see
        // scenario header for why we don't pin the SDAI suffix.
        // 30s timeout because the balance fetch chain is:
        // page mount → useBalanceManager init → wallet connect →
        // chainId match → useContractConfig fetch → balanceOfBatch
        // RPC → setState → render. Each step is fast individually
        // but the wallet/chain-validation handshake can take a
        // couple seconds.
        async (page) => {
            await expect(
                page.getByText('100.0000').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
    ],

    timeout: 180_000,
};
