/**
 * wallet-stub.mjs — programmatic EIP-1193 wallet for harness Playwright tests.
 *
 * Per ADR-001 (`docs/ADR-001-synpress-vs-custom-stub.md`): custom stub
 * implementation, NOT Synpress. Wraps a viem account, proxies non-signing
 * RPC methods to the local anvil fork over HTTP.
 *
 * Three layers:
 *
 *   - createProvider(config) → in-process EIP-1193 provider (testable
 *     in node:test, no browser needed). Used by Phase 4 unit tests.
 *
 *   - installWalletStub(config) → returns JS source to inject via
 *     Playwright `addInitScript`. Constructs the same provider in
 *     the page, sets `window.ethereum`, and announces it via
 *     EIP-6963 so RainbowKit auto-discovers it. Used by Phase 5
 *     browser tests.
 *
 *   - setupSigningTunnel(context, {privateKey, rpcUrl, chainId}) →
 *     Phase 5 slice 2. Exposes `window.__harnessSign` in the page
 *     (via Playwright's `exposeBinding`) backed by a node-side viem
 *     wallet client. The privateKey NEVER enters the page; the in-
 *     page wallet stub forwards SIGNING_METHODS through this binding
 *     and returns the result. If the tunnel isn't installed, the
 *     stub falls back to rejecting signing methods with -32601
 *     (slice-1 default). Avoids inlining @noble/secp256k1 + EIP-712
 *     hashing + EIP-1559 serialization into a string blob.
 *
 * The EIP-1193 method dispatch table is the source of truth for what
 * the harness actually supports. Three classes:
 *
 *   1. WALLET_LOCAL  — handled in-stub (eth_accounts, eth_chainId,
 *                      personal_sign, eth_signTypedData_v4,
 *                      eth_sendTransaction, wallet_switchEthereumChain,
 *                      wallet_addEthereumChain)
 *
 *   2. RPC_PASSTHROUGH — forwarded to anvil verbatim (eth_call,
 *                        eth_getBalance, eth_blockNumber, eth_getCode,
 *                        eth_getBlockByNumber, eth_getTransactionReceipt,
 *                        eth_getTransactionByHash, eth_estimateGas,
 *                        eth_gasPrice, eth_chainId fallback, etc.)
 *
 *   3. SUBSCRIPTION  — eth_subscribe / eth_unsubscribe. Currently
 *                      handled by the SHIM described in
 *                      `docs/spike-002-eth-subscribe-shim.md` (when
 *                      that spike completes). Until then, returns
 *                      an unsupported error so consumers fall back
 *                      to polling.
 *
 * The stub is cryptographically real — sendTransaction signs a v4
 * EIP-1559 tx with the configured key and submits as
 * eth_sendRawTransaction. Anvil treats it as a normal tx.
 */

import { createWalletClient, http, publicActions, getAddress, isHex } from 'viem';
import { privateKeyToAccount, mnemonicToAccount } from 'viem/accounts';

// ────────────────────────────────────────────────────────────────────
// EIP-1193 method classification
// ────────────────────────────────────────────────────────────────────

export const WALLET_LOCAL_METHODS = new Set([
    'eth_accounts',
    'eth_requestAccounts',
    'eth_chainId',
    'wallet_switchEthereumChain',
    'wallet_addEthereumChain',
    'personal_sign',
    'eth_sign',
    'eth_signTypedData_v4',
    'eth_sendTransaction',
]);

export const RPC_PASSTHROUGH_METHODS = new Set([
    'eth_call',
    'eth_estimateGas',
    'eth_gasPrice',
    'eth_getTransactionReceipt',
    'eth_getTransactionByHash',
    'eth_getBalance',
    'eth_blockNumber',
    'eth_getCode',
    'eth_getBlockByNumber',
    'eth_getBlockByHash',
    'eth_getLogs',
    'eth_maxPriorityFeePerGas',
    'eth_feeHistory',
    'net_version',
]);

export const SUBSCRIPTION_METHODS = new Set([
    'eth_subscribe',
    'eth_unsubscribe',
]);

