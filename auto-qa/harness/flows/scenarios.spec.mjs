/**
 * scenarios.spec.mjs — Phase 6 wrapper: auto-discover + run scenarios.
 *
 * Reads `auto-qa/harness/scenarios/*.scenario.mjs`, dynamically
 * imports each one's default export (a `Scenario` object per
 * ADR-002), and emits one Playwright `test()` per scenario.
 *
 * Per scenario:
 *   1. Skip when `HARNESS_NO_WEBSERVER=1` (scenarios always need
 *      the dev server — they navigate to real routes).
 *   2. Install the default wallet stub (every scenario currently
 *      needs `window.ethereum` so the futarchy app's wagmi/RainbowKit
 *      hydrate cleanly).
 *   3. Apply each entry of `scenario.mocks` via `context.route`.
 *   4. Navigate to `scenario.route` (waitUntil: 'domcontentloaded').
 *   5. Run each `scenario.assertions[i](page)` in order.
 *
 * Top-level `await` is fine here — Playwright loads spec files as
 * ESM and resolves async imports during collection.
 *
 * Format reference: ADR-002
 *   (interface/auto-qa/harness/docs/ADR-002-scenario-format.md)
 */

import { test } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    installWalletStub,
    nStubWallets,
} from '../fixtures/wallet-stub.mjs';
import { installAnvilRpcProxy } from '../fixtures/api-mocks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENARIOS_DIR = join(__dirname, '..', 'scenarios');

const STUB_RPC_URL =
    process.env.HARNESS_FRONTEND_RPC_URL ||
    process.env.HARNESS_ANVIL_URL ||
    'http://localhost:8546';

// Discover all scenarios up-front so each gets its own stable
// Playwright `test()` registration.
const scenarioFiles = readdirSync(SCENARIOS_DIR)
    .filter((f) => f.endsWith('.scenario.mjs'))
    .sort(); // deterministic order

// Top-level await: load each scenario module before the
// `test.describe` block so Playwright sees the full test list at
// collection time.
const scenarios = await Promise.all(
    scenarioFiles.map(async (file) => {
        const url = pathToFileURL(join(SCENARIOS_DIR, file)).href;
        const mod = await import(url);
        if (!mod.default) {
            throw new Error(`scenarios/${file}: missing default export`);
        }
        return { file, scenario: mod.default };
    }),
);

test.describe('Phase 6 — captured bug-shape scenarios', () => {
    test.beforeEach(({}, testInfo) => {
        if (process.env.HARNESS_NO_WEBSERVER === '1') {
            testInfo.skip(true, 'scenarios require Next.js dev server (run :ui:full)');
        }
    });

    for (const { scenario } of scenarios) {
        // Test name: "<NN>-<short-name> — <bugShape>" so the
        // Playwright report is browseable by bug class.
        const title = `${scenario.name} — ${scenario.bugShape}`;

        test(title, async ({ context, page }) => {
            if (scenario.timeout) test.setTimeout(scenario.timeout);

            // Default wallet stub — every scenario gets a deterministic
            // dev-mnemonic wallet injected before navigation.
            const wallet = nStubWallets(1)[0];
            await context.addInitScript(installWalletStub({
                privateKey: wallet.privateKey,
                rpcUrl:     STUB_RPC_URL,
                chainId:    100,
            }));

            // Apply mocks
            for (const [url, handler] of Object.entries(scenario.mocks ?? {})) {
                await context.route(url, handler);
            }

            // Phase 7 step 5c: scenarios that need on-chain reads to land
            // on the local anvil fork (not real Gnosis mainnet) opt in
            // here. Routes the public Gnosis RPC URL set
            // (`PUBLIC_GNOSIS_RPC_URLS`) to localhost:8546 so that
            // `getBestRpcProvider(100)` and the wagmi fallback chain
            // both read from the fork — a prerequisite for any
            // assertion on a fork-funded balance.
            if (scenario.useAnvilRpcProxy) {
                await installAnvilRpcProxy(context);
            }

            // Navigate
            await page.goto(scenario.route, { waitUntil: 'domcontentloaded' });

            // Run assertions in order
            for (const assertion of scenario.assertions ?? []) {
                await assertion(page);
            }
        });
    }
});
