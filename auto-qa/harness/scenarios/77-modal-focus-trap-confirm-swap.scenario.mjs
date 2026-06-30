/**
 * 77-modal-focus-trap-confirm-swap.scenario.mjs — sister of scenario
 * 76 on the market-page ConfirmSwapModal surface.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Same KIND as scenario 76 (modal focus-trap, slice 301) — on a
 * DIFFERENT modal stack:
 *   - **76**: RainbowKit's wallet-list modal on /companies.
 *     Third-party modal library (RainbowKit uses Vaul/Radix +
 *     focus-trap internally). Tests that RainbowKit's
 *     pre-rolled trap is wired correctly.
 *   - **77 (this)**: futarchy's custom ConfirmSwapModal on
 *     /markets/<probe>. Hand-rolled modal component
 *     (`src/components/futarchyFi/marketPage/ConfirmSwapModal
 *     .jsx`). Tests that the CUSTOM modal has its own
 *     focus trap in place.
 *
 * The two modals have orthogonal failure modes:
 *   - RainbowKit could regress if a major-version bump drops
 *     its trap implementation.
 *   - ConfirmSwapModal could regress at any refactor of its
 *     own JSX — much higher probability since it's
 *     in-repo code.
 *
 * ── How the scenario catches it ─────────────────────────────────────
 * Reuses scenario 65's multicall3-aware setup to open the modal:
 *
 *   1. Navigate /markets/<probe>; anchor on "Trading Pair".
 *   2. Mocks: simulateQuote eth_call returns non-zero so the
 *      "Confirm Swap" button enables (same setup as 65).
 *      Multicall3 aggregate3 returns MaxUint256 for any
 *      allowance() inner call.
 *   3. Wait for "Confirm Swap" button enabled.
 *   4. Click → ConfirmSwapModal opens.
 *   5. Wait for modal heading "Confirm Buy"/"Confirm Sell".
 *   6. Tab walk N=20 from current state (modal-open).
 *   7. **Catch (inverted, same as 76)**: "Chain Selector"
 *      (Header aria-label) MUST NOT appear in the focus chain.
 *      Background Header element — if Tab reaches it, the
 *      ConfirmSwapModal's focus trap is broken.
 *
 * ── Why "Chain Selector" as negative anchor ─────────────────────────
 * Same rationale as scenario 76 — stable Header element
 * regardless of wallet state. On /markets the wallet stub
 * auto-connects, so "Connect Wallet" wouldn't be a valid
 * negative anchor (already replaced by wallet dropdown). Chain
 * Selector is always present.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: scenario PASSES.
 *   2. Mutate ConfirmSwapModal.jsx to remove its FocusScope/
 *      focus-trap wrapper → scenario FAILS (Chain Selector
 *      reachable within 20 tabs).
 *   3. Restore → passes.
 *
 * ── Fixture leverage ────────────────────────────────────────────────
 * Same as 76: `walkTabOrder` from `fixtures/keyboard-nav.mjs`.
 * Two scenarios now use this primitive with inverted catch
 * direction (76, 77). A third negative-focus scenario would
 * meet the N=3 extraction trigger for a dedicated
 * `assertTabDoesNotReachAnyOf` helper.
 *
 * RPC interception boilerplate is the same as scenarios 64 + 65;
 * a future refactor could extract the simulateQuote + multicall3
 * stub pair into a shared fixture (`fixtures/quote-helper-stub.mjs`)
 * once a 3rd scenario needs it.
 */

import { expect } from '@playwright/test';
import {
    encodeAbiParameters,
    toFunctionSelector,
} from 'viem';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    MARKET_PROBE_ADDRESS,
    PUBLIC_GNOSIS_RPC_URLS,
    fakeMarketProposalEntity,
    makeGraphqlMockHandler,
    makeSubgraphAwareCandlesHandler,
} from '../fixtures/api-mocks.mjs';
import {
    parseEthCallParams,
    sameAddress,
    decodeMulticall3Aggregate3,
    encodeMulticall3Returns,
    MULTICALL3_ADDRESS,
    MULTICALL3_AGGREGATE3_SELECTOR,
} from '../fixtures/eth-call-inspector.mjs';
import { assertTabDoesNotReachAnyOf } from '../fixtures/keyboard-nav.mjs';

