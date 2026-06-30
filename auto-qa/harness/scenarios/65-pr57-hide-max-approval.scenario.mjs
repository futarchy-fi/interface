/**
 * 65-pr57-hide-max-approval.scenario.mjs — catches PR #57 (Hide Max
 * Approval section when relevant allowances are already max).
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Modal-state DOM assertion combined with eth_call PARAMETER
 * mocking. First scenario in the catalog that clicks "Confirm Swap"
 * to OPEN the ConfirmSwapModal AND drives a specific allowance state
 * into the modal's mount useEffect via multicall3-aware interception.
 *
 * Pre-PR-57, the "Max Approval" toggle rendered on every swap-
 * confirm flow regardless of whether input-token allowances were
 * already at MaxUint256 — useless UI clutter for the common case
 * where users had pre-approved. Post-PR-57, the modal probes the
 * relevant (token, spender) pairs on open + on action change; if
 * ALL allowances are already >= MaxUint256/2, the section is hidden.
 *
 * A regression that drops the gating useEffect re-shows the
 * section even when the toggle has no effect. The catch is a
 * `getByText('Max Approval').toHaveCount(0)` inside the open modal.
 *
 * ── Why slice 103 ─────────────────────────────────────────────────
 * Slice 102 hit a viem-decode blocker when the modal's allowance
 * reads went through wagmi's publicClient. Slice 103 diagnosed the
 * blocker: wagmi enables `batch.multicall` by default, so all
 * readContract calls are AUTO-BATCHED through Multicall3 (Gnosis
 * deployment at `0xca11bde0...`). viem's call() action tries
 * `scheduleMulticall` FIRST when `batch.multicall` is on, which
 * sends ONE eth_call to multicall3 with `aggregate3(Call3[])`
 * calldata. A scenario interceptor matching on the INNER selector
 * (`allowance(...)`) misses the OUTER multicall, and the fallback
 * default response (`0x` + 32 bytes of zero) trips viem's
 * `Result[]` dynamic-array decoder which calls
 * `cursor.setPosition(staticPosition + 32)` and asserts position
 * 32 < buffer.length=32 — fails with `PositionOutOfBoundsError`.
 *
 * Slice 103 fix: a shared `decodeMulticall3Aggregate3` +
 * `encodeMulticall3Returns` helper (in `eth-call-inspector.mjs`)
 * lets scenario interceptors decode the inner Call3[] array,
 * compute per-inner-call responses, and encode a properly-shaped
 * Result[] return. This scenario uses both to make the modal's
 * allowance reads resolve to MaxUint256, even when batched.
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to `/markets/${MARKET_PROBE_ADDRESS}` with
 *      `requiresAnvil: true`.
 *   2. Registry + candles mocks populate POOL_CONFIG_YES/NO +
 *      MERGE_CONFIG + BASE_TOKENS_CONFIG (via slice-95 fixture).
 *   3. RPC interceptor handles three eth_call shapes:
 *      a. `simulateQuote(...)` on FutarchyQuoteHelper → non-zero
 *         tuple return so "Confirm Swap" button enables.
 *      b. Multicall3 `aggregate3(Call3[])` → decode the inner
 *         array, for each inner `allowance(...)` call encode
 *         MaxUint256 (32 bytes of 0xff), for any other inner
 *         selector encode 32 bytes of 0. Wrap in Result[] and
 *         return.
 *      c. Anything else with method=eth_call → zero default
 *         (64 bytes, not 32 — see helper comment for why).
 *   4. ShowcaseSwapComponent auto-fires the quote on mount
 *      (`amount = '1'`). Button enables after ~3-6s.
 *   5. Click "Confirm Swap" → modal opens.
 *   6. Modal's hide-approval useEffect fires; its 2 allowance
 *      reads get batched into ONE multicall3 aggregate3 call;
 *      our handler returns MaxUint256 for both → `allMax = true`
 *      → `setHideApprovalSection(true)`.
 *   7. Assert: "Max Approval" text count is 0.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *
 *   1. Current code: passes (modal opens, section hidden).
 *
 *   2. Mutate `src/components/futarchyFi/marketPage/ConfirmSwapModal.jsx`:
 *      remove or short-circuit the hide-approval useEffect that
 *      computes `allMax`. → assertion FAILS with count=1.
 *
 *   3. Restore → passes.
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

// Non-zero quote so the "Confirm Swap" button enables.
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

// MaxUint256 as a 32-byte payload (used as `returnData` inside
// multicall3's Result tuples for allowance() inner calls).
const MAX_UINT256_BYTES32 = encodeAbiParameters(
    [{ type: 'uint256' }],
    [(2n ** 256n) - 1n],
);

// 32 bytes of zero (returnData for non-allowance inner calls in a
// batched multicall — balance reads etc.).
const ZERO_BYTES32 = '0x' + '00'.repeat(32);

// 64 bytes of zero — safe fallback for ANY direct eth_call that
// isn't multicall (32-byte zero trips viem's dynamic-array decoder).
const ZERO_BYTES64 = '0x' + '00'.repeat(64);

export default {
    name:        '65-pr57-hide-max-approval',
    description: 'Catches PR #57 (Hide Max Approval section when allowances at MaxUint256). Multicall3-aware: intercepts the wagmi-batched aggregate3 eth_call from ConfirmSwapModal\'s hide-approval useEffect, decodes inner allowance() calls, encodes a Result[] return with MaxUint256 per call. Assert "Max Approval" toHaveCount(0). Reverting the useEffect re-shows the section.',
    bugShape:    'Max Approval section default-show regresses: every swap-confirm flow surfaces a useless toggle even when input-token allowances are already at MaxUint256 (no approve tx will fire regardless)',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    requiresAnvil: true,

    mocks: (ctx) => {
        ctx.multicallCount = 0;
        ctx.directAllowanceCount = 0;

        const ethCallInterceptor = async (route) => {
            const req = route.request();
            const post = req.postData() || '{}';
            let body;
            try { body = JSON.parse(post); } catch { return route.continue(); }

            const call = parseEthCallParams(body);
            if (!call) return route.continue();

            const data = (call.data || '').toLowerCase();

            // 1. FutarchyQuoteHelper.simulateQuote — non-zero return
            //    so the "Confirm Swap" button enables.
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

            // 2. Multicall3 aggregate3(Call3[]) — wagmi/viem batches
            //    readContract calls through this. Decode the inner
            //    array, build per-inner-call results.
            if (sameAddress(call.to, MULTICALL3_ADDRESS) &&
                data.startsWith(MULTICALL3_AGGREGATE3_SELECTOR)) {
                ctx.multicallCount += 1;
                const innerCalls = decodeMulticall3Aggregate3(call.data);
                const results = (innerCalls || []).map((c) => {
                    const innerData = (c.callData || '').toLowerCase();
                    if (innerData.startsWith(ALLOWANCE_SELECTOR.toLowerCase())) {
                        return { success: true, returnData: MAX_UINT256_BYTES32 };
                    }
                    // Default zero for balance/other reads — keeps
                    // the page non-erroring without affecting the
                    // hide-approval assertion.
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

            // 3. Direct allowance() — only fires when wagmi's
            //    multicall path is bypassed (state overrides, etc).
            //    Keep matching as defense in depth.
            if (data.startsWith(ALLOWANCE_SELECTOR.toLowerCase())) {
                ctx.directAllowanceCount += 1;
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

            // 4. Any other eth_call — return 64 bytes of zero
            //    (NOT 32 — 32 trips viem's dynamic-array decoder
            //    as documented on MULTICALL3_ADDRESS in
            //    eth-call-inspector.mjs).
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
                marketName: 'Harness probe — hide Max Approval',
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

        // Wait for "Confirm Swap" button to enable (quote
        // completed). Button text: "Calculating..." → "Confirm Swap".
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

        // Give hide-approval useEffect time to (a) fire multicall3
        // aggregate3 with the 2 allowance calls, (b) decode the
        // returned Result[], (c) classify both as max, (d)
        // setHideApprovalSection(true).
        async (page) => {
            await page.waitForTimeout(3000);
        },

        // Catch: "Max Approval" must be ABSENT.
        async (page, ctx) => {
            const count = await page.getByText('Max Approval').count();
            if (count > 0) {
                throw new Error(
                    `Scenario 65: "Max Approval" still visible (count=${count}). ` +
                    `Diagnostics — multicallCount=${ctx.multicallCount}, ` +
                    `directAllowanceCount=${ctx.directAllowanceCount}.`,
                );
            }
        },
    ],

    timeout: 180_000,
};
