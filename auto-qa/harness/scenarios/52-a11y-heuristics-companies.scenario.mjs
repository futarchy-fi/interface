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

// Inline a11y heuristics evaluated in the page context. Returns
// an array of violation records. Each record has:
//   kind:    'img-no-alt' | 'button-no-name' | 'input-no-label'
//   element: { tag, html, text }
//   selector: CSS-ish path for human-debugging
const A11Y_HEURISTICS = () => {
    const violations = [];

    const isVisible = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
        const style = window.getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        return true;
    };

    const briefHtml = (el) => el.outerHTML.slice(0, 200);

    const accessibleName = (el) => {
        if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
        if (el.getAttribute('aria-labelledby')) {
            const ref = document.getElementById(el.getAttribute('aria-labelledby'));
            if (ref) return ref.textContent.trim();
        }
        return (el.textContent || '').trim();
    };

    // 1. <img> without alt
    for (const img of document.querySelectorAll('img')) {
        if (!isVisible(img)) continue;
        const alt = img.getAttribute('alt');
        if (alt == null || alt.trim() === '') {
            violations.push({
                kind:     'img-no-alt',
                src:      img.getAttribute('src') ?? '(no src)',
                html:     briefHtml(img),
            });
        }
    }

    // 2. <button> with no accessible name
    for (const btn of document.querySelectorAll('button')) {
        if (!isVisible(btn)) continue;
        if (!accessibleName(btn)) {
            violations.push({
                kind:     'button-no-name',
                html:     briefHtml(btn),
            });
        }
    }

    // 3. <input> without label (skip type="hidden" — not displayed)
    for (const input of document.querySelectorAll('input')) {
        if (input.type === 'hidden') continue;
        if (!isVisible(input)) continue;
        // Check for: aria-label, aria-labelledby, wrapping <label>,
        // <label for="...">, or a placeholder (technically weak
        // but commonly accepted).
        if (input.getAttribute('aria-label')) continue;
        if (input.getAttribute('aria-labelledby')) continue;
        if (input.closest('label')) continue;
        if (input.id) {
            const associated = document.querySelector(`label[for="${input.id}"]`);
            if (associated) continue;
        }
        if (input.getAttribute('placeholder')) continue; // weak but tolerated
        violations.push({
            kind:     'input-no-label',
            type:     input.getAttribute('type') ?? 'text',
            name:     input.getAttribute('name') ?? '(no name)',
            html:     briefHtml(input),
        });
    }

    return violations;
};

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

            const isKnown = (v) => KNOWN_BASELINE.some(
                (rule) => rule.kind === v.kind && (rule.match instanceof RegExp
                    ? rule.match.test(v.html ?? '')
                    : (v.html ?? '').includes(rule.match)),
            );

            const fresh = violations.filter((v) => !isKnown(v));
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
