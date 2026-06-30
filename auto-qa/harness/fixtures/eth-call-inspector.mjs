/**
 * eth-call-inspector.mjs — slice 94. Decode + inspect `eth_call`
 * RPC requests to known contracts. The slice 90+91+93 trio
 * established TIME-EVOLUTION primitives at the chain layer; this
 * module is the COMPLEMENT at the application layer — it lets
 * scenarios inspect what FUNCTION was called on a contract,
 * not just what RPC method was issued.
 *
 * **Why this is needed for the PR #54 catch**: TwapCountdown's
 * fetchPoolTwap calls `poolContract.getTimepoints([aStart, aEnd])`
 * for the YES + NO pools. Pre-PR-54, the call shape was
 * `getTimepoints([secondsWindow, 0])` — second arg always zero.
 * Post-fix, the second arg is `now - twapEndTimestamp` (positive
 * for ended proposals).
 *
 * Catching a regression to the pre-fix shape requires:
 *   1. Intercepting the eth_call HTTP request via Playwright's
 *      context.route on the anvil URL.
 *   2. Parsing the eth_call params to find the `to` and `data`
 *      fields.
 *   3. Decoding `data`: first 4 bytes = function selector;
 *      remaining bytes = ABI-encoded arguments.
 *   4. For `getTimepoints(uint32[])`: extracting the secondsAgos
 *      array as JavaScript numbers.
 *   5. Asserting `args[1] > 0` for an ended proposal — would
 *      fail under the pre-fix shape (always 0).
 *
 * This module covers steps 3-4. Step 1-2 happen in the route
 * handler the scenario installs; step 5 is the scenario's
 * assertion.
 *
 * **Why viem rather than ethers**: the harness already depends on
 * viem (per `package.json`). Bringing ethers would add ~250 KB of
 * additional dependency for one function. viem's
 * `decodeFunctionData` does exactly what we need.
 *
 * **Scope discipline**: this module ONLY covers the eth_call
 * decoding path for the contracts the harness needs to inspect.
 * Generalizing to a full ABI registry across all of Gnosis
 * mainnet is out of scope — we'd be reimplementing etherscan.
 */

import {
    decodeFunctionData,
    toFunctionSelector,
    getAddress,
    isAddress,
    isHex,
    encodeAbiParameters,
    decodeAbiParameters,
} from 'viem';

// ── Multicall3 — read-batching contract used by wagmi/viem ──────────

/**
 * Standard Multicall3 contract address. Same on every chain where
 * Multicall3 is deployed (per the canonical deployment). viem's
 * `scheduleMulticall` (in `actions/public/call.js`) auto-batches
 * read-only eth_calls through this contract when
 * `client.batch.multicall` is enabled — which IS the wagmi default
 * for `usePublicClient`. So any scenario that intercepts eth_calls
 * must either (a) match this address with `aggregate3` selector and
 * return a properly-encoded `Result[]`, or (b) return a 64-byte
 * (NOT 32-byte) zero buffer so viem's dynamic-array `setPosition(
 * staticPosition + 32)` doesn't trip on a 32-byte buffer.
 *
 * The 32-byte trap was diagnosed in slice 103: viem's
 * `decodeAbiParameters` for `Result[]` (dynamic) does the
 * "wonder-restore" pattern `cursor.setPosition(staticPosition + 32)`
 * after reading the offset pointer. On a 32-byte buffer
 * (positions 0-31), setPosition(32) trips the cursor's
 * `assertPosition(position > bytes.length - 1)` check. The
 * `PositionOutOfBoundsError` bubbles up wrapped as
 * `CallExecutionError`, which is opaque to the
 * `.catch(() => 0n)` swallows in the consumer code.
 */
export const MULTICALL3_ADDRESS = '0xca11bde05977b3631167028862be2a173976ca11';
export const MULTICALL3_AGGREGATE3_SELECTOR = '0x82ad56cb';

/**
 * Decode an aggregate3 input's inner Call3[] array.
 *
 * @param {`0x${string}`} aggregateData — the full data field of an
 *   eth_call to multicall3 (starts with aggregate3 selector).
 * @returns {Array<{ target: string, allowFailure: boolean, callData: `0x${string}` }> | null}
 */
export function decodeMulticall3Aggregate3(aggregateData) {
    if (
        typeof aggregateData !== 'string' ||
        !aggregateData.toLowerCase().startsWith(MULTICALL3_AGGREGATE3_SELECTOR)
    ) return null;
    try {
        // Strip selector (first 4 bytes / 10 hex chars including 0x)
        const inputs = '0x' + aggregateData.slice(10);
        const [calls] = decodeAbiParameters(
            [{
                type: 'tuple[]',
                components: [
                    { name: 'target',       type: 'address' },
                    { name: 'allowFailure', type: 'bool'    },
                    { name: 'callData',     type: 'bytes'   },
                ],
            }],
            inputs,
        );
        return calls;
    } catch {
        return null;
    }
}

/**
 * Encode a multicall3 aggregate3 RETURN value (Result[] where
 * Result = { bool success, bytes returnData }). Each inner result
 * MUST match the inner-call's expected return shape (caller's
 * responsibility).
 *
 * @param {Array<{ success: boolean, returnData: `0x${string}` }>} results
 * @returns {`0x${string}`}
 */
