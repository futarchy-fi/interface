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

    // Phase 7 fork-bootstrap step 2: globalSetup verifies anvil
    // reachability + chain id + synthetic-wallet pre-funding before
    // any scenario runs. Skips cleanly when HARNESS_NO_ANVIL is set
    // or anvil isn't reachable. See fixtures/fork-state-setup.mjs.
    globalSetup: './fixtures/fork-state-setup.mjs',

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
    // dev server itself; slices 1+2 also opt out since they only
    // need about:blank).
    //
    // Path is '../../' relative to this config — so Playwright runs
    // `npm run dev` from `<repo>/interface/`, where `next dev` lives.
    // Slice 1 had a stale '../../..' that pointed at /Users/kas/ —
    // fixed in slice 3 when we first actually exercised the webServer.
    //
    // **Anvil** is the second webServer entry (Phase 7 fork-bootstrap
    // step 1). Per the user's (A) decision, scenarios that read on-
    // chain state (balances via useBalanceManager, sDAI rate via
    // useSdaiRate, ERC20 allowance lookups, etc.) need a real RPC
    // endpoint backing them. Anvil forks Gnosis at the latest block,
    // and the wallet stub's `setupSigningTunnel` already routes RPC
    // to localhost:8546 — so wiring anvil here makes those reads
    // succeed end-to-end with real contract state.
    //
    // Opt-out: `HARNESS_NO_ANVIL=1` skips the anvil entry (useful
    // when an anvil is already running locally on the same port,
    // when the test doesn't need on-chain reads, or when Foundry
    // isn't installed in CI yet — that part lands in a follow-up
    // slice that updates the staged scenarios CI workflow).
    //
    // `--silent` keeps stdout quiet; `--accounts 10 --balance 10000`
    // pre-funds 10 accounts with 10k ETH each for impersonation
    // workflows. Fork URL defaults to a public Gnosis RPC and can
    // be overridden via FORK_URL.
    webServer: process.env.HARNESS_NO_WEBSERVER ? undefined : [
        {
            command: 'npm --prefix ../../ run dev',
            url: BASE_URL,
            reuseExistingServer: !process.env.CI,
            timeout: 180_000, // cold Next.js compile can be slow
            env: {
                // Force Wagmi/RainbowKit at the local anvil fork by
                // default; slice 3 overrides via HARNESS_FRONTEND_RPC_URL
                // when an anvil isn't running.
                NEXT_PUBLIC_RPC_URL:
                    process.env.HARNESS_FRONTEND_RPC_URL ||
                    process.env.HARNESS_ANVIL_URL ||
                    'http://localhost:8546',
                NEXT_PUBLIC_API_URL: process.env.HARNESS_API_URL || 'http://localhost:3031',
            },
        },
        ...(process.env.HARNESS_NO_ANVIL ? [] : [{
            command: `anvil --fork-url ${process.env.FORK_URL || 'https://rpc.gnosis.gateway.fm'} --port 8546 --chain-id 100 --accounts 10 --balance 10000 --silent`,
            url: 'http://localhost:8546',
            reuseExistingServer: !process.env.CI,
            timeout: 60_000,
        }]),
    ],
});
