/**
 * keyboard-nav.mjs — slice 300 extraction.
 *
 * Shared helpers for the keyboard-navigation simulation KIND
 * (scenarios 73, 74, 75) — Tab-walk + focus-chain inspection
 * for catching dynamic tab-order regressions invisible to static
 * a11y heuristics.
 *
 * ── Why a shared module ─────────────────────────────────────────────
 * Slice 297 introduced scenario 73 (keyboard-nav on /companies)
 * with an inline Tab walk + 2 assertions. Slice 298 added
 * scenario 74 (/markets sister), discovering the wallet-state
 * heterogeneity diagnostic that motivated a more flexible Catch
 * 2 matcher (accept "Chain Selector" OR "Connect Wallet"). Slice
 * 299 added scenario 75 (/milestones sister), closing the 3/3
 * grid with the same Tab walk + adjusted matcher inlined a third
 * time.
 *
 * Three inline copies — slice 289's deferral threshold crossed.
 * Slice 293 (a11y) and slice 296 (text-selection) extracted at
 * the same threshold; slice 300 honors it.
 *
 * Benefits (mirroring slices 293 + 296):
 *   - Future keyboard-nav scenarios opt in with `import` + one
 *     helper call.
 *   - Tab walk implementation (focus body, press Tab N times,
 *     collect activeElement info) updates ONE place.
 *   - Catch logic refinements (e.g., aria-pressed/expanded
 *     state collection, focus-trap detection) update ONE place.
 *   - Failure-message formatting consolidated.
 *
 * ── What the helpers do ─────────────────────────────────────────────
 *
 *   `walkTabOrder(page, { depth })`:
 *     Focuses `document.body`, then presses Tab `depth` times.
 *     After each press, reads `document.activeElement` and
 *     records `{tag, text, ariaLabel, href}`. Returns the
 *     ordered chain.
 *
 *   `assertTabReachesAnyOf(page, { depth, anchors, minDistinctTags })`:
 *     Runs walkTabOrder, then asserts:
 *       1. Catch 1: ≥ minDistinctTags distinct tag names appear.
 *          Rules out collapsed tab order (focus stuck on body
 *          or single-element loop).
 *       2. Catch 2: ANY of the `anchors` (RegExp[]) matches
 *          the text OR aria-label of some focused element in
 *          the chain. Proves at least one expected element is
 *          reachable via keyboard.
 *
 *     Anchors are RegExps to allow flexible matching (case-
 *     insensitive titles, partial matches). Pass as many as
 *     needed — wallet-state divergence on /markets means a
 *     surface might surface "Chain Selector" OR "Connect Wallet"
 *     depending on whether the stub auto-connects.
 *
 *     On failure, throws with a debuggable message including
 *     focused-element tag set and first 5 focused entries.
 *
 * ── Page-context constraint ─────────────────────────────────────────
 * The page.evaluate() callbacks below run inside the browser —
 * no closures, no external imports inside. Globals used:
 * `document`, `window` (only via Playwright's evaluate context).
 *
 * ── Usage ───────────────────────────────────────────────────────────
 *
 *   import { assertTabReachesAnyOf } from '../fixtures/keyboard-nav.mjs';
 *
 *   // Inside an assertion:
 *   await assertTabReachesAnyOf(page, {
 *       depth:           20,
 *       anchors:         [/chain selector/i, /connect wallet/i],
 *       minDistinctTags: 2,
 *   });
 *
 * For scenarios that need custom catch logic (e.g., modal
 * focus-trap), import `walkTabOrder` directly and write
 * scenario-specific assertions against the returned chain.
 */

import { expect } from '@playwright/test';

/**
 * Press Tab `depth` times from `document.body`, returning the
 * ordered chain of focused elements.
 *
 * Each entry: `{ tag, text, ariaLabel, href }`. Text is
 * truncated to 80 chars; href empty-string when not present.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{depth: number}} opts
 * @returns {Promise<Array<{tag: string, text: string, ariaLabel: string, href: string}>>}
 */
export async function walkTabOrder(page, { depth }) {
    // Establish a known starting point. <body> is NOT in the
    // tab sequence by default, so the next Tab press lands on
    // the first focusable element in the document.
    await page.evaluate(() => document.body.focus());

    const focused = [];
    for (let i = 0; i < depth; i++) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(() => {
            const el = document.activeElement;
            if (!el) return null;
            return {
                tag:       el.tagName,
                text:      (el.textContent || '').trim().slice(0, 80),
                ariaLabel: el.getAttribute('aria-label') ?? '',
                href:      el.getAttribute('href') ?? '',
            };
        });
        if (info) focused.push(info);
    }
    return focused;
}

