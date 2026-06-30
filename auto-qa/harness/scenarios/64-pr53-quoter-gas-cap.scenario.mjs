/**
 * 64-pr53-quoter-gas-cap.scenario.mjs — catches PR #53 (lower
 * FutarchyQuoteHelper gasLimit below Gnosis block cap).
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * eth_call PARAMETER inspection — extends the slice-94 inspector
 * pattern (which read the `data` field) to the `gas` field. The
 * eth_call JSON-RPC body's `params[0]` object carries a `gas` hex
 * string when the caller provides a gasLimit override. Public Gnosis
 * RPCs enforce `gas <= block-cap (~17M)`; an eth_call with gas
 * above the cap is rejected by some providers ("Block gas limit
 * exceeded") and silently dropped or retried.
 *
 * Pre-PR-53, `FutarchyQuoteHelper.getSwapQuote` set
 * `txOverrides.gasLimit = 30_000_000` (30M). Some
 * RPC endpoints accepted this on local nodes (and Drpc), but
 * `gnosis-rpc.publicnode.com` rejected it — leaving the swap
 * quoter unable to fetch quotes for users routed to that
 * provider. Post-PR-53, the override is `12_000_000` (12M, well
 * under the cap).
 *
 * The DOM behavior is partial-functional pre-fix (the quoter
 * sometimes works, sometimes hangs, depending on which RPC the
 * page rotated through). A regression to 30M wouldn't trip any
 * DOM-text assertion — only inspecting the eth_call's gas param
 * surfaces it.
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to `/markets/${MARKET_PROBE_ADDRESS}` with
 *      `requiresAnvil: true` (the page's wagmi provider needs a
 *      reachable chain to mount the swap component).
 *   2. Registry mock provides standard probe metadata; candles mock
 *      uses `makeSubgraphAwareCandlesHandler` (slice 95) so
 *      POOL_CONFIG_YES/NO + MERGE_CONFIG populate. Without this,
 *      ShowcaseSwapComponent's quote useEffect never fires.
 *   3. ShowcaseSwapComponent initializes `amount = '1'` on mount
 *      (line 108) — so the debounced quote useEffect fires
 *      AUTOMATICALLY ~500ms after mount, without needing simulated
 *      user input. `getSwapQuote` calls
 *      `helper.callStatic.simulateQuote(...)` with
 *      `{ gasLimit: 12_000_000 }`, which ethers v5 serializes as a
 *      JSON-RPC `eth_call` with `params[0].gas = "0xB71B00"`
 *      (post-fix) or `"0x1C9C380"` (pre-fix).
 *   4. A Playwright route handler on every RPC URL the page might
 *      probe intercepts eth_call POSTs. If the call's `to` matches
 *      `HELPER_ADDRESS` (`0xe32bfb3DD8bA4c7F82dADc4982c04Afa90027EFb`),
 *      parse `params[0].gas` as hex, push to a scenario-scoped
 *      capture array, and fulfill with a synthetic
 *      `simulateQuote` return value (zeroed struct) so the page's
 *      callStatic promise resolves cleanly.
 *   5. Assertion: at least one captured call AND every captured
 *      call has `gas <= 17_000_000` (a safe ceiling — Gnosis block
 *      cap hovers ~17.4M but 17M leaves margin and the post-fix
 *      target is 12M, so 17M is the cleanest threshold).
 *
 * ── The `simulateQuote` ABI ─────────────────────────────────────────
 * Selector: `keccak256("simulateQuote(address,bool,uint8,uint256)")
 *   [0:4]` — computed via viem's `toFunctionSelector` at scenario
 * load time, no hardcoded magic number.
 *
 * Return type: tuple with int256/int256/uint160/uint160/bytes/bool.
 * We return all-zeros — the page's downstream code parses
 * `amount0Delta` / `amount1Delta` to decide which side is the
 * output amount, but both being zero means it picks zero either
 * way. The DOM may render `0.000000` next to the input — that's
 * fine, it doesn't affect the catch (which is purely on the
 * eth_call gas param).
 *
 * ── Verification protocol ───────────────────────────────────────────
 *
 *   1. Current code (`gasLimit: 12_000_000`): assertion passes
 *      with `gas = 12,000,000` (0xB71B00).
 *
 *   2. Mutate `src/utils/FutarchyQuoteHelper.js:50` back to the
 *      pre-fix value `gasLimit: 30_000_000` → assertion FAILS
 *      with `gas = 30,000,000 (exceeds Gnosis block cap)`. The
 *      failure trace includes the raw hex.
 *
 *   3. Restore → passes.
 *
 *   4. Without anvil (`HARNESS_NO_ANVIL=1`): scenario SKIPS via
 *      `requiresAnvil`.
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
} from '../fixtures/eth-call-inspector.mjs';

// FutarchyQuoteHelper deployed contract on Gnosis (see
// src/utils/FutarchyQuoteHelper.js:9). The ABI is intentionally
// narrow — only the function this scenario inspects.
const HELPER_ADDRESS = '0xe32bfb3DD8bA4c7F82dADc4982c04Afa90027EFb';

const SIMULATE_QUOTE_ABI = [{
    name: 'simulateQuote',
    type: 'function',
    stateMutability: 'view',
    inputs: [
        { name: 'proposal',      type: 'address' },
        { name: 'isYesPool',     type: 'bool'    },
        { name: 'inputType',     type: 'uint8'   },
        { name: 'amountIn',      type: 'uint256' },
    ],
    outputs: [{
        type: 'tuple',
        components: [
            { name: 'amount0Delta',     type: 'int256'   },
            { name: 'amount1Delta',     type: 'int256'   },
            { name: 'startSqrtPrice',   type: 'uint160'  },
            { name: 'endSqrtPrice',     type: 'uint160'  },
            { name: 'debugReason',      type: 'bytes'    },
            { name: 'isToken0Outcome',  type: 'bool'     },
        ],
    }],
}];

const SIMULATE_QUOTE_SELECTOR = toFunctionSelector(SIMULATE_QUOTE_ABI[0]);

// Synthetic return: zeroed struct. encodeAbiParameters of a single
// tuple yields the same on-wire encoding the contract would return.
// Using a non-zero startSqrtPrice (1e18-ish) would be more
// realistic but risks the page's downstream computation introducing
// flakiness. Zero is safe — the catch is on the call's gas param,
// not the response.
const SYNTHETIC_RETURN_DATA = encodeAbiParameters(
    [{
        type: 'tuple',
        components: [
            { type: 'int256'   },
            { type: 'int256'   },
            { type: 'uint160'  },
            { type: 'uint160'  },
            { type: 'bytes'    },
            { type: 'bool'     },
        ],
    }],
    [[0n, 0n, 0n, 0n, '0x', false]],
);

// Gnosis Chain block gas limit hovers around 17.4M; 17M is a safe
// ceiling that pre-fix 30M clearly exceeds and post-fix 12M
// clearly clears.
const GNOSIS_BLOCK_CAP = 17_000_000;

export default {
    name:        '64-pr53-quoter-gas-cap',
    description: 'Catches PR #53 (lower FutarchyQuoteHelper gasLimit below Gnosis block cap). Mounts /markets/<probe>, intercepts the auto-fired simulateQuote eth_call on HELPER_ADDRESS, parses params[0].gas as hex, asserts every captured value <= 17M (Gnosis block cap). Pre-fix 30M trips the assertion. Extends slice-94 eth_call inspector pattern from `data` field to `gas` field — same KIND (TIME-EVOLUTION + chain-side network shape), new SHAPE (parameter-level inspection of an RPC override).',
    bugShape:    'FutarchyQuoteHelper gasLimit regresses above the Gnosis block cap (~17M): some public RPC endpoints reject eth_call with "Block gas limit exceeded", swap quoter hangs or fails depending on which provider wagmi rotated through, users see "Insufficient liquidity" or empty quote panels',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,
    ciTiers:     ['fork'],

    requiresAnvil: true,

    mocks: (ctx) => {
        ctx.quoterCalls = [];

        const ethCallInterceptor = async (route) => {
            const req = route.request();
            const post = req.postData() || '{}';
            let body;
            try {
                body = JSON.parse(post);
            } catch {
                return route.continue();
            }

            const call = parseEthCallParams(body);
            if (call && sameAddress(call.to, HELPER_ADDRESS)) {
                // The eth_call's gas is in body.params[0].gas
                // (ethers v5 maps tx.gasLimit → params[0].gas
                // when serializing). Hex string like '0xB71B00'.
                const params0 = body?.params?.[0] || {};
                const gasHex = params0.gas;
                const gasDec = typeof gasHex === 'string'
                    ? parseInt(gasHex, 16)
                    : null;
                ctx.quoterCalls.push({
                    gasHex,
                    gasDec,
                    isSimulateQuote: typeof call.data === 'string' &&
                        call.data.toLowerCase().startsWith(
                            SIMULATE_QUOTE_SELECTOR.toLowerCase()
                        ),
                });
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: body.id ?? 1,
                        result: SYNTHETIC_RETURN_DATA,
                    }),
                });
            }

            return route.continue();
        };

        const allRpcUrls = [
            'http://localhost:8546/',
            ...PUBLIC_GNOSIS_RPC_URLS,
        ];
        const rpcRoutes = {};
        for (const rpcUrl of allRpcUrls) {
            rpcRoutes[`${rpcUrl}**`] = ethCallInterceptor;
        }

        return {
            [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
                proposals: [fakeMarketProposalEntity()],
            }),
            [CANDLES_GRAPHQL_URL]: makeSubgraphAwareCandlesHandler({
                marketName: 'Harness probe — quoter gas-cap',
            }),
            ...rpcRoutes,
        };
    },

    assertions: [
        // Sanity: page mounted past chain gate. Reuses the
        // "Trading Pair" anchor that scenarios 10/57 / 60 rely on.
        async (page) => {
            await expect(
                page.getByText(/Trading Pair/i).first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // ShowcaseSwapComponent's `amount = '1'` initial state +
        // `chainId === 100` make the debounced (500ms) quote
        // useEffect fire on mount. Give it 6s slack to:
        //   - resolve config (POOL_CONFIG_YES/NO from subgraph
        //     adapter)
        //   - render the swap component
        //   - debounce 500ms
        //   - dynamic-import FutarchyQuoteHelper + getBestRpc
        //   - issue the eth_call (helper.callStatic.simulateQuote)
        async (page) => {
            await page.waitForTimeout(6000);
        },

        // Catch: every captured simulateQuote eth_call has
        // gas <= Gnosis block cap. At least one call must have
        // been captured.
        async (page, ctx) => {
            const calls = ctx.quoterCalls ?? [];
            const quoteCalls = calls.filter((c) => c.isSimulateQuote);
            if (quoteCalls.length === 0) {
                // Surface a useful diagnostic if zero quote calls
                // were captured: it usually means the swap
                // component didn't mount (config not resolved)
                // OR the RPC URL wasn't routed.
                throw new Error(
                    `Scenario 64 captured ZERO simulateQuote eth_calls to ` +
                    `HELPER_ADDRESS (${HELPER_ADDRESS}). Either the swap ` +
                    `component didn't mount (config resolution failed — ` +
                    `check makeSubgraphAwareCandlesHandler returned the ` +
                    `expected pool/token data) or the page's wagmi provider ` +
                    `routed eth_call to an unmocked URL. ` +
                    `Total eth_calls to HELPER_ADDRESS captured: ${calls.length}.`,
                );
            }
            const overCap = quoteCalls.filter(
                (c) => typeof c.gasDec === 'number' && c.gasDec > GNOSIS_BLOCK_CAP,
            );
            if (overCap.length > 0) {
                const summary = overCap
                    .slice(0, 4)
                    .map((c, i) =>
                        `  ${i + 1}. gas=${c.gasDec.toLocaleString()} (${c.gasHex})`,
                    )
                    .join('\n');
                throw new Error(
                    `Scenario 64 found ${overCap.length} of ${quoteCalls.length} ` +
                    `simulateQuote eth_call(s) with gas > ${GNOSIS_BLOCK_CAP.toLocaleString()} ` +
                    `(Gnosis block cap ~17.4M). PR #53 capped the override at 12M to stay ` +
                    `under all public RPC providers' cap enforcement:\n${summary}`,
                );
            }
        },
    ],

    timeout: 180_000,
};