export const REQUIRED_EVENTS = [
    'accountsChanged',
    'chainChanged',
    'connect',
    'disconnect',
    'message',
];

// Anvil's deterministic dev mnemonic — same one Foundry ships by default.
// Yields 10 funded accounts: 0xf39F..., 0x7099..., 0x3C44..., etc.
export const ANVIL_DEV_MNEMONIC =
    'test test test test test test test test test test test junk';

// ────────────────────────────────────────────────────────────────────
// EventEmitter (lightweight, sufficient for EIP-1193 needs)
// ────────────────────────────────────────────────────────────────────

class TinyEmitter {
    constructor() { this._handlers = new Map(); }
    on(event, fn) {
        if (!this._handlers.has(event)) this._handlers.set(event, []);
        this._handlers.get(event).push(fn);
        return this;
    }
    removeListener(event, fn) {
        const arr = this._handlers.get(event);
        if (!arr) return this;
        const i = arr.indexOf(fn);
        if (i >= 0) arr.splice(i, 1);
        return this;
    }
    emit(event, ...args) {
        const arr = this._handlers.get(event);
        if (!arr) return false;
        for (const fn of [...arr]) fn(...args);
        return true;
    }
}

// ────────────────────────────────────────────────────────────────────
// Raw JSON-RPC passthrough to anvil
// ────────────────────────────────────────────────────────────────────

let _rpcId = 0;

async function rpcCall(rpcUrl, method, params) {
    const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: ++_rpcId,
            method,
            params,
        }),
    });
    if (!res.ok) {
        const err = new Error(`HTTP ${res.status} from anvil ${method}`);
        err.code = -32603;
        throw err;
    }
    const body = await res.json();
    if (body.error) {
        const err = new Error(body.error.message || 'RPC error');
        err.code = body.error.code ?? -32603;
        err.data = body.error.data;
        throw err;
    }
    return body.result;
}

// ────────────────────────────────────────────────────────────────────
// Provider creation
// ────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ProviderConfig
 * @property {`0x${string}`}        privateKey  — Anvil dev key (or any hex key)
 * @property {string}               rpcUrl      — Local anvil URL
 * @property {number}               chainId     — Reported chain ID (e.g. 100)
 * @property {boolean}             [autoApprove] — Skip prompting for sends (default true for harness)
 */

/**
 * Create an in-process EIP-1193 provider that wraps a viem account.
 *
 * The provider is THE thing tested in node:test. Browser injection
 * (via installWalletStub below) constructs the same provider inside
 * the page.
 *
 * @param {ProviderConfig} config
 * @returns {{
 *     address: `0x${string}`,
 *     chainId: number,
 *     request: ({method, params}: {method: string, params?: any[]}) => Promise<any>,
 *     on: (event: string, fn: Function) => void,
 *     removeListener: (event: string, fn: Function) => void,
 *     isMetaMask: true,
 *     isHarness: true,
 * }}
 */
