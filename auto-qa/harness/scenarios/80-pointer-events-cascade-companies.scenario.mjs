/**
 * 80-pointer-events-cascade-companies.scenario.mjs — second catch
 * in **KIND 6 (Visual / Computed CSS)**. Sister of scenario 62 on
 * the same surface (/companies) but a different cascading CSS
 * property: `pointer-events`.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * `pointer-events: none` cascade. Same shape as scenario 62's
 * `user-select: none` catch — both are CSS properties that cascade
 * to descendants and silently re-break UX if pasted at a parent.
 *
 * `pointer-events: none` on a parent makes the entire subtree
 * non-clickable: no buttons fire, no links navigate, no form fields
 * accept focus. The page renders identically (same text, same
 * pixels) but the user can't INTERACT with it. Worse than
 * `user-select` because there's no obvious "I can't copy" trigger —
 * users see a button, click it, and nothing happens.
 *
 * Bug shapes caught:
 *
 *   1. **Tailwind `pointer-events-none` pasted at PageLayout root**
 *      — adjacent in naming to `select-none` (which scenario 62
 *      catches). If a hover-only utility class gets copied from
 *      another file and pasted at the wrong nesting level, every
 *      page wrapped by PageLayout becomes uninteractive.
 *
 *   2. **`<div className="overlay">` accidentally promoted to a
 *      page-wide wrapper** — many overlay utilities set
 *      `pointer-events: none` as a default, expected to be flipped
 *      to `auto` on the visible parts. Wrapping the page in such an
 *      overlay flips the polarity.
 *
 *   3. **Loading-state component leaking its disabled style** — a
 *      `<LoadingShim pointer-events-none>` wrapper that's supposed
 *      to release after data resolves but doesn't.
 *
 * ── Why pin this on /companies (mirroring scenario 62) ──────────────
 *   `/companies` is a clean PageLayout consumer that doesn't opt
 *   INTO `pointer-events: none` anywhere. The PageLayout root div
 *   is the only plausible source of a cascading `none`, so the
 *   resolved value at `<main>` is a clean signal: `'auto'` →
 *   healthy, `'none'` → cascade regression.
 *
 *   /proposals opts INTO `select-none` (per scenario 62 docs); it
 *   does NOT opt into `pointer-events-none`, but to keep the catch
 *   anchored to a route with known-clean cascade behavior, we
 *   reuse /companies. Sister-pattern logic: scenario 62 + scenario
 *   80 use the same anchor + same `<main>` selection logic so the
 *   two computed-CSS catches share verification reasoning.
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to `/companies` (same as scenario 62).
 *   2. Wait for the CompaniesListCarousel heading (same anchor as
 *      scenario 62 — confirms the PageLayout tree mounted, not the
 *      bare _app.js shell).
 *   3. Find the PageLayout `<main>` (same selection logic as
 *      scenario 62 — match `mt-20 bg-white` classes; fall back to
 *      last `<main>` in DOM order).
 *   4. Read `getComputedStyle(main).pointerEvents`. Assert it's
 *      NOT `'none'`. The resolved value is typically `'auto'` for a
 *      healthy page.
 *   5. On failure, dump the ancestor chain (tag, className,
 *      pointerEvents value) so the cascade source is obvious.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: assertion passes (`pointer-events: auto`).
 *   2. Mutate `src/components/layout/PageLayout.jsx:5` (the root
 *      `<div className="flex flex-col flex-grow">`) to:
 *         `<div className="flex flex-col pointer-events-none flex-grow">`
 *      → assertion FAILS with `Received: "none"` and the ancestor
 *      chain in the error message identifies which div carries the
 *      cascade source.
 *   3. Restore → passes.
 *
 * ── What this scenario does NOT cover ───────────────────────────────
 *   - Per-element `pointer-events: none` on a specific button or
 *     subtree (the cascade catch here only fires when the regression
 *     is at the PageLayout level). Per-element regressions need
 *     per-element scenarios.
 *   - `pointer-events: none` ADDED inside a feature-flag-gated
 *     codepath. Like all UI catches, this only fires when the
 *     regression reaches /companies under default conditions.
 *
 * ── Slot in KIND 6 (Visual / Computed CSS) ──────────────────────────
 * Scenario 62 = first computed-CSS catch (user-select cascade).
 * Scenario 80 = second computed-CSS catch (pointer-events cascade).
 * Both share verification reasoning + the same DOM anchor + the
 * same selection logic; differ only in the CSS property name. KIND
 * 6 is now at 2 scenarios. Per-surface coverage on /companies; a
 * future slice could add sisters on /markets and /milestones for
 * either property (or both via a shared helper if a 3rd cascade
 * catch lands and N=3 inline copies materialize).
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    makeGraphqlMockHandler,
    makeCandlesMockHandler,
    fakePoolBearingProposal,
} from '../fixtures/api-mocks.mjs';
import { assertPageLayoutCascadeStyleIsNot } from '../fixtures/cascading-css.mjs';

export default {
    name:        '80-pointer-events-cascade-companies',
    description: 'KIND 6 (Visual/Computed CSS), 2nd scenario. Sister of 62 on the same surface but for pointer-events. Navigate to /companies, wait for PageLayout-mounted heading, assert getComputedStyle(<main>).pointerEvents !== "none". A pointer-events: none on the PageLayout root cascades to descendants and makes the entire page uninteractive — invisible visually, total UX break.',
    bugShape:    'pointer-events-none class added to PageLayout root: every descendant inherits non-interactivity. Users see buttons but clicks do nothing. No visual signal — strictly an interaction regression.',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakePoolBearingProposal({})],
        }),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({}),
    },

    assertions: [
        // Mirror scenario 62's anchor — wait for the page-shell to
        // mount past the loading state. Without this, evaluate()
        // against a still-loading shell could resolve to the
        // default pointer-events of an inner shim element, masking
        // a regression that's only visible on the actual page tree.
        async (page) => {
            await expect(
                page.getByRole('heading', { name: /Organizations|Active Milestones/i }).first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Core: inspect computed pointer-events at PageLayout's
        // <main>. Slice 310: shared cascade helper. Identical
        // selection logic + ancestor-chain dump to 62 + 81 —
        // single source of truth for all cascade catches.
        async (page) => {
            await assertPageLayoutCascadeStyleIsNot(page, {
                propertyName:  'pointerEvents',
                expectedNot:   'none',
                scenarioLabel: 'Scenario 80',
            });
        },
    ],

    timeout: 60_000,
};