/**
 * Assert that a Tab walk reaches at least one of the given
 * anchor patterns AND covers at least N distinct tag names.
 *
 * Catches:
 *   - Focus stuck on body (catch 1 fails: set size = 1).
 *   - Single-element loop (catch 1 fails: set size = 1).
 *   - Primary CTA unreachable (catch 2 fails: no anchor match).
 *   - Whole subtree skipped via aria-hidden/inert cascade
 *     (catch 1 OR catch 2 fails depending on what's left
 *     reachable).
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} opts
 * @param {number} opts.depth — Tab presses (default 20).
 * @param {RegExp[]} opts.anchors — patterns matched against
 *   focused-element text OR aria-label. At least one must
 *   match somewhere in the chain.
 * @param {number} opts.minDistinctTags — minimum distinct tag
 *   names required across the chain (default 2).
 */
export async function assertTabReachesAnyOf(page, {
    depth = 20,
    anchors,
    minDistinctTags = 2,
}) {
    if (!Array.isArray(anchors) || anchors.length === 0) {
        throw new Error(
            'assertTabReachesAnyOf: `anchors` must be a non-empty array of RegExps',
        );
    }

    const focused = await walkTabOrder(page, { depth });

    // Catch 1: tab order has multiple distinct tag names.
    const tags = new Set(focused.map((f) => f.tag));
    expect(tags.size, {
        message: `expected ≥ ${minDistinctTags} distinct focused-element tag names across ${depth} tabs, got ${tags.size} (${[...tags].join(', ')}); first 5 elements: ${JSON.stringify(focused.slice(0, 5))}`,
    }).toBeGreaterThanOrEqual(minDistinctTags);

    // Catch 2: at least one anchor pattern matches some
    // focused element's text or aria-label.
    const matches = (f) =>
        anchors.some((re) => re.test(f.text) || re.test(f.ariaLabel));

    const reachedAnchor = focused.some(matches);
    expect(reachedAnchor, {
        message: `expected one of [${anchors.map(String).join(', ')}] to match the text or aria-label of some focused element in the first ${depth} tabs, but none did; focused tags: ${[...tags].join(', ')}; first 5 focused: ${JSON.stringify(focused.slice(0, 5))}`,
    }).toBe(true);
}

/**
 * Inverted-direction sister of `assertTabReachesAnyOf`. Slice 306
 * extraction from scenarios 76 + 77 (modal focus-trap KIND).
 *
 * Assert that a Tab walk does NOT reach ANY of the given anchor
 * patterns. Used for modal focus-trap catches: after a modal
 * opens, Tab should cycle inside the modal subtree, never
 * reaching background-page anchors (e.g., Header "Chain
 * Selector" aria-label).
 *
 * Catches:
 *   - Modal renders without focus-trap library (Tab walks back
 *     to background).
 *   - `<FocusTrap active={false}>` hard-coded by feature-flag
 *     refactor.
 *   - Tabindex misuse on backdrop.
 *   - Portal renders modal OUTSIDE trap container.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} opts
 * @param {number} opts.depth — Tab presses (default 20).
 * @param {RegExp[]} opts.anchors — patterns to inspect against
 *   focused-element text OR aria-label. NONE may match.
 */
export async function assertTabDoesNotReachAnyOf(page, {
    depth = 20,
    anchors,
}) {
    if (!Array.isArray(anchors) || anchors.length === 0) {
        throw new Error(
            'assertTabDoesNotReachAnyOf: `anchors` must be a non-empty array of RegExps',
        );
    }

    const focused = await walkTabOrder(page, { depth });

    const matches = (f) =>
        anchors.some((re) => re.test(f.text) || re.test(f.ariaLabel));

    const escaped = focused.find(matches);
    const tags = new Set(focused.map((f) => f.tag));

    expect(escaped, {
        message: `expected NONE of [${anchors.map(String).join(', ')}] to match any focused element across ${depth} tabs (focus trap broken — Tab escaped to background). Tab escaped to: ${JSON.stringify(escaped)}. Tag set: ${[...tags].join(', ')}. First 5 focused: ${JSON.stringify(focused.slice(0, 5))}`,
    }).toBeUndefined();
}