export function createProvider(config) {
    if (!config) throw new Error('createProvider: config required');
    const { privateKey, rpcUrl, chainId } = config;
    if (!privateKey || !isHex(privateKey)) {
        throw new Error('createProvider: privateKey must be 0x-prefixed hex');
    }
    if (!rpcUrl) throw new Error('createProvider: rpcUrl required');
    if (!Number.isInteger(chainId) || chainId < 1) {
        throw new Error('createProvider: chainId must be a positive integer');
    }

    const account = privateKeyToAccount(privateKey);

    // Minimal "chain" object — viem requires `id`, but our transport
    // bypasses chain validation since we use http() directly to anvil.
    const chain = { id: chainId, name: `harness-${chainId}`, nativeCurrency: { name: 'XDAI', symbol: 'XDAI', decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } };

    const walletClient = createWalletClient({
        account,
        chain,
        transport: http(rpcUrl),
    }).extend(publicActions);

    const emitter = new TinyEmitter();

    let currentChainId = chainId;

    const provider = {
        address: account.address,
        chainId: currentChainId,
        isMetaMask: true,           // RainbowKit's MetaMask detector keys off this
        isHarness: true,            // distinguishes us from real MetaMask if a test cares

        async request({ method, params }) {
            const _params = params ?? [];

            // ── 1. WALLET_LOCAL ──
            if (WALLET_LOCAL_METHODS.has(method)) {
                switch (method) {
                    case 'eth_accounts':
                    case 'eth_requestAccounts':
                        return [account.address];

                    case 'eth_chainId':
                        return `0x${currentChainId.toString(16)}`;

                    case 'wallet_switchEthereumChain': {
                        const requested = parseInt(_params[0]?.chainId, 16);
                        if (!Number.isInteger(requested)) {
                            const err = new Error('wallet_switchEthereumChain: invalid chainId');
                            err.code = -32602;
                            throw err;
                        }
                        currentChainId = requested;
                        emitter.emit('chainChanged', `0x${currentChainId.toString(16)}`);
                        return null;
                    }

                    case 'wallet_addEthereumChain':
                        // Treat as no-op; the harness chain is already configured.
                        return null;

                    case 'personal_sign': {
                        // params[0] is message, params[1] is address. Some clients
                        // pass them in the OTHER order; viem expects message-first.
                        const [msg, addr] = _params;
                        if (addr && getAddress(addr) !== account.address) {
                            const err = new Error('personal_sign: address mismatch');
                            err.code = -32602;
                            throw err;
                        }
                        return walletClient.signMessage({
                            message: isHex(msg) ? { raw: msg } : msg,
                        });
                    }

                    case 'eth_sign': {
                        // Same as personal_sign in our stub (anvil treats them
                        // identically; we don't enforce the prefix discipline).
                        const [_addr, msg] = _params;
                        return walletClient.signMessage({
                            message: isHex(msg) ? { raw: msg } : msg,
                        });
                    }

                    case 'eth_signTypedData_v4': {
                        const [addr, dataStr] = _params;
                        if (addr && getAddress(addr) !== account.address) {
                            const err = new Error('eth_signTypedData_v4: address mismatch');
                            err.code = -32602;
                            throw err;
                        }
                        const data = typeof dataStr === 'string'
                            ? JSON.parse(dataStr) : dataStr;
                        return walletClient.signTypedData(data);
                    }

                    case 'eth_sendTransaction': {
                        const tx = _params[0];
                        // viem will sign + broadcast as eth_sendRawTransaction.
                        return walletClient.sendTransaction({
                            to: tx.to,
                            value: tx.value ? BigInt(tx.value) : undefined,
                            data: tx.data,
                            gas: tx.gas ? BigInt(tx.gas) : undefined,
                            // Other gas fields are optional; viem fills them.
                        });
                    }
                }
            }

            // ── 2. SUBSCRIPTION (currently unsupported — see spike-002) ──
            if (SUBSCRIPTION_METHODS.has(method)) {
                const err = new Error(
                    `${method} not supported by harness wallet stub ` +
                    '(eth_subscribe shim pending — see ' +
                    'docs/spike-002-eth-subscribe-shim.md). Consumers ' +
                    'should fall back to polling.',
                );
                err.code = -32601;
                throw err;
            }

            // ── 3. RPC_PASSTHROUGH (and unknown methods) ──
            // Forward verbatim. We allow unknown methods through too —
            // anvil will reject them with its own -32601 if it doesn't
            // know them, which is the right behavior for a transparent
            // stub.
            return rpcCall(rpcUrl, method, _params);
        },

        on(event, fn) { emitter.on(event, fn); },
        removeListener(event, fn) { emitter.removeListener(event, fn); },

        // For tests / inspection — not part of EIP-1193 surface.
        _emit(event, ...args) { emitter.emit(event, ...args); },
        _account: account,
    };

    return provider;
}

// ────────────────────────────────────────────────────────────────────
// Multi-account derivation from anvil mnemonic
// ────────────────────────────────────────────────────────────────────

/**
 * Derive N deterministic accounts from the anvil dev mnemonic
 * (BIP-44 path m/44'/60'/0'/0/<index>).
 *
 * Returns an array of {address, privateKey} suitable for
 * createProvider().
 *
 * @param {number} n — how many accounts (1..)
 * @param {string} [mnemonic] — defaults to ANVIL_DEV_MNEMONIC
 * @returns {{address: `0x${string}`, privateKey: `0x${string}`}[]}
 */
