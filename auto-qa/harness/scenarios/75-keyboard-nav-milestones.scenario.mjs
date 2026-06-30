/**
 * 75-keyboard-nav-milestones.scenario.mjs — sister of scenarios 73
 * + 74 on the /milestones surface. **Closes the 3/3 grid for the
 * keyboard-navigation KIND.**
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Same KIND as scenarios 73 (/companies) + 74 (/markets) —
 * keyboard-navigation simulation, dynamic tab-order regressions
 * invisible to static a11y heuristics — on the /milestones
 * surface.
 *
 * Specific bug shapes caught (in addition to 73 + 74's catches):
 *
 *   - /milestones-list components get tabindex="-1" — keyboard
 *     users can't reach individual milestone cards (e.g., to
 *     activate the per-card link).
 *   - The org-header card on /milestones gets aria-hidden via
 *     a layout refactor — focus skips past the page header.
 *   - Slug-resolution code introduces a focus race (initial
 *     focus jumps backward on rerender after slug resolves)
 *     that desyncs the tab order.
 *
 * ── How the scenario catches it ─────────────────────────────────────
 * Identical algorithm to scenarios 73 + 74, third inline copy.
 * Same fixture as scenarios 69 + 70 + 71 + 72 (/milestones
 * coverage).
 *
 *   1. Navigate /milestones?company_id=gnosis with mocks that
 *      return PROBE_ORG_NAME via slice 291's organization(id:)
 *      branch.
 *   2. Anchor: "Connect Wallet" visible (proven anchor from
 *      scenarios 69, 70, 71).
 *   3. Tab walk N=20 from body; collect focus chain.
 *   4. Catch 1: ≥2 distinct tag names.
 *   5. Catch 2: ANY of "Chain Selector" (aria-label) OR
 *      "Connect Wallet" reachable — same wallet-state-agnostic
 *      catch as scenario 74 (slice 298 diagnostic).
 *
 * ── Fixture extraction trigger met this slice ──────────────────────
 * With three inline copies of the Tab walk + assertion code
 * (scenarios 73, 74, 75), the N=3 deferral threshold from slice
 * 289 is crossed. Slice 293 (a11y) and slice 296 (text-selection)
 * extracted at the same threshold. A future slice (likely 300)
 * should extract the keyboard-nav walk into a shared fixture
 * `fixtures/keyboard-nav.mjs` exposing
 * `assertTabReachesAnyOf(page, { depth, anchors })` or similar.
 *
 * Deferred from THIS slice to keep "one new scenario, one new
 * surface coverage" focused — the extraction would couple a
 * refactor with the grid-closure catch slice and obscure
 * verification.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: scenario PASSES.
 *   2. Add tabindex="-1" to all /milestones-mounted focusable
 *      elements (or aria-hidden to a wrapping `<main>` element)
 *      → catch 1 + catch 2 both fail.
 *   3. Restore → passes.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    makeGraphqlMockHandler,
    makeCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';
import { assertTabReachesAnyOf } from '../fixtures/keyboard-nav.mjs';

// Slice 300: Tab walk + assertions extracted to shared fixture.

export default {
    name:        '75-keyboard-nav-milestones',
    description: 'Sister of scenarios 73 + 74 on /milestones?company_id=gnosis. Press Tab 20 times, collect focus chain. Asserts (1) ≥2 distinct tag names appear, (2) Header CTA ("Chain Selector" aria-label OR "Connect Wallet") reachable. Closes the 3/3 grid for the keyboard-navigation KIND (companies + markets + milestones).',
    bugShape:    '/milestones-specific tab-order regression: milestones-list cards get tabindex=-1 / org-header card gets aria-hidden / slug-resolution introduces focus race / tab order collapses on /milestones. /companies + /markets stay green; /milestones keyboard users hit a surface-specific break.',
    route:       '/milestones?company_id=gnosis',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({}),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({ prices: {} }),
    },

    assertions: [
        // Anchor: page chrome rendered. "Connect Wallet" is in the
        // shared Header — proven anchor from scenarios 69, 70, 71.
        async (page) => {
            await expect(
                page.getByText('Connect Wallet').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Tab walk + 2 catches (slice 300 extracted to fixture).
        // Wallet-state-agnostic anchors (same as scenario 74).
        async (page) => {
            await assertTabReachesAnyOf(page, {
                depth:   20,
                anchors: [/chain selector/i, /connect wallet/i],
            });
        },
    ],

    timeout: 180_000,
};
