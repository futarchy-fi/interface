/**
 * 72-text-selection-milestones.scenario.mjs — sister of scenarios
 * 51 (/companies) + 68 (/markets) on the /milestones surface.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Same KIND as scenarios 51 + 68 (user-CSS interactive regressions:
 * a CSS rule blocks user-level text selection) — on the third
 * user-facing surface.
 *
 * The {51, 62, 68, 72} ensemble pins user-CSS interactive across
 * all surface families:
 *
 *   - **51**: /companies + triple-click (interactive,
 *     /companies-specific text).
 *   - **62**: /companies + getComputedStyle('main').userSelect
 *     (structural, PageLayout root).
 *   - **68**: /markets + triple-click (interactive,
 *     market-page-specific text).
 *   - **72 (this)**: /milestones + triple-click (interactive,
 *     /milestones-specific text).
 *
 * Closes the LAST 2/3 → 3/3 grid in the per-surface coverage
 * matrix for the four sister-pattern KINDs (page-error, a11y,
 * network shape, user-CSS interactive).
 *
 * Specifically catches:
 *   - `select-none` Tailwind class added to a /milestones-only
 *     component (the milestones list wrapper, an individual
 *     milestone card, the org header).
 *   - A CSS module rule on a /milestones-mounted element.
 *   - Pointer-events: none on a milestones-list parent that
 *     wraps proposal text.
 *
 * /companies-scoped 51 + 62 stay green under such regressions
 * because they don't navigate /milestones. /markets-scoped 68
 * stays green for the same reason.
 *
 * ── How the scenario catches it ─────────────────────────────────────
 *   1. Navigate to /milestones?company_id=gnosis with mocks that
 *      return PROBE_ORG_NAME via the singular organization(id:)
 *      query (slice 291 fixture extension makes the page render
 *      "HARNESS-PROBE-ORG-001" via the useOrganization data).
 *   2. Wait for the org name to render — proves the page mounted
 *      past the slug-resolution gate AND gives us a stable
 *      non-button text target.
 *   3. Clear inherited selection, triple-click on the org name.
 *   4. Read `window.getSelection().toString()` and assert it
 *      contains "HARNESS-PROBE-ORG-001".
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: scenario PASSES.
 *   2. Add `style={{userSelect: 'none'}}` to any /milestones-only
 *      wrapper of the org-name element → scenario FAILS with
 *      empty selection.
 *   3. Restore → passes.
 *
 * ── Why triple-click (matching scenarios 51, 68) ────────────────────
 * Triple-click selects the whole text line of the element — works
 * even when the click coordinate lands on a word boundary or
 * whitespace. Respects `user-select: none` exactly the same way
 * dblclick would, but more sturdy under variable text content.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    PROBE_ORG_NAME,
    makeGraphqlMockHandler,
    makeCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';
import { assertTripleClickSelects } from '../fixtures/text-selection.mjs';

export default {
    name:        '72-text-selection-milestones',
    description: 'Sister of scenarios 51 + 68 on /milestones?company_id=gnosis. Triple-click the rendered org name (PROBE_ORG_NAME, via slice 291 fixture extension), assert browser selection captured it. Closes the LAST 2/3 grid for user-CSS interactive KIND (3-surface coverage for companies + markets + milestones).',
    bugShape:    'Milestones-page-specific CSS rule blocks user-level text selection (e.g., select-none added to a milestones-list wrapper, an individual card, or the org-header element). User-visible UX breakage on the /milestones surface — untriggered by scenarios 51 (/companies), 62 (/companies structural), and 68 (/markets).',
    route:       '/milestones?company_id=gnosis',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({}),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({ prices: {} }),
    },

    assertions: [
        // Anchor: org name renders. Slice 291's `organization(id:`
        // singular branch in the mock echoes back the requested id
        // with synthesized data (name: PROBE_ORG_NAME). The
        // /milestones page renders that name in the org-header
        // area. Without slice 291's fixture extension, this would
        // never appear and the catch direction would be ambiguous.
        async (page) => {
            await expect(
                page.getByText(PROBE_ORG_NAME).first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // The user-CSS interactive catch on /milestones —
        // slice 296 extracted to shared helper. Triple-clicks
        // the rendered PROBE_ORG_NAME, asserts window.
        // getSelection() captured it. Empty under any
        // select-none cascade in the milestones tree above the
        // org-name element.
        async (page) => {
            await assertTripleClickSelects(
                page,
                page.getByText(PROBE_ORG_NAME).first(),
                PROBE_ORG_NAME,
            );
        },
    ],

    timeout: 180_000,
};