export function nStubWallets(n, mnemonic = ANVIL_DEV_MNEMONIC) {
    if (!Number.isInteger(n) || n < 1) {
        throw new Error('nStubWallets: n must be a positive integer');
    }
    const out = [];
    for (let i = 0; i < n; i++) {
        const account = mnemonicToAccount(mnemonic, { addressIndex: i });
        // mnemonicToAccount doesn't expose the private key directly; we
        // need to derive it via HDKey. viem's getHdKey is the path.
        // For our use case we can rebuild the account in createProvider
        // from the mnemonic+index, but for a programmatic privateKey
        // we expose it through the underlying HDKey.
        const hdKey = account.getHdKey();
        const privateKey = `0x${Buffer.from(hdKey.privateKey).toString('hex')}`;
        out.push({ address: account.address, privateKey });
    }
    return out;
}

// ────────────────────────────────────────────────────────────────────
// Browser injection (Phase 5)
// ────────────────────────────────────────────────────────────────────

/**
 * Returns JS source to inject into a Playwright browser context via
 * `context.addInitScript({content: installWalletStub({...})})`.
 *
 * Phase 5 slice 1 scope:
 *   - eth_accounts / eth_requestAccounts return [address]
 *   - eth_chainId / wallet_switchEthereumChain handled in-page
 *   - All read RPCs (eth_call, eth_blockNumber, eth_getBalance, …)
 *     proxy to `rpcUrl` via fetch
 *   - Signing methods (personal_sign, eth_signTypedData_v4,
 *     eth_sendTransaction) return JSON-RPC -32601 — slice 2 will
 *     inline @noble/secp256k1 to enable signing in-page
 *   - EIP-6963 announcement so RainbowKit auto-discovers
 *   - Emits ethereum#initialized for late-hydrating dApps
 *
 * The script is HEREDOC'd as a template literal then JSON-encoded
 * into safe fields so addresses/keys/etc. don't break parsing.
 *
 * @param {ProviderConfig} config
 * @returns {string} JS source to inject
 */
