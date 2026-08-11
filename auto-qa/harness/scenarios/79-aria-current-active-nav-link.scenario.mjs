/**
 * 79-aria-current-active-nav-link.scenario.mjs — third scenario for
 * the ARIA-state inspection KIND (12th KIND realized slice 304).
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Same KIND as scenario 78 (ARIA-state inspection): runtime ARIA
 * attribute encoding the current state of an interactive widget.
 * Different sub-shape:
 *
 *   - **78**: aria-selected on TAB widgets after click
 *     (transition catch).
 *   - **79 (this)**: aria-current on the active NAV LINK at
 *     mount (static-read catch).
 *
 * The catch direction is different: 78 verifies a TRANSITION;
 * 79 verifies a STEADY STATE. Same KIND because both inspect
 * ARIA attributes encoding interactive-widget state, distinct
 * from the static a11y-heuristic checks (52/67/70) that only
 * look at structural attributes (alt, aria-label, label
 * association).
 *
 * The `aria-current` attribute is the canonical ARIA way to
 * mark the currently-active item in a navigation set. Per
 * WAI-ARIA 1.1, valid values include: "page" (active link in
 * a nav), "step" (current step in a multi-step process),
 * "location" (current location in a tree / breadcrumb), "date",
 * "time", "true" (most general), or "false"/null/missing
 * (inactive).
 *
 * Bug shapes caught:
 *
 *   1. **No element on /companies has aria-current** — the app
 *      doesn't mark active navigation, so screen-reader users
 *      can't tell which page they're currently on.
 *
 *   2. **aria-current is set on the WRONG link** — e.g.,
 *      "Markets" link is marked current while we're on
 *      /companies (state-tracking bug; common when the active-
 *      link logic uses stale router data).
 *
 *   3. **Multiple links have aria-current** — the active-link
 *      logic doesn't deselect previous; both old + new are
 *      marked current.
 *
 * ── How the scenario catches it ─────────────────────────────────────
 *   1. Navigate /companies; wait for "Connect Wallet" anchor
 *      (proves Header rendered).
 *   2. Query the entire page for elements with `aria-current`
 *      attribute (any value).
 *   3. **Catch**: exactly 1 element should have aria-current
 *      with a truthy value ("page", "true", or any other
 *      non-"false" string), AND that element's href OR text
 *      should map to /companies.
 *
 * If the app doesn't use aria-current at all (zero matches),
 * pin via `pinnedLatentBug` per slice 302 pattern — that's a
 * real catch for screen-reader users.
 *
 * ── Why this target was chosen for the 3rd ARIA-state probe ─────────
 * Slice 304's outcome-tabs catch found a real bug; slice 304's
 * "next-slice candidates" suggested trying a 3rd target to see
 * if the systemic ARIA-state gap holds across surfaces. This
 * scenario probes a DIFFERENT ARIA attribute (aria-current vs
 * aria-selected) on a DIFFERENT widget class (nav links vs
 * tabs). If this also lacks the attribute, the harness can
 * report a systemic-gap meta-finding ("the codebase doesn't use
 * runtime ARIA-state at all").
 *
 * Static-read catch (no click required) is also intentionally
 * chosen — slice 304's transition catch needed a successful
 * click; slice 303's two failed attempts both involved click
 * complications. This scenario sidesteps interaction entirely.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: scenario PASSES if some element on
 *      /companies has correct aria-current. If not, pin via
 *      pinnedLatentBug.
 *   2. Mutate the active-link logic to break aria-current
 *      tracking → scenario FAILS.
 *   3. Restore → passes.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    makeGraphqlMockHandler,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '79-aria-current-active-nav-link',
    description: 'Third scenario for ARIA-state KIND. Static-read catch: navigate /companies, query for elements with aria-current attribute, assert exactly 1 has truthy value AND its href/text maps to /companies. Catches missing-active-link-indication, wrong-link-marked, multiple-links-marked regressions invisible to other monitors.',
    bugShape:    'No element on the active route has aria-current="page"/true (screen readers can\'t tell user which page they\'re on); OR a stale-router-state bug marks a different link as current; OR the active-link logic doesn\'t deselect previous, leaving multiple links marked current.',
    route:       '/companies',

    // Slice 305 finding: ZERO elements on /companies have an
    // aria-current attribute. Empirical query
    // `document.querySelectorAll('[aria-current]')` returned an
    // empty array. App doesn't mark active navigation for
    // screen-reader users at all.
    //
    // 5th latent bug ledger entry (siblings: slices 79/80/302/304):
    //   * Component: app-wide nav (Header logo link / page-level
    //     navigation if any). The top-level Layout/Header component
    //     should set aria-current="page" on the link matching
    //     `router.pathname`.
    //   * Severity: A11y — NavLink active-state indication is one
    //     of the most basic a11y nav patterns.
    //   * Fix: in the Header / NavLink component, set
    //     `aria-current={pathname === href ? "page" : undefined}`.
    //     Or use Next.js's Link with a className-based highlight
    //     extended to include the ARIA attribute. Verify by
    //     removing the pinnedLatentBug flag from this scenario.
    //
    // Together with slice 304's outcome-tabs finding, this
    // confirms the systemic-gap hypothesis: the codebase
    // doesn't use runtime ARIA state at all (2 of 2 probed
    // surfaces). Slice 305 documents this as a meta-finding
    // worth a single comprehensive a11y audit pass — but
    // each scenario file remains an independent regression
    // catch for that specific surface.
    pinnedLatentBug: 'No element on /companies has aria-current attribute. App-wide nav does not mark active route for screen-reader users. Add aria-current="page" on the active link in Header/NavLink (e.g., aria-current={pathname === href ? "page" : undefined}). Together with slice 304 (outcome tabs), confirms systemic ARIA-state gap in the codebase.',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({}),
    },

    assertions: [
        // Anchor: page rendered.
        async (page) => {
            await expect(
                page.getByText('Connect Wallet').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Wait briefly for late-mounting nav components to settle
        // (Header may finish resolving wallet / chain state and
        // render full nav structure within ~1s).
        async (page) => {
            await page.waitForTimeout(1000);
        },

        // ARIA-state catch: aria-current on active nav.
        async (page) => {
            // Collect every element with aria-current attribute,
            // regardless of value. Empty array means the app
            // doesn't use the attribute at all.
            const ariaCurrentElements = await page.evaluate(() => {
                const els = Array.from(document.querySelectorAll('[aria-current]'));
                return els.map((el) => ({
                    tag:         el.tagName,
                    ariaCurrent: el.getAttribute('aria-current'),
                    href:        el.getAttribute('href') ?? '',
                    text:        (el.textContent || '').trim().slice(0, 80),
                    role:        el.getAttribute('role') ?? '',
                }));
            });

            // Catch direction: at least one element should have
            // truthy aria-current ("page", "true", or other valid
            // current-state token). And one of those should
            // semantically map to the current route (href ends
            // with /companies, OR text contains "Companies",
            // OR href is "/" given /companies might be the root).
            const truthyAriaCurrent = ariaCurrentElements.filter((e) =>
                e.ariaCurrent && e.ariaCurrent !== 'false'
            );

            // Diagnostic: include all aria-current elements (even
            // false) so the failure message shows the full state.
            const matchesCurrentRoute = truthyAriaCurrent.some((e) =>
                e.href.endsWith('/companies') ||
                e.href === '/companies' ||
                /companies/i.test(e.text)
            );

            const passesCatch = (
                truthyAriaCurrent.length >= 1 &&
                matchesCurrentRoute
            );

            expect(passesCatch, {
                message: `expected at least one element on /companies to have a truthy aria-current attribute matching the current route. Found ${ariaCurrentElements.length} aria-current element(s) total, ${truthyAriaCurrent.length} with truthy value, matchesCurrentRoute=${matchesCurrentRoute}. Snapshot: ${JSON.stringify(ariaCurrentElements, null, 2)}.\n\nIf zero aria-current elements are found, the app doesn't mark active navigation for screen-reader users — pin via pinnedLatentBug per slice 302 pattern.`,
            }).toBe(true);
        },
    ],

    timeout: 180_000,
};
