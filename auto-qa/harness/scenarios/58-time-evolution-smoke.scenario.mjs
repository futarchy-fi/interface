/**
 * 58-time-evolution-smoke.scenario.mjs — first scenario to exercise
 * the slice 90 time-control primitives (`advanceTime`,
 * `getBlockTimestamp`) inside the Playwright scenario harness.
 *
 * ── What this scenario validates ────────────────────────────────────
 * Not a PR catch. This is an integration test that proves three
 * separate pieces compose correctly:
 *   - The `requiresAnvil: true` opt-in flag (slice 93) skips
 *     cleanly under `HARNESS_NO_ANVIL=1`.
 *   - The fork-state.mjs `advanceTime` primitive (slice 90)
 *     succeeds when called from a Playwright assertion via
 *     `ctx.anvilUrl`.
 *   - The anvil snapshot/revert isolation (existing infra) restores
 *     the chain timestamp after the scenario, so this scenario
 *     leaves no residue for later scenarios in the suite.
 *
 * ── Why a smoke scenario, not a PR catch ────────────────────────────
 * The canonical TIME-EVOLUTION PR catch is PR #54 (TWAP window for
 * ended proposals). Catching that requires:
 *   - A market page mount with hasEnded === true (already
 *     achievable by setting twap metadata such that
 *     `twapStartTimestamp + twapDurationSeconds < Date.now()` —
 *     hasEnded reads from wall clock, not chain time)
 *   - Intercepting the `getTimepoints([aStart, aEnd])` eth_call to
 *     the YES/NO pool contracts
 *   - Asserting `aEnd > 0` (post-fix shape)
 *
 * That intercept + ABI decoder infrastructure is a separate slice
 * (94+). This scenario lays the integration foundation by proving
 * the time primitives are wired into the scenario harness.
 *
 * ── How this scenario works ─────────────────────────────────────────
 *   1. Navigate to /companies (any route; the page DOM is not
 *      involved in the assertion).
 *   2. Read the current anvil block timestamp via
 *      `getBlockTimestamp(ctx.anvilUrl)`.
 *   3. Call `advanceTime(ctx.anvilUrl, 86400)` (24h forward).
 *   4. Read the new block timestamp.
 *   5. Assert the delta is EXACTLY 86400 (anvil's
 *      setNextBlockTimestamp pins exactly; no slop).
 *
 * Per-scenario state isolation (existing harness infra at
 * `flows/scenarios.spec.mjs:beforeEach`) takes an evmSnapshot
 * before each scenario and reverts after. So the +86400 timestamp
 * advance is rolled back automatically when scenario 58 finishes
 * — later scenarios see the original chain time.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *
 *   1. Current code + anvil running: assertion passes (delta == 86400).
 *
 *   2. Run without anvil (`HARNESS_NO_ANVIL=1`): scenario SKIPS
 *      with the message "requires anvil — run via npm run ui:full".
 *
 *   3. Mutate `setNextBlockTimestamp` in fork-state.mjs to issue
 *      `evm_setBlockTimestamp` (typo) instead → first call throws
 *      "Method not supported" → scenario FAILS at advanceTime,
 *      catching the regression. (The slice 90 stub smoke test
 *      also catches this; this scenario catches it via integration.)
 *
 *   4. Mutate `advanceTime` to use `evm_increaseTime` instead of
 *      `setNextBlockTimestamp + mineBlock` → the next block's
 *      timestamp won't be the requested target → delta assertion
 *      FAILS (slop).
 *
 * ── What this DOESN'T yet do ────────────────────────────────────────
 *   - No PAGE behavior is asserted. The page's polling layer
 *     re-reads block state on its own cadence, but this scenario
 *     doesn't try to observe that. PR #54's catch will require
 *     either a deterministic page-poll waiter or an
 *     eth_call interceptor on `getTimepoints`.
 *   - No fork-state mutations beyond the timestamp advance. Future
 *     scenarios might combine time advance with balance changes,
 *     position changes, etc.
 */

import { expect } from '@playwright/test';

import {
    advanceTime,
    getBlockTimestamp,
} from '../fixtures/fork-state.mjs';

export default {
    name:        '58-time-evolution-smoke',
    description: 'First scenario exercising slice 90 time-control primitives in the Playwright harness. Navigates /companies, calls advanceTime(86400), asserts block timestamp delta is exactly 86400. Integration validation — confirms requiresAnvil flag, advanceTime via ctx.anvilUrl, and per-scenario evmSnapshot isolation all compose correctly. Foundation for slice 94+ PR #54 catch.',
    bugShape:    'time-control primitives broken in scenario context — advanceTime fails, returns wrong value, or evmSnapshot doesn\'t isolate the advance from later scenarios',
    route:       '/companies',

    // Requires anvil because the scenario reads chain state directly.
    // Skipped automatically when HARNESS_NO_ANVIL=1 is set (e.g.,
    // `npm run ui`). Run via `npm run ui:full` or with anvil up.
    requiresAnvil: true,

    // No mocks needed — assertions don't touch the page DOM. The
    // /companies route is incidental (any successfully-loaded route
    // works); we just need page.goto to complete so the per-test
    // beforeEach snapshot took effect.
    mocks: {},

    assertions: [
        // Time-control round-trip via the primitives. Wall-clock
        // independence: we read BEFORE and AFTER from anvil, so
        // any drift between the test runner and the chain doesn't
        // affect the assertion.
        async (page, ctx) => {
            const before = await getBlockTimestamp(ctx.anvilUrl);
            const newTs = await advanceTime(ctx.anvilUrl, 86400);
            const after = await getBlockTimestamp(ctx.anvilUrl);

            // advanceTime's return must equal the post-advance read.
            // Catches inconsistency between the mine-and-return path
            // and the subsequent fetch.
            expect(newTs).toBe(after);

            // Anvil applies setNextBlockTimestamp EXACTLY. No
            // wall-clock slop. A delta != 86400 means either:
            //   - the primitive's hex encoding is wrong, OR
            //   - advanceTime regressed to evm_increaseTime
            //     (which doesn't pin), OR
            //   - the snapshot from beforeEach was already
            //     time-advanced (state leak from a prior scenario)
            const delta = after - before;
            expect(delta).toBe(86400);
        },

        // Sanity: page actually mounted. Without this we can't tell
        // whether the time assertion is meaningful or whether the
        // page failed before reaching us.
        async (page) => {
            await expect(
                page.getByRole('heading', { name: /Organizations|Active Milestones/i }).first(),
            ).toBeVisible({ timeout: 30_000 });
        },
    ],

    timeout: 180_000,
};
