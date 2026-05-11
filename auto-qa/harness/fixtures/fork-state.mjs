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

const DEFAULT_TIMEOUT_MS = 5_000;

// ── Token constants (Gnosis chain) ──
//
// sDAI on Gnosis (chain 100) — also used by the api-side harness
// invariants (rate-provider check). Same address Maker shipped:
// the Savings xDai vault.
export const SDAI_GNOSIS_ADDRESS = '0x89C80A4540A00b5270347E02e2E144c71da2EceD';

// **TODO live-verify**: storage slot index for sDAI's `_balances`
// mapping. OpenZeppelin's ERC20 puts `_balances` at slot 0 by
// default; Maker's SavingsDai inherits from a custom base, so
// the slot may differ. Once the user runs a scenario against the
// fork end-to-end, verify by reading via `cast storage` and
// update this constant. The smoke tests below don't depend on
// this constant being right (they use parametric slot indices),
// only `fundWalletWithSDAI()` does.
export const SDAI_BALANCE_SLOT = 0;

// Standard ERC20 ABI fragments — minimal surface for read/write
// helpers. Keeping the fragments inline avoids a separate ABI
// file and makes the helpers self-contained.
const ERC20_BALANCE_OF_ABI = [{
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
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
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
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
 * @param {string} rpcUrl
 * @param {`0x${string}`} address       contract address
 * @param {`0x${string}`|bigint|number} slot  storage slot index
 *                                            (passed through toHex)
 * @param {`0x${string}`|bigint} value  32-byte value (left-padded
 *                                      automatically if shorter)
 * @returns {Promise<unknown>}
 */
export async function setStorageAt(rpcUrl, address, slot, value) {
    const slotHex = typeof slot === 'string' && slot.startsWith('0x')
        ? slot
        : toHex(slot);
    const valueHex = typeof value === 'string' && value.startsWith('0x')
        ? pad(value, { size: 32 })
        : pad(viemToHex(value), { size: 32 });
    return anvilRpc(rpcUrl, 'anvil_setStorageAt', [address, slotHex, valueHex]);
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
    return setErc20Balance(rpcUrl, SDAI_GNOSIS_ADDRESS, holder, amountWei, SDAI_BALANCE_SLOT);
}