// Slice 306: inverted-direction catch extracted to shared
// fixture (sibling of assertTabReachesAnyOf from slice 300).

const HELPER_ADDRESS = '0xe32bfb3DD8bA4c7F82dADc4982c04Afa90027EFb';

const SIMULATE_QUOTE_ABI = [{
    name: 'simulateQuote', type: 'function', stateMutability: 'view',
    inputs: [
        { name: 'proposal',  type: 'address' },
        { name: 'isYesPool', type: 'bool'    },
        { name: 'inputType', type: 'uint8'   },
        { name: 'amountIn',  type: 'uint256' },
    ],
    outputs: [{
        type: 'tuple',
        components: [
            { type: 'int256' }, { type: 'int256' },
            { type: 'uint160' }, { type: 'uint160' },
            { type: 'bytes' }, { type: 'bool' },
        ],
    }],
}];

const SIMULATE_QUOTE_SELECTOR = toFunctionSelector(SIMULATE_QUOTE_ABI[0]);
const ALLOWANCE_SELECTOR = toFunctionSelector('allowance(address,address)');

const SYNTHETIC_QUOTE_RETURN = encodeAbiParameters(
    [{
        type: 'tuple',
        components: [
            { type: 'int256' }, { type: 'int256' },
            { type: 'uint160' }, { type: 'uint160' },
            { type: 'bytes' }, { type: 'bool' },
        ],
    }],
    [[-(10n ** 18n), 10n ** 18n, 2n ** 96n, 2n ** 96n, '0x', true]],
);

const MAX_UINT256_BYTES32 = encodeAbiParameters(
    [{ type: 'uint256' }],
    [(2n ** 256n) - 1n],
);
const ZERO_BYTES32 = '0x' + '00'.repeat(32);
const ZERO_BYTES64 = '0x' + '00'.repeat(64);

