/**
 * Playwright config for PRODUCTION-BUILD scenarios (slice 85, 8th
 * assertion-target KIND).
 *
 * Why this exists: PR #58 was a TDZ crash visible ONLY post-
 * minification. Dev mode masked it because React's strict-mode
 * re-render ordering hid the binding-before-declaration. Production
 * minification reorders bindings and the crash surfaces every load.
 * No dev-mode scenario could mechanically catch the regression
 * class.
 *
 * This config differs from `playwright.config.mjs` ONLY at the
 * webServer block: instead of `next dev` (HMR + transpiled
 * sources), it runs `next start` against a `.next/` build
 * produced by `npm run build`. The Next.js production server
 * serves minified, prerendered code — identical to what users see
 * on deploy.
 *
 * Usage:
 *   npm run build  # first — produces `out/` static export
 *   npx playwright test --config=playwright.prod.config.mjs
 *
 * Or via the wrapper script `ui:prod` (npm).
 *
 * Server: the interface uses `output: 'export'` in
 * `next.config.mjs` (when NODE_ENV !== 'development'), which
 * produces a static export in `out/`. `next start` doesn't work
 * with static exports — we use `npx serve` to serve `out/` over
 * HTTP on port 3001.
 *
 * Port choice: 3001 (vs dev's 3000) so dev and prod servers can
 * coexist on the same machine.
 */

import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.HARNESS_FRONTEND_PORT
    ? Number(process.env.HARNESS_FRONTEND_PORT)
    : 3001;
const BASE_URL =
    process.env.HARNESS_PROD_BASE_URL ||
    process.env.HARNESS_FRONTEND_URL ||
    `http://localhost:${PORT}`;

export default defineConfig({
    testDir: './flows',
    testMatch: ['flows/**/*.spec.mjs', 'invariants/**/*.spec.mjs'],

    // Prod-build runs are slower (single worker, no HMR retries), and
    // most catch power is at scenario 48-style page-error monitoring;
    // running the full 52-scenario suite under prod build is overkill
    // for one iteration. Scenarios spec discovers everything; the
    // user filters via --grep.
    fullyParallel: false,
    globalSetup: './fixtures/fork-state-setup.mjs',

    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,

    reporter: [
        ['list'],
        ['html', { outputFolder: 'playwright-prod-report', open: 'never' }],
    ],

    timeout: 120_000,
    expect: { timeout: 30_000 },

    use: {
        baseURL: BASE_URL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        viewport: { width: 1440, height: 900 },
    },

    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],

    webServer: process.env.HARNESS_NO_WEBSERVER ? undefined : [
        {
            // The interface uses `output: 'export'` so build emits
            // `out/` static files including `companies.html`,
            // `milestones.html`, etc. — Next.js static export
            // pattern. We serve via `npx serve` WITHOUT `-s` (the
            // SPA flag would catch every path with index.html
            // before per-page .html files get matched). Plain
            // `serve out/` rewrites `/companies` → `companies.html`
            // automatically.
            command: `npx serve ../../out -l ${PORT} --no-clipboard --no-port-switching`,
            url: BASE_URL,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
            env: {
                NEXT_PUBLIC_RPC_URL:
                    process.env.HARNESS_FRONTEND_RPC_URL ||
                    process.env.HARNESS_ANVIL_URL ||
                    'http://localhost:8546',
                NEXT_PUBLIC_API_URL: process.env.HARNESS_API_URL || 'http://localhost:3031',
                NEXT_PUBLIC_SUPABASE_URL:
                    process.env.HARNESS_SUPABASE_URL ||
                    'https://harness-supabase.invalid',
                NEXT_PUBLIC_SUPABASE_ANON_KEY:
                    process.env.HARNESS_SUPABASE_ANON_KEY ||
                    'harness-dummy-anon-key',
            },
        },
        // Anvil block kept identical to dev config so fork-backed
        // scenarios behave the same in prod mode.
        ...(process.env.HARNESS_NO_ANVIL ? [] : [{
            command: process.env.HARNESS_ANVIL_LOG
                ? `sh -c "anvil --fork-url ${process.env.FORK_URL || 'https://rpc.gnosis.gateway.fm'} --port 8546 --chain-id 100 --accounts 10 --balance 10000 > /tmp/anvil-harness.log 2>&1"`
                : `anvil --fork-url ${process.env.FORK_URL || 'https://rpc.gnosis.gateway.fm'} --port 8546 --chain-id 100 --accounts 10 --balance 10000 --silent`,
            url: 'http://localhost:8546',
            reuseExistingServer: !process.env.CI,
            timeout: 60_000,
        }]),
    ],
});
