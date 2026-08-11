/**
 * 78-aria-state-outcome-tabs.scenario.mjs — second attempt at the
 * 12th KIND (ARIA-state inspection). Slice 303 first try used
 * Header buttons (Chain Selector + theme toggle), both unsuitable
 * (RainbowKit chain-switch hang and theme reload navigation).
 * This iteration targets outcome tabs ("If Yes" / "If No") in
 * the market-page trading panel — naturally uses aria-selected
 * for tab state, no navigation, no wallet flows.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Runtime ARIA-state desync on TAB widgets: clicking a tab visibly
 * activates it (content swap, color change), but `aria-selected`
 * doesn't flip across the tab pair. Screen readers continue
 * announcing the previously-selected tab as the current one.
 *
 * Distinct from existing KINDs (same as slice 303 rationale):
 *   - A11y heuristics inspect static DOM at one point.
 *   - Keyboard-nav observes focus chain.
 *   - Modal focus-trap observes focus after modal opens.
 *   - Visual/CSS observes computed style.
 *   None catches "the tab's ARIA state stayed stale across an
 *   interaction".
 *
 * Bug shapes caught:
 *   - "If No" tab activation doesn't update aria-selected on
 *     either tab (refactor handles the visual state but drops
 *     the ARIA binding).
 *   - Both tabs end up with aria-selected="true" or both
 *     "false" after click (state machine logic regression that
 *     desyncs the pair).
 *   - The clicked tab updates but the previously-selected one
 *     doesn't deselect (single-binding refactor that forgets
 *     the cross-tab update).
 *
 * ── How the scenario catches it ─────────────────────────────────────
 *   1. Navigate /markets/<probe> with market-page fixture.
 *   2. Anchor: "If Yes" + "If No" tab labels both visible
 *      (proves trading panel mounted; same anchor as scenario 11).
 *   3. Locate each tab; read initial aria-selected on both.
 *   4. Click "If No" tab.
 *   5. Wait briefly for state to settle.
 *   6. Read aria-selected on both tabs again.
 *   7. **Catch**: after click, "If No" must be selected ("true"),
 *      "If Yes" must be deselected (null/"false"). The pair
 *      MUST flip — no stuck-state, no double-selected, no
 *      both-deselected.
 *
 * If the tabs don't use aria-selected at all (both always null),
 * pin via `pinnedLatentBug` per slice 302's pattern — that
 * itself is a real catch for screen-reader users.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: scenario PASSES if tabs implement
 *      aria-selected correctly. If not, latent-bug-pin (slice
 *      302 pattern) and surface the finding.
 *   2. Mutate tab component to drop the aria-selected binding
 *      → scenario FAILS with diagnostic showing both tabs at
 *      same state.
 *   3. Restore → passes.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    MARKET_PROBE_ADDRESS,
    fakeMarketProposalEntity,
    makeGraphqlMockHandler,
    makeMarketCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '78-aria-state-outcome-tabs',
    description: '🎯 NEW KIND: ARIA-state inspection (12th KIND, retry from slice 303). Click "If No" outcome tab in market-page trading panel; assert aria-selected flips between the "If Yes" / "If No" pair. Catches tab-activation-without-aria-update regressions invisible to a11y heuristics (static DOM only), keyboard-nav (focus chain only), or visual/CSS.',
    bugShape:    'Tab activation visibly works (content swap, color change) but aria-selected doesn\'t flip across the tab pair. Screen readers continue announcing the previously-selected tab. Both tabs end up at same ARIA state, or only the clicked tab updates while sibling stays stale.',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    // Slice 304 finding: outcome tabs are plain <button> elements
    // with NO aria-selected, aria-pressed, aria-current, and no
    // role="tab". Empirical snapshot of yesBefore/noBefore/
    // yesAfter/noAfter all returned `null` for every ARIA state
    // attribute on both tabs. Visual change (color, content
    // swap) happens, but screen-reader users have no way to
    // know which outcome is selected.
    //
    // Latent bug ledger entry (4th, sibling of slices 79/80/302):
    //   * Component: market-page trading-panel outcome tabs
    //     (likely src/components/futarchyFi/marketPage/
    //     ShowcaseSwapComponent.jsx or its OutcomeTabs sub-
    //     component)
    //   * Severity: A11y — tab-pattern widget without ARIA tab
    //     state. Screen-reader users can't distinguish selected
    //     outcome.
    //   * Fix: add role="tab" + aria-selected to each tab
    //     (and role="tablist" to the parent + aria-controls
    //     pointing at the panel that swaps). Or simpler: just
    //     wire aria-pressed to the active state. Verify by
    //     removing the pinnedLatentBug flag from this scenario.
    pinnedLatentBug: 'Outcome tabs (If Yes / If No) lack ARIA tab state — plain <button> with no aria-selected, aria-pressed, aria-current, or role="tab". Screen-reader users cannot tell which outcome is selected. Add role="tab" + aria-selected (and ideally role="tablist" on the parent), then remove this flag.',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    assertions: [
        // Anchor: trading panel mounted with both outcome tabs
        // visible (same anchor pattern as scenario 11).
        async (page) => {
            await expect(
                page.getByText('If Yes').first(),
            ).toBeVisible({ timeout: 30_000 });
            await expect(
                page.getByText('If No').first(),
            ).toBeVisible({ timeout: 15_000 });
        },

        // ARIA-state catch on the outcome tab pair.
        async (page) => {
            const yesTab = page.getByText('If Yes').first();
            const noTab  = page.getByText('If No').first();

            // Walk each text element to its nearest tab-shaped
            // ancestor: button OR element with role="tab".
            // Inline page.evaluate so we don't depend on the
            // exact component library.
            const readState = async (locator) => {
                return locator.evaluate((textEl) => {
                    let el = textEl;
                    while (el && el !== document.body) {
                        const role = el.getAttribute && el.getAttribute('role');
                        if (role === 'tab' || el.tagName === 'BUTTON') {
                            return {
                                tag:           el.tagName,
                                role:          role,
                                ariaSelected:  el.getAttribute('aria-selected'),
                                ariaPressed:   el.getAttribute('aria-pressed'),
                                ariaCurrent:   el.getAttribute('aria-current'),
                                className:     (el.getAttribute('class') || '').slice(0, 80),
                            };
                        }
                        el = el.parentElement;
                    }
                    return null;
                });
            };

            const yesBefore = await readState(yesTab);
            const noBefore  = await readState(noTab);

            // Click "If No" → tab should activate.
            await noTab.click();
            await page.waitForTimeout(500);

            const yesAfter = await readState(yesTab);
            const noAfter  = await readState(noTab);

            // Diagnostic snapshot for the failure message.
            const summary = {
                yesBefore, noBefore, yesAfter, noAfter,
            };

            // Catch: after the click, "If No" should be selected
            // and "If Yes" should be deselected. Accept both
            // forms (`aria-selected` and `aria-current` —
            // different libraries pick differently).
            const isSelected = (s) =>
                s?.ariaSelected === 'true' ||
                s?.ariaCurrent === 'true' ||
                s?.ariaCurrent === 'page';

            const isDeselected = (s) =>
                s?.ariaSelected === 'false' ||
                s?.ariaSelected === null ||
                (s?.ariaCurrent === null && s?.ariaSelected === null);

            const flipped = (
                isSelected(noAfter) &&
                isDeselected(yesAfter)
            );

            expect(flipped, {
                message: `expected outcome tabs to flip aria-selected after clicking "If No": "If No" should become selected (true), "If Yes" deselected (false/null). Snapshot: ${JSON.stringify(summary, null, 2)}.\n\nIf both tabs show ariaSelected=null in the snapshot, the component doesn't implement ARIA tab state — pin via pinnedLatentBug per slice 302 pattern.`,
            }).toBe(true);
        },
    ],

    timeout: 180_000,
};
