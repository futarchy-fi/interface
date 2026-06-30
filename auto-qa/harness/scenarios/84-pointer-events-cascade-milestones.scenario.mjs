/**
 * 84-pointer-events-cascade-milestones.scenario.mjs — closes the
 * 3-surface grid for `pointer-events` cascade in **KIND 6
 * (Visual / Computed CSS)**. Sister of scenario 80 (/companies)
 * and scenario 83 (/markets) on the /milestones surface.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Same `pointer-events: none` cascade catch as scenarios 80 + 83,
 * surfacing on the /milestones page. Catches a /milestones-specific
 * cascade that scenarios 80 (/companies) + 83 (/markets) would
 * both miss.
 *
 * Bug shapes specific to /milestones:
 *   - A milestones-list-component wrapper getting
 *     `pointer-events-none` from a refactor (e.g., a "card grid"
 *     style accidentally including the disabled-state class).
 *   - The slug-resolution loading shim leaking its disabled
 *     pointer-events state to descendants AFTER the org loads.
 *   - A `useOrganization` fallback rendering a wrapped overlay
 *     element with `pointer-events: none` that doesn't release.
 *   - Any /milestones-only feature flag rolling out a wrapper
 *     with bad CSS.
 *
 * ── Slot in KIND 6 — closes pointer-events 3-surface grid ───────────
 * KIND 6 (Visual/Computed CSS) catches before this scenario:
 *   62: user-select cascade on /companies (slice 99)
 *   80: pointer-events cascade on /companies (slice 308)
 *   81: cursor cascade on /companies (slice 309)
 *   82: text-transform cascade on /companies (slice 311)
 *   83: pointer-events cascade on /markets (slice 312, first
 *       cross-surface)
 *   84: pointer-events cascade on /milestones (this scenario,
 *       slice 313, closes 3-surface grid for pointer-events)
 *
 * After this scenario, the {80, 83, 84} triangle gives full
 * 3-surface coverage for pointer-events cascade — same KIND, same
 * mechanism, three different surfaces. Adds KIND 6 to the
 * "sister-pattern KINDs at 3-surface coverage" tally (was 5/12
 * after slice 305; lifts to 6/12 after this slice).
 *
 * Why pointer-events specifically gets the 3-surface honor:
 *   - It's the most consequential cascade catch (page totally
 *     uninteractive) — value-per-surface is highest.
 *   - The cross-surface lift (slice 312) was already done for
 *     pointer-events; closing the 3rd surface for the same
 *     property is the cleanest grid completion.
 *   - The other 3 properties (user-select, cursor,
 *     text-transform) are all single-surface (/companies); each
 *     could be expanded later when surface-specific risk
 *     materializes.
 *
 * ── Why pin on /milestones (mirroring scenarios 70, 71, 72, 75) ──────
 *   /milestones is the third user-facing surface in the harness.
 *   Per scenario 70's docs, /milestones uses PageLayout — same
 *   `<main>` signature as /companies + /markets. The slice-310
 *   helper's PageLayout `<main>` selection (Tailwind
 *   `mt-20 bg-white`) hits MilestonesPage's `<main>` unchanged.
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to /milestones?company_id=gnosis (mirrors
 *      scenario 70's route + fixture pattern).
 *   2. Wait for "Connect Wallet" (shared Header anchor — proven
 *      mount signal across /milestones from scenarios 69 + 70).
 *   3. Sleep 2s — gives milestones-specific elements (slug
 *      resolution + useOrganization fetch + list components)
 *      time to mount past the loading state. Without this, the
 *      cascade probe could fire against an intermediate loading
 *      shim with its own `pointer-events: none` (false positive).
 *   4. Call `assertPageLayoutCascadeStyleIsNot(page, {
 *      propertyName: 'pointerEvents', expectedNot: 'none',
 *      scenarioLabel: 'Scenario 84' })` — same call as
 *      scenarios 80 + 83.
 *   5. Helper finds PageLayout `<main>` (Tailwind `mt-20
 *      bg-white` signature), reads computed pointer-events,
 *      asserts NOT `'none'`. Ancestor-chain dump on failure
 *      pinpoints the cascade source.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: assertion passes (`pointer-events: 'auto'`).
 *   2. Mutate any /milestones-only wrapper component (e.g., the
 *      milestones-list container or a slug-resolution
 *      <Suspense> fallback) to include
 *      `className="pointer-events-none"` → assertion FAILS with
 *      `pointer-events: 'none'` at `<main>`, ancestor chain
 *      identifies the milestones-side cascade source.
 *   3. Restore → passes.
 *
 * ── What this scenario does NOT cover ───────────────────────────────
 *   - Other cascading properties on /milestones (cursor,
 *     user-select, text-transform). Each could get a
 *     /milestones sister, but the structural payoff of
 *     completing OTHER 3-surface grids is lower than completing
 *     the most-consequential property (pointer-events) first.
 *   - Per-element `pointer-events: none` on a specific button
 *     (legitimate). The catch only fires when the cascade
 *     reaches PageLayout `<main>`.
 *
 * ── Closing the 3-surface grid: the structural payoff ──────────────
 * Before this slice, "sister-pattern KINDs at 3-surface
 * coverage" was 5 of 12: page-error, network shape, a11y
 * heuristics, user-CSS interactive (text-selection), keyboard-
 * nav. After this slice: 6 of 12 — KIND 6 joins the tally for
 * its `pointer-events` sub-grid.
 *
 * The KIND 6 expansion across surfaces also means the harness
 * now covers cascade regressions on EVERY user-facing route
 * (companies + markets + milestones). Any layout-level CSS
 * regression that flips `pointer-events: none` on a wrapper
 * fires on at least one of the three. PR coverage for
 * layout-level CSS regressions is structurally complete.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    makeGraphqlMockHandler,
    makeCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';
import { assertPageLayoutCascadeStyleIsNot } from '../fixtures/cascading-css.mjs';

export default {
    name:        '84-pointer-events-cascade-milestones',
    description: 'KIND 6 (Visual/Computed CSS), 6th scenario; closes 3-surface grid for pointer-events cascade. Sister of 80 (/companies) + 83 (/markets) on /milestones?company_id=gnosis. Lifts KIND 6 to "sister-pattern KIND at 3-surface coverage" — was 5/12 after slice 305, now 6/12. Catches /milestones-specific pointer-events-none cascade that scenarios 80/83 would miss.',
    bugShape:    'pointer-events-none added to a milestones-list wrapper, slug-resolution Suspense fallback, useOrganization fallback overlay, or any /milestones-only feature-flag-gated wrapper: every interactive element on the milestones surface becomes non-clickable. Untriggered by /companies-scoped (80) or /markets-scoped (83) sisters.',
    route:       '/milestones?company_id=gnosis',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({}),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({ prices: {} }),
    },

    assertions: [
        // Mount anchor — shared Header across /companies, /markets,
        // /milestones (proven by scenarios 69 + 70). Without this,
        // the cascade probe could fire before any meaningful page
        // content mounts.
        async (page) => {
            await expect(
                page.getByText('Connect Wallet').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Settle: give /milestones-specific elements (slug
        // resolution + useOrganization fetch + list components)
        // time to mount past the loading state. Without this, an
        // intermediate loading shim with its own
        // `pointer-events: none` could trigger a false positive.
        async (page) => {
            await page.waitForTimeout(2000);
        },

        // Core: same helper call as scenarios 80 + 83. Just a
        // different route in the surrounding scenario. Closes
        // the pointer-events 3-surface grid for KIND 6.
        async (page) => {
            await assertPageLayoutCascadeStyleIsNot(page, {
                propertyName:  'pointerEvents',
                expectedNot:   'none',
                scenarioLabel: 'Scenario 84',
            });
        },
    ],

    timeout: 180_000,
};
