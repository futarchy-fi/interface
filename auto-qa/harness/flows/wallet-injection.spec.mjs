/**
 * wallet-injection.spec.mjs — Phase 5 slice 1: browser injection smoke.
 *
 * Validates that `installWalletStub` injects an EIP-1193 provider that:
 *   1. Sets window.ethereum with the right surface
 *   2. Returns the configured address from eth_accounts
 *   3. Returns the configured chainId from eth_chainId
 *   4. Announces via EIP-6963 (RainbowKit auto-discovery)
 *   5. Emits chainChanged when wallet_switchEthereumChain is called
 *   6. Returns -32601 for signing methods (slice-1 deferred)
 *   7. Forwards eth_blockNumber to the configured RPC URL
 *
 * Phase 5 slice 1 deliberately AVOIDS:
 *   - Loading the futarchy Next.js app (slice 3+)
 *   - Real anvil for the RPC test (we use a tiny in-test mock server)
 *   - Real signing (slice 2 inlines @noble/secp256k1)
 *
 * Tests run against `about:blank` only — pure browser-injection
 * verification with no network or app dependencies.
 *
 * Override `HARNESS_NO_WEBSERVER=1` is set in package.json so this
 * test does NOT auto-launch the Next.js dev server.
 */

import { test, expect } from '@playwright/test';

import {
    installWalletStub,
    nStubWallets,
} from '../fixtures/wallet-stub.mjs';

// Sentinel URL for the eth_blockNumber forward test — never actually
// reached because Playwright's `context.route` intercepts it. Using a
// real-looking URL with a sentinel port (1) so any unintercepted call
// fails loudly rather than silently hanging.
const MOCK_RPC_URL = 'http://127.0.0.1:1/harness-mock-rpc';

test.describe('Phase 5 slice 1 — wallet stub browser injection', () => {
    test('window.ethereum exposes the configured address + chain', async ({ context, page }) => {
        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: 'http://127.0.0.1:1', // unused for this case
            chainId: 100,
        }));
        await page.goto('about:blank');

        const probe = await page.evaluate(async () => {
            return {
                hasEth: !!window.ethereum,
                isMetaMask: window.ethereum?.isMetaMask,
                isHarness: window.ethereum?.isHarness,
                accounts: await window.ethereum.request({ method: 'eth_accounts' }),
                chainId: await window.ethereum.request({ method: 'eth_chainId' }),
                selectedAddress: window.ethereum?.selectedAddress,
            };
        });

        expect(probe.hasEth).toBe(true);
        expect(probe.isMetaMask).toBe(true);
        expect(probe.isHarness).toBe(true);
        expect(probe.accounts).toEqual([wallet.address]);
        expect(probe.chainId).toBe('0x64');
        expect(probe.selectedAddress).toBe(wallet.address);
    });

    test('wallet_switchEthereumChain emits chainChanged', async ({ context, page }) => {
        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: 'http://127.0.0.1:1',
            chainId: 100,
        }));
        await page.goto('about:blank');

        const result = await page.evaluate(async () => {
            const events = [];
            window.ethereum.on('chainChanged', (cid) => events.push(cid));
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x1' }],
            });
            const newCid = await window.ethereum.request({ method: 'eth_chainId' });
            return { events, newCid };
        });

        expect(result.events).toEqual(['0x1']);
        expect(result.newCid).toBe('0x1');
    });

    test('eth_subscribe rejected with -32601 (per Spike-002)', async ({ context, page }) => {
        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: 'http://127.0.0.1:1',
            chainId: 100,
        }));
        await page.goto('about:blank');

        const err = await page.evaluate(async () => {
            try {
                await window.ethereum.request({
                    method: 'eth_subscribe',
                    params: ['newHeads'],
                });
                return null;
            } catch (e) {
                return { message: e.message, code: e.code };
            }
        });

        expect(err).not.toBeNull();
        expect(err.code).toBe(-32601);
    });

    test('signing methods rejected with -32601 (slice-1 scope; slice-2 enables)', async ({ context, page }) => {
        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: 'http://127.0.0.1:1',
            chainId: 100,
        }));
        await page.goto('about:blank');

        const results = await page.evaluate(async () => {
            const methods = ['personal_sign', 'eth_signTypedData_v4', 'eth_sendTransaction'];
            const out = {};
            for (const m of methods) {
                try {
                    await window.ethereum.request({ method: m, params: [] });
                    out[m] = 'unexpectedly succeeded';
                } catch (e) {
                    out[m] = { message: e.message, code: e.code };
                }
            }
            return out;
        });

        for (const m of ['personal_sign', 'eth_signTypedData_v4', 'eth_sendTransaction']) {
            expect(results[m].code).toBe(-32601);
        }
    });

    test('EIP-6963 announcement fires (RainbowKit auto-discovery)', async ({ context, page }) => {
        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: 'http://127.0.0.1:1',
            chainId: 100,
        }));
        // Set up the listener BEFORE the script runs by injecting it
        // first. addInitScript runs scripts in registration order.
        await context.addInitScript(() => {
            window.__announces = [];
            window.addEventListener('eip6963:announceProvider', (e) => {
                window.__announces.push({
                    name: e.detail.info.name,
                    rdns: e.detail.info.rdns,
                    hasProvider: typeof e.detail.provider?.request === 'function',
                });
            });
        });
        await page.goto('about:blank');

        // Trigger an explicit request — also tests that the requestProvider
        // listener replays the announcement.
        const requested = await page.evaluate(async () => {
            window.__requestAnnounces = [];
            window.addEventListener('eip6963:announceProvider', (e) => {
                window.__requestAnnounces.push(e.detail.info.rdns);
            });
            window.dispatchEvent(new Event('eip6963:requestProvider'));
            return window.__requestAnnounces;
        });

        const announces = await page.evaluate(() => window.__announces);

        // Either the original announce OR the requested re-announce
        // should have happened. Listener-registered-after-page-load
        // means we may only catch the requestProvider replay; that's fine.
        expect(announces.length + requested.length).toBeGreaterThan(0);
        // The requested replay always works (we register the listener
        // before dispatching).
        expect(requested).toContain('fi.futarchy.harness');
    });

    test('eth_blockNumber forwards to the configured RPC', async ({ context, page }) => {
        // Intercept the fetch via Playwright's network routing instead
        // of a real HTTP server. about:blank's null origin prevents
        // chromium from issuing fetches to local servers (even with
        // permissive CORS), but route() works at the network layer
        // before that check.
        const calls = [];
        await context.route(MOCK_RPC_URL, async (route) => {
            const body = JSON.parse(route.request().postData());
            calls.push(body);
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    jsonrpc: '2.0', id: body.id,
                    result: '0x' + (12345).toString(16),
                }),
            });
        });

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: MOCK_RPC_URL,
            chainId: 100,
        }));
        await page.goto('about:blank');

        const result = await page.evaluate(async () => {
            return window.ethereum.request({ method: 'eth_blockNumber' });
        });
        expect(result).toBe('0x3039');                    // 12345
        expect(calls.length).toBeGreaterThanOrEqual(1);
        expect(calls[0].method).toBe('eth_blockNumber');
    });
});
