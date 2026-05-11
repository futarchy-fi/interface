/**
 * fork-state.mjs — primitives for setting up forked-anvil state.
 *
 * Phase 7 fork-bootstrap steps 2 + 2.5. Where step 1 wired anvil
 * into Playwright's `webServer` block (so `npm run ui:full` spins
 * up a Gnosis fork at port 8546), this module provides the helpers
 * a scenario or globalSetup hook calls to FUND addresses, mint
 * conditional-token positions, and otherwise put the fork into a
 * scenario-relevant state before the page navigates.
 *
 * **Scope** (so far):
 *   - Step 2: low-level JSON-RPC primitives (anvilRpc, toHex,
 *     setEthBalance, getEthBalance, impersonateAndSend, getChainId)
 *   - Step 2.5 (this slice): ERC20 storage-write primitives
 *     (setStorageAt, setErc20Balance, getErc20Balance) +
 *     `fundWalletWithSDAI()` wrapper for sDAI specifically
 *
 * Higher-level setups still pending (mint-conditional-position via
 * the futarchy router) layer on top of these in subsequent slices.
 *
 * **viem usage**: pulled in for ABI encoding + keccak256 only —
 * no wallet client, no provider object. Already available via
 * wallet-stub.mjs which depends on viem/accounts.
 */

import {
    encodeAbiParameters,
    encodeFunctionData,
    decodeFunctionResult,
    keccak256,
    pad,
    toHex as viemToHex,
} from 'viem';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Step 10: bumped from 5s. When the anvil RPC proxy is forwarding
// page traffic (many concurrent eth_calls) AND a fixture issues a
// mid-test mutation (anvil_setStorageAt, eth_call, etc.), anvil
// serializes them all. A primitive that lands behind a backlog of
// queued eth_calls can take 10-20s to acknowledge — well past the
// old 5s default. 30s is the same ceiling step 9 used for the
// snapshot/revert primitives.
const DEFAULT_TIMEOUT_MS = 30_000;

// Step 13 added MUTATION_TIMEOUT_MS = 60s for setStorageAt with
// the queue-backlog hypothesis. Step 21 replaced that with
// SETSTORAGE_PER_ATTEMPT_MS (30s) + retry, after step 20's probe
// proved that anvil silently DROPS the request rather than queues
// it — longer per-attempt waits don't help; multiple shorter
// attempts with read-back verification do. Constant kept removed
// to avoid future drift between the two timeout regimes.

// ── Token constants (Gnosis chain) ──
//
// sDAI ERC20 token on Gnosis (chain 100) — the Savings xDai vault.
// **DISTINCT** from the sDAI RATE PROVIDER at
// 0x89C80A4540A00b5270347E02e2E144c71da2EceD which is what the
// api-side rateSanity invariant calls `getRate()` on. The rate
// provider doesn't have a `balanceOf` function — calling it would
// revert. This token address is what scenarios should fund.
//
// Step 2.6 verified via live anvil: `symbol()` returns "sDAI",
// `balanceOf(0xf39F…)` returns 0 by default, suitable for a clean
// post-write check.
export const SDAI_TOKEN_GNOSIS_ADDRESS = '0xaf204776c7245bF4147c2612BF6e5972Ee483701';

// Storage slot index for sDAI's `_balances` mapping. Verified via
// the live-anvil probe loop in `step 2.6` — slot N (TBD by the
// probe). Re-derive when sDAI's contract upgrades by running:
//   anvil --fork-url <gnosis-rpc> --port 8546 &
//   node -e "import('./fixtures/fork-state.mjs').then(m => …probeSlot…)"
// The smoke tests below DON'T depend on this constant being right
// (they use parametric slot indices), only `fundWalletWithSDAI()`
// does at runtime.
export const SDAI_BALANCE_SLOT = 0; // PROVISIONAL — re-verifying live below

// Gnosis ConditionalTokens framework — same address `contracts.js`
// uses for `CONDITIONAL_TOKENS_ADDRESS`. This is the standard Gnosis
// CT contract (CTF-1.x). Position IDs are derived from
// (collateralToken, collectionId(parentCollectionId, conditionId,
// indexSet)) — the helpers below call the contract directly rather
// than reimplementing the formula in JS, since the formula's exact
// encoding (packed vs encoded, ordering, parent-collection
// arithmetic) is non-trivial and contract-version-sensitive.
export const CT_GNOSIS_ADDRESS = '0xCeAfDD6bc0bEF976fdCd1112955828E00543c0Ce';

// Storage slot index for ConditionalTokens' `_balances` mapping
// (`mapping(uint256 => mapping(address => uint256))`). Live-verified
// in step 2.8: NOT slot 0 (Gnosis CT inherits a base that uses
// slot 0 for something else); the actual `_balances` is at slot 1.
// Re-derive when CT upgrades by running:
//   anvil --fork-url <gnosis-rpc> --port 8546 &
//   node -e "import('./fixtures/fork-state.mjs').then(m => /* probe loop */)"
export const CT_BALANCE_SLOT = 1;

// Empty parentCollectionId (top-level collection). Most futarchy
// positions live at the top level; nested collections are for
// multi-condition products which the harness doesn't currently
// exercise.
export const EMPTY_COLLECTION_ID = `0x${'00'.repeat(32)}`;

/**
 * Position IDs that `src/hooks/useContractConfig.js` returns as
 * `MERGE_CONFIG.{currency,company}Positions.{yes,no}.positionId`
 * in the GIP-145 fallback path. These literals are hard-coded in
 * the hook (lines 400/408/418/426); the harness funds wallet
 * positions at these IDs in globalSetup so the page sees non-zero
 * balances. Step 12+ scenarios mutate these IDs directly to
 * exercise position-side change-detection.
 *
 * DO NOT confuse these with `deriveYesNoPositionIds()` output —
 * that derives IDs from the LIVE `proposal.conditionId()` call,
 * which produces a DIFFERENT set of IDs (the hook hard-codes
 * production GIP-145 values from a different collateral
 * derivation; ours derives from MARKET_PROBE_ADDRESS on the
 * fork).
 */
