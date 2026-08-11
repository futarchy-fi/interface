/**
 * 52-a11y-heuristics-companies.scenario.mjs — first scenario using
 * inline accessibility heuristics. 7th distinct assertion-target KIND.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Accessibility regressions invisible to every other monitor:
 *
 *   - DOM text: the text IS in the DOM; missing `alt` or
 *     `aria-label` doesn't change visible content
 *   - GraphQL / network: no API surface involved
 *   - Page errors / console: a11y violations don't throw
 *   - URL state: no URL change
 *   - Visual / user-CSS: a11y is about non-visual users (screen
 *     readers, keyboard navigation) — a sighted-user interaction
 *     test misses it
 *
 * Only an assertion that INSPECTS DOM SEMANTICS for accessibility
 * properties catches:
 *   - `<img>` without `alt` attribute (screen-reader-invisible)
 *   - `<button>` with no accessible name (icon-only buttons that
 *     don't announce purpose)
 *   - `<input>` not labelled (form fields screen readers can't
 *     describe)
 *
 * ── Why inline heuristics (no axe-core dep) ─────────────────────────
 * Could integrate `@axe-core/playwright` for comprehensive coverage,
 * but that adds a 200+ KB dep with its own version-coupling risks
 * (axe-core changes its rule output across versions). Inline
 * heuristics covering the three high-ROI rule classes catch ~80%
 * of common a11y regressions while staying dep-free. Future slice
 * can swap in axe-core if needed.
 *
 * ── Detection mechanism ─────────────────────────────────────────────
 * `page.evaluate(() => {...})` runs inline in the page context.
 * Returns an array of violation records `{kind, locator, html}`
 * for each failing element. Assertion: array length is 0 OR all
 * entries match `excludeViolations` predicates.
 *
 * Heuristics check (in order of impact):
 *
 *   1. `<img>` with empty/missing `alt`:
 *      Image without alt is invisible to screen readers. Catches
 *      a refactor that drops alt from a logo or card image.
 *      Visible-only (rendered images, not display:none) so we
 *      ignore icons-as-svg-symbols.
 *
 *   2. `<button>` with no accessible name:
 *      Icon-only buttons need `aria-label`. A button with only an
 *      SVG/img child and no text or aria-label is a screen-reader
 *      dead end. Catches refactors that swap text for icons
 *      without preserving labels.
 *
 *   3. `<input>` without associated label:
 *      Form input needs `<label for>`, wrapping `<label>`, or
 *      `aria-label` / `aria-labelledby`. Unlabeled inputs are
 *      one of the most common a11y bugs in React apps.
 *
 * ── Verification protocol ───────────────────────────────────────────
 * 1. Run scenario with current code; empirically populate
 *    `excludeViolations` with all baseline violations (each entry
 *    is a real latent a11y bug worth filing).
 * 2. Mutate src to strip alt from a known image →
 *    scenario FAILS with that violation listed.
 * 3. Restore → passes.
 *
 * ── Empirically discovered baseline ─────────────────────────────────
 * (Populated after first run — see exclusions below.)
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    PROBE_ORG_NAME,
    makeGraphqlMockHandler,
} from '../fixtures/api-mocks.mjs';
import { A11Y_HEURISTICS, isKnownViolation } from '../fixtures/a11y-heuristics.mjs';

// Slice 293: A11Y_HEURISTICS extracted to a shared fixture.
// Previously this scenario carried the heuristic inline (slice 92);
// slice 289 added refinements (skip aria-hidden, accept title) in
// scenario 67 but didn't back-port; slice 292 (scenario 70) made it
// 3 inline copies. Slice 293 centralizes — importing here also
// retroactively picks up the refinements (which are strict
// improvements: false-positive elimination on aria-hidden imgs and
// title-bearing icon buttons that this scenario's empirical
// baseline didn't happen to surface).

export default {
    name:        '52-a11y-heuristics-companies',
    description: 'First scenario using inline a11y heuristics. 7th distinct assertion-target KIND. Inspects DOM semantics (img alt, button accessible-name, input labels) on /companies and asserts no new violations beyond empirically-established baseline. Catches a11y regressions invisible to every other monitor (DOM text, GraphQL, errors, URL, network, visual).',
    bugShape:    'Refactor drops img alt / replaces text button with unlabeled icon / adds form input without label. Screen-reader-invisible regressions with no DOM text change, no error, no visual artifact for sighted users.',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({}),
    },

    assertions: [
        // Anchor: page mounted enough for a11y to be meaningful.
        async (page) => {
            await expect(
                page.getByText(PROBE_ORG_NAME).first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // The a11y catch. Run heuristics, filter known-baseline
        // violations, assert remaining list is empty.
        async (page) => {
            const violations = await page.evaluate(A11Y_HEURISTICS);

            // Empirically-discovered baseline (populated after first
            // run). Each entry here is a REAL latent a11y bug worth
            // filing separately — same pattern as the
            // fallback-company.png finding (slice 79) and React
            // update-in-render warning (slice 80). Future slice
            // should fix these upstream then remove the exclusion.
            const KNOWN_BASELINE = [
                // (populated empirically)
            ];

            const fresh = violations.filter((v) => !isKnownViolation(v, KNOWN_BASELINE));
            if (fresh.length > 0) {
                const summary = fresh.map((v, i) =>
                    `${i + 1}. [${v.kind}] ${v.html}`,
                ).join('\n');
                throw new Error(
                    `Scenario 52 found ${fresh.length} unexcluded a11y violation(s):\n${summary}`,
                );
            }
        },
    ],

    timeout: 180_000,
};