export function installWalletStub(config) {
    if (!config) throw new Error('installWalletStub: config required');
    const { privateKey, rpcUrl, chainId } = config;
    if (!privateKey || typeof privateKey !== 'string') {
        throw new Error('installWalletStub: privateKey (hex) required');
    }
    if (!rpcUrl) throw new Error('installWalletStub: rpcUrl required');
    if (!Number.isInteger(chainId) || chainId < 1) {
        throw new Error('installWalletStub: chainId required');
    }

    // Derive the address in node so we don't need viem in-page.
    const address = privateKeyToAccount(privateKey).address;

    // Encode all interpolated values via JSON.stringify so quotes /
    // special characters in URLs etc. don't break the script.
    const cfg = JSON.stringify({ address, rpcUrl, chainId });

    return `
(function installHarnessWallet() {
    const CFG = ${cfg};
    const SIGNING_METHODS = new Set([
        'personal_sign', 'eth_sign', 'eth_signTypedData_v4',
        'eth_sendTransaction', 'eth_sign_typed_data',
    ]);
    const SUB_METHODS = new Set(['eth_subscribe', 'eth_unsubscribe']);

    let currentChainId = CFG.chainId;
    const handlers = new Map();
    function on(event, fn) {
        if (!handlers.has(event)) handlers.set(event, []);
        handlers.get(event).push(fn);
    }
    function emit(event, ...args) {
        const arr = handlers.get(event); if (!arr) return;
        for (const fn of [...arr]) fn(...args);
    }
    function removeListener(event, fn) {
        const arr = handlers.get(event); if (!arr) return;
        const i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1);
    }

    let _id = 0;
    async function rpcPassthrough(method, params) {
        const r = await fetch(CFG.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0', id: ++_id, method, params,
            }),
        });
        const j = await r.json();
        if (j.error) {
            const e = new Error(j.error.message || 'RPC error');
            e.code = j.error.code ?? -32603;
            throw e;
        }
        return j.result;
    }

    async function request({ method, params }) {
        const _params = params ?? [];

        switch (method) {
            case 'eth_accounts':
            case 'eth_requestAccounts':
                return [CFG.address];
            case 'eth_chainId':
                return '0x' + currentChainId.toString(16);
            case 'wallet_switchEthereumChain': {
                const next = parseInt(_params[0]?.chainId, 16);
                if (!Number.isInteger(next)) {
                    const e = new Error('invalid chainId');
                    e.code = -32602; throw e;
                }
                currentChainId = next;
                emit('chainChanged', '0x' + currentChainId.toString(16));
                return null;
            }
            case 'wallet_addEthereumChain':
                return null;
        }

        if (SIGNING_METHODS.has(method)) {
            // Phase 5 slice 2: forward to the signing tunnel
            // (window.__harnessSign, wired via setupSigningTunnel
            // in node — backed by viem). Tunnel keeps the privateKey
            // out of the page entirely. If the tunnel isn't installed,
            // fall back to slice-1 behavior (reject -32601).
            if (typeof window.__harnessSign !== 'function') {
                const e = new Error(method + ' not supported (signing tunnel not installed; call setupSigningTunnel from node)');
                e.code = -32601; throw e;
            }
            try {
                return await window.__harnessSign({ method, params: _params });
            } catch (err) {
                // Re-throw with EIP-1193-shaped error so consumers can
                // inspect .code. exposeBinding loses non-enumerable
                // properties on Error, so we synthesize a fresh one.
                const e = new Error(err?.message || (method + ' failed'));
                e.code = err?.code ?? -32603;
                throw e;
            }
        }

        if (SUB_METHODS.has(method)) {
            const e = new Error(method + ' not supported (consumers should poll)');
            e.code = -32601; throw e;
        }

        return rpcPassthrough(method, _params);
    }

    const provider = {
        request, on, removeListener,
        isMetaMask: true,
        isHarness: true,
        get chainId() { return '0x' + currentChainId.toString(16); },
        get selectedAddress() { return CFG.address; },
    };

    // Set window.ethereum (Wagmi's MetaMask connector keys off this)
    try {
        Object.defineProperty(window, 'ethereum', {
            value: provider,
            writable: true,
            configurable: true,
        });
    } catch {
        window.ethereum = provider;
    }

    // EIP-6963 announcement for modern wallet auto-discovery (RainbowKit).
    const info = {
        uuid: '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0').slice(-12),
        name: 'Futarchy Harness Wallet',
        rdns: 'fi.futarchy.harness',
        // Placeholder transparent 1x1 PNG so RainbowKit's icon validation passes
        icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=',
    };
    function announce() {
        window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
            detail: Object.freeze({ info, provider }),
        }));
    }
    window.addEventListener('eip6963:requestProvider', announce);
    announce();

    // Late-hydrating dApps may listen for this:
    window.dispatchEvent(new Event('ethereum#initialized'));

    // Diagnostic — visible to Playwright via console listening
    if (window.__HARNESS_DEBUG) {
        console.log('[harness-wallet] installed', { address: CFG.address, chainId: CFG.chainId });
    }
})();
`;
}

// ────────────────────────────────────────────────────────────────────
// Signing tunnel (Phase 5 slice 2)
// ────────────────────────────────────────────────────────────────────

/**
 * Wire `window.__harnessSign` in every page of `context` to a node-side
 * viem wallet client. The in-page wallet stub forwards
 * `personal_sign` / `eth_signTypedData_v4` / `eth_sendTransaction`
 * through this binding when present.
 *
 * Avoids the alternative (inlining @noble/secp256k1 + EIP-712 hashing
 * + EIP-1559 tx serialization as a ~30 KB string blob in the
 * addInitScript). Net effect from the dApp's perspective is identical
 * — `await window.ethereum.request({method: 'personal_sign', params:
 * […]})` returns a signature.
 *
 * The privateKey lives in the node test process; the page only sees
 * the signature/hash result. setupSigningTunnel must be called BEFORE
 * the first `page.goto()` so the binding is in place when the stub
 * script runs (Playwright's `exposeBinding` is registered on the
 * context, applied per-page).
 *
 * @param {import('@playwright/test').BrowserContext} context
 * @param {{privateKey: `0x${string}`, rpcUrl: string, chainId: number}} cfg
 * @returns {Promise<void>}
 */
