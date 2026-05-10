/**
 * wallet-stub.mjs — programmatic EIP-1193 wallet for harness Playwright tests.
 *
 * Phase 0 SCAFFOLD ONLY. Every method below throws "not implemented".
 * The real implementation lands in Phase 4 once we choose between
 * Synpress (real MetaMask in Chrome extension) and a custom in-page
 * stub. See `docs/ADR-001-synpress-vs-custom-stub.md`.
 *
 * This file documents the EIP-1193 surface we MUST support, derived
 * from the futarchy interface's actual usage (Wagmi v2 + RainbowKit +
 * ethers v5 + custom strategy pattern in src/components/refactor/).
 *
 * Usage from Playwright (eventual):
 *
 *   import { installWalletStub } from './fixtures/wallet-stub.mjs';
 *
 *   test.beforeEach(async ({ context }) => {
 *       await context.addInitScript({
 *           content: installWalletStub({
 *               address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
 *               privateKey: '0xac0974be...', // anvil dev key
 *               chainId: 100,
 *               rpcUrl: 'http://localhost:8545',
 *           }),
 *       });
 *   });
 *
 * The init script runs BEFORE Wagmi/RainbowKit hydrate, so they see
 * window.ethereum as our stub and the connection flow Just Works.
 */

// ────────────────────────────────────────────────────────────────────
// Required EIP-1193 methods (confirmed by grep across futarchy interface)
// ────────────────────────────────────────────────────────────────────

export const REQUIRED_METHODS = [
    // Account discovery + connection
    'eth_accounts',
    'eth_requestAccounts',
    'eth_chainId',

    // Network management
    'wallet_switchEthereumChain',
    'wallet_addEthereumChain',

    // Signing
    'personal_sign',
    'eth_signTypedData_v4',

    // Transaction lifecycle
    'eth_sendTransaction',
    'eth_estimateGas',
    'eth_gasPrice',
    'eth_getTransactionReceipt',
    'eth_getTransactionByHash',

    // Read-only chain queries (passthrough to RPC is fine)
    'eth_call',
    'eth_getBalance',
    'eth_blockNumber',
    'eth_getCode',

    // Subscriptions (Wagmi uses these for block/event watching)
    'eth_subscribe',
    'eth_unsubscribe',
];

// ────────────────────────────────────────────────────────────────────
// EIP-1193 event surface
// ────────────────────────────────────────────────────────────────────

export const REQUIRED_EVENTS = [
    'accountsChanged',
    'chainChanged',
    'connect',
    'disconnect',
    'message',           // for subscription notifications
];

// ────────────────────────────────────────────────────────────────────
// Provider config shape — what installWalletStub takes as input
// ────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} WalletStubConfig
 * @property {`0x${string}`}       address       — The account to expose
 * @property {`0x${string}`}       privateKey    — For signing (anvil dev keys are fine for harness use)
 * @property {number}              chainId       — e.g. 100 for Gnosis
 * @property {string}              rpcUrl        — Where to forward eth_call etc.
 * @property {boolean}            [autoApprove]  — If true, sign/send without prompting (default true for harness)
 */

// ────────────────────────────────────────────────────────────────────
// Phase 4 entry point — currently a stub
// ────────────────────────────────────────────────────────────────────

/**
 * Returns a string of JS to be injected into the page via
 * `context.addInitScript({content: ...})`.
 *
 * The injected script:
 *   1. Constructs an EIP-1193 provider that wraps the given private key
 *   2. Forwards read-only methods to `rpcUrl` via fetch
 *   3. Signs writes locally with the private key, forwards as eth_sendRawTransaction
 *   4. Sets `window.ethereum = provider` and `window.ethereum.isMetaMask = true`
 *      (Wagmi's MetaMask connector keys off this)
 *   5. Emits a synthetic `ethereum#initialized` event for late-hydrating dApps
 *
 * @param {WalletStubConfig} config
 * @returns {string} JS source to inject
 */
export function installWalletStub(_config) {
    throw new Error(
        '[wallet-stub] Phase 0 scaffold — not implemented yet. ' +
            'See auto-qa/harness/docs/ADR-001-synpress-vs-custom-stub.md ' +
            'for the implementation choice (pending).',
    );
}

/**
 * Helper for spawning N stub wallets with deterministic addresses.
 * Used by multi-user scenarios (e.g. arbitrage between traders).
 *
 * @param {number} n
 * @param {Omit<WalletStubConfig, 'address'|'privateKey'>} sharedConfig
 * @returns {WalletStubConfig[]}
 */
export function nStubWallets(n, _sharedConfig) {
    if (n <= 0) throw new Error('nStubWallets: n must be > 0');
    throw new Error(
        '[wallet-stub] Phase 0 scaffold — not implemented yet. ' +
            'Will use anvil dev mnemonic ' +
            '"test test test test test test test test test test test junk" ' +
            'to derive deterministic addresses.',
    );
}

// ────────────────────────────────────────────────────────────────────
// Self-test (runnable to confirm the file loads cleanly)
// ────────────────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('[wallet-stub] Phase 0 scaffold loaded successfully.');
    console.log(`Required EIP-1193 methods (${REQUIRED_METHODS.length}):`);
    for (const m of REQUIRED_METHODS) console.log(`  - ${m}`);
    console.log(`Required events (${REQUIRED_EVENTS.length}):`);
    for (const e of REQUIRED_EVENTS) console.log(`  - ${e}`);
    console.log('\nimplementation: pending Phase 4 (see ADR-001).');
}
