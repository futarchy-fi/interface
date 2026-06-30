/**
 * 73-keyboard-nav-companies.scenario.mjs — FIRST scenario for a
 * NEW KIND: keyboard-navigation simulation.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Tab-order regressions that are INVISIBLE to every existing KIND:
 *
 *   - **DOM text/attributes**: the element IS in the DOM, just not
 *     in the tab sequence (tabindex=-1 added, aria-hidden wrapping,
 *     display:flex with `inert` attribute, etc.). Text content
 *     unchanged.
 *   - **A11y heuristics (52, 67, 70)**: inline heuristics check
 *     img alt / button aria-label / input labels — STATIC DOM
 *     inspection. Tab order is DYNAMIC: it depends on tabindex,
 *     focusable=true, contenteditable, and visibility. A button
 *     can have a valid aria-label AND be skipped by Tab.
 *   - **User-CSS interactive (51, 68, 72)**: tests `user-select`
 *     via triple-click. Tab keyboard nav uses `Tab` keypress,
 *     different code path.
 *   - **Page errors / GraphQL / network / URL / build-mode**: none
 *     of these observe keyboard interaction.
 *
 * Specific bug shapes caught:
 *
 *   1. **Connect Wallet button gets `tabindex="-1"`** — keyboard
 *      users can't reach the primary CTA. No visual change for
 *      sighted mouse users; total break for keyboard-only users.
 *
 *   2. **An ancestor of Connect Wallet gets `aria-hidden="true"`
 *      or `inert`** — browser skips the whole subtree from
 *      focus. Catches refactors that intentionally hide a
 *      decorative wrapper but accidentally include interactive
 *      children.
 *
 *   3. **Tab order loops back to body too early** — only 1 or 2
 *      focusable elements exist (broken initial focus, missing
 *      `tabindex="0"` on custom widgets). The Tab keypress
 *      collapses the focus chain.
 *
 *   4. **Focus-trap regression on a modal/dropdown that the page
 *      auto-opens** — if /companies eventually mounts a modal
 *      on load, Tab should stay inside it; a regression that
 *      drops the trap would let Tab walk back to the Header.
 *      (Not currently triggered on /companies; first scenario
 *      sets up the capability.)
 *
 * ── How the scenario catches it ─────────────────────────────────────
 *   1. Navigate to /companies; wait for "Connect Wallet" (proves
 *      page chrome rendered AND a primary tab target exists).
 *   2. Focus `document.body` programmatically to establish a known
 *      starting point — `<body>` is NOT in the tab sequence so
 *      the next Tab presses move to the FIRST focusable.
 *   3. Press Tab N=20 times; after each press, evaluate
 *      `document.activeElement` and collect tag + truncated text
 *      + aria-label.
 *   4. **Catch 1**: at least 2 distinct tags appear in the
 *      sequence (`tagName` set size ≥ 2). Rules out:
 *      - Focus stuck on body (set size = 1, "BODY").
 *      - Single-element loop (set size = 1, e.g., "BUTTON").
 *   5. **Catch 2**: "Connect Wallet" appears in the focused-
 *      element text OR aria-label sequence at some point in
 *      the first 20 tabs. Proves the primary CTA is reachable
 *      via keyboard.
 *
 * ── Why N=20 ────────────────────────────────────────────────────────
 * The /companies page has Header (multiple nav links + Connect
 * Wallet), plus the carousel + table. A typical Tab walk through
 * the Header alone hits 5-10 stops; 20 is generous slack while
 * staying small enough to keep the scenario fast (< 1s of
 * keystrokes).
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: scenario PASSES.
 *   2. Mutate Header's Connect Wallet button container to add
 *      `aria-hidden="true"` OR `tabindex="-1"` to the button
 *      itself → CATCH 2 FAILS ("Connect Wallet" not in the
 *      tab sequence).
 *   3. Set `tabindex="-1"` on every focusable element in the
 *      Header → CATCH 1 FAILS (set size collapses to {BODY}
 *      since Tab walks straight to body / nothing).
 *   4. Restore → passes.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    makeGraphqlMockHandler,
} from '../fixtures/api-mocks.mjs';
import { assertTabReachesAnyOf } from '../fixtures/keyboard-nav.mjs';

// Slice 300: Tab walk + assertions extracted to a shared
// fixture. Previously inline here (slice 297). The fixture
// carries the same algorithm and the same wallet-state-agnostic
// anchor matching (slice 298 diagnostic).

export default {
    name:        '73-keyboard-nav-companies',
    description: 'FIRST scenario for keyboard-navigation simulation KIND. Press Tab 20 times on /companies, collect document.activeElement chain. Asserts (1) ≥2 distinct tag names appear (rules out collapsed/single-loop tab order), and (2) "Connect Wallet" primary CTA is reachable via Tab. Catches: aria-hidden wrapping primary CTAs, tabindex=-1, broken tab order — invisible to a11y heuristics (52/67/70) which inspect static DOM only.',
    bugShape:    'Tab-order regression makes keyboard-only users unable to reach a primary CTA. Connect Wallet button gets tabindex=-1 / its ancestor gets aria-hidden=true or inert / tab order loops back early / focus stuck on body. Sighted mouse users see no change; keyboard users hit a total break.',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({}),
    },

    assertions: [
        // Anchor: page chrome rendered AND Connect Wallet button is
        // present in the DOM. Without this, catch 2 below could
        // vacuously fail because the button hasn't mounted yet.
        async (page) => {
            await expect(
                page.getByText('Connect Wallet').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Tab walk + 2 catches (slice 300 extracted to fixture).
        // Catch 1: ≥2 distinct tag names (rules out collapsed
        // tab order). Catch 2: "Connect Wallet" reachable.
        async (page) => {
            await assertTabReachesAnyOf(page, {
                depth:   20,
                anchors: [/connect wallet/i],
            });
        },
    ],

    timeout: 180_000,
};
