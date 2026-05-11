/**
 * 18-market-page-isolation-canary-2.scenario.mjs — Phase 7 step 12:
 * SECOND isolation-health canary; runs after both mutating
 * scenarios (#15 wallet, #17 position).
 *
 * **Purpose** — same as #16, but covers the case where #16's
 * canary already passed (proving #15's wallet mutation reverted)
 * AND #17 then ran (mutating positions). #18 runs after #17 and
 * asserts the BASELINE state again — proving #17's POSITION
 * mutation also reverted, distinct from #16's coverage which only
 * proved #15's WALLET mutation reverted.
 *
 * **Why two canaries** — #16 only catches "snapshot/revert breaks
 * for ERC20 storage mutations"; #18 catches "snapshot/revert
 * breaks for ERC1155 storage mutations". Both go through anvil's
 * `evm_revert`, but they exercise different storage layouts
 * (ERC20 single mapping vs ERC1155 nested mapping). A regression
 * could hit one and not the other (e.g., a partial-revert bug
 * that drops nested mappings).
 *
 * **What this scenario does** — identical to #16:
 *   - Same mocks + proxy as #11.
 *   - Single assertion: "Available 1100 sDAI" (the baseline
 *     aggregate). If both #15's wallet revert AND #17's position
 *     revert worked, this passes. Otherwise, the wallet still
 *     holds 500 sDAI (#15 leak → "Available 600 sDAI") OR the
 *     position still holds 200 (#17 leak → "Available 1200
 *     sDAI"). Either failure mode produces a clear "canary 2"
 *     test failure.
 *
 * Bug-shapes captured (NEW failure modes the pre-#18 suite couldn't
 * catch):
 *   - Snapshot/revert handles flat-mapping (ERC20 _balances) but
 *     not nested-mapping (ERC1155 _balances) state. Anvil might
 *     have a partial-revert regression that drops nested-mapping
 *     writes from the snapshot diff.
 *   - Step 9's recovery-bail fires on ERC1155 mutation specifically
 *     (different RPC pattern) and the snapshot file doesn't get
 *     reset before #18 runs.
 *
 * Numbered 18 (not 16-foo or appended-to-16) so the alphabetical
 * sort places it AFTER #17.
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
    name:        '18-market-page-isolation-canary-2',
    description: 'SECOND isolation canary. Sorts AFTER #17 (the position-mutating scenario). Asserts the trading panel shows the BASELINE "Available 1100 sDAI" line. Distinct from #16: this canary specifically catches regressions where snapshot/revert handles ERC20 mutations correctly (#15 → #16 chain) but mishandles ERC1155 mutations (#17 → #18 chain).',
    bugShape:    'snapshot/revert handles flat-mapping (ERC20) but not nested-mapping (ERC1155) state / step 9 recovery-bail fires on ERC1155 mutation and leaves wallet+position dirty / partial-revert bug drops nested-mapping writes from snapshot diff',
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