export function encodeMulticall3Returns(results) {
    return encodeAbiParameters(
        [{
            type: 'tuple[]',
            components: [
                { name: 'success',    type: 'bool'  },
                { name: 'returnData', type: 'bytes' },
            ],
        }],
        [results],
    );
}

/**
 * Algebra V1 pool — the on-chain contract behind YES/NO conditional
 * pools on Gnosis. The TWAP-relevant function is:
 *
 *   function getTimepoints(uint32[] memory secondsAgos)
 *     external view
 *     returns (
 *       int56[] memory tickCumulatives,
 *       uint160[] memory secondsPerLiquidityCumulatives,
 *       uint112[] memory volatilityCumulatives,
 *       uint144[] memory volumePerLiquidityCumulatives
 *     );
 *
 * Selector: keccak256("getTimepoints(uint32[])").slice(0, 4) =
 * `0x9d3a5241` (verified via `cast sig "getTimepoints(uint32[])"`
 * and pinned in smoke-eth-call-inspector tests).
 *
 * The narrow ABI here covers ONLY this function. A future slice
 * can extend to `swap`, `mint`, etc. if those become assertion
 * targets.
 */
export const ALGEBRA_POOL_TIMEPOINTS_ABI = [
    {
        name: 'getTimepoints',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'secondsAgos', type: 'uint32[]' },
        ],
        outputs: [
            { name: 'tickCumulatives', type: 'int56[]' },
            { name: 'secondsPerLiquidityCumulatives', type: 'uint160[]' },
            { name: 'volatilityCumulatives', type: 'uint112[]' },
            { name: 'volumePerLiquidityCumulatives', type: 'uint144[]' },
        ],
    },
];

export const ALGEBRA_POOL_TIMEPOINTS_SELECTOR = toFunctionSelector(
    ALGEBRA_POOL_TIMEPOINTS_ABI[0],
);

/**
 * Parse a JSON-RPC body and return the `eth_call` params if it's
 * an eth_call, else null. Handles batch requests by inspecting
 * only the FIRST entry — batch eth_calls are rare in the wallet
 * stub's call patterns; widen to map-over-batch if a scenario
 * actually needs it.
 *
 * @param {object} body — parsed JSON-RPC request body
 * @returns {{ to: string, data: string } | null}
 */
export function parseEthCallParams(body) {
    if (!body || body.method !== 'eth_call') return null;
    const params = Array.isArray(body.params) ? body.params : null;
    if (!params || params.length === 0) return null;
    const call = params[0];
    if (!call || typeof call !== 'object') return null;
    if (typeof call.to !== 'string' || typeof call.data !== 'string') return null;
    if (!isAddress(call.to) || !isHex(call.data)) return null;
    return { to: call.to, data: call.data };
}

/**
 * Decode an eth_call's `data` field against a known ABI. Returns
 * `{ functionName, args }` on success, `null` on selector
 * mismatch / decode error. Use a try/catch on the call site to
 * distinguish "not the function I'm watching for" from "data was
 * malformed."
 *
 * @param {`0x${string}`} data — eth_call's data field
 * @param {Array} abi — function ABI (single-entry array is fine)
 * @returns {{ functionName: string, args: readonly unknown[] } | null}
 */
export function decodeEthCallData(data, abi) {
    if (!isHex(data) || data.length < 10) return null;
    try {
        const decoded = decodeFunctionData({ abi, data });
        return { functionName: decoded.functionName, args: decoded.args };
    } catch {
        return null;
    }
}

/**
 * Specialized decoder for the Algebra pool's getTimepoints call.
 * Returns the `secondsAgos` array as plain JavaScript numbers
 * (uint32 fits comfortably in JS Number; no BigInt needed).
 *
 * Returns null if:
 *   - the data doesn't start with the getTimepoints selector
 *   - viem can't decode the rest
 *
 * Use this in scenarios over the generic decoder when you're
 * narrowly targeting TWAP-window assertions — the typed return
 * makes the assertion code less noisy.
 *
 * @param {`0x${string}`} data
 * @returns {number[] | null}
 */
export function decodeGetTimepointsArgs(data) {
    if (typeof data !== 'string') return null;
    // Cheap pre-check: avoid kicking decodeFunctionData unless the
    // selector matches.
    if (!data.toLowerCase().startsWith(ALGEBRA_POOL_TIMEPOINTS_SELECTOR.toLowerCase())) {
        return null;
    }
    const decoded = decodeEthCallData(data, ALGEBRA_POOL_TIMEPOINTS_ABI);
    if (!decoded || decoded.functionName !== 'getTimepoints') return null;
    const [secondsAgos] = decoded.args;
    if (!Array.isArray(secondsAgos)) return null;
    // viem returns uint32 as regular numbers; defensively coerce
    // in case a future viem version switches to bigint.
    return secondsAgos.map((v) => (typeof v === 'bigint' ? Number(v) : Number(v)));
}

/**
 * Address-match helper. Compares two address strings case-
 * insensitively. Use when a scenario records eth_calls and needs
 * to filter by contract.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function sameAddress(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    try {
        return getAddress(a) === getAddress(b);
    } catch {
        return false;
    }
}
