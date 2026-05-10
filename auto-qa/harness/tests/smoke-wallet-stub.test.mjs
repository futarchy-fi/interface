/**
 * smoke-wallet-stub.test.mjs — Phase 4 slice 1: EIP-1193 stub against live anvil.
 *
 * The harness's wallet stub (fixtures/wallet-stub.mjs) implements an
 * in-process EIP-1193 provider that wraps a viem account. This test
 * spawns a local anvil fork and exercises the stub end-to-end without
 * involving Playwright or a browser.
 *
 * Cases:
 *
 *   1. Constructor errors (no config, missing fields, bad types)
 *
 *   2. nStubWallets — derives the canonical 10 anvil dev addresses
 *      (0xf39F..., 0x7099..., 0x3C44..., ...) from the dev mnemonic
 *
 *   3. eth_accounts / eth_requestAccounts return [provider.address]
 *
 *   4. eth_chainId returns the configured chain
 *
 *   5. wallet_switchEthereumChain updates currentChainId AND emits
 *      chainChanged event
 *
 *   6. RPC passthrough: eth_blockNumber returns anvil's actual height
 *
 *   7. eth_sendTransaction: send 1 ETH from anvil dev[0] to dev[1],
 *      mine the block, verify recipient balance increased
 *
 *   8. personal_sign: signs a message; sig is non-empty hex
 *
 *   9. eth_subscribe: rejected with -32601 (per spike-002 plan —
 *      consumers fall back to polling)
 *
 * Skip behavior:
 *   - SKIP if anvil not on PATH
 *
 * Runtime: ~5s (spawn anvil + several RPC roundtrips + tx mine).
 *
 * ANVIL DEV-ACCOUNT QUIRK (resolved in Phase 4 slice 3):
 *   On a Gnosis fork, anvil's "10000 ETH" auto-funding for dev
 *   addresses (0xf39F, 0x7099, …) is a LAZY view. The underlying
 *   fork state is whatever the address has on Gnosis (~0). On first
 *   interaction (incoming tx), the lazy 10000 ETH vanishes and the
 *   true fork balance materializes. So sending 1 ETH to dev[1]
 *   reads as recipient going from 10000 → 0, NOT 10000 → 10001.
 *   Verified in scripts/debug-balance-quirk.mjs across 4 recipient
 *   kinds: dev[1] anomalous, vanity/fresh/low addresses all correct.
 *   FIX: this test sends to a freshly-generated address.
 *
 * Run via:   node --test auto-qa/harness/tests/smoke-wallet-stub.test.mjs
 *       or:  npm run auto-qa:e2e:smoke:wallet
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

import {
    createProvider,
    nStubWallets,
    WALLET_LOCAL_METHODS,
    SUBSCRIPTION_METHODS,
} from '../fixtures/wallet-stub.mjs';

const PORT = Number(process.env.HARNESS_WALLET_TEST_PORT) || 8551;
const FORK_URL = process.env.FORK_URL || 'https://rpc.gnosis.gateway.fm';
const RPC = `http://127.0.0.1:${PORT}`;
const READY_TIMEOUT_MS = 30_000;

function whichAnvil() {
    const r = spawnSync('which', ['anvil'], { encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : null;
}

async function spawnAnvil(port) {
    const anvilPath = whichAnvil();
    if (!anvilPath) return null;

    const child = spawn(anvilPath, [
        '--host', '0.0.0.0',
        '--port', String(port),
        '--fork-url', FORK_URL,
        '--chain-id', '100',
        '--no-mining',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    // Suppress noisy anvil output unless tests fail.
    child.stdout.on('data', () => {});
    child.stderr.on('data', () => {});

    // Poll for readiness
    const start = Date.now();
    while (Date.now() - start < READY_TIMEOUT_MS) {
        try {
            const r = await fetch(`http://127.0.0.1:${port}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [],
                }),
                signal: AbortSignal.timeout(1000),
            });
            if (r.ok) {
                const j = await r.json();
                if (j.result) return child;
            }
        } catch { /* not ready */ }
        await wait(250);
    }
    child.kill('SIGTERM');
    throw new Error(`anvil not ready within ${READY_TIMEOUT_MS}ms`);
}

async function killAnvil(child) {
    if (!child || child.killed) return;
    child.kill('SIGTERM');
    await new Promise((res) => child.once('exit', res));
}

async function evmMine(rpcUrl) {
    const r = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'evm_mine', params: [] }),
    });
    return r.json();
}

// ── 1. Constructor errors ──────────────────────────────────────────

