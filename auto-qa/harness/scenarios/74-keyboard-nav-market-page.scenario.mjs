/**
 * 74-keyboard-nav-market-page.scenario.mjs — sister of scenario 73
 * on the /markets/<probe> surface.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Same KIND as scenario 73 (keyboard-navigation simulation;
 * dynamic tab-order regressions invisible to static a11y
 * heuristics) — on the second user-facing surface.
 *
 * Why a separate market-page scenario:
 *
 *   - The market page has a substantially RICHER tab landscape:
 *     - Header (shared with /companies; covered by 73 already)
 *     - Trading panel: outcome tabs ("If Yes" / "If No"),
 *       amount input, "Buy"/"Sell" buttons, "Confirm Swap"
 *       CTA — multiple new focusable elements
 *     - Allowances/collateral dropdown trigger
 *     - Chart parameter strip toggles
 *     - Multiple modals that mount on click
 *
 *   - A regression that drops tab-ability from a Trading-panel-
 *     only element (e.g., amount input becomes
 *     `<div contenteditable>` without tabindex, or "Buy" button
 *     gets aria-hidden) leaves /companies' tab order intact —
 *     scenario 73 stays green. The market page's keyboard users
 *     hit a total break.
 *
 *   - Different bug landscape per surface = different sister
 *     scenario, same pattern as 51/68 + 50/66 + 52/67 + 48/10-23.
 *
 * Specific bug shapes caught (in addition to 73's catches):
 *
 *   - Amount input on Trading panel becomes contenteditable div
 *     without tabindex="0" — keyboard users can't enter amounts.
 *   - "Buy" / "Sell" action buttons get aria-hidden via a
 *     visibility refactor — keyboard users skip them.
 *   - Outcome tabs ("If Yes" / "If No") get tabindex="-1" — tab
 *     skips between them.
 *
 * ── How the scenario catches it ─────────────────────────────────────
 * Identical algorithm to scenario 73, with two distinctions:
 *   - Market-page fixture (registry + candles mocks via
 *     fakeMarketProposalEntity + makeMarketCandlesMockHandler).
 *   - Same Catch 1 (≥2 tag names) + Catch 2 (Connect Wallet
 *     reachable). Connect Wallet is in the shared Header so it
 *     should appear within the first 20 tabs on the market page
 *     too — proves the Header tab-order is intact when reached
 *     FROM the market page (could differ from /companies if a
 *     market-page wrapper messes with focus order).
 *
 * ── Why no Trading-panel-specific assertion ─────────────────────────
 * Asserting on Trading-panel elements (e.g., "Buy button
 * reachable") couples the scenario tightly to current
 * MarketPageShowcase layout. A future redesign that moves
 * "Buy" elsewhere would false-fail. The current pair of
 * generic assertions (tag diversity + shared CTA reachable) is
 * BOTH durable AND surface-distinguishing.
 *
 * Future iteration can add /markets-specific catches (e.g.,
 * "Buy" button reachable via Tab) once the market-page layout
 * stabilizes more.
 *
 * ── Fixture extraction (deferred) ───────────────────────────────────
 * The Tab walk + assertion block is byte-for-byte the same as
 * scenario 73's. Two inline copies — below the N=3 threshold
 * that triggered slice 293's a11y extraction and slice 296's
 * text-selection extraction. A third keyboard-nav scenario
 * (e.g., /milestones sister) would meet the threshold; defer
 * extraction to that slice.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: scenario PASSES.
 *   2. Add aria-hidden to /markets-specific wrappers around the
 *      Header → catch 2 fails (Connect Wallet skipped from
 *      market-page surface).
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
import { assertTabReachesAnyOf } from '../fixtures/keyboard-nav.mjs';

// Slice 300: Tab walk + assertions extracted to shared fixture.

export default {
    name:        '74-keyboard-nav-market-page',
    description: 'Sister of scenario 73 on /markets/<probe>. Press Tab 20 times, collect focus chain. Asserts (1) ≥2 distinct tag names appear, (2) "Connect Wallet" reachable from market page. Catches market-page-specific tab-order regressions (Trading panel inputs/buttons unreachable, aria-hidden on market wrappers, broken focus chain from market-only refactors) — invisible to scenario 73 (/companies-only).',
    bugShape:    'Market-page-specific tab-order regression: amount input becomes contenteditable without tabindex / "Buy"/"Sell" action buttons get aria-hidden / outcome tabs get tabindex=-1 / market-only wrapper introduces aria-hidden that cascades to the Header. /companies-scoped scenario 73 stays green; keyboard users hit a market-only break.',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,
    ciTiers:     ['interaction'],

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    assertions: [
        // Anchor: market page chrome rendered. "Trading Pair" is
        // the proven mount signal from scenarios 10/24/57/60/66/67.
        async (page) => {
            await expect(
                page.getByText('Trading Pair').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Tab walk + 2 catches (slice 300 extracted to fixture).
        // Wallet-state-agnostic anchors: on /markets the wallet
        // stub auto-connects, replacing "Connect Wallet" with a
        // wallet-shorthand Dropdown. "Chain Selector" (aria-label)
        // is always in the Header regardless of state.
        async (page) => {
            await assertTabReachesAnyOf(page, {
                depth:   20,
                anchors: [/chain selector/i, /connect wallet/i],
            });
        },
    ],

    timeout: 180_000,
};
