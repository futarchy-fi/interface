/**
 * 81-cursor-cascade-companies.scenario.mjs — third catch in
 * **KIND 6 (Visual / Computed CSS)**. Sister of scenarios 62 +
 * 80 on the same surface (/companies); third cascading CSS
 * property: `cursor`.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * `cursor: not-allowed` cascade. Third inline copy of the same
 * computed-CSS catch shape introduced by scenario 62 (user-select)
 * and extended by scenario 80 (pointer-events). Per CSS spec,
 * `cursor` is INHERITED — a value set on a parent propagates to
 * descendants unless explicitly overridden.
 *
 * When `cursor: not-allowed` cascades from a page-level wrapper
 * (PageLayout root, a section, etc.), every interactive element
 * within the wrapper renders with the not-allowed (Ø) cursor on
 * hover. Functional clicks may still fire (so this isn't a
 * `pointer-events: none` clone), but the UX feels broken — users
 * see a "blocked" icon over buttons that actually work. Subtle
 * but corrosive: most users abandon the action because they
 * believe the UI is rejecting them.
 *
 * Bug shapes caught:
 *
 *   1. **Tailwind `cursor-not-allowed` pasted at PageLayout root**
 *      — easy paste from a button-disabled utility class.
 *      `cursor-not-allowed` is widely used on disabled `<button>`
 *      elements; copying it to a layout-level wrapper to indicate
 *      "page is in a loading state" without re-pointing
 *      individual interactive children pollutes every cursor.
 *
 *   2. **Form-disabled state leaking up the tree** — a parent
 *      `<div>` that sets `cursor: not-allowed` while a form is
 *      submitting, intended to scope to the form, but actually
 *      cascading to non-form descendants because it's positioned
 *      above the form in the tree.
 *
 *   3. **CSS reset gone wrong** — a CSS reset or normalizer that
 *      sets `cursor: not-allowed` on `*` or a layout-level class.
 *
 * ── Slot in KIND 6 — N=3 inline copies reached ──────────────────────
 * KIND 6 (Visual/Computed CSS) now has three scenarios with
 * structurally identical assertion shapes:
 *
 *   62: user-select cascade catch on /companies
 *   80: pointer-events cascade catch on /companies
 *   81: cursor cascade catch on /companies (this scenario)
 *
 * All three:
 *   - Use the same anchor (CompaniesListCarousel heading).
 *   - Use the same `<main>` selection logic (match
 *     `mt-20 bg-white` Tailwind signature, fall back to last
 *     `<main>` in DOM order).
 *   - Read a different cascading CSS property via
 *     `getComputedStyle`.
 *   - Assert the resolved value is NOT the regression marker
 *     (`'none'` for 62/80, `'not-allowed'` for 81).
 *   - Dump the ancestor chain on failure for cascade debugging.
 *
 * Per slice 289 doctrine (extract at N=3 inline copies), the next
 * slice can extract a shared `assertCascadeStyleIsNot(page, {
 * route?, anchor, expectedNot, propertyName })` helper into a new
 * `fixtures/cascading-css.mjs` (or similar). This scenario closes
 * the threshold; the extraction is the obvious follow-up.
 *
 * ── Why pin on /companies (same rationale as 62 + 80) ───────────────
 *   `/companies` is a clean PageLayout consumer with no local
 *   `cursor` opt-in. Default cursor resolves to `'auto'` at
 *   `<main>`. /proposals has a `select-none` opt-in (scenario 62
 *   docs) but no known `cursor` opt-in — could also work, but
 *   keeping all three N=3 sisters on the same surface keeps the
 *   extraction unambiguous (same anchor, same selection logic).
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to `/companies`.
 *   2. Wait for CompaniesListCarousel heading (same anchor as 62
 *      + 80).
 *   3. `page.evaluate` reads `getComputedStyle(<main>).cursor`
 *      using identical `<main>` selection to 62 + 80.
 *   4. Assert the resolved value is NOT `'not-allowed'`.
 *   5. On failure, dump the ancestor chain (tag, className,
 *      cursor value) so the cascade source is obvious.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: assertion passes (`cursor: 'auto'`).
 *   2. Mutate `src/components/layout/PageLayout.jsx:5`:
 *         `<div className="flex flex-col cursor-not-allowed flex-grow">`
 *      → assertion FAILS with `cursor: 'not-allowed'` at `<main>`,
 *      ancestor chain identifies the PageLayout root div as the
 *      cascade source.
 *   3. Restore → passes.
 *
 * ── What this scenario does NOT cover ───────────────────────────────
 *   - Per-button `cursor: not-allowed` (legitimate, expected on
 *     disabled buttons). The catch fires only when cascade reaches
 *     `<main>` — page-level regression only.
 *   - `cursor: pointer` on non-interactive elements (a different
 *     bug shape — accessibility/UX confusion but not a cascade
 *     regression).
 *   - Custom cursor URLs broken (the asserter only checks against
 *     the regression marker `'not-allowed'`, not arbitrary
 *     custom cursors).
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
    name:        '81-cursor-cascade-companies',
    description: 'KIND 6 (Visual/Computed CSS), 3rd scenario. Sister of 62 + 80 on the same surface; 3rd cascading CSS property: cursor. Navigate to /companies, assert getComputedStyle(<main>).cursor !== "not-allowed". A cursor-not-allowed cascade from PageLayout makes every page show the blocked cursor on hover — clicks still work but UX feels broken (users abandon believing the UI is rejecting them). Closes N=3 threshold for KIND 6 fixture extraction.',
    bugShape:    'cursor-not-allowed class pasted at PageLayout root (or any page-level wrapper): every descendant inherits the blocked cursor on hover. Subtle — functional clicks still fire, but users see "blocked" icon over working buttons and abandon the action.',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakePoolBearingProposal({})],
        }),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({}),
    },

    assertions: [
        // Mirror 62 + 80's anchor — wait for the page-shell to
        // mount past the loading state. Without this, evaluate()
        // against a still-loading shell could resolve to the
        // default cursor of an inner shim element, masking a
        // regression that's only visible on the actual page tree.
        async (page) => {
            await expect(
                page.getByRole('heading', { name: /Organizations|Active Milestones/i }).first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Core: inspect computed cursor at PageLayout's <main>.
        // Slice 310: shared cascade helper. Identical selection
        // logic + ancestor-chain dump to 62 + 80 — single source
        // of truth for all cascade catches.
        async (page) => {
            await assertPageLayoutCascadeStyleIsNot(page, {
                propertyName:  'cursor',
                expectedNot:   'not-allowed',
                scenarioLabel: 'Scenario 81',
            });
        },
    ],

    timeout: 60_000,
};
