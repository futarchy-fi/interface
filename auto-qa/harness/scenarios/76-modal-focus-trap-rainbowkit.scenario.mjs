/**
 * 76-modal-focus-trap-rainbowkit.scenario.mjs — first scenario for
 * a NEW KIND: modal focus-trap. **🎯 11th KIND** in the harness.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Modal focus-trap regressions — when a modal opens, keyboard
 * focus must STAY INSIDE it until the user closes/dismisses.
 * Without a focus trap, Tab eventually walks back to background
 * elements (Header navigation, content behind the overlay) —
 * keyboard users get visually-trapped behind an overlay they
 * can't reach focus inside.
 *
 * Distinct from existing keyboard-navigation KIND (scenarios
 * 73-75): those scenarios assert focus REACHES specific anchors
 * via Tab. This scenario asserts focus does NOT reach specific
 * anchors (i.e., focus stays bounded inside a modal subtree).
 * Same Tab walk mechanism, OPPOSITE catch direction.
 *
 * Bug shapes caught:
 *
 *   1. **Modal renders without a focus-trap library** — common
 *      regression when a third-party modal is replaced with a
 *      hand-rolled component. Tab walks straight back to Header.
 *
 *   2. **Focus-trap library disabled by feature flag refactor**
 *      — `<FocusTrap active={...}>` gets `active={false}`
 *      hard-coded or gated incorrectly.
 *
 *   3. **Tabindex misuse on modal backdrop** — backdrop becomes
 *      tabbable, focus escapes through it.
 *
 *   4. **Portal renders modal OUTSIDE the trap container** —
 *      ReactDOM.createPortal to a different DOM root that the
 *      trap doesn't cover.
 *
 * ── How the scenario catches it ─────────────────────────────────────
 *   1. Navigate to /companies; wait for "Connect Wallet" anchor
 *      (proves the Header button is in the DOM AND that no
 *      modal is currently open).
 *   2. Click the "Connect Wallet" button → RainbowKit
 *      auto-discovers EIP-6963 providers (the wallet stub
 *      announces itself as "Futarchy Harness Wallet" per
 *      scenario 3b) and opens its wallet-list modal.
 *   3. Wait for "Futarchy Harness Wallet" text inside the
 *      modal — proves the modal mounted with its expected
 *      content.
 *   4. Tab walk N=20 from current state (post-modal-open).
 *      Modern modal libraries (focus-trap-react, etc.) move
 *      focus INTO the modal on open and trap Tab cycles
 *      inside.
 *   5. **Catch**: "Chain Selector" (aria-label on the Header's
 *      chain dropdown button) MUST NOT appear in the focus
 *      chain. The Chain Selector is in the BACKGROUND Header,
 *      not the modal — if Tab reaches it, the trap is broken.
 *
 * ── Why "Chain Selector" as the negative anchor ─────────────────────
 * "Chain Selector" is a stable Header aria-label present
 * regardless of wallet-connection state (slice 298 diagnostic).
 * It's also a guaranteed Tab destination in the absence of a
 * modal (scenarios 74 + 75 prove it's reachable on /markets
 * and /milestones). With a working focus trap, Tab cycles
 * inside the modal and never reaches it.
 *
 * Alternative anchors considered:
 *   - "Connect Wallet" button itself (same Header). Risk: it
 *     might be in the modal's "current state" display or
 *     re-rendered inside the modal. Less reliable.
 *   - Body element. Risk: Tab from inside modal could land on
 *     body and immediately back into modal; harder to detect
 *     "escape".
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: scenario PASSES (RainbowKit's focus trap
 *      keeps Tab inside the modal).
 *   2. Mutate RainbowKit's render to remove `<FocusScope>` or
 *      similar wrapper → scenario FAILS (Chain Selector
 *      reachable within 20 tabs).
 *   3. Restore → passes.
 *
 * ── Fixture leverage ────────────────────────────────────────────────
 * Uses `walkTabOrder` from `fixtures/keyboard-nav.mjs` (slice
 * 300) — the same Tab-walk primitive that scenarios 73-75 use,
 * but here the focus chain is consumed by an INVERTED catch
 * direction. Proves the primitive is reusable across catch
 * polarities (reaches-any-of vs reaches-none-of). A future
 * slice could extract `assertTabDoesNotReachAnyOf` into the
 * fixture if a 3rd negative-focus scenario lands.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    makeGraphqlMockHandler,
} from '../fixtures/api-mocks.mjs';
import { assertTabDoesNotReachAnyOf } from '../fixtures/keyboard-nav.mjs';

// Slice 306: inverted-direction catch extracted to shared
// fixture (sibling of assertTabReachesAnyOf from slice 300).

export default {
    name:        '76-modal-focus-trap-rainbowkit',
    description: '🎯 NEW KIND: modal focus-trap. Click "Connect Wallet" on /companies, wait for RainbowKit modal with "Futarchy Harness Wallet", press Tab 20 times, assert "Chain Selector" (Header anchor) is NEVER reached. Catches broken focus trap (Tab escapes back to Header background). Distinct from keyboard-nav scenarios 73-75 (those assert focus REACHES; this asserts focus does NOT reach).',
    bugShape:    'Modal renders without focus trap / focus-trap library disabled by flag / tabbable backdrop / portal renders outside trap container. Keyboard users hit background elements while the modal overlay is visible — total a11y break with no visual artifact for sighted mouse users.',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({}),
    },

    assertions: [
        // Anchor 1: Header button visible (no modal currently open).
        async (page) => {
            await expect(
                page.getByText('Connect Wallet').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Click Connect Wallet → RainbowKit modal opens.
        async (page) => {
            await page.getByText('Connect Wallet').first().click();
        },

        // Anchor 2: modal mounted with expected content. The wallet
        // stub announces itself as "Futarchy Harness Wallet" via
        // EIP-6963 (per scenario 3b's discovery).
        async (page) => {
            await expect(
                page.getByText('Futarchy Harness Wallet').first(),
            ).toBeVisible({ timeout: 15_000 });
        },

        // Tab walk inside the modal-open state — inverted-
        // direction catch via shared helper (slice 306). With
        // a working focus trap, "Chain Selector" never appears
        // in the focus chain. Without trap, Tab walks back to
        // the Header background.
        async (page) => {
            await assertTabDoesNotReachAnyOf(page, {
                depth:   20,
                anchors: [/chain selector/i],
            });
        },
    ],

    timeout: 180_000,
};
