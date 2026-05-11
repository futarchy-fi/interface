/**
 * 51-pr59-text-selection.scenario.mjs — catches PR #59 (allow text
 * selection across all pages).
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * CSS-driven interaction regressions: a stylesheet rule blocks
 * legitimate user interaction. Distinct from every other monitor:
 *
 *   - DOM text: the text IS in the DOM (selection regressions don't
 *     change rendered content)
 *   - GraphQL shape / network: no API surface involved
 *   - Page errors / console: no errors fire when selection silently
 *     fails
 *   - URL state: no URL change
 *
 * Only an assertion that simulates USER-LEVEL INTERACTION and
 * inspects the resulting browser state catches CSS regressions
 * like `user-select: none`, `pointer-events: none`, hidden
 * overflow, etc.
 *
 * ── PR #59 in one paragraph ─────────────────────────────────────────
 * `src/components/layout/PageLayout.jsx`'s root container had
 * `className="...select-none..."` (Tailwind class compiles to CSS
 * `user-select: none`). The component wraps /companies, /proposals,
 * /market, and other top-level routes. Net effect: users couldn't
 * select or copy ANY text on those pages — no errors, no DOM diff,
 * just silently broken UX. The fix dropped the class from the root.
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to /companies (PageLayout-wrapped route).
 *   2. Wait for a known static text element to render
 *      ("Active Milestones" heading; renders even when the orgs
 *      table is empty per scenario 48's snapshot).
 *   3. Programmatically clear any existing selection, then call
 *      `.dblclick()` on the element. Double-clicking in a browser
 *      selects the clicked word — but ONLY if `user-select` allows
 *      it. With `user-select: none`, the word doesn't get
 *      selected.
 *   4. Read `window.getSelection().toString()` and assert it
 *      contains text from the element.
 *
 * Under the PR #59 fix, dblclick → selection works → assertion
 * passes. Under a regression that re-adds `select-none` to
 * PageLayout, dblclick → no selection → assertion fails.
 *
 * ── Verification protocol ───────────────────────────────────────────
 * 1. Current code (PR #59 fix applied): scenario PASSES.
 * 2. Re-add `select-none` to `PageLayout.jsx`'s root flex container
 *    → scenario FAILS (selection text is empty).
 * 3. Restore → PASSES.
 *
 * ── Why dblclick (not mouse drag) ───────────────────────────────────
 * Double-click triggers the browser's word-selection logic, which
 * respects `user-select: none`. Drag-select via `page.mouse` would
 * work the same way but requires computing coordinates and is
 * fragile under viewport changes. Dblclick is locator-based and
 * stable.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    makeGraphqlMockHandler,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '51-pr59-text-selection',
    description: 'Catches PR #59 (allow text selection across all pages). Navigate to /companies, double-click the "Active Milestones" heading, assert window.getSelection() captured a word. Catches CSS user-select: none regressions — distinct KIND from DOM-text / GraphQL / page-error / URL / network monitors.',
    bugShape:    'CSS rule blocks user-level interaction (user-select: none / pointer-events: none / overflow: hidden hides text). User-visible UX breakage with no DOM diff, no errors, no network change.',
    route:       '/companies',

    mocks: {
        // Standard happy-path mocks. The text we double-click —
        // "Active Milestones" — is a static heading from the
        // /companies page chrome, so it renders regardless of
        // mock data.
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({}),
    },

    assertions: [
        // Anchor: confirm the heading is on the page before we try
        // to interact with it. Saves a confusing failure if the
        // page didn't render.
        async (page) => {
            await expect(
                page.getByText('Active Milestones').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // The PR #59 catch.
        async (page) => {
            // Clear any inherited selection from page navigation so
            // our triple-click is the only source of selection state.
            await page.evaluate(() => window.getSelection()?.removeAllRanges());

            // Triple-click ({clickCount: 3}) on the heading selects
            // the WHOLE LINE of text within the element — works
            // even when the click lands on whitespace, unlike
            // dblclick which only selects a word and can return
            // empty if it lands between words. Triple-click STILL
            // respects `user-select: none` — under the regression
            // the line is not selected.
            await page.getByText('Active Milestones').first().click({ clickCount: 3 });

            // Read what the browser selected. With the PR #59 fix
            // applied (no `select-none` on PageLayout root), this
            // should contain "Active Milestones". With the
            // regression, it's empty or just whitespace.
            const selectedText = await page.evaluate(
                () => window.getSelection()?.toString() ?? '',
            );

            // Assertion: must contain the heading text. Using
            // `toContain` rather than strict equality because
            // triple-click may capture leading/trailing whitespace
            // from neighboring inline elements.
            expect(selectedText, {
                message: `expected triple-click on "Active Milestones" to select the heading line; got: ${JSON.stringify(selectedText)}`,
            }).toContain('Active Milestones');
        },
    ],

    timeout: 180_000,
};
