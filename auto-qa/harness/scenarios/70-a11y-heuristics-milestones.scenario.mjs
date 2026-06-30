/**
 * 70-a11y-heuristics-milestones.scenario.mjs — sister of scenarios
 * 52 (/companies) + 67 (/markets) on the /milestones surface.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Same KIND as scenarios 52 + 67 (a11y violations invisible to
 * every other monitor) — on a third user-facing surface.
 *
 * The {52, 67, 70} ensemble completes the 3-surface grid for a11y
 * heuristics:
 *
 *   - **52**: /companies (first scenario; established the KIND).
 *   - **67**: /markets/<probe> (second scenario; refined the
 *     heuristic to skip aria-hidden + accept title).
 *   - **70 (this)**: /milestones (third scenario; opens the
 *     /milestones surface for a11y catches).
 *
 * Specifically catches a11y regressions in:
 *   - The slug-resolution + org-name rendering chain that
 *     /milestones-only code paths walk through
 *   - The milestones-list components (distinct from the
 *     /companies CompaniesListCarousel and the
 *     MarketPageShowcase trees)
 *   - Any milestone-specific badge / button / input element
 *     added without a label
 *
 * A market-page or /companies a11y baseline change wouldn't
 * regress /milestones; conversely a milestones-specific a11y bug
 * is invisible to scenarios 52 + 67. Three surfaces × inline
 * heuristics = three independent baselines.
 *
 * ── Fixture duplication, deferred extraction ────────────────────────
 * The A11Y_HEURISTICS function below is byte-for-byte the same as
 * scenario 67's (with the slice 289 refinements: aria-hidden skip +
 * title-as-accessible-name). Three copies (52 inline, 67 inline,
 * 70 inline) now exist. Extraction to a shared
 * `fixtures/a11y-heuristics.mjs` is the right NEXT-slice move:
 *
 *   - 3 consumers > 2 (the slice 289 deferral threshold).
 *   - Back-porting the aria-hidden + title refinements to
 *     scenario 52 retroactively (52 currently lacks them; runs
 *     green only because /companies happens not to surface those
 *     specific element types).
 *   - Centralizing the heuristic means future refinements
 *     (e.g., aria-current handling, label-by-fieldset) update
 *     ONE place.
 *
 * Deferred to a dedicated refactor slice. This slice focuses on
 * SURFACE COVERAGE (the new catch), not refactoring (which adds
 * orthogonal risk).
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: scenario PASSES with empirically-populated
 *      KNOWN_BASELINE.
 *   2. Strip alt from any /milestones-mounted image OR add a
 *      no-aria-label icon button → scenario FAILS with the new
 *      violation listed.
 *   3. Restore → PASSES.
 *
 * ── Empirically discovered baseline ─────────────────────────────────
 * (Populated after first run — see KNOWN_BASELINE below.)
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    makeGraphqlMockHandler,
    makeCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';
import { A11Y_HEURISTICS, isKnownViolation } from '../fixtures/a11y-heuristics.mjs';

// Slice 293: A11Y_HEURISTICS extracted to a shared fixture.
// This scenario was the third inline copy (after 52 and 67) and
// triggered the extraction. The fixture carries the slice 289
// refinements (aria-hidden ancestor walk, title-as-accessible-name)
// that this scenario's inline version originally had.

export default {
    name:        '70-a11y-heuristics-milestones',
    description: 'Sister of scenarios 52 + 67 on /milestones?company_id=gnosis. Inspects DOM semantics (img alt, button accessible-name, input labels) on the milestones page and asserts no new violations beyond empirically-established baseline. Completes the 3-surface grid for a11y heuristics KIND (companies + markets + milestones).',
    bugShape:    'Milestones-page refactor drops img alt on a slug-resolution or list-rendering element / adds icon button without label / adds form input without label. Screen-reader-invisible regressions on the /milestones surface with no DOM-text change, no error, no visual artifact for sighted users — untriggered by scenarios 52 (/companies) and 67 (/markets).',
    route:       '/milestones?company_id=gnosis',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({}),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({ prices: {} }),
    },

    assertions: [
        // Mount anchor — proves the page chrome rendered. "Connect
        // Wallet" is in the shared Header across /companies,
        // /markets, /milestones — proven anchor in scenario 69.
        async (page) => {
            await expect(
                page.getByText('Connect Wallet').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Give milestones-specific elements (slug-resolution +
        // useOrganization fetch + list components) time to mount
        // and render before running the heuristics.
        async (page) => {
            await page.waitForTimeout(2000);
        },

        // The a11y catch. Run heuristics, filter known-baseline
        // violations, assert remaining list is empty.
        async (page) => {
            const violations = await page.evaluate(A11Y_HEURISTICS);

            // Empirically-discovered baseline for /milestones.
            // Each entry here is a REAL latent a11y bug worth
            // filing separately — same pattern as scenarios 52, 67.
            // Start empty; first run will surface real violations
            // (if any); narrow exclusions added below with
            // justifying comments.
            const KNOWN_BASELINE = [
                // (populated empirically — see PROGRESS.md slice 292
                // for the rationale of each entry, if any are added)
            ];

            const fresh = violations.filter((v) => !isKnownViolation(v, KNOWN_BASELINE));
            if (fresh.length > 0) {
                const summary = fresh.map((v, i) =>
                    `${i + 1}. [${v.kind}] ${v.html}`,
                ).join('\n');
                throw new Error(
                    `Scenario 70 found ${fresh.length} unexcluded a11y violation(s) on /milestones:\n${summary}`,
                );
            }
        },
    ],

    timeout: 180_000,
};
