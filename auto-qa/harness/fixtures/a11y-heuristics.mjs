/**
 * a11y-heuristics.mjs — slice 293 extraction.
 *
 * Shared inline a11y heuristics for scenarios that opt into a11y
 * checks (slice 92 capability, originated as inline code in
 * scenario 52, refined in scenario 67, applied in scenario 70).
 *
 * ── Why a shared module ─────────────────────────────────────────────
 * Slice 92 (scenario 52) introduced inline heuristics for /companies.
 * Slice 289 (scenario 67) refined them while adding /markets coverage
 * (skip aria-hidden ancestors, accept `title` as accessible-name).
 * Slice 292 (scenario 70) added /milestones coverage with the same
 * refined heuristic copied inline a third time.
 *
 * Three inline copies — slice 289 documented this as the natural
 * deferral threshold; slice 293 (this extraction) honors it.
 *
 * Benefits:
 *   - Future a11y scenarios opt in with `import` + one
 *     `page.evaluate(A11Y_HEURISTICS)` call.
 *   - Refinements (new rule classes, edge-case handling, false-
 *     positive fixes) update ONE place — N-way drift impossible.
 *   - **BACK-PORTS slice 289's refinements to scenario 52
 *     retroactively** — 52's inline copy predated the refinements;
 *     /companies happened to not surface aria-hidden imgs or
 *     title-bearing icon buttons in the empirical baseline, so
 *     the gap was silent. Centralizing fixes it.
 *
 * ── What the heuristic checks ───────────────────────────────────────
 * Three high-ROI rule classes (cover ~80% of common a11y bugs in
 * React apps without needing axe-core's 200KB dependency):
 *
 *   1. `<img>` with empty/missing `alt` — screen-reader-invisible
 *      image. Skipped if the element OR any ancestor has
 *      `aria-hidden="true"` (per WAI-ARIA spec, aria-hidden
 *      cascades to descendants).
 *
 *   2. `<button>` without an accessible name — icon-only button
 *      that doesn't announce purpose. Accessible name sources
 *      checked, in priority order: aria-label, aria-labelledby,
 *      `title`, textContent. (`title` aligns with WAI-ARIA's
 *      accessible-name computation algorithm.) Skipped if
 *      aria-hidden anywhere up the ancestor chain.
 *
 *   3. `<input>` without an associated label — form field screen
 *      readers can't describe. Label sources checked, in priority
 *      order: aria-label, aria-labelledby, wrapping `<label>`,
 *      `<label for>`, placeholder (weak but tolerated). Skipped
 *      if type=hidden, not visible, or aria-hidden anywhere up.
 *
 * Visibility check: skip elements with offsetWidth+offsetHeight=0
 * OR computed visibility/display set to hidden/none.
 *
 * ── Return value ────────────────────────────────────────────────────
 * Array of violation records. Each entry:
 *   {
 *     kind:    'img-no-alt' | 'button-no-name' | 'input-no-label',
 *     html:    string (first 200 chars of outerHTML for debugging),
 *     ...kind-specific fields (src for img, type+name for input)
 *   }
 *
 * Empty array = no violations. Consumers should filter against a
 * `KNOWN_BASELINE` of accepted-as-latent violations before
 * asserting fresh.length === 0.
 *
 * ── Page-context constraint ─────────────────────────────────────────
 * This function runs INSIDE the browser via `page.evaluate(...)`.
 * Playwright serializes the function source — no closures, no
 * external imports allowed inside. Globals used: `document`,
 * `window`, `HTMLElement` (all standard browser globals).
 *
 * ── Usage ───────────────────────────────────────────────────────────
 *
 *   import { A11Y_HEURISTICS } from '../fixtures/a11y-heuristics.mjs';
 *
 *   // Inside an assertion:
 *   const violations = await page.evaluate(A11Y_HEURISTICS);
 *   const fresh = violations.filter((v) => !isKnown(v, KNOWN_BASELINE));
 *   if (fresh.length > 0) throw new Error(...);
 */

/**
 * Inline a11y heuristics evaluated in the page context.
 *
 * Refinements landed slice 289 (scenario 67):
 *   - Walk the ancestor chain for aria-hidden ("true" anywhere
 *     up means screen readers skip the element entirely, so a
 *     missing alt/name is NOT a violation).
 *   - Accept `title` as a fallback accessible-name source for
 *     buttons (aligns with WAI-ARIA computation algorithm;
 *     lower priority than aria-label/aria-labelledby but still
 *     a valid label).
 */
export const A11Y_HEURISTICS = () => {
    const violations = [];

    const isVisible = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
        const style = window.getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        return true;
    };

    const isAriaHidden = (el) => {
        let cur = el;
        while (cur && cur !== document.body) {
            if (cur.getAttribute && cur.getAttribute('aria-hidden') === 'true') return true;
            cur = cur.parentElement;
        }
        return false;
    };

    const briefHtml = (el) => el.outerHTML.slice(0, 200);

    const accessibleName = (el) => {
        if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
        if (el.getAttribute('aria-labelledby')) {
            const ref = document.getElementById(el.getAttribute('aria-labelledby'));
            if (ref) return ref.textContent.trim();
        }
        if (el.getAttribute('title')) return el.getAttribute('title').trim();
        return (el.textContent || '').trim();
    };

    // 1. <img> without alt
    for (const img of document.querySelectorAll('img')) {
        if (!isVisible(img)) continue;
        if (isAriaHidden(img)) continue;
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
        if (isAriaHidden(btn)) continue;
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
        if (isAriaHidden(input)) continue;
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

/**
 * Helper: filter violations by an exclusion list.
 *
 * Each rule in the exclusion list is `{ kind, match }` where:
 *   - `kind` matches the violation's `kind` field exactly.
 *   - `match` is a string (substring of html) or RegExp (tested
 *     against html). A violation is excluded if its kind matches
 *     AND its html satisfies the match.
 */
export const isKnownViolation = (violation, knownBaseline) =>
    knownBaseline.some((rule) =>
        rule.kind === violation.kind && (rule.match instanceof RegExp
            ? rule.match.test(violation.html ?? '')
            : (violation.html ?? '').includes(rule.match))
    );
