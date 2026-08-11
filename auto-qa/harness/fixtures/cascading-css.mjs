/**
 * cascading-css.mjs — slice 310 extraction.
 *
 * Shared helper for KIND 6 (Visual / Computed CSS) catches that
 * inspect a cascading CSS property at the PageLayout `<main>`
 * element and assert it has NOT regressed to a specific value.
 *
 * ── Why a shared module ─────────────────────────────────────────────
 * Slice 99 (scenario 62) introduced the inline computed-CSS catch
 * for `user-select` cascade on /companies. Slice 308 (scenario 80)
 * copied the same inline structure for `pointer-events`. Slice 309
 * (scenario 81) copied it again for `cursor` — closing N=3 inline
 * copies, the canonical fixture-extraction threshold per slice 289
 * doctrine. Slice 310 (this extraction) honors the threshold.
 *
 * Benefits:
 *   - Future cascade catches opt in with `import` + one helper
 *     call instead of ~30 lines of `page.evaluate` boilerplate.
 *   - The PageLayout-`<main>` selection logic (Tailwind `mt-20
 *     bg-white` signature with fallback to last `<main>` in DOM
 *     order) lives in ONE place — N-way drift impossible.
 *   - Ancestor-chain debugging dump format consolidated — every
 *     cascade-catch failure has the same shape, easier to triage.
 *   - The assertion message format ("Scenario X: PageLayout
 *     <prop> regressed to '<value>'. Picked element: ...
 *     Ancestor chain ... values: ...") is consistent across
 *     scenarios.
 *
 * ── What the helper does ────────────────────────────────────────────
 * `assertPageLayoutCascadeStyleIsNot(page, opts)`:
 *   1. `page.evaluate` — find the PageLayout `<main>` element
 *      (match Tailwind `mt-20 bg-white` signature; fall back to
 *      the last `<main>` in DOM order if the class hunt fails).
 *   2. Read `getComputedStyle(layoutMain)[opts.propertyName]`.
 *      Property name is dynamic — passed as a string argument
 *      to the evaluate (so the same helper covers user-select,
 *      pointer-events, cursor, etc.).
 *   3. Walk the ancestor chain to `<html>`, recording each
 *      element's tag, class, and resolved property value. The
 *      chain bundles into the error message on failure to make
 *      the cascade source obvious.
 *   4. If `probe.value === opts.expectedNot`, throw with the
 *      bundled debug info. Otherwise return — no exception
 *      means the catch passed.
 *
 * The check is page-layout-specific: it assumes the page is
 * wrapped by `PageLayout.jsx` (whose root div is the cascade
 * source for any property regression). For non-PageLayout pages,
 * a custom selector parameter could be added in a future slice.
 *
 * ── Page-context constraint ─────────────────────────────────────────
 * The page.evaluate callback below runs INSIDE the browser via
 * Playwright serialization — no closures, no external imports
 * inside. Globals: `document`, `getComputedStyle`. The
 * `propertyName` string is passed as an argument.
 *
 * ── Usage ───────────────────────────────────────────────────────────
 *
 *   import { assertPageLayoutCascadeStyleIsNot } from
 *     '../fixtures/cascading-css.mjs';
 *
 *   // Inside an assertion:
 *   await assertPageLayoutCascadeStyleIsNot(page, {
 *       propertyName: 'cursor',
 *       expectedNot:  'not-allowed',
 *       scenarioLabel: 'Scenario 81',
 *   });
 *
 * Caller is still responsible for the anchor-wait (e.g., wait
 * for the page-shell to mount past the loading state) BEFORE
 * calling this helper. Without that, the evaluate could resolve
 * against a still-loading shell and miss a regression that's
 * only visible on the actual page tree.
 */

/**
 * Assert that a cascading CSS property at the PageLayout `<main>`
 * element has NOT regressed to `expectedNot`.
 *
 * Catches CSS regressions that cascade from a page-level wrapper
 * (PageLayout root div, an overlay, etc.):
 *   - `user-select: none` (scenario 62 — text uncopyable)
 *   - `pointer-events: none` (scenario 80 — page uninteractive)
 *   - `cursor: not-allowed` (scenario 81 — UX feels blocked)
 *   - any other inheriting property that cascades to descendants
 *
 * @param {import('@playwright/test').Page} page
 *   The Playwright page (used for evaluate calls).
 * @param {object} opts
 * @param {string} opts.propertyName
 *   The camelCase CSS property name (e.g., `'userSelect'`,
 *   `'pointerEvents'`, `'cursor'`). Read via
 *   `getComputedStyle(<main>)[propertyName]`.
 * @param {string} opts.expectedNot
 *   The regression marker. If the resolved value EQUALS this
 *   string, the catch fails (regression detected). For
 *   `userSelect` and `pointerEvents` this is `'none'`; for
 *   `cursor` it's `'not-allowed'`.
 * @param {string} [opts.scenarioLabel]
 *   Optional context label (e.g., `'Scenario 81'`) included in
 *   the error message for triage. Defaults to `'cascade catch'`.
 */
export async function assertPageLayoutCascadeStyleIsNot(page, {
    propertyName,
    expectedNot,
    scenarioLabel = 'cascade catch',
}) {
    if (!propertyName || typeof propertyName !== 'string') {
        throw new Error(
            'assertPageLayoutCascadeStyleIsNot: `propertyName` must be a non-empty string',
        );
    }
    if (!expectedNot || typeof expectedNot !== 'string') {
        throw new Error(
            'assertPageLayoutCascadeStyleIsNot: `expectedNot` must be a non-empty string',
        );
    }

    const probe = await page.evaluate((propName) => {
        const allMains = Array.from(document.querySelectorAll('main'));
        if (allMains.length === 0) return { error: 'no <main> element on page' };

        // Match PageLayout's <main> signature: Tailwind `mt-20`
        // (top margin offsetting the fixed Header) AND `bg-white`
        // (light-theme background; persists across light/dark
        // because the dark variant is `dark:bg-...`). Fall back
        // to the last <main> in DOM order (innermost) if the
        // class hunt fails — better to evaluate against an
        // explicit fallback than throw.
        const layoutMain = allMains.find((m) =>
            /\bmt-20\b/.test(m.className) && /\bbg-white\b/.test(m.className),
        ) || allMains[allMains.length - 1];

        const cs = getComputedStyle(layoutMain);
        const chain = [];
        let el = layoutMain;
        while (el && el !== document.documentElement) {
            const ec = getComputedStyle(el);
            chain.push({
                tag:   el.tagName,
                cls:   el.className.toString().slice(0, 100),
                value: ec[propName],
            });
            el = el.parentElement;
        }
        return {
            picked: {
                tag: layoutMain.tagName,
                cls: layoutMain.className.toString().slice(0, 100),
            },
            mainCount:     allMains.length,
            value:         cs[propName],
            ancestorChain: chain,
        };
    }, propertyName);

    if (probe?.error) {
        throw new Error(`${scenarioLabel} sanity check failed: ${probe.error}`);
    }

    if (probe.value === expectedNot) {
        throw new Error(
            `${scenarioLabel}: PageLayout ${propertyName} regressed to '${expectedNot}'. ` +
            `Picked element: <${probe.picked.tag} class="${probe.picked.cls}">. ` +
            `Ancestor chain ${propertyName} values: ${JSON.stringify(probe.ancestorChain)}`,
        );
    }
}
