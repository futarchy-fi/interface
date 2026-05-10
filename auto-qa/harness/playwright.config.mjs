/**
 * Playwright config for the Forked Replay Harness — UI side.
 *
 * Phase 0 SCAFFOLD ONLY. Playwright is NOT installed yet. This file
 * documents the eventual config shape so the layout is reviewable now;
 * no @playwright/test import (would fail at module load).
 *
 * Phase 5 will:
 *   - npm i -D @playwright/test
 *   - replace the dummy export below with `export default defineConfig({...})`
 *   - install browser binaries via `npx playwright install chromium`
 *   - wire `npm run auto-qa:e2e:ui` to `playwright test`
 */

const PLANNED_CONFIG = {
    // Where the test files live. flows/ holds end-to-end user scripts;
    // invariants/ holds DOM↔API consistency assertions.
    testDir: './flows',

    // Run tests in files in parallel.
    fullyParallel: false,
    // Each scenario wants a fresh wallet + fresh anvil snapshot, so
    // parallel-within-file would leak state across tests. We intentionally
    // serialize for now; flip to true after Phase 6 if scenarios prove
    // independent.

    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,

    reporter: [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ],

    timeout: 120_000,         // 2 min per test; on-chain confirmation is slow
    expect: { timeout: 30_000 },

    use: {
        // The local Next.js dev server (started by docker compose
        // service "interface-dev" or by the webServer block below).
        baseURL: process.env.HARNESS_FRONTEND_URL || 'http://localhost:3000',

        // Capture on failure for debugging.
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',

        // Pretend to be a desktop user; the futarchy UI is desktop-first.
        viewport: { width: 1440, height: 900 },

        // Custom env injected by the wallet stub (Phase 4) — when the
        // page loads, our fixture overrides window.ethereum before
        // Wagmi/RainbowKit initializes.
        // Implementation: `await context.addInitScript({ path: 'fixtures/wallet-stub.mjs' })`
    },

    // Browser matrix.
    //
    // Start with chromium only. Add firefox + webkit once the wallet
    // stub is proven (Wagmi/RainbowKit can behave subtly differently
    // across browsers due to provider injection timing).
    projects: [
        // Phase 5 starter project:
        // {
        //     name: 'chromium',
        //     use: { ...devices['Desktop Chrome'] },
        // },
        //
        // Phase 7 expansion:
        // { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
        // { name: 'webkit',   use: { ...devices['Desktop Safari']  } },
    ],

    // Auto-launch the local Next.js dev server when not running via
    // docker-compose. In compose mode the env var skips this block.
    webServer: process.env.HARNESS_NO_WEBSERVER ? undefined : {
        command: 'npm --prefix ../../.. run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
            // Force Wagmi/RainbowKit at the local anvil fork.
            NEXT_PUBLIC_RPC_URL: 'http://localhost:8545',
            NEXT_PUBLIC_API_URL: 'http://localhost:3000',
        },
    },
};

// Phase 0: not callable yet — exporting the planned config as data so
// `node playwright.config.mjs` does NOT crash if accidentally invoked.
export default PLANNED_CONFIG;

if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('[playwright.config] Phase 0 scaffold — config not yet active.');
    console.log('Planned shape:');
    console.log(JSON.stringify(PLANNED_CONFIG, null, 2));
}