export const HOOK_FALLBACK_POSITION_IDS = {
    currencyYes: '0x0da8ddb6e1511c1b897fa0fdabac151efbe8a6a1cee0d042035a10bd8ca50566',
    currencyNo:  '0xc493e87c029b70d6dd6a58ea51d2bb5e7c5e19a61833547e3f3876242665b501',
    companyYes:  '0x15883231add67852d8d5ae24898ec21779cc1a99897a520f12ba52021266e218',
    companyNo:   '0x50b02574e86d37993b7a6ebd52414f9deea42ecfe9c3f1e8556a6d91ead41cc7',
};

/**
 * Contract addresses the page reads during normal load. Pre-warming
 * anvil's bytecode cache for these (via `eth_getCode`) eliminates the
 * cold-start cascade documented in step 13: anvil's first read of an
 * uncached contract requires an upstream RPC fetch (~1s each on
 * gnosis.gateway.fm), and a burst of those during scenario load can
 * back up the request queue enough to time out a mid-test mutation.
 *
 * The list MUST stay in sync with what the page actually touches —
 * adding a new contract to `src/hooks/useContractConfig.js`'s
 * `MERGE_CONFIG` defaults or `BASE_TOKENS_CONFIG` defaults requires
 * adding it here too. Discover via:
 *   tail -100 /tmp/anvil.log | awk '/eth_call/{print}' | sort -u
 * after a cold scenario run.
 *
 * sDAI + CT + MARKET_PROBE_ADDRESS are NOT in this list — globalSetup
 * already warms them via the funding step's setStorageAt + readback +
 * conditionId calls.
 */
export const PAGE_CONTRACT_ADDRESSES = [
    // GNO (real Gnosis token; companyToken default in
    // useContractConfig.js:315)
    '0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb',
    // YES_sDAI wrap (currencyPositions.yes.wrap)
    '0x2301e71f6c6dc4f8d906772f0551e488dd007a99',
    // NO_sDAI wrap (currencyPositions.no.wrap)
    '0xb9d258c84589d47d9c4cab20a496255556337111',
    // YES_GNO wrap (companyPositions.yes.wrap)
    '0xb28dbe5cd5168d2d94194eb706eb6bcd81edb04e',
    // NO_GNO wrap (companyPositions.no.wrap)
    '0xad34b43712588fa57d80e76c5c2bcbd274bdb5c0',
    // sDAI rate provider (read by useSdaiRate)
    '0x89C80A4540A00b5270347E02e2E144c71da2EceD',
    // Futarchy router (FUTARCHY_ROUTER_ADDRESS default)
    '0x7495a583ba85875d59407781b4958ED6e0E1228f',
    // Wrapper service (WRAPPER_SERVICE_ADDRESS default)
    '0xc14f5d2B9d6945EF1BA93f8dB20294b90FA5b5b1',
    // FutarchyQuoteHelper (HELPER_ADDRESS in
    // src/utils/FutarchyQuoteHelper.js — read every poll cycle for
    // quote calculations). Discovered via the step 16 trace probe
    // which captured the page's actual eth_call addresses.
    '0xe32bfb3DD8bA4c7F82dADc4982c04Afa90027EFb',
];

/**
 * Subset of `PAGE_CONTRACT_ADDRESSES` that implement ERC20 (have a
 * `balanceOf` function). Used by `warmErc20Balances` to warm slot
 * caches; the non-ERC20 entries (rate provider, router, wrapper
 * service) revert on `balanceOf` calls and are warmed by bytecode
 * fetch only.
 */
export const PAGE_ERC20_ADDRESSES = [
    '0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb', // GNO
    '0x2301e71f6c6dc4f8d906772f0551e488dd007a99', // YES_sDAI wrap
    '0xb9d258c84589d47d9c4cab20a496255556337111', // NO_sDAI wrap
    '0xb28dbe5cd5168d2d94194eb706eb6bcd81edb04e', // YES_GNO wrap
    '0xad34b43712588fa57d80e76c5c2bcbd274bdb5c0', // NO_GNO wrap
];

// Standard ERC20 + ERC1155 ABI fragments — minimal surface for
// read/write helpers. Keeping fragments inline avoids a separate
// ABI file and makes the helpers self-contained.
const ERC20_BALANCE_OF_ABI = [{
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
}];

