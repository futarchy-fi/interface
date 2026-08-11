/**
 * text-selection.mjs — slice 296 extraction.
 *
 * Shared helpers for the user-CSS interactive KIND of catch
 * (scenarios 51, 68, 72) — text selection via simulated user
 * interaction, used to detect CSS regressions that block
 * `user-select` cascade.
 *
 * ── Why a shared module ─────────────────────────────────────────────
 * Slice 290 introduced scenario 68 (sister of 51 on /markets) with
 * an inline triple-click + getSelection assertion. Slice 295 added
 * scenario 72 (sister on /milestones) with the same boilerplate
 * inline. Three inline copies — slice 289's deferral threshold
 * crossed; slice 296 honors it (same pattern as slice 293's
 * a11y-heuristics extraction).
 *
 * Benefits (mirroring slice 293):
 *   - Future text-selection scenarios opt in with `import` + one
 *     helper call instead of ~10 lines of boilerplate.
 *   - Refinements (e.g., dblclick fallback, support for
 *     selection across multiple ranges) update ONE place.
 *   - Centralized failure messages: each scenario currently
 *     constructs its own "expected … to select … got …" message;
 *     consolidating means consistent error formatting.
 *
 * ── What the helper does ────────────────────────────────────────────
 * `assertTripleClickSelects(page, locator, expectedSubstring)`:
 *   1. Clears any inherited selection from page navigation
 *      (`window.getSelection()?.removeAllRanges()`).
 *   2. Triple-clicks the given locator (`{clickCount: 3}`) — the
 *      browser's word/line selection logic respects
 *      `user-select: none` on the locator OR any ancestor.
 *   3. Reads `window.getSelection().toString()`.
 *   4. Asserts the captured selection contains
 *      `expectedSubstring` — `.toContain` rather than strict
 *      equality because triple-click may capture leading/trailing
 *      whitespace from neighboring inline elements.
 *   5. On failure, throws with a debuggable message including
 *      the actual selection text + expected substring.
 *
 * ── Why triple-click (not dblclick or mouse drag) ──────────────────
 * Triple-click selects the whole text line on the element, even
 * when the click coordinate lands on whitespace or a word
 * boundary. Dblclick only selects a word and can return empty
 * if the click lands between words. Mouse drag works the same
 * way as triple-click for `user-select` purposes but requires
 * computing coordinates and is fragile under viewport changes.
 * Triple-click is locator-based and stable across viewports.
 *
 * ── Page-context constraint ─────────────────────────────────────────
 * The page.evaluate() callbacks below run inside the browser via
 * Playwright serialization — no closures, no external imports
 * inside. Globals: `window` only.
 *
 * ── Usage ───────────────────────────────────────────────────────────
 *
 *   import { assertTripleClickSelects } from '../fixtures/text-selection.mjs';
 *
 *   // Inside an assertion:
 *   await assertTripleClickSelects(
 *       page,
 *       page.getByText('Trading Pair').first(),
 *       'Trading Pair',
 *   );
 *
 * Works on any locator — the caller is responsible for
 * choosing a stable, non-button text element. Buttons commonly
 * have `user-select: none` by default in CSS resets/Tailwind,
 * so triple-click on a button can return empty regardless of
 * the cascade — pick a heading, span, or paragraph instead.
 */

import { expect } from '@playwright/test';

/**
 * Assert that triple-clicking a locator captures text matching
 * `expectedSubstring` in the browser's window selection.
 *
 * Catches CSS regressions that block user-level text selection:
 * `user-select: none`, `pointer-events: none`, hidden overflow.
 *
 * @param {import('@playwright/test').Page} page
 *   The Playwright page (used for evaluate calls).
 * @param {import('@playwright/test').Locator} locator
 *   The element to triple-click. Must contain text — buttons
 *   often have `user-select: none` by default; pick a heading
 *   or paragraph instead.
 * @param {string} expectedSubstring
 *   Substring that must appear in the captured selection. Uses
 *   `.toContain` rather than strict equality because triple-
 *   click may pick up leading/trailing whitespace.
 */
export async function assertTripleClickSelects(page, locator, expectedSubstring) {
    // Clear any inherited selection from page navigation so our
    // triple-click is the only source of selection state.
    await page.evaluate(() => window.getSelection()?.removeAllRanges());

    // Triple-click selects the whole text line of the element —
    // works even when the click coordinate lands on whitespace
    // or a word boundary. Respects `user-select: none` on the
    // element AND any ancestor (per CSS cascade).
    await locator.click({ clickCount: 3 });

    // Read the browser's selection state. With no
    // `user-select: none` cascade: contains the expected
    // substring. Under a regression that blocks selection on
    // any ancestor: empty or whitespace-only.
    const selectedText = await page.evaluate(
        () => window.getSelection()?.toString() ?? '',
    );

    expect(selectedText, {
        message: `expected triple-click to capture "${expectedSubstring}" in window.getSelection(); got: ${JSON.stringify(selectedText)}`,
    }).toContain(expectedSubstring);
}