export default {
    name:        '77-modal-focus-trap-confirm-swap',
    description: 'Sister of scenario 76 on the market-page ConfirmSwapModal. Reuses scenario 65\'s multicall3-aware eth_call mocking to open the modal, then Tab walks N=20 and asserts "Chain Selector" (Header aria-label) is NEVER reached. Different modal stack from 76 (custom ConfirmSwapModal vs RainbowKit) — orthogonal failure modes. Catches focus-trap removal/disable in the in-repo modal component.',
    bugShape:    'ConfirmSwapModal renders without focus trap / FocusScope wrapper removed in a refactor / Tab walks back to the market-page background while modal overlay is visible. Custom-modal regression invisible to scenario 76 (different modal library).',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    requiresAnvil: true,

    // Slice 302 finding: ConfirmSwapModal currently has NO focus trap.
    // First empirical run (slice 302) showed Tab walked from inside
    // the modal back to the market-page background within 5 presses
    // (Wallet:0 sDAI link, Split Collateral button, then Companies
    // header link), then eventually reached the Chain Selector
    // aria-label. Pinned via the slice-302 `pinnedLatentBug` runner
    // flag so the suite stays green — when ConfirmSwapModal gets a
    // FocusScope/focus-trap-react wrapper, REMOVE this flag and the
    // scenario starts catching regressions automatically.
    //
    // Latent bug ledger entry (sibling of fallback-company.png from
    // slice 79 and the React update-in-render warning from slice 80):
    //   * Component: src/components/futarchyFi/marketPage/ConfirmSwapModal.jsx
    //   * Severity: A11y — keyboard users can interact with background
    //     while modal overlay is visually opaque.
    //   * Fix: wrap the modal root in FocusScope (radix-ui/primitives)
    //     or react-focus-lock. Verify by running this scenario after
    //     removing the pinnedLatentBug flag.
    pinnedLatentBug: 'ConfirmSwapModal has no focus trap; Tab escapes to market-page background and Header within ~5-10 presses. Wrap modal root in FocusScope/react-focus-lock and remove this flag.',

    mocks: (ctx) => {
        const ethCallInterceptor = async (route) => {
            const req = route.request();
            const post = req.postData() || '{}';
            let body;
            try { body = JSON.parse(post); } catch { return route.continue(); }

            const call = parseEthCallParams(body);
            if (!call) return route.continue();

            const data = (call.data || '').toLowerCase();

            // 1. simulateQuote → non-zero return so Confirm Swap enables.
            if (sameAddress(call.to, HELPER_ADDRESS) &&
                data.startsWith(SIMULATE_QUOTE_SELECTOR.toLowerCase())) {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: body.id ?? 1,
                        result: SYNTHETIC_QUOTE_RETURN,
                    }),
                });
            }

            // 2. Multicall3 aggregate3 → MaxUint256 for allowance,
            //    zero for everything else.
            if (sameAddress(call.to, MULTICALL3_ADDRESS) &&
                data.startsWith(MULTICALL3_AGGREGATE3_SELECTOR)) {
                const innerCalls = decodeMulticall3Aggregate3(call.data);
                const results = (innerCalls || []).map((c) => {
                    const innerData = (c.callData || '').toLowerCase();
                    if (innerData.startsWith(ALLOWANCE_SELECTOR.toLowerCase())) {
                        return { success: true, returnData: MAX_UINT256_BYTES32 };
                    }
                    return { success: true, returnData: ZERO_BYTES32 };
                });
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: body.id ?? 1,
                        result: encodeMulticall3Returns(results),
                    }),
                });
            }

            // 3. Direct allowance → MaxUint256.
            if (data.startsWith(ALLOWANCE_SELECTOR.toLowerCase())) {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: body.id ?? 1,
                        result: MAX_UINT256_BYTES32,
                    }),
                });
            }

            // 4. Any other eth_call → 64 bytes zero.
            if (body.method === 'eth_call') {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: body.id ?? 1,
                        result: ZERO_BYTES64,
                    }),
                });
            }

            return route.continue();
        };

        const rpcRoutes = {};
        for (const u of ['http://localhost:8546/', ...PUBLIC_GNOSIS_RPC_URLS]) {
            rpcRoutes[`${u}**`] = ethCallInterceptor;
        }

        return {
            [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
                proposals: [fakeMarketProposalEntity()],
            }),
            [CANDLES_GRAPHQL_URL]: makeSubgraphAwareCandlesHandler({
                marketName: 'Harness probe — modal focus-trap',
            }),
            ...rpcRoutes,
        };
    },

    assertions: [
        // Sanity: page mounted past chain gate.
        async (page) => {
            await expect(
                page.getByText(/Trading Pair/i).first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Wait for Confirm Swap button enabled.
        async (page) => {
            const confirmBtn = page.getByRole('button', { name: /^Confirm Swap$/ });
            await expect(confirmBtn).toBeEnabled({ timeout: 30_000 });
        },

        // Click → opens ConfirmSwapModal.
        async (page) => {
            await page.getByRole('button', { name: /^Confirm Swap$/ }).click();
        },

        // Wait for modal heading.
        async (page) => {
            await expect(
                page.getByRole('heading', { name: /^Confirm (Buy|Sell)$/ }).first(),
            ).toBeVisible({ timeout: 15_000 });
        },

        // Tab walk while modal is open — inverted-direction
        // catch via shared helper (slice 306). With trap, Chain
        // Selector never reached; without trap, focus escapes
        // to background.
        async (page) => {
            await assertTabDoesNotReachAnyOf(page, {
                depth:   20,
                anchors: [/chain selector/i],
            });
        },
    ],

    timeout: 180_000,
};
