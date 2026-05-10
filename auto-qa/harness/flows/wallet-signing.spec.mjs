/**
 * wallet-signing.spec.mjs — Phase 5 slice 2: in-page signing via tunnel.
 *
 * Slice 2 enables the SIGNING_METHODS subset of EIP-1193
 * (personal_sign, eth_signTypedData_v4, eth_sendTransaction) inside
 * the browser-injected wallet stub. Mechanism: `setupSigningTunnel`
 * (in `fixtures/wallet-stub.mjs`) registers a Playwright
 * `exposeBinding` named `__harnessSign` that the in-page stub calls
 * for any SIGNING_METHODS request. The handler in node uses viem to
 * sign, so the privateKey never enters the page and we get the same
 * signing semantics as the in-process `createProvider`.
 *
 * This file deliberately avoids inlining @noble/secp256k1 +
 * EIP-712 hashing + EIP-1559 serialization into the addInitScript
 * blob — the tunnel approach is ~30 lines vs ~30 KB of crypto code.
 *
 * Test cases:
 *
 *   1. personal_sign — sign a string in the page, recover the signer
 *      via viem in node, assert it matches the wallet address.
 *
 *   2. eth_signTypedData_v4 — sign a minimal EIP-712 message in the
 *      page, recover via viem, assert the address matches.
 *
 *   3. eth_sendTransaction (live anvil; SKIPPED when anvil missing)
 *      — sign + broadcast a small XDAI transfer, await the receipt,
 *      assert status=success and recipient balance increased by the
 *      sent value (recipient is freshly generated to avoid the
 *      anvil dev-account lazy-funding quirk — see Phase 4 slice 3
 *      in `tests/smoke-wallet-stub.test.mjs`).
 */

import { test, expect } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

