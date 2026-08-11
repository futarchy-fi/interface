/**
 * 69-no-page-errors-milestones.scenario.mjs — sister of scenario 48
 * (page-error monitor on /companies) on the /milestones surface.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Same KIND as scenario 48 (silent JS errors that DOM-text/network/
 * URL/visual monitors miss) — on a third user-facing surface.
 *
 * The {48, 10-23, 69} ensemble pins the page-error monitor across
 * all three user-facing surface families:
 *
 *   - **48**: /companies (single scenario, pure monitor catch).
 *   - **10-23**: /markets/<probe> (14 scenarios all opt in via
 *     `assertNoPageErrors: true`; the monitor runs alongside each
 *     scenario's primary catch).
 *   - **69 (this)**: /milestones (single scenario, pure monitor
 *     catch).
 *
 * Specifically catches errors in code paths that ONLY /milestones
 * exercises and that no other scenario surface walks through:
 *   - `/pages/milestones.js` mount logic
 *   - `LEGACY_ID_TO_ORG_ADDRESS` mapping resolution
 *   - `useOrganization` hook on the slug entry point
 *   - Milestones-list rendering (distinct from the
 *     MarketPageShowcase render path covered by 10-23)
 *
 * A refactor to /pages/milestones.js that introduces a TDZ-style
 * error (PR #58 class) or a `Cannot read properties of undefined`
 * error in the slug-resolution useEffect would:
 *   - Pass scenarios 49 (URL rewrite — different code path) and 63
 *     (network shape on legacy-id mapping — different catch
 *     direction) because the error fires AFTER their catch points.
 *   - Pass scenarios 10-23 because /milestones doesn't appear in
 *     their navigation.
 *   - Fail THIS scenario via the page-error monitor.
 *
 * ── How the assertion works ─────────────────────────────────────────
 * Identical to scenario 48: `assertNoPageErrors: true` opt-in
 * flag fires the page-error monitor (slice 79 capability). After
 * the anchor assertion passes, the runner checks `ctx.pageErrors`
 * is empty modulo the BASELINE exclusions.
 *
 * Why BASELINE_PAGE_ERROR_EXCLUSIONS (not MARKET_PAGE_*): the
 * /milestones?company_id=<slug> path does NOT mount
 * MarketPageShowcase (no `#milestone:` hash provided here, distinct
 * from scenario 49's URL). So we don't need the market-page-
 * specific exclusion bucket; the universal baseline is sufficient.
 *
 * ── Mock & anchor choices ───────────────────────────────────────────
 * Uses `/milestones?company_id=gnosis` (slug form) so the post-PR-
 * 50 `LEGACY_ID_TO_ORG_ADDRESS` mapping resolves to Gnosis DAO's
 * on-chain address, exercises the slug → address branch (different
 * from scenario 63's numeric `?company_id=9` branch).
 *
 * Registry mock returns one org with PROBE_ORG_NAME so a stable
 * text anchor renders. Candles mock kept happy too so the milestone
 * cards (if rendered) don't throw on missing price data.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: scenario PASSES.
 *   2. Inject `console.error('HARNESS-VALIDATION-PROBE-69')` into
 *      /pages/milestones.js's mount useEffect → scenario FAILS
 *      with the probe message in the thrown error summary.
 *   3. Restore → PASSES.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    makeGraphqlMockHandler,
    makeCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';
import { BASELINE_PAGE_ERROR_EXCLUSIONS } from '../fixtures/page-error-exclusions.mjs';

export default {
    name:        '69-no-page-errors-milestones',
    description: 'Sister of scenario 48 on the /milestones surface. Asserts /milestones?company_id=gnosis loads without uncaught JS exceptions or console.error logs. Catches silent JS errors in /pages/milestones.js + useOrganization slug-resolution path + milestones-list rendering — surfaces NOT covered by 48 (/companies) or scenarios 10-23 (market-page surface).',
    bugShape:    'Silent JS error in /milestones-only code (TDZ-style ReferenceError, undefined-property access in LEGACY_ID_TO_ORG_ADDRESS slug-resolution useEffect, milestones-list-render-only crash) that leaves DOM visually intact but breaks a feature. Untriggered by /companies scenarios 48 + market-page scenarios 10-23.',
    route:       '/milestones?company_id=gnosis',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({}),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({ prices: {} }),
    },

    // Opt into the page-error monitor's catch-all assertion.
    // After the anchor assertion completes, the runner asserts
    // `ctx.pageErrors` is empty modulo the baseline exclusions.
    assertNoPageErrors: true,

    // /milestones?company_id=<slug> exercises the milestones-list
    // path, NOT MarketPageShowcase (no `#milestone:` hash). The
    // universal BASELINE is the base; one /milestones-specific
    // narrow exclusion below covers a real-RPC test-mode artifact.
    excludePageErrors: [
        ...BASELINE_PAGE_ERROR_EXCLUSIONS,
        // Test-mode artifact: RainbowKit/Wagmi auto-init pings a
        // public ETH-mainnet RPC during boot. The harness doesn't
        // mock public RPCs, so under network load the upstream
        // returns 408 Request Timeout. The error surfaces as a
        // console.error from the browser's resource-load failure,
        // not from app code — it's not a real bug. Narrow regex
        // matches only the failed-resource-load message tied to
        // drpc.org. Same family as the localhost:8546 anvil-
        // unreachable exclusion in BASELINE.
        /Failed to load resource.*status of \d+.*drpc\.org/,
    ],

    assertions: [
        // Mount anchor — proves the page chrome rendered. The
        // /milestones page resolves the slug "gnosis" to Gnosis
        // DAO's REAL address (not PROBE_ORG_ID), so the probe org
        // name from the mock won't appear there — the page queries
        // for a different address via useOrganization(id: $id).
        // Anchor on the shared Header instead, which is identical
        // across /companies, /markets, and /milestones. "Connect
        // Wallet" is a stable Header text element when no wallet
        // is connected (verified in scenarios 3b + 51 + 62).
        // Without this anchor, a completely-blank page (no errors)
        // would vacuously pass — same defensive pattern as
        // scenario 48.
        async (page) => {
            await expect(
                page.getByText('Connect Wallet').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Give the milestones-specific code (slug resolution +
        // useOrganization fetch + list render path) time to fire
        // its useEffects. Most surface-mount errors land in the
        // first ~1s; 3s slack covers slow CI machines and gives
        // late-mounting card components a chance to error out
        // before the page-error monitor checks the array.
        async (page) => {
            await page.waitForTimeout(3000);
        },
    ],

    timeout: 180_000,
};
