/**
 * 67-a11y-heuristics-market-page.scenario.mjs — sister of scenario 52
 * (a11y-heuristics /companies) on the /markets/<probe> surface.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Same KIND as scenario 52 (a11y regressions invisible to DOM-text,
 * GraphQL, errors, URL, network, and visual/CSS monitors) — on a
 * different and structurally richer surface.
 *
 * Why a separate market-page scenario is needed even though 52 exists:
 *
 *   - The market page mounts a substantially DIFFERENT DOM tree:
 *     chart strip (zoom/time-window buttons), trading panel (amount
 *     inputs, outcome tabs, action buttons), allowances/collateral
 *     dropdowns, balances panel, badges row, multiple modals (swap
 *     confirm, trade details). /companies's DOM is mostly tables +
 *     cards + a single CTA — much narrower a11y surface.
 *
 *   - Refactors that drop alt on a CHART icon, replace a tab label
 *     with an icon, or add an unlabeled amount-input regress on the
 *     market page WITHOUT touching /companies. Scenario 52 stays
 *     green; the bug ships.
 *
 *   - Each surface has its own empirical baseline. Pinning the
 *     market-page baseline separately makes future regressions
 *     surface as specific NEW violations, not noise mixed with
 *     /companies's pre-existing violations.
 *
 * ── Detection mechanism ─────────────────────────────────────────────
 * Identical to scenario 52: `page.evaluate(A11Y_HEURISTICS)` runs
 * inline in the page context, returns an array of violations
 * `{kind, ...}`. Assertion: filter known-baseline violations,
 * assert remaining list is empty.
 *
 * ── Why no fixture extraction (yet) ─────────────────────────────────
 * The A11Y_HEURISTICS function below is byte-for-byte the same as
 * scenario 52's. Extracting to `fixtures/a11y-heuristics.mjs` is
 * tempting (40 lines saved per future scenario) but:
 *   - Two scenarios (52 + 67) is not yet enough duplication to
 *     justify the indirection.
 *   - Scenario 52's design comment explicitly chose inline.
 *     Touching it in this slice adds risk to a working scenario.
 *   - A third a11y scenario (e.g., /milestones) WOULD justify the
 *     extraction. Deferred to that iteration.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: scenario must PASS (after empirical baseline).
 *   2. Mutate any market-page-mounted component to strip alt from
 *      a known image or remove aria-label from an icon button →
 *      assertion FAILS with the specific violation listed.
 *   3. Restore → passes.
 *
 * ── Empirically discovered baseline ─────────────────────────────────
 * KNOWN_BASELINE starts empty. After first run, real baseline
 * violations get NARROW exclusion entries (one per known-baseline
 * a11y bug). Each is a latent bug worth filing separately — same
 * pattern as scenario 52, fallback-company.png (slice 79), React
 * update-in-render warning (slice 80). Documented inline.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    MARKET_PROBE_ADDRESS,
    fakeMarketProposalEntity,
    makeGraphqlMockHandler,
    makeMarketCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';
import { A11Y_HEURISTICS, isKnownViolation } from '../fixtures/a11y-heuristics.mjs';

// Slice 293: A11Y_HEURISTICS extracted to a shared fixture.
// The refinements that landed here in slice 289 (aria-hidden
// ancestor walk, title-as-accessible-name) are now the canonical
// version in the fixture and are back-ported to scenarios 52
// (companies) and 70 (milestones).

export default {
    name:        '67-a11y-heuristics-market-page',
    description: 'Sister of scenario 52 on the /markets/<probe> surface. Inspects DOM semantics (img alt, button accessible-name, input labels) on the market page and asserts no new violations beyond empirically-established baseline. Market page has richer DOM than /companies (chart controls, trading panel, modals) so its a11y surface is distinct — refactors that drop alt on a chart icon or replace a tab label with an icon would slip past scenario 52 (which only navigates /companies).',
    bugShape:    'Market-page refactor drops img alt on chart/badge icon / replaces text tab label with unlabeled icon / adds amount-input without label. Screen-reader-invisible regressions on the market surface with no DOM text change, no error, no visual artifact for sighted users.',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    assertions: [
        // Anchor: page mounted enough for a11y inspection to be
        // meaningful. Without this, an empty page (no a11y
        // violations because no elements) would vacuously pass.
        async (page) => {
            await expect(
                page.getByText('Trading Pair').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Wait briefly for late-mounting elements (modals,
        // badges, panels) to settle. The market page's DOM
        // continues to populate for a few seconds after the
        // chart strip mounts; running heuristics too early would
        // miss elements added later.
        async (page) => {
            await page.waitForTimeout(2000);
        },

        // The a11y catch. Run heuristics, filter known-baseline
        // violations, assert remaining list is empty.
        async (page) => {
            const violations = await page.evaluate(A11Y_HEURISTICS);

            // Empirically-discovered baseline (populated after
            // first run). Each entry here is a REAL latent a11y
            // bug on the market page worth filing separately —
            // same pattern as scenario 52's exclusion list.
            // Start empty; first run will surface real
            // violations; add NARROW exclusions per violation,
            // each with a justifying comment.
            const KNOWN_BASELINE = [
                // (populated empirically — see verification log
                // in PROGRESS.md slice 289 for the rationale of
                // each entry)
            ];

            const fresh = violations.filter((v) => !isKnownViolation(v, KNOWN_BASELINE));
            if (fresh.length > 0) {
                const summary = fresh.map((v, i) =>
                    `${i + 1}. [${v.kind}] ${v.html}`,
                ).join('\n');
                throw new Error(
                    `Scenario 67 found ${fresh.length} unexcluded a11y violation(s) on the market page:\n${summary}`,
                );
            }
        },
    ],

    timeout: 180_000,
};