import {
    recoverMessageAddress,
    recoverTypedDataAddress,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

import {
    installWalletStub,
    nStubWallets,
    setupSigningTunnel,
} from '../fixtures/wallet-stub.mjs';

// ── anvil lifecycle helpers (mirrors smoke-wallet-stub.test.mjs) ──

const FORK_URL = process.env.FORK_URL || 'https://rpc.gnosis.gateway.fm';
const ANVIL_READY_TIMEOUT_MS = 30_000;

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
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', () => {});
    child.stderr.on('data', () => {});

    const start = Date.now();
    while (Date.now() - start < ANVIL_READY_TIMEOUT_MS) {
        try {
            const r = await fetch(`http://127.0.0.1:${port}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [],
                }),
                signal: AbortSignal.timeout(1000),
            });
            if (r.ok && (await r.json()).result) return child;
        } catch { /* not ready */ }
        await wait(250);
    }
    child.kill('SIGTERM');
    throw new Error(`anvil not ready within ${ANVIL_READY_TIMEOUT_MS}ms`);
}

async function killAnvil(child) {
    if (!child || child.killed) return;
    child.kill('SIGTERM');
    await new Promise((res) => child.once('exit', res));
}

async function rpcCall(url, method, params = []) {
    const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const j = await r.json();
    if (j.error) throw new Error(`${method}: ${j.error.message}`);
    return j.result;
}

// Poll eth_getTransactionReceipt until non-null. Anvil with default
// settings auto-mines on each tx, but viem returns the hash before
// the auto-mine settles — receipt can be momentarily null.
async function waitForReceipt(rpcUrl, txHash, timeoutMs = 5_000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const r = await rpcCall(rpcUrl, 'eth_getTransactionReceipt', [txHash]);
        if (r) return r;
        await wait(50);
    }
    throw new Error(`receipt not available within ${timeoutMs}ms (txHash=${txHash})`);
}

test.describe('Phase 5 slice 2 — in-page signing via tunnel', () => {
    test('personal_sign — page signs, node recovers address', async ({ context, page }) => {
        const wallet = nStubWallets(1)[0];
        await setupSigningTunnel(context, {
            privateKey: wallet.privateKey,
            rpcUrl: 'http://127.0.0.1:1', // unused for personal_sign
            chainId: 100,
        });
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: 'http://127.0.0.1:1',
            chainId: 100,
        }));
        await page.goto('about:blank');

        const message = 'Hello, harness! Phase 5 slice 2.';
        const signature = await page.evaluate(async (msg) => {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            return window.ethereum.request({
                method: 'personal_sign',
                params: [msg, accounts[0]],
            });
        }, message);

        expect(signature).toMatch(/^0x[0-9a-f]+$/i);
        const recovered = await recoverMessageAddress({ message, signature });
        expect(recovered).toBe(wallet.address);
    });

    test('eth_signTypedData_v4 — EIP-712 sign + recover', async ({ context, page }) => {
        const wallet = nStubWallets(1)[0];
        await setupSigningTunnel(context, {
            privateKey: wallet.privateKey,
            rpcUrl: 'http://127.0.0.1:1',
            chainId: 100,
        });
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: 'http://127.0.0.1:1',
            chainId: 100,
        }));
        await page.goto('about:blank');

        // Minimal EIP-712 typed data — not a real protocol payload,
        // just enough surface to exercise the signing path.
        const typedData = {
            domain: {
                name: 'Futarchy Harness',
                version: '1',
                chainId: 100,
                verifyingContract: '0x0000000000000000000000000000000000000001',
            },
            types: {
                Greeting: [
                    { name: 'from',    type: 'address' },
                    { name: 'message', type: 'string'  },
                ],
            },
            primaryType: 'Greeting',
            message: {
                from: wallet.address,
                message: 'Hello from slice 2',
            },
        };

        const signature = await page.evaluate(async ({ addr, td }) => {
            return window.ethereum.request({
                method: 'eth_signTypedData_v4',
                params: [addr, JSON.stringify(td)],
            });
        }, { addr: wallet.address, td: typedData });

        expect(signature).toMatch(/^0x[0-9a-f]+$/i);
        const recovered = await recoverTypedDataAddress({ ...typedData, signature });
        expect(recovered).toBe(wallet.address);
    });

    test('eth_sendTransaction — sign + broadcast against live anvil', async ({ context, page }) => {
        test.skip(!whichAnvil(), 'anvil not on PATH');
        test.setTimeout(60_000);

        const port = 8552;
        const rpcUrl = `http://127.0.0.1:${port}`;
        const anvil = await spawnAnvil(port);

        try {
            const wallet = nStubWallets(1)[0];

            // Use a freshly-generated recipient so the anvil dev-
            // account lazy-funding quirk doesn't poison the
            // recipient-balance assertion (see Phase 4 slice 3 fix).
            const recipientKey = generatePrivateKey();
            const recipient = privateKeyToAccount(recipientKey).address;

            await setupSigningTunnel(context, {
                privateKey: wallet.privateKey,
                rpcUrl,
                chainId: 100,
            });
            await context.addInitScript(installWalletStub({
                privateKey: wallet.privateKey,
                rpcUrl,
                chainId: 100,
            }));
            await page.goto('about:blank');

            // 0.5 XDAI in wei.
            const valueWei = '0x' + (5n * 10n ** 17n).toString(16);

            const txHash = await page.evaluate(async ({ to, value }) => {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                return window.ethereum.request({
                    method: 'eth_sendTransaction',
                    params: [{ from: accounts[0], to, value }],
                });
            }, { to: recipient, value: valueWei });

            expect(txHash).toMatch(/^0x[0-9a-f]{64}$/);

            const receipt = await waitForReceipt(rpcUrl, txHash);
            expect(receipt.status).toBe('0x1');

            const balHex = await rpcCall(rpcUrl, 'eth_getBalance', [recipient, 'latest']);
            expect(BigInt(balHex)).toBe(5n * 10n ** 17n);
        } finally {
            await killAnvil(anvil);
        }
    });
});
