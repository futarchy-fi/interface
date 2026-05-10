/**
 * app-discovery.spec.mjs — Phase 5 slice 3: Next.js dev server in the loop.
 *
 * Slices 1 + 2 ran against `about:blank` only — pure browser-injection
 * verification with no app code. Slice 3 is the first slice that
 * actually launches the futarchy Next.js dev server and navigates to
 * a real route, proving the wallet stub injects in time for app code
 * to see it.
 *
 * What slice 3 verifies (this file):
 *   1. Playwright's `webServer` block successfully starts `next dev`
 *      from interface/ (cold compile can be ~30-90s).
 *   2. `addInitScript` runs BEFORE the app's React/Wagmi hydration —
 *      i.e. `window.ethereum` is set when the app's first read of it
 *      happens.
 *   3. `window.ethereum.isHarness === true` from inside the app's
 *      page context (not just about:blank).
 *
 * What slice 3 does NOT verify (deferred to slice 4):
 *   - That RainbowKit's wallet-discovery modal lists our wallet by
 *     name — that's a UI assertion that needs RainbowKit's connect
 *     modal opened.
 *   - That a real swap/sign flow works end-to-end through the app.
 *   - The DOM↔API price invariant (the canonical Phase 5 assertion).
 *
 * Skipping rules:
 *   - Skips when `HARNESS_NO_WEBSERVER=1` is set (the slice-1+2 mode).
 *     Run via `npm run auto-qa:e2e:ui:full` to enable.
 *
 * Environment knobs:
 *   - `HARNESS_FRONTEND_RPC_URL` — overrides what the dev server's
 *     NEXT_PUBLIC_RPC_URL points at (default: localhost:8546 anvil).
 *     Set to a public Gnosis RPC if you don't have anvil running, so
 *     the app can hydrate cleanly without RPC errors.
 */

import { test, expect } from '@playwright/test';

import {
    installWalletStub,
    nStubWallets,
} from '../fixtures/wallet-stub.mjs';

const STUB_RPC_URL =
    process.env.HARNESS_FRONTEND_RPC_URL ||
    process.env.HARNESS_ANVIL_URL ||
    'http://localhost:8546';

test.describe('Phase 5 slice 3 — futarchy app + wallet auto-discovery', () => {
    test.beforeEach(({}, testInfo) => {
        if (process.env.HARNESS_NO_WEBSERVER === '1') {
            testInfo.skip(true, 'app discovery requires Next.js dev server (run :ui:full)');
        }
    });

    test('window.ethereum.isHarness is observable in the futarchy app context', async ({ context, page }) => {
        // Cold Next.js compile + first navigation can run long.
        test.setTimeout(180_000);

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        // Navigate to the homepage of the futarchy interface. We don't
        // wait for any specific selector — just confirm the page loaded
        // far enough that we can read `window.ethereum`.
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const probe = await page.evaluate(() => ({
            hasEth: !!window.ethereum,
            isMetaMask: window.ethereum?.isMetaMask,
            isHarness: window.ethereum?.isHarness,
            selectedAddress: window.ethereum?.selectedAddress,
        }));

        expect(probe.hasEth).toBe(true);
        expect(probe.isMetaMask).toBe(true);
        expect(probe.isHarness).toBe(true);
        expect(probe.selectedAddress).toBe(wallet.address);
    });
});