const ERC1155_BALANCE_OF_ABI = [{
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [
        { name: 'account', type: 'address' },
        { name: 'id',      type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
}];

const CT_GET_COLLECTION_ID_ABI = [{
    type: 'function',
    name: 'getCollectionId',
    stateMutability: 'view',
    inputs: [
        { name: 'parentCollectionId', type: 'bytes32' },
        { name: 'conditionId',        type: 'bytes32' },
        { name: 'indexSet',           type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
}];

const CT_GET_POSITION_ID_ABI = [{
    type: 'function',
    name: 'getPositionId',
    stateMutability: 'pure',
    inputs: [
        { name: 'collateralToken', type: 'address' },
        { name: 'collectionId',    type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
}];

const FUTARCHY_PROPOSAL_CONDITION_ID_ABI = [{
    type: 'function',
    name: 'conditionId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
}];

/**
 * Send a raw JSON-RPC request to an anvil endpoint and return the
 * `result` field (or throw on RPC error / network failure).
 *
 * @param {string} rpcUrl
 * @param {string} method
 * @param {unknown[]} [params=[]]
 * @param {number} [timeoutMs]
 * @returns {Promise<unknown>}
 */
export async function anvilRpc(rpcUrl, method, params = [], timeoutMs = DEFAULT_TIMEOUT_MS) {
    const ctrl = new AbortController();
    let abortReason = null;
    const t = setTimeout(() => { abortReason = `client timeout after ${timeoutMs}ms`; ctrl.abort(); }, timeoutMs);
    const startedAt = Date.now();
    try {
        const r = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
            signal: ctrl.signal,
        });
        if (!r.ok) {
            throw new Error(`${rpcUrl} → HTTP ${r.status}`);
        }
        const j = await r.json();
        if (j.error) {
            throw new Error(`RPC error (${method}): ${JSON.stringify(j.error)}`);
        }
        return j.result;
    } catch (err) {
        const elapsed = Date.now() - startedAt;
        // Surface the actual cause: client-side timeout vs anything
        // else (host abort by Playwright / network reset / etc).
        // The bare "AbortError: This operation was aborted" message
        // doesn't distinguish them, which made step 10 debugging
        // hard.
        if (err.name === 'AbortError') {
            throw new Error(
                `[fork-state] anvilRpc(${method}) aborted after ${elapsed}ms ` +
                `(${abortReason ?? 'host-aborted, NOT our timeout'})`,
                { cause: err },
            );
        }
        throw err;
    } finally {
        clearTimeout(t);
    }
}

/**
 * Convert a JS number / bigint / string-decimal to a 0x-prefixed
 * hex string. Anvil's RPC accepts 0x-hex for amounts; passing a
 * plain decimal string fails with a parse error.
 */
export function toHex(value) {
    if (typeof value === 'bigint') return `0x${value.toString(16)}`;
    if (typeof value === 'number') {
        if (!Number.isInteger(value) || value < 0) {
            throw new Error(`toHex: number must be non-negative integer (got ${value})`);
        }
        return `0x${value.toString(16)}`;
    }
    if (typeof value === 'string') {
        if (value.startsWith('0x')) return value;
        return `0x${BigInt(value).toString(16)}`;
    }
    throw new Error(`toHex: unsupported type ${typeof value}`);
}

/**
 * Set an address's ETH balance via `anvil_setBalance`. Note: anvil's
 * default 10 dev accounts are already pre-funded with 10000 ETH —
 * this helper is for funding ARBITRARY addresses (e.g., a probe-
 * specific account, an impersonated whale, etc.).
 *
 * @param {string}        rpcUrl
 * @param {`0x${string}`} address
 * @param {bigint|number|string} amountWei  — hex-able value
 */
export async function setEthBalance(rpcUrl, address, amountWei) {
    return anvilRpc(rpcUrl, 'anvil_setBalance', [address, toHex(amountWei)]);
}

/**
 * Read an address's current ETH balance via `eth_getBalance`.
 * Returns a bigint (parsed from the 0x-hex result).
 */
export async function getEthBalance(rpcUrl, address) {
    const hex = await anvilRpc(rpcUrl, 'eth_getBalance', [address, 'latest']);
    return BigInt(hex);
}

/**
 * Read contract bytecode at `address` via `eth_getCode`. Returns the
 * raw 0x-hex string (`0x` for an EOA / undeployed address). On a
 * forked anvil, the FIRST call for an address fetches from the
 * upstream RPC (~1s on cold gnosis.gateway.fm) and caches the
 * result; subsequent calls are microseconds. Used by
 * `warmContractCache` to pre-populate anvil's bytecode cache before
 * tests run.
 */
export async function getCode(rpcUrl, address) {
    return anvilRpc(rpcUrl, 'eth_getCode', [address, 'latest']);
}

/**
 * Pre-warm anvil's bytecode cache for a list of contract addresses.
 * Issues `eth_getCode` for each address in parallel — anvil's
 * upstream-fetch latency adds up if done serially (~1s × N
 * addresses), but parallel fetches let anvil pipeline the upstream
 * requests. Returns the count of addresses warmed.
 *
 * Errors are TOLERATED (not thrown) — a single contract that 404s
 * upstream shouldn't fail globalSetup. Logs a one-line warning
 * for each failure so the maintainer can update the warm-list if
 * an address moved.
 *
 * @param {string} rpcUrl
 * @param {ReadonlyArray<`0x${string}`>} addresses
 * @returns {Promise<number>} count of successfully warmed addresses
 */
export async function warmContractCache(rpcUrl, addresses) {
    const results = await Promise.allSettled(
        addresses.map((a) => getCode(rpcUrl, a)),
    );
    let successCount = 0;
    for (const [i, r] of results.entries()) {
        if (r.status === 'fulfilled') {
            successCount++;
        } else {
            console.warn(`[fork-state] warmContractCache: ${addresses[i]} failed: ${r.reason?.message ?? r.reason}`);
        }
    }
    return successCount;
}

/**
 * Pre-warm anvil's storage cache for `holder`'s `balanceOf` slot at
 * each ERC20 token in `tokens`. Step 15 found that warming JUST the
 * bytecode (`warmContractCache`) wasn't enough — anvil's first read
 * of a STORAGE slot still falls through to upstream RPC. Issuing the
 * same balanceOf eth_call the page eventually does primes both the
 * bytecode AND the slot.
 *
 * Returns the count of tokens warmed.
 *
 * @param {string} rpcUrl
 * @param {ReadonlyArray<`0x${string}`>} tokens
 * @param {`0x${string}`} holder
 */
export async function warmErc20Balances(rpcUrl, tokens, holder) {
    const results = await Promise.allSettled(
        tokens.map((t) => getErc20Balance(rpcUrl, t, holder)),
    );
    let successCount = 0;
    for (const [i, r] of results.entries()) {
        if (r.status === 'fulfilled') {
            successCount++;
        } else {
            console.warn(`[fork-state] warmErc20Balances: ${tokens[i]} failed: ${r.reason?.message ?? r.reason}`);
        }
    }
    return successCount;
}

/**
 * Impersonate `fromAddress` for ONE transaction send, then stop
 * impersonating — gives the caller a clean RAII-ish wrapper around
 * the impersonate / sendTransaction / stop pattern. The eth_call
 * is `eth_sendTransaction` rather than `eth_sendRawTransaction`
 * because the impersonated account doesn't have a private key
 * the harness controls.
 *
 * @param {string} rpcUrl
 * @param {`0x${string}`} fromAddress
 * @param {{to: `0x${string}`, data?: `0x${string}`, value?: bigint|number|string, gas?: bigint|number|string}} tx
 * @returns {Promise<`0x${string}`>}  tx hash
 */
export async function impersonateAndSend(rpcUrl, fromAddress, tx) {
    await anvilRpc(rpcUrl, 'anvil_impersonateAccount', [fromAddress]);
    try {
        const txArg = {
            from: fromAddress,
            to:   tx.to,
            ...(tx.data  != null ? { data:  tx.data  } : {}),
            ...(tx.value != null ? { value: toHex(tx.value) } : {}),
            ...(tx.gas   != null ? { gas:   toHex(tx.gas)   } : {}),
        };
        return await anvilRpc(rpcUrl, 'eth_sendTransaction', [txArg]);
    } finally {
        // Always stop impersonating, even if send failed. Leaving an
        // account impersonated leaks state into the next scenario.
        await anvilRpc(rpcUrl, 'anvil_stopImpersonatingAccount', [fromAddress]).catch(() => {});
    }
}

/**
 * Probe-only — returns the chain id reported by anvil (no state
 * change). Useful as a connectivity check before doing real setup.
 *
 * @returns {Promise<number>}
 */
export async function getChainId(rpcUrl) {
    const hex = await anvilRpc(rpcUrl, 'eth_chainId', []);
    return Number(BigInt(hex));
}

// ── Step 2.5: ERC20 storage-write primitives ──

/**
 * Write a 32-byte value to a specific storage slot of a contract
 * via `anvil_setStorageAt`. Lowest-level state mutation; callers
 * compute the slot themselves (or use one of the helpers below).
 *
 * **Step 21**: write-then-verify-then-retry. Step 20's read-back
 * probe proved that anvil silently drops some `anvil_setStorageAt`
 * requests under cold-cache load — request is logged but the slot
 * isn't mutated, and our client times out waiting for a response
 * that never comes. Reads remain responsive throughout. The fix:
 * after each `anvil_setStorageAt` (or each timeout), read the slot
 * back via `eth_getStorageAt` and confirm the value landed; if
 * not, retry. Up to `SETSTORAGE_MAX_ATTEMPTS` total attempts with
 * exponential backoff between them.
 *
 * Per-attempt timeout is shorter than `MUTATION_TIMEOUT_MS`
 * (`SETSTORAGE_PER_ATTEMPT_MS`) so that 3 failing attempts fit
 * comfortably under a single Playwright test's 120-180s budget.
 * Failure mode is preserved (still throws if all attempts fail).
 *
 * @param {string} rpcUrl
 * @param {`0x${string}`} address       contract address
 * @param {`0x${string}`|bigint|number} slot  storage slot index
 *                                            (passed through toHex)
 * @param {`0x${string}`|bigint} value  32-byte value (left-padded
 *                                      automatically if shorter)
 * @returns {Promise<void>}
 */
const SETSTORAGE_MAX_ATTEMPTS = 3;
const SETSTORAGE_PER_ATTEMPT_MS = 30_000;
export async function setStorageAt(rpcUrl, address, slot, value) {
    const slotHex = typeof slot === 'string' && slot.startsWith('0x')
        ? slot
        : toHex(slot);
    const valueHex = typeof value === 'string' && value.startsWith('0x')
        ? pad(value, { size: 32 })
        : pad(viemToHex(value), { size: 32 });
    // Normalize value to bigint for read-back equality. Accepts
    // both `0x...` hex strings and bigints; viem's pad/toHex on a
    // bigint round-trips through hex cleanly.
    const expected = typeof value === 'bigint'
        ? value
        : BigInt(value);

    let lastErr = null;
    for (let attempt = 1; attempt <= SETSTORAGE_MAX_ATTEMPTS; attempt++) {
        try {
            await anvilRpc(
                rpcUrl,
                'anvil_setStorageAt',
                [address, slotHex, valueHex],
                SETSTORAGE_PER_ATTEMPT_MS,
            );
            // Read-back: anvil_setStorageAt returns success but
            // (per step 20 diagnostic) the slot may not actually
            // be mutated. Confirm by reading the slot.
            const actualHex = await anvilRpc(
                rpcUrl,
                'eth_getStorageAt',
                [address, slotHex, 'latest'],
            );
            const actual = BigInt(actualHex);
            if (actual === expected) {
                if (attempt > 1) {
                    console.log(
                        `[fork-state] setStorageAt(${address}, slot=${slotHex.slice(0, 10)}…) ` +
                        `succeeded on attempt ${attempt}/${SETSTORAGE_MAX_ATTEMPTS}`,
                    );
                }
                return;
            }
            console.warn(
                `[fork-state] setStorageAt write didn't land on attempt ${attempt}/${SETSTORAGE_MAX_ATTEMPTS} ` +
                `(wrote ${valueHex}, read 0x${actual.toString(16).padStart(64, '0')}); retrying`,
            );
            lastErr = new Error(
                `setStorageAt silent drop on attempt ${attempt}: wrote ${valueHex} read 0x${actual.toString(16)}`,
            );
        } catch (err) {
            console.warn(
                `[fork-state] setStorageAt attempt ${attempt}/${SETSTORAGE_MAX_ATTEMPTS} ` +
                `threw: ${err.message}; retrying`,
            );
            lastErr = err;
        }
        // Exponential backoff: attempt 1 → 1s, attempt 2 → 2s.
        // Gives anvil's worker pool time to recover between hits.
        if (attempt < SETSTORAGE_MAX_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
    }
    throw new Error(
        `[fork-state] setStorageAt(${address}, slot=${slotHex}) failed after ${SETSTORAGE_MAX_ATTEMPTS} attempts. ` +
        `Last error: ${lastErr?.message ?? 'unknown'}`,
        { cause: lastErr },
    );
}

/**
 * Compute the storage key for `mapping(address => uint256)` at a
 * given mapping slot. Solidity layout: keccak256(abi.encode(key,
 * mapping_slot)). Used by `setErc20Balance` (and any future
 * `setErc1155Balance` etc.).
 *
 * @param {`0x${string}`} addressKey  the address used as map key
 * @param {bigint|number} mappingSlot the mapping's slot in the contract
 * @returns {`0x${string}`}
 */
export function mappingStorageKey(addressKey, mappingSlot) {
    const encoded = encodeAbiParameters(
        [{ type: 'address' }, { type: 'uint256' }],
        [addressKey, BigInt(mappingSlot)],
    );
    return keccak256(encoded);
}

/**
 * Set an ERC20 `balanceOf(holder)` result by writing directly to
 * the contract's `_balances` mapping storage slot. Faster +
 * deterministic vs the impersonate-a-whale approach; works as
 * long as the caller knows the right `_balances` slot index for
 * the token.
 *
 * **Caveat**: doesn't update `_totalSupply` — token contracts that
 * also expose `totalSupply()` will report a value inconsistent
 * with the sum of balances. Most app code reads `balanceOf`
 * directly so this is rarely a problem; flag if a scenario
 * specifically exercises totalSupply paths.
 *
 * @param {string} rpcUrl
 * @param {`0x${string}`} token
 * @param {`0x${string}`} holder
 * @param {bigint|number|string} amount  raw token units (no decimals
 *                                       conversion; caller scales)
 * @param {bigint|number} [slot=0]       mapping slot index (varies
 *                                       per contract — OpenZeppelin
 *                                       defaults to 0; verify with
 *                                       `cast storage <token> <slot>`
 *                                       if uncertain)
 * @returns {Promise<unknown>}
 */
export async function setErc20Balance(rpcUrl, token, holder, amount, slot = 0) {
    const key = mappingStorageKey(holder, slot);
    return setStorageAt(rpcUrl, token, key, BigInt(amount));
}

/**
 * Read an ERC20 balance via `eth_call` (proper `balanceOf(address)`
 * call, not a storage read). Returns a bigint.
 *
 * Use as the verification step after `setErc20Balance` — if the
 * write went to the wrong slot, the eth_call will return the
 * UNCHANGED on-chain value, surfacing the slot mismatch loudly.
 *
 * @param {string} rpcUrl
 * @param {`0x${string}`} token
 * @param {`0x${string}`} holder
 * @returns {Promise<bigint>}
 */
export async function getErc20Balance(rpcUrl, token, holder) {
    const data = encodeFunctionData({
        abi:          ERC20_BALANCE_OF_ABI,
        functionName: 'balanceOf',
        args:         [holder],
    });
    const result = await anvilRpc(rpcUrl, 'eth_call', [
        { to: token, data },
        'latest',
    ]);
    const decoded = decodeFunctionResult({
        abi:          ERC20_BALANCE_OF_ABI,
        functionName: 'balanceOf',
        data:         result,
    });
    return decoded;
}

/**
 * Convenience wrapper for sDAI on Gnosis. Defaults to 1000 sDAI
 * (1e18 × 1000), enough for most market-page scenarios that need
 * collateral but not stress-testing.
 *
 * **Reminder**: `SDAI_BALANCE_SLOT` is a best-guess constant
 * (typically 0 for OpenZeppelin-derived ERC20s). If a scenario
 * fails because `getErc20Balance` returns 0 immediately after
 * `fundWalletWithSDAI`, the slot is wrong — re-derive via
 * `cast storage 0x89C8...EceD <addr> <slot>` and update the
 * constant.
 *
 * @param {string} rpcUrl
 * @param {`0x${string}`} holder
 * @param {bigint} [amountWei=1000e18]
 * @returns {Promise<unknown>}
 */
export async function fundWalletWithSDAI(rpcUrl, holder, amountWei = 1000n * 10n ** 18n) {
    return setErc20Balance(rpcUrl, SDAI_TOKEN_GNOSIS_ADDRESS, holder, amountWei, SDAI_BALANCE_SLOT);
}

// ── Step 2.7: ERC1155 storage-write primitives ──

/**
 * Compute the storage key for `mapping(K1 => mapping(K2 => V))`
 * at a given outer slot, accessing position [outerKey][innerKey].
 *
 * Solidity layout (for outer slot S):
 *   inner_slot   = keccak256(abi.encode(outerKey, S))
 *   actual_slot  = keccak256(abi.encode(innerKey, inner_slot))
 *
 * The argument order matches the access pattern `[outerKey][innerKey]`
 * — same as Solidity. **`outerKeyType` and `innerKeyType` are
 * required** because the inner mapping's key type changes the
 * abi.encode padding (uint256 stays 32 bytes, address pads to
 * 32 bytes left-aligned — both happen to encode identically here,
 * but typing it explicitly future-proofs against bytes32 vs
 * smaller-uint mismatches).
 *
 * @param {`0x${string}`|bigint|number} outerKey
 * @param {`0x${string}`|bigint|number} innerKey
 * @param {bigint|number} outerSlot
 * @param {'address'|'uint256'} outerKeyType
 * @param {'address'|'uint256'} innerKeyType
 * @returns {`0x${string}`}
 */
export function nestedMappingStorageKey(
    outerKey, innerKey, outerSlot,
    outerKeyType = 'uint256', innerKeyType = 'address',
) {
    const innerEncoded = encodeAbiParameters(
        [{ type: outerKeyType }, { type: 'uint256' }],
        [coerceForType(outerKey, outerKeyType), BigInt(outerSlot)],
    );
    const innerSlot = keccak256(innerEncoded);

    const valueEncoded = encodeAbiParameters(
        [{ type: innerKeyType }, { type: 'uint256' }],
        [coerceForType(innerKey, innerKeyType), BigInt(innerSlot)],
    );
    return keccak256(valueEncoded);
}

// Coerce JS values to the runtime types viem's encodeAbiParameters
// expects. Address params want 0x-prefixed strings; uint params want
// bigint.
function coerceForType(v, type) {
    if (type === 'address') {
        if (typeof v !== 'string' || !v.startsWith('0x')) {
            throw new Error(`coerceForType(address): expected 0x-string, got ${typeof v}`);
        }
        return v;
    }
    if (type === 'uint256') {
        return BigInt(v);
    }
    throw new Error(`coerceForType: unsupported type ${type}`);
}

/**
 * Set an ERC1155 `balanceOf(holder, tokenId)` result by writing
 * directly to the contract's `_balances` mapping storage. Sister
 * to `setErc20Balance`; the difference is the nested mapping
 * (`mapping(uint256 => mapping(address => uint256))` vs ERC20's
 * single `mapping(address => uint256)`).
 *
 * **Caveat** (same as ERC20 sister): doesn't update event logs or
 * any auxiliary supply/balance trackers the contract may maintain.
 * For OpenZeppelin's standard ERC1155, only `_balances` and the
 * `TransferSingle` event matter for downstream reads — and the
 * event isn't emitted from a storage write, so app code that
 * subscribes to `TransferSingle` will miss this funding. Use
 * impersonate-and-mint via the contract's own `mint` function if
 * a scenario specifically asserts on event subscriptions.
 *
 * @param {string} rpcUrl
 * @param {`0x${string}`} contract
 * @param {`0x${string}`} holder
 * @param {bigint|number|string} tokenId  ERC1155 position id
 * @param {bigint|number|string} amount
 * @param {bigint|number} [slot=0]  outer mapping slot index
 * @returns {Promise<unknown>}
 */
export async function setErc1155Balance(rpcUrl, contract, holder, tokenId, amount, slot = 0) {
    // ERC1155 layout: mapping(tokenId => mapping(account => balance))
    // outerKey = tokenId, innerKey = holder
    const key = nestedMappingStorageKey(
        tokenId, holder, slot,
        /* outerKeyType */ 'uint256',
        /* innerKeyType */ 'address',
    );
    return setStorageAt(rpcUrl, contract, key, BigInt(amount));
}

/**
 * Read an ERC1155 balance via `eth_call` (proper
 * `balanceOf(address, uint256)` call, not a storage read). Returns
 * a bigint.
 *
 * Use as the verification step after `setErc1155Balance` — wrong
 * slot writes show up as the unchanged on-chain balance.
 *
 * @param {string} rpcUrl
 * @param {`0x${string}`} contract
 * @param {`0x${string}`} holder
 * @param {bigint|number|string} tokenId
 * @returns {Promise<bigint>}
 */
export async function getErc1155Balance(rpcUrl, contract, holder, tokenId) {
    const data = encodeFunctionData({
        abi:          ERC1155_BALANCE_OF_ABI,
        functionName: 'balanceOf',
        args:         [holder, BigInt(tokenId)],
    });
    const result = await anvilRpc(rpcUrl, 'eth_call', [
        { to: contract, data },
        'latest',
    ]);
    return decodeFunctionResult({
        abi:          ERC1155_BALANCE_OF_ABI,
        functionName: 'balanceOf',
        data:         result,
    });
}

// ── Step 2.8: ConditionalTokens position-ID helpers ──

/**
 * Call the live ConditionalTokens contract's `getCollectionId`
 * function via eth_call. Returns a bytes32 collection id.
 *
 * **Why we don't reimplement the formula in JS**: the exact
 * encoding (packed vs encoded, ordering, parent-collection
 * arithmetic for nested collections) is non-trivial and
 * contract-version-sensitive. The empirical verification
 * (step 2.8 inline probe) showed that the obvious-looking
 * pure-JS formulas (both `keccak256(encodePacked(...))` and
 * `keccak256(abi.encode(...))`) DON'T match the constants
 * shipped in `src/components/futarchyFi/marketPage/constants/
 * contracts.js` — so trying to maintain the formula in JS
 * is a maintenance liability. eth_call is one round trip and
 * always correct.
 *
 * @param {string} rpcUrl
 * @param {`0x${string}`} parentCollectionId  bytes32 (use
 *                                            EMPTY_COLLECTION_ID
 *                                            for top-level)
 * @param {`0x${string}`} conditionId
 * @param {bigint|number} indexSet  outcome bitmask
 * @returns {Promise<`0x${string}`>}  collection id (bytes32 hex)
 */
export async function ctGetCollectionId(rpcUrl, parentCollectionId, conditionId, indexSet) {
    const data = encodeFunctionData({
        abi:          CT_GET_COLLECTION_ID_ABI,
        functionName: 'getCollectionId',
        args:         [parentCollectionId, conditionId, BigInt(indexSet)],
    });
    const result = await anvilRpc(rpcUrl, 'eth_call', [
        { to: CT_GNOSIS_ADDRESS, data },
        'latest',
    ]);
    return decodeFunctionResult({
        abi:          CT_GET_COLLECTION_ID_ABI,
        functionName: 'getCollectionId',
        data:         result,
    });
}

/**
 * Call the live ConditionalTokens contract's `getPositionId`
 * function via eth_call. Returns a uint256 position id (bigint).
 *
 * @param {string} rpcUrl
 * @param {`0x${string}`} collateralToken
 * @param {`0x${string}`} collectionId
 * @returns {Promise<bigint>}
 */
export async function ctGetPositionId(rpcUrl, collateralToken, collectionId) {
    const data = encodeFunctionData({
        abi:          CT_GET_POSITION_ID_ABI,
        functionName: 'getPositionId',
        args:         [collateralToken, collectionId],
    });
    const result = await anvilRpc(rpcUrl, 'eth_call', [
        { to: CT_GNOSIS_ADDRESS, data },
        'latest',
    ]);
    return decodeFunctionResult({
        abi:          CT_GET_POSITION_ID_ABI,
        functionName: 'getPositionId',
        data:         result,
    });
}

/**
 * Convenience helper: fully derive a position id given a
 * collateral token + condition id + index set, with the standard
 * empty parent collection. Two eth_calls (collectionId then
 * positionId).
 *
 * Index-set convention for the standard 2-outcome (YES/NO)
 * partition: indexSet=1 selects outcome 0, indexSet=2 selects
 * outcome 1. Which is YES vs NO is convention-defined per
 * proposal — the harness should derive both and let the consumer
 * pick.
 *
 * @returns {Promise<bigint>}
 */
export async function ctDerivePositionId(rpcUrl, collateralToken, conditionId, indexSet) {
    const collectionId = await ctGetCollectionId(
        rpcUrl, EMPTY_COLLECTION_ID, conditionId, indexSet,
    );
    return ctGetPositionId(rpcUrl, collateralToken, collectionId);
}

/**
 * Set a holder's balance for a specific ConditionalTokens position
 * id by writing directly to the CT contract's `_balances` mapping
 * storage. Wrapper around `setErc1155Balance` that pins the
 * contract to `CT_GNOSIS_ADDRESS` and the slot to
 * `CT_BALANCE_SLOT`.
 *
 * @param {string} rpcUrl
 * @param {`0x${string}`} holder
 * @param {bigint|number|string} positionId
 * @param {bigint|number|string} amount
 * @returns {Promise<unknown>}
 */
export async function setConditionalPosition(rpcUrl, holder, positionId, amount) {
    return setErc1155Balance(
        rpcUrl, CT_GNOSIS_ADDRESS, holder, positionId, amount, CT_BALANCE_SLOT,
    );
}

/**
 * Read a holder's balance for a specific position id via eth_call
 * to the CT contract's `balanceOf(address, uint256)`. Verification
 * step for `setConditionalPosition`.
 *
 * @returns {Promise<bigint>}
 */
export async function getConditionalPosition(rpcUrl, holder, positionId) {
    return getErc1155Balance(rpcUrl, CT_GNOSIS_ADDRESS, holder, positionId);
}

// ── Step 2.9: probe-market position-ID derivation ──

/**
 * Read a FutarchyProposal contract's `conditionId()` via eth_call.
 * Each proposal is its own contract that pins the conditionId at
 * deployment; without this getter the harness would have to guess
 * the conditionId or hardcode it per probe market.
 *
 * @param {string} rpcUrl
 * @param {`0x${string}`} proposalAddress  the FutarchyProposal /
 *                                         FutarchyMarket address
 *                                         (e.g., MARKET_PROBE_ADDRESS)
 * @returns {Promise<`0x${string}`>}  bytes32 condition id
 */
export async function proposalGetConditionId(rpcUrl, proposalAddress) {
    const data = encodeFunctionData({
        abi:          FUTARCHY_PROPOSAL_CONDITION_ID_ABI,
        functionName: 'conditionId',
    });
    const result = await anvilRpc(rpcUrl, 'eth_call', [
        { to: proposalAddress, data },
        'latest',
    ]);
    return decodeFunctionResult({
        abi:          FUTARCHY_PROPOSAL_CONDITION_ID_ABI,
        functionName: 'conditionId',
        data:         result,
    });
}

/**
 * Convenience helper for the standard YES/NO 2-outcome partition.
 * Returns `{ yes, no }` position IDs as bigints, ready to pass to
 * `setConditionalPosition`. Index-set convention: indexSet=1 →
 * outcome 0 (YES per the futarchy contract's outcome ordering),
 * indexSet=2 → outcome 1 (NO). The harness pins this convention
 * here so per-scenario callers don't have to remember.
 *
 * Three eth_calls (proposal.conditionId + 2× ct.getCollectionId/
 * getPositionId pairs) — fine at globalSetup time, never inside
 * a hot loop.
 *
 * @param {string} rpcUrl
 * @param {`0x${string}`} proposalAddress
 * @param {`0x${string}`} collateralToken
 * @returns {Promise<{conditionId:`0x${string}`, yes:bigint, no:bigint}>}
 */
export async function deriveYesNoPositionIds(rpcUrl, proposalAddress, collateralToken) {
    const conditionId = await proposalGetConditionId(rpcUrl, proposalAddress);
    const yes = await ctDerivePositionId(rpcUrl, collateralToken, conditionId, 1n);
    const no  = await ctDerivePositionId(rpcUrl, collateralToken, conditionId, 2n);
    return { conditionId, yes, no };
}

// ── Step 7: snapshot/revert for per-scenario state isolation ──

/**
 * Take an EVM-state snapshot via `evm_snapshot`. Returns the
 * snapshot ID (a 0x-prefixed hex string) that callers pass back
 * to `evmRevert` to roll the chain to the captured state.
 *
 * Pinning this primitive in the fixture (rather than calling
 * `anvilRpc('evm_snapshot', [])` inline) lets future callers
 * upgrade the snapshot strategy in one place — e.g., adding
 * structured snapshot metadata for debugging which scenario
 * dirtied which slot.
 *
 * @param {string} rpcUrl
 * @returns {Promise<`0x${string}`>} snapshot ID
 */
export async function evmSnapshot(rpcUrl) {
    // 30s timeout (default is 5s): a snapshot under load — e.g.,
    // taken right after the page made a burst of eth_call requests
    // through the proxy that anvil is still draining — has been
    // observed to take longer than 5s to acknowledge. Don't push
    // higher than 30s: Playwright's per-test timeout is 120s by
    // default, and the beforeEach calls evmRevert + evmSnapshot
    // back-to-back, so two 60s timeouts here would blow the test
    // budget. 30s is a comfortable middle.
    const id = await anvilRpc(rpcUrl, 'evm_snapshot', [], 30_000);
    if (typeof id !== 'string' || !id.startsWith('0x')) {
        throw new Error(`[fork-state] evm_snapshot returned non-hex ID: ${JSON.stringify(id)}`);
    }
    return id;
}

/**
 * Revert chain state to a previously-taken snapshot via
 * `evm_revert`. **The snapshot ID is consumed** — anvil deletes
 * it after the revert, so callers that want to revert again
 * must take a fresh snapshot AFTER each revert. Returns true on
 * success; throws on failure (rather than returning false the
 * way anvil's raw RPC does — silent false-on-bad-id is exactly
 * the kind of footgun that masks state-isolation bugs).
 *
 * @param {string} rpcUrl
 * @param {string} snapshotId  ID returned by evmSnapshot
 * @returns {Promise<true>}
 */
export async function evmRevert(rpcUrl, snapshotId) {
    if (typeof snapshotId !== 'string' || !snapshotId.startsWith('0x')) {
        throw new Error(`[fork-state] evmRevert requires a 0x-prefixed snapshot ID, got: ${JSON.stringify(snapshotId)}`);
    }
    // 30s timeout: same reasoning as evmSnapshot above. Bounded to
    // 30s to keep the beforeEach budget under Playwright's 120s
    // per-test default. If revert genuinely takes longer than 30s,
    // soft-fail in the runner picks up the slack — the suite
    // proceeds without isolation for the affected iteration.
    const result = await anvilRpc(rpcUrl, 'evm_revert', [snapshotId], 30_000);
    if (result !== true) {
        throw new Error(
            `[fork-state] evm_revert(${snapshotId}) returned ${JSON.stringify(result)} ` +
            `instead of true. Snapshot ID likely already consumed (each ID can only be reverted once) ` +
            `OR the ID was never produced by evm_snapshot on THIS anvil instance.`,
        );
    }
    return true;
}

// ── Time control (slice 90) ─────────────────────────────────────────
//
// Anvil supports three RPC methods for chain-time manipulation:
//   - evm_setNextBlockTimestamp(uint64)    — pin the next mined
//     block's timestamp to an EXACT value
//   - evm_increaseTime(uint64)             — relative bump (deltas
//     accumulate until next block is mined)
//   - evm_mine                             — force a new block now
//     (uses last-set timestamp if any, else `now + 1s`)
//
// Together these unlock TIME-EVOLUTION scenarios (PR #54 TWAP class,
// resolution-deadline behavior, vote-weight decay). Without them,
// any test that needs to simulate "wait 24h then assert" would
// have to actually wait 24h — not feasible in CI.
//
// Lineage: ganache-original RPC methods, also supported by hardhat
// and anvil. Wrong-fork clients (geth/erigon/reth) lack them — the
// api-side `anvilTimeWarpCapabilityPresent` invariant guards this.

/**
 * Read the latest block's timestamp from anvil. Useful for setting
 * a relative time target (e.g., "now + 1h") without relying on
 * wall-clock time, which can drift between the test runner and
 * the chain.
 *
 * @param {string} rpcUrl
 * @returns {Promise<number>} unix timestamp (seconds, integer)
 */
export async function getBlockTimestamp(rpcUrl) {
    const block = await anvilRpc(rpcUrl, 'eth_getBlockByNumber', ['latest', false]);
    if (!block || typeof block.timestamp !== 'string') {
        throw new Error(`[fork-state] eth_getBlockByNumber returned unexpected shape: ${JSON.stringify(block)}`);
    }
    return parseInt(block.timestamp, 16);
}

/**
 * Pin the NEXT mined block's timestamp. The next call to
 * `mineBlock` will produce a block at exactly this timestamp;
 * subsequent blocks resume from there.
 *
 * Useful for putting the chain into a specific date range — e.g.,
 * past a proposal's `twapEnd` to exercise the PR #54 ended-proposal
 * branch.
 *
 * @param {string} rpcUrl
 * @param {number} timestamp  unix seconds (integer); must be ≥ the
 *                            CURRENT block's timestamp + 1, else
 *                            anvil rejects
 */
export async function setNextBlockTimestamp(rpcUrl, timestamp) {
    if (!Number.isInteger(timestamp) || timestamp <= 0) {
        throw new Error(`[fork-state] setNextBlockTimestamp requires positive integer seconds, got: ${timestamp}`);
    }
    await anvilRpc(rpcUrl, 'evm_setNextBlockTimestamp', [toHex(BigInt(timestamp))]);
}

/**
 * Mine a single block. If `setNextBlockTimestamp` was called first,
 * the new block uses that exact timestamp; otherwise anvil picks
 * `previous + 1` (or wall-clock if no `evm_setNextBlockTimestamp`
 * was issued in this session).
 *
 * Returns the new block's timestamp so callers can verify the
 * advance without a second RPC.
 *
 * @param {string} rpcUrl
 * @returns {Promise<number>} the mined block's unix timestamp
 */
export async function mineBlock(rpcUrl) {
    await anvilRpc(rpcUrl, 'evm_mine', []);
    return getBlockTimestamp(rpcUrl);
}

/**
 * Convenience: advance chain time by `seconds` relative to the
 * latest block, then mine. Equivalent to:
 *   const now = await getBlockTimestamp(rpcUrl);
 *   await setNextBlockTimestamp(rpcUrl, now + seconds);
 *   await mineBlock(rpcUrl);
 *
 * Returns the new block's timestamp.
 *
 * Note: anvil also exposes `evm_increaseTime` which bumps a delta
 * without immediately mining. This helper always mines for
 * predictability — the page's polling has SOMETHING to observe
 * after the call returns.
 *
 * @param {string} rpcUrl
 * @param {number} seconds  positive integer (a future negative-seek
 *                          could be a separate helper)
 * @returns {Promise<number>}
 */
export async function advanceTime(rpcUrl, seconds) {
    if (!Number.isInteger(seconds) || seconds < 0) {
        throw new Error(`[fork-state] advanceTime requires non-negative integer seconds, got: ${seconds}`);
    }
    const now = await getBlockTimestamp(rpcUrl);
    await setNextBlockTimestamp(rpcUrl, now + seconds);
    return mineBlock(rpcUrl);
}

/**
 * Cross-process channel for the active snapshot ID. globalSetup
 * (`fork-state-setup.mjs`) writes here once after funding; the
 * per-scenario `beforeEach` in `flows/scenarios.spec.mjs` reads,
 * reverts, re-snapshots, and rewrites.
 *
 * Lives in `fork-state.mjs` (NOT in `fork-state-setup.mjs`) because
 * Playwright treats the globalSetup module as part of the config:
 * a test file importing from the config file fails with
 * "Playwright Test did not expect test() to be called here." Hosting
 * the constant in a fixture-only module sidesteps that constraint
 * while keeping the path definition in one place.
 */
const __forkStateDir = dirname(fileURLToPath(import.meta.url));
export const SNAPSHOT_ID_FILE = join(__forkStateDir, '..', '.fork-snapshot-id');
