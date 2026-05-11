/**
 * fork-state.mjs — primitives for setting up forked-anvil state.
 *
 * Phase 7 fork-bootstrap step 2. Where step 1 wired anvil into
 * Playwright's `webServer` block (so `npm run ui:full` spins up a
 * Gnosis fork at port 8546), this module provides the helpers a
 * scenario or globalSetup hook calls to FUND addresses, mint
 * conditional-token positions, and otherwise put the fork into a
 * scenario-relevant state before the page navigates.
 *
 * **Scope of this module**: low-level primitives only —
 * `anvilRpc()`, `setEthBalance()`, `impersonateAndSend()`,
 * `getEthBalance()`. Higher-level setups (fund-with-sDAI, mint-
 * conditional-position) are layered on top in subsequent slices.
 *
 * **No fetch wrapper imports** — uses globalThis.fetch (Node 22+
 * has it built in, same as the Playwright env).
 *
 * **Why no viem dependency** — these helpers run in the harness
 * process (Node), not in-page; they don't need a wallet client,
 * just raw JSON-RPC. Keeping the dep surface tight matches the
 * existing fixture-side pattern (api-mocks.mjs has zero deps).
 */

const DEFAULT_TIMEOUT_MS = 5_000;

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