test('Phase 4 slice 1 — createProvider throws on missing config', () => {
    assert.throws(() => createProvider(), /config required/);
});

test('Phase 4 slice 1 — createProvider throws on missing privateKey', () => {
    assert.throws(
        () => createProvider({ rpcUrl: RPC, chainId: 100 }),
        /privateKey must be 0x-prefixed hex/,
    );
});

test('Phase 4 slice 1 — createProvider throws on missing rpcUrl', () => {
    const wallets = nStubWallets(1);
    assert.throws(
        () => createProvider({ privateKey: wallets[0].privateKey, chainId: 100 }),
        /rpcUrl required/,
    );
});

test('Phase 4 slice 1 — createProvider throws on bad chainId', () => {
    const wallets = nStubWallets(1);
    assert.throws(
        () => createProvider({ privateKey: wallets[0].privateKey, rpcUrl: RPC }),
        /chainId must be a positive integer/,
    );
    assert.throws(
        () => createProvider({ privateKey: wallets[0].privateKey, rpcUrl: RPC, chainId: 0 }),
        /chainId must be a positive integer/,
    );
});

// ── 2. nStubWallets canonical addresses ────────────────────────────

test('Phase 4 slice 1 — nStubWallets derives canonical anvil dev addresses', () => {
    const wallets = nStubWallets(3);
    // These are the canonical foundry/anvil dev mnemonic addresses.
    assert.equal(wallets[0].address, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    assert.equal(wallets[1].address, '0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
    assert.equal(wallets[2].address, '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC');
    // Private keys are 0x-prefixed hex of length 66
    for (const w of wallets) {
        assert.match(w.privateKey, /^0x[0-9a-f]{64}$/i);
    }
});

test('Phase 4 slice 1 — nStubWallets throws on invalid n', () => {
    assert.throws(() => nStubWallets(0), /positive integer/);
    assert.throws(() => nStubWallets(-1), /positive integer/);
    assert.throws(() => nStubWallets(1.5), /positive integer/);
});

// ── 3-9. Live-anvil tests (skip if foundry missing) ────────────────

test('Phase 4 slice 1 — live anvil: provider end-to-end', async (t) => {
    if (!whichAnvil()) {
        t.skip('anvil not on PATH (install foundry: curl -L https://foundry.paradigm.xyz | bash)');
        return;
    }

    const child = await spawnAnvil(PORT);
    try {
        const wallets = nStubWallets(2);
        const provider = createProvider({
            privateKey: wallets[0].privateKey,
            rpcUrl: RPC,
            chainId: 100,
        });

        // 3. eth_accounts
        const accs = await provider.request({ method: 'eth_accounts' });
        assert.deepEqual(accs, [wallets[0].address]);

        const reqAccs = await provider.request({ method: 'eth_requestAccounts' });
        assert.deepEqual(reqAccs, [wallets[0].address]);
        t.diagnostic(`eth_accounts → ${accs[0]}`);

        // 4. eth_chainId
        const cid = await provider.request({ method: 'eth_chainId' });
        assert.equal(cid, '0x64'); // 100 in hex
        t.diagnostic(`eth_chainId → ${cid} (decimal ${parseInt(cid, 16)})`);

        // 5. wallet_switchEthereumChain emits chainChanged
        const events = [];
        provider.on('chainChanged', (newChainHex) => {
            events.push({ event: 'chainChanged', value: newChainHex });
        });
        await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xa' }], // 10 = OP mainnet
        });
        assert.equal(events.length, 1);
        assert.equal(events[0].value, '0xa');
        t.diagnostic('wallet_switchEthereumChain → chainChanged event fired');

        // Restore chain for subsequent tests
        await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x64' }],
        });

        // 6. RPC passthrough — eth_blockNumber
        const heightHex = await provider.request({ method: 'eth_blockNumber' });
        const height = parseInt(heightHex, 16);
        assert.ok(height > 0, `block number should be > 0 (got ${height})`);
        t.diagnostic(`eth_blockNumber → ${height}`);

        // 7. eth_sendTransaction — use a FRESHLY GENERATED recipient
        // (anvil dev addresses on a fork carry "lazy" 10000-ETH balances
        // that vanish on first interaction — see scripts/debug-balance-quirk.mjs).
        // Fresh addresses give correct credit semantics.
        const recipientAddr = privateKeyToAccount(generatePrivateKey()).address;
        const oneEth = '0xde0b6b3a7640000';

        // Fund the SENDER via anvil_setBalance (anvil dev accounts may not
        // have funds on a fresh fork)
        await provider.request({
            method: 'anvil_setBalance',
            params: [wallets[0].address, '0x56bc75e2d63100000'], // 100 ETH
        });

        // Snapshot recipient's pre-balance
        const pre = await provider.request({
            method: 'eth_getBalance',
            params: [recipientAddr, 'latest'],
        });
        t.diagnostic(`pre balance of recipient: ${BigInt(pre)} wei = ${BigInt(pre)/10n**18n} ETH`);

        // Sender pre-balance for sanity check
        const senderPre = await provider.request({
            method: 'eth_getBalance',
            params: [wallets[0].address, 'latest'],
        });
        t.diagnostic(`pre balance of sender:    ${BigInt(senderPre)} wei = ${BigInt(senderPre)/10n**18n} ETH`);

        // Send 1 ETH (no explicit gas — let viem estimate; the fork
        // may have a different gas schedule than mainnet)
        const txHash = await provider.request({
            method: 'eth_sendTransaction',
            params: [{
                from: wallets[0].address,
                to: recipientAddr,
                value: oneEth,
            }],
        });
        assert.match(txHash, /^0x[0-9a-f]{64}$/i);
        t.diagnostic(`eth_sendTransaction → ${txHash.slice(0, 18)}…`);

        // Mine the tx in
        await evmMine(RPC);

        // Verify the tx made it in with status SUCCESS.
        const receipt = await provider.request({
            method: 'eth_getTransactionReceipt',
            params: [txHash],
        });
        assert.ok(receipt, `tx ${txHash} should have a receipt after mining`);
        assert.equal(receipt.status, '0x1',
            `tx receipt status should be 0x1 (success), got ${receipt.status}`);
        assert.equal(receipt.from.toLowerCase(), wallets[0].address.toLowerCase(),
            'receipt.from should match the wallet sender');
        assert.equal(receipt.to.toLowerCase(), recipientAddr.toLowerCase(),
            'receipt.to should match the recipient');
        t.diagnostic(`receipt: status=${receipt.status} block=${receipt.blockNumber}`);

        // Sender balance should decrease by AT LEAST `oneEth` (more if
        // gas was paid; we don't assert exact gas to stay anvil-version
        // independent).
        const senderPost = await provider.request({
            method: 'eth_getBalance',
            params: [wallets[0].address, 'latest'],
        });
        const senderDelta = BigInt(senderPre) - BigInt(senderPost);
        assert.ok(senderDelta >= BigInt(oneEth),
            `sender should lose at least ${BigInt(oneEth)} wei (lost ${senderDelta})`);
        t.diagnostic(`sender lost ${senderDelta} wei (${senderDelta - BigInt(oneEth)} for gas)`);

        // Recipient credit — works correctly because we used a fresh
        // address (see ANVIL DEV-ACCOUNT QUIRK note at top of this file).
        const post = await provider.request({
            method: 'eth_getBalance',
            params: [recipientAddr, 'latest'],
        });
        const recipientDelta = BigInt(post) - BigInt(pre);
        assert.equal(recipientDelta, BigInt(oneEth),
            `fresh recipient should have received exactly 1 ETH (got ${recipientDelta})`);
        t.diagnostic(`recipient credited ${recipientDelta} wei (= 1 ETH)`);

        // 8. personal_sign
        const sig = await provider.request({
            method: 'personal_sign',
            params: ['hello harness', wallets[0].address],
        });
        assert.match(sig, /^0x[0-9a-f]{130}$/i,
            'sig should be 65-byte 0x-prefixed hex');
        t.diagnostic(`personal_sign → ${sig.slice(0, 18)}…`);

        // 9. eth_subscribe is rejected (forces polling fallback)
        await assert.rejects(
            () => provider.request({
                method: 'eth_subscribe',
                params: ['newHeads'],
            }),
            (err) => {
                assert.equal(err.code, -32601);
                assert.match(err.message, /not supported/i);
                return true;
            },
        );
        t.diagnostic('eth_subscribe → rejected with -32601 (consumers fall back to polling)');
    } finally {
        await killAnvil(child);
    }
});

// ── Module surface sanity ──────────────────────────────────────────

test('Phase 4 slice 1 — method classification sets are non-overlapping', () => {
    for (const m of WALLET_LOCAL_METHODS) {
        assert.ok(!SUBSCRIPTION_METHODS.has(m),
            `${m} appears in both WALLET_LOCAL_METHODS and SUBSCRIPTION_METHODS`);
    }
});