export async function setupSigningTunnel(context, cfg) {
    if (!context || typeof context.exposeBinding !== 'function') {
        throw new Error('setupSigningTunnel: context with exposeBinding required');
    }
    const { privateKey, rpcUrl, chainId } = cfg ?? {};
    if (!privateKey || !isHex(privateKey)) {
        throw new Error('setupSigningTunnel: privateKey (0x-hex) required');
    }
    if (!rpcUrl) throw new Error('setupSigningTunnel: rpcUrl required');
    if (!Number.isInteger(chainId) || chainId < 1) {
        throw new Error('setupSigningTunnel: chainId required');
    }

    const account = privateKeyToAccount(privateKey);
    const chain = {
        id: chainId,
        name: `harness-${chainId}`,
        nativeCurrency: { name: 'XDAI', symbol: 'XDAI', decimals: 18 },
        rpcUrls: { default: { http: [rpcUrl] } },
    };
    const walletClient = createWalletClient({
        account, chain, transport: http(rpcUrl),
    }).extend(publicActions);

    await context.exposeBinding('__harnessSign', async (_source, payload) => {
        const { method, params } = payload ?? {};
        const _params = params ?? [];

        switch (method) {
            case 'personal_sign': {
                const [msg, addr] = _params;
                if (addr && getAddress(addr) !== account.address) {
                    throw new Error('personal_sign: address mismatch');
                }
                return walletClient.signMessage({
                    message: isHex(msg) ? { raw: msg } : msg,
                });
            }

            case 'eth_sign': {
                // EIP-1193 spec: params[0]=address, params[1]=message.
                // Anvil treats this identically to personal_sign.
                const [addr, msg] = _params;
                if (addr && getAddress(addr) !== account.address) {
                    throw new Error('eth_sign: address mismatch');
                }
                return walletClient.signMessage({
                    message: isHex(msg) ? { raw: msg } : msg,
                });
            }

            case 'eth_signTypedData_v4': {
                const [addr, dataStr] = _params;
                if (addr && getAddress(addr) !== account.address) {
                    throw new Error('eth_signTypedData_v4: address mismatch');
                }
                const data = typeof dataStr === 'string'
                    ? JSON.parse(dataStr) : dataStr;
                return walletClient.signTypedData(data);
            }

            case 'eth_sendTransaction': {
                const tx = _params[0];
                // viem fills nonce/chainId/gas/fees by querying rpcUrl,
                // signs the EIP-1559 tx, and broadcasts via
                // eth_sendRawTransaction. Returns the tx hash.
                return walletClient.sendTransaction({
                    to: tx.to,
                    value: tx.value ? BigInt(tx.value) : undefined,
                    data: tx.data,
                    gas: tx.gas ? BigInt(tx.gas) : undefined,
                });
            }

            default: {
                const e = new Error(`__harnessSign: unsupported method ${method}`);
                e.code = -32601;
                throw e;
            }
        }
    });
}

// ────────────────────────────────────────────────────────────────────
// Self-test (runnable to confirm the file loads cleanly)
// ────────────────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('[wallet-stub] loads cleanly.');
    console.log(`Wallet-local methods: ${WALLET_LOCAL_METHODS.size}`);
    console.log(`RPC passthrough methods: ${RPC_PASSTHROUGH_METHODS.size}`);
    console.log(`Subscription methods: ${SUBSCRIPTION_METHODS.size}`);
    console.log(`Required events: ${REQUIRED_EVENTS.length}`);
    console.log('');
    console.log('Sample anvil-derived account #0:');
    const wallets = nStubWallets(3);
    for (let i = 0; i < wallets.length; i++) {
        console.log(`  [${i}] ${wallets[i].address}`);
    }
}
