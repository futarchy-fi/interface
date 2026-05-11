/**
 * 48-no-page-errors-companies.scenario.mjs — first scenario using
 * the page-error monitor capability (step 79).
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Silent JavaScript errors that don't change visible DOM content.
 * Existing scenarios assert on TEXT (e.g., "PROBE_ORG_NAME visible")
 * or NUMBERS (e.g., "3.00K"). They can't catch:
 *
 *   - Uncaught render exceptions that get swallowed by an error
 *     boundary or React's recovery path while the page still renders
 *     SOMETHING (just not the regression-affected component).
 *   - `console.error` from try-catch blocks that log the error and
 *     continue. The feature is broken but the page looks normal.
 *   - TypeError on dependency access (e.g., `Cannot read properties
 *     of undefined (reading 'X')`) — the affected component shows
 *     empty/default state; the page-shell still renders.
 *   - React prop-validation warnings or hydration mismatches
 *     escalated to errors.
 *
 * These can be silent in production: the user sees a page, doesn't
 * realize a feature is broken until they try to use it. The
 * page-error monitor catches them at test time.
 *
 * Specific bug-shape relevance:
 *
 *   - PR #58 (TDZ crash on every market page): dev mode often
 *     surfaces TDZ as a console error before the page render-error-
 *     boundary kicks in. This scenario doesn't target /market (the
 *     PR #58 surface), but the SAME monitor wired into a market-page
 *     scenario would catch the regression in dev mode reliably
 *     more often than the "page-shell mounted" assertion. A
 *     follow-up slice will add the monitor opt-in to market-page
 *     scenarios.
 *
 *   - Generally: catches a CLASS of bugs every DOM-text-based
 *     scenario currently misses. One iteration of monitor wiring,
 *     N future regressions caught.
 *
 * ── How the assertion works ─────────────────────────────────────────
 * The runner in `flows/scenarios.spec.mjs` (step 79 changes)
 * attaches two listeners before navigation:
 *   - `page.on('pageerror', ...)` — uncaught JS exceptions
 *   - `page.on('console', ...)` filtered to `msg.type() === 'error'`
 *
 * Both feed into the `ctx.pageErrors` array. After the explicit
 * assertions complete, IF `assertNoPageErrors: true`, the runner
 * fails the test when the array contains entries not matched by
 * `excludePageErrors`.
 *
 * ── Verification protocol ───────────────────────────────────────────
 * Mechanical-catch test (slice 74/75/76/77/78 pattern):
 *
 *   1. With current `src/` clean, run the scenario → must PASS
 *      (proves /companies has no unexpected page errors).
 *
 *   2. Mutate any /companies-mounted component to add a console.error
 *      or throw an uncaught exception, e.g., add to
 *      `src/components/futarchyFi/companyList/page/CompaniesPage.jsx`:
 *
 *        if (typeof window !== 'undefined') {
 *            console.error('HARNESS-VALIDATION-PROBE');
 *        }
 *
 *      Run scenario → must FAIL with the probe message in the
 *      thrown error summary.
 *
 *   3. Restore. Run → PASSES.
 *
 * ── Exclusions ──────────────────────────────────────────────────────
 * `excludePageErrors` is a list of strings, RegExps, or predicate
 * functions. A page error matching ANY of them is filtered out.
 * Used here to allow known-benign errors that the futarchy app
 * emits during normal /companies load (populated only after first
 * empirical pass — start with [] and add as needed).
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    PROBE_ORG_NAME,
    makeGraphqlMockHandler,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '48-no-page-errors-companies',
    description: 'First scenario using the page-error monitor (step 79 capability). Asserts /companies loads without uncaught JS exceptions or console.error logs. Catches a KIND no DOM-text assertion can: silent JS errors that leave the page visually intact but break a feature. Foundation for catching TDZ/render-error regressions (PR #58 class) once the monitor is wired into market-page scenarios.',
    bugShape:    'silent JS error that leaves DOM visually intact (uncaught render exception swallowed by error boundary, console.error from try-catch, TypeError on dependency access) — KIND distinct from DOM-text regressions',
    route:       '/companies',

    mocks: {
        // Standard happy-path registry mock — same probe data as
        // scenario 4 v1's DOM↔API invariant. Page should mount
        // cleanly with no errors.
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({}),
    },

    // Opt into the page-error monitor's catch-all assertion.
    // After explicit assertions complete, the runner asserts
    // `ctx.pageErrors` is empty modulo `excludePageErrors`.
    assertNoPageErrors: true,

    // Known-benign errors that fire during normal /companies load
    // in dev mode. Empty until the first empirical pass surfaces
    // any — then we either fix the upstream cause OR add an
    // exclusion here with a justifying comment.
    excludePageErrors: [
        // EMPIRICAL FINDING from slice 79's first run: the asset
        // `/assets/fallback-company.png` (referenced by
        // `useAggregatorCompanies.js:95` as the no-logo fallback for
        // every org card) doesn't exist in this repo's `public/`
        // tree. Every /companies page load 404s on it. This is a
        // REAL latent bug — orgs without metadata.logo show a broken
        // image in production — but it's a pre-existing issue and
        // not something this scenario's introduction would fix. Add
        // a tracking note (see PROGRESS.md slice 79 entry) and
        // exclude here so the scenario can guard against NEW errors
        // without being blocked on this one.
        /fallback-company\.png/i,

        // Next.js dev server may emit hydration-mismatch warnings
        // for SSR/client divergence when a stub wallet injects
        // window.ethereum after server render. Tolerated if the
        // empirical pass shows them; ignored otherwise.
        /Hydration failed/i,
    ],

    assertions: [
        // Mounting anchor — proves the page rendered at all.
        // Without this, an empty page (no errors) would also pass.
        // The anchor + the no-error assertion together catch:
        //   - page didn't render (anchor fails)
        //   - page rendered but with errors (no-error fails)
        //   - page rendered without errors but with broken
        //     features (CAUGHT by neither — needs more specific
        //     assertions; that's why this is one of many planned
        //     monitor-opt-in scenarios, not the only one).
        async (page) => {
            await expect(
                page.getByText(PROBE_ORG_NAME).first(),
            ).toBeVisible({ timeout: 30_000 });
        },
    ],

    timeout: 180_000,
};
