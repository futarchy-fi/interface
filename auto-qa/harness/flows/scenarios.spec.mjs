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
import { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    installWalletStub,
    nStubWallets,
} from '../fixtures/wallet-stub.mjs';
import { installAnvilRpcProxy } from '../fixtures/api-mocks.mjs';
import { evmSnapshot, evmRevert, SNAPSHOT_ID_FILE } from '../fixtures/fork-state.mjs';

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
    test.beforeEach(async ({}, testInfo) => {
        if (process.env.HARNESS_NO_WEBSERVER === '1') {
            testInfo.skip(true, 'scenarios require Next.js dev server (run :ui:full)');
        }

        // Step 7: revert to globalSetup's funded snapshot before each
        // scenario, then immediately take a fresh snapshot for the
        // next iteration. anvil consumes the snapshot ID on revert,
        // so we re-snapshot after every revert and persist the new
        // ID back to the same file. **Skip cleanly when no snapshot
        // file exists** (e.g., HARNESS_NO_ANVIL was set during
        // globalSetup); that's a deliberate fork-less mode, not an
        // error. Same for missing anvil.
        if (process.env.HARNESS_NO_ANVIL || !existsSync(SNAPSHOT_ID_FILE)) {
            return;
        }
        const anvilUrl = STUB_RPC_URL;
        try {
            const id = readFileSync(SNAPSHOT_ID_FILE, 'utf8').trim();
            // Step 13 instrumentation: time the revert + snapshot
            // pair to see when (and which scenarios) hit the slow
            // path. Logged unconditionally so the timing pattern
            // shows up in CI artifacts too.
            const startedAt = Date.now();
            await evmRevert(anvilUrl, id);
            const revertedAt = Date.now();
            const newId = await evmSnapshot(anvilUrl);
            const snapshottedAt = Date.now();
            writeFileSync(SNAPSHOT_ID_FILE, newId, 'utf8');
            const revertMs = revertedAt - startedAt;
            const snapMs = snapshottedAt - revertedAt;
            // Only log when slow enough to matter (>500ms) — keeps
            // the test output quiet on the happy path.
            if (revertMs > 500 || snapMs > 500) {
                console.log(`[scenarios] beforeEach for "${testInfo.title}" — revert=${revertMs}ms snapshot=${snapMs}ms`);
            }
        } catch (err) {
            // Step 9: bail on isolation for the rest of the run.
            // Once revert fails, the snapshot ID is consumed and the
            // file points at a dead ID — every subsequent beforeEach
            // would then time out the same way (30s × N scenarios =
            // multi-minute overhead for nothing). Deleting the file
            // makes the existsSync() check above short-circuit on
            // every later scenario, returning immediately. Scenarios
            // that don't mutate state still pass — they just lose
            // the cross-scenario isolation guarantee. The first
            // failure logs the actual cause; subsequent scenarios
            // run silently, no warning spam.
            console.warn(`[scenarios] snapshot revert FAILED: ${err.message}`);
            console.warn('[scenarios] disabling per-scenario state isolation for the rest of this run (deleting snapshot file)');
            try { unlinkSync(SNAPSHOT_ID_FILE); } catch { /* file may already be gone */ }
        }
    });

    for (const { scenario } of scenarios) {
        // Test name: "<NN>-<short-name> — <bugShape>" so the
        // Playwright report is browseable by bug class.
        const title = `${scenario.name} — ${scenario.bugShape}`;

        test(title, async ({ context, page }, testInfo) => {
            if (scenario.timeout) test.setTimeout(scenario.timeout);

            // Slice 87: prod-mode opt-in. Scenarios that target
            // behavior only present in the static export (e.g.
            // src/pages/404.js's redirect useEffect, which `next
            // dev` never serves — dev uses its built-in 404)
            // declare `prodModeOnly: true`. ui:prod sets
            // HARNESS_PROD_MODE=1; ui:full / ui:ui leave it unset.
            if (scenario.prodModeOnly && !process.env.HARNESS_PROD_MODE) {
                testInfo.skip(true, `scenario "${scenario.name}" is prod-mode-only — run via npm run ui:prod`);
            }

            // Default wallet stub — every scenario gets a deterministic
            // dev-mnemonic wallet injected before navigation.
            const wallet = nStubWallets(1)[0];
            await context.addInitScript(installWalletStub({
                privateKey: wallet.privateKey,
                rpcUrl:     STUB_RPC_URL,
                chainId:    100,
            }));

            // Step 79: page-error monitor. Attached BEFORE navigation
            // so it catches errors emitted during initial render. Two
            // event sources:
            //   - `pageerror`: uncaught JS exceptions in the page
            //     context (e.g., TDZ crashes from PR #58-style bugs,
            //     React render exceptions that escape error boundaries)
            //   - `console.error`: explicit error-level logs from the
            //     page (e.g., useAggregatorProposals' console.warn on
            //     subgraph errors — note: warn level NOT counted here,
            //     only level === 'error')
            // The collector lives on the assertion ctx so scenarios
            // can examine it directly OR opt into the catch-all check
            // via `assertNoPageErrors: true` (handled below the
            // assertion loop). Existing scenarios are unaffected —
            // they don't set the flag, the array fills silently.
            // Step 82: network-request monitor. Captures every
            // outbound request the page makes (including those
            // satisfied by context.route mocks; those still fire
            // 'request' before the route handler resolves them).
            // Scenarios use this to assert:
            //   - REQUIRED URLs were called (positive shape)
            //   - DEPRECATED URLs were NOT called (negative shape;
            //     guards against regressions to old endpoints)
            //   - call count stays within budget (no retry storms)
            // Distinct from page-error monitor: catches SILENT
            // network regressions where the wrong URL succeeds OR
            // the page floods a healthy endpoint without errors.
            const networkRequests = [];
            page.on('request', (req) => {
                networkRequests.push({
                    url:        req.url(),
                    method:     req.method(),
                    resourceType: req.resourceType(),
                    timestamp:  Date.now(),
                });
            });

            const pageErrors = [];
            page.on('pageerror', (err) => {
                pageErrors.push({
                    kind:    'pageerror',
                    message: err.message,
                    stack:   err.stack,
                });
            });
            page.on('console', (msg) => {
                if (msg.type() === 'error') {
                    // Capture location too — browser-emitted resource
                    // 404 errors (whose text is just "Failed to load
                    // resource: ...") only become diagnosable when
                    // the URL is included.
                    const loc = msg.location?.();
                    const url = loc?.url ? ` @ ${loc.url}` : '';
                    pageErrors.push({
                        kind:    'console.error',
                        message: msg.text() + url,
                    });
                }
            });

            // Slice 86: build the assertion ctx early so factory-
            // form `mocks` can attach state to it (e.g., a strict-
            // schema mock that pushes each rejected query so the
            // assertion can verify "no legacy shape leaked"). The
            // proxy-dependent fields (`withProxyPaused`) get
            // patched in below once `proxyHandler` is known. Object
            // identity is preserved so the mock's closure and the
            // assertion see the same `ctx`.
            const ctx = {
                wallet,
                anvilUrl:        STUB_RPC_URL,
                withProxyPaused: async (fn) => fn(), // overwritten below if proxy active
                pageErrors,
                networkRequests,
                callsTo: (pattern) => networkRequests.filter((r) =>
                    pattern instanceof RegExp
                        ? pattern.test(r.url)
                        : r.url.includes(pattern),
                ),
            };

            // Apply mocks. Scenarios that need to share state with
            // assertions pass a FACTORY function for `mocks` —
            // invoked here with the live `ctx` so the closure sees
            // the same scope as the assertions below. Plain-object
            // `mocks` are still supported for the common case.
            const mocksObj = typeof scenario.mocks === 'function'
                ? scenario.mocks(ctx)
                : (scenario.mocks ?? {});
            for (const [url, handler] of Object.entries(mocksObj)) {
                await context.route(url, handler);
            }

            // Phase 7 step 5c: scenarios that need on-chain reads to land
            // on the local anvil fork (not real Gnosis mainnet) opt in
            // here. Routes the public Gnosis RPC URL set
            // (`PUBLIC_GNOSIS_RPC_URLS`) to localhost:8546 so that
            // `getBestRpcProvider(100)` and the wagmi fallback chain
            // both read from the fork — a prerequisite for any
            // assertion on a fork-funded balance.
            //
            // Step 17: capture the proxy handler so its `withPaused`
            // API can be threaded into the assertion context. Mutating
            // scenarios wrap their fork writes in `withProxyPaused`
            // to block page polling during the mutation window —
            // anvil sees only the mutation traffic (which goes direct,
            // not via the proxy), avoiding the request-queue
            // saturation that caused the cold-anvil #17 timeout.
            let proxyHandler = null;
            if (scenario.useAnvilRpcProxy) {
                ({ handler: proxyHandler } = await installAnvilRpcProxy(context));
                ctx.withProxyPaused = proxyHandler.withPaused;
            }

            // Navigate
            await page.goto(scenario.route, { waitUntil: 'domcontentloaded' });

            // ctx was built earlier (slice 86); proxy fields were
            // patched in if `useAnvilRpcProxy` is true. Live fields:
            //   - wallet              (Step 10)
            //   - anvilUrl            (Step 10)
            //   - withProxyPaused     (Step 17)
            //   - pageErrors          (Step 79 page-error monitor)
            //   - networkRequests     (Step 82 network monitor)
            //   - callsTo(pattern)    (Step 82 helper)
            //   - any field a factory-mocks closure attached
            //     during scenario.mocks(ctx) — slice 86 strict
            //     schema mock uses `ctx.strictSchemaViolations`.

            // Run assertions in order
            for (const assertion of scenario.assertions ?? []) {
                await assertion(page, ctx);
            }

            // Step 79: opt-in catch-all assertion that no page error
            // fired during the scenario. Scenarios that EXPECT errors
            // (e.g., scenario 02 simulates registry 502 which the
            // consumer logs via console.warn — not error level — but
            // future chaos scenarios may explicitly produce errors)
            // do NOT set this flag. Scenarios that want to guard
            // against silent JS regressions DO set it.
            //
            // `excludePageErrors` lets a scenario filter out
            // known-benign errors via predicate or regex array.
            // Default: any pageerror or console.error fails the test.
            if (scenario.assertNoPageErrors) {
                const excluded = scenario.excludePageErrors ?? [];
                const matchesExcluded = (err) => excluded.some((rule) => {
                    if (typeof rule === 'function') return rule(err);
                    if (rule instanceof RegExp)    return rule.test(err.message);
                    return err.message.includes(rule);
                });
                const fatal = pageErrors.filter((e) => !matchesExcluded(e));
                if (fatal.length > 0) {
                    const summary = fatal
                        .map((e) => `[${e.kind}] ${e.message}`)
                        .join('\n');
                    throw new Error(
                        `Scenario "${scenario.name}" produced ${fatal.length} ` +
                        `unexpected page error(s):\n${summary}`,
                    );
                }
            }
        });
    }
});
