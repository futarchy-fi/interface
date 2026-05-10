/**
 * Playwright config for the Forked Replay Harness — UI side.
 *
 * Phase 5 slice 1: real config now that @playwright/test is installed.
 * The browser matrix starts with chromium-only; firefox + webkit
 * deferred to Phase 7.
 *
 * Tests live in `flows/` (end-to-end user scripts) and `invariants/`
 * (DOM↔API consistency assertions). Both are picked up by `testDir`.
 *
 * The `webServer` block auto-launches the futarchy Next.js dev server
 * unless `HARNESS_NO_WEBSERVER=1` is set (used when the harness is
 * driven by docker-compose, which manages the dev server itself).
 *
 * Wallet stub injection is per-test via `addInitScript` (see
 * `fixtures/wallet-stub.mjs::installWalletStub`).
 */

import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.HARNESS_FRONTEND_PORT
    ? Number(process.env.HARNESS_FRONTEND_PORT)
    : 3000;
const BASE_URL = process.env.HARNESS_FRONTEND_URL || `http://localhost:${PORT}`;

export default defineConfig({
    testDir: './flows',
    // Also pick up tests in invariants/ when present.
    testMatch: ['flows/**/*.spec.mjs', 'invariants/**/*.spec.mjs'],

    fullyParallel: false,
    // Each scenario wants a fresh wallet + fresh anvil snapshot, so
    // parallel-within-file would leak state across tests. Flip to true
    // after Phase 6 if scenarios prove independent.

    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,

    reporter: [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ],

    timeout: 120_000,        // 2 min per test; on-chain confirmation is slow
    expect: { timeout: 30_000 },

    use: {
        baseURL: BASE_URL,

        // Capture on failure for debugging.
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',

        // Desktop-first viewport — the futarchy UI is desktop-first.
        viewport: { width: 1440, height: 900 },
    },

    // Phase 5 starter project (chromium only). Add firefox + webkit
    // in Phase 7 once the wallet stub is proven across browsers.
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    // Auto-launch local Next.js when not running inside docker compose.
    // The HARNESS_NO_WEBSERVER env opts out (compose mode runs the
    // dev server itself).
    webServer: process.env.HARNESS_NO_WEBSERVER ? undefined : {
        command: 'npm --prefix ../../.. run dev',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
            // Force Wagmi/RainbowKit at the local anvil fork.
            NEXT_PUBLIC_RPC_URL: process.env.HARNESS_ANVIL_URL || 'http://localhost:8546',
            NEXT_PUBLIC_API_URL: process.env.HARNESS_API_URL || 'http://localhost:3031',
        },
    },
});
