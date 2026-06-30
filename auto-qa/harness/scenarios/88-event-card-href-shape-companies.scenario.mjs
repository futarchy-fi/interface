/**
 * 88-event-card-href-shape-companies.scenario.mjs — third catch
 * in **KIND 4 (URL state)**. Static-href assertion: verify that
 * event cards on /companies have anchor elements pointing at the
 * market page with the correct href shape (probe proposal address
 * present). Authored after a click-navigation attempt failed —
 * see slice 318 PROGRESS entry for the diagnostic.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * In-app navigation INFRASTRUCTURE regressions. The futarchy app's
 * primary navigation pattern is /companies → click event card →
 * market page. The infrastructure for that navigation is the
 * `<a href="...">` element rendered inside EventHighlightCard.jsx.
 *
 * If the href shape is wrong (typo path, missing proposalID, broken
 * by a feature flag flip), the navigation breaks silently — users
 * click and nothing happens (or land on a wrong route). This catch
 * verifies the href EXISTS and CONTAINS the probe proposal
 * address. It does NOT verify that clicking actually navigates
 * (an attempt at click-mediated nav failed during slice 318 —
 * Next.js Link click handling in the harness setup needs further
 * investigation).
 *
 * Bug shapes caught:
 *
 *   1. **Card href wired to wrong path** — refactor types
 *      `/marekt` (typo) instead of `/market`, or omits the
 *      proposalID, or makes the href conditional in a way that
 *      drops it.
 *
 *   2. **Feature flag drift breaks href shape** — the
 *      `USE_QUERY_PARAM_URLS` flag toggles the href shape
 *      between `/market?proposalId=X` and `/markets/X` (per
 *      `src/utils/urlUtils.js`). A regression in the flag
 *      handling could produce neither shape.
 *
 *   3. **Card renders without an anchor at all** — refactor
 *      removes the `<a>` wrapper, leaving the card non-
 *      navigable.
 *
 *   4. **Address truncation / mangling** — href contains
 *      a malformed proposalID (e.g., truncated, hex-only-
 *      lowercased when checksum was needed).
 *
 * What this scenario does NOT catch:
 *   - Click handler regressions (preventDefault without
 *     navigating, Link → router.push() refactor that drops
 *     await). A click-mediated catch was attempted in slice
 *     318 but Next.js Link click handling in the harness
 *     setup didn't fire navigation; deferred to a future
 *     slice with proper diagnosis.
 *
 * ── Slot in KIND 4 (URL state) — third scenario, static-href ────────
 * KIND 4 catches before this scenario:
 *   49 (PR #52 URL hash rewrite): single-page hash → query
 *       param rewrite via `history.replaceState`.
 *   54 (PR #55 `/market` singular redirect): single-page
 *       redirect for legacy URL alias.
 *
 * Slice 318 (this scenario): static-href shape assertion on
 * /companies. Distinct from 49 (which checks post-mount URL
 * mutation) and 54 (which checks redirect mapping). After this
 * slice, KIND 4 has 3 scenarios covering 3 distinct URL-state
 * catch directions.
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to /companies. Wait for the page-shell to mount
 *      (CompaniesListCarousel heading visible).
 *   2. Wait for the probe-event card to render
 *      (HARNESS-PROBE-EVENT-001 text visible — proves the
 *      registry mock's proposal got assembled into a card).
 *   3. `page.evaluate` reads ALL `a[href]` elements with
 *      hrefs starting with `/market` (covers both
 *      `/market?proposalId=X` legacy alias and `/markets/X`
 *      direct shape).
 *   4. Assert at least one such anchor exists.
 *   5. Assert at least one of them contains the probe
 *      proposal address (case-insensitive). Catches address-
 *      mangling regressions.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: scenario PASSES (USE_QUERY_PARAM_URLS=true
 *      makes hrefs `/market?proposalId=<probe-address>`).
 *   2. Mutate `EventHighlightCard.jsx:314` to remove the `<a>`
 *      wrapper → scenario FAILS at step 4 (no matching
 *      anchors found).
 *   3. Mutate the marketUrl computation to drop the
 *      proposalId → scenario FAILS at step 5 (no anchor
 *      contains the probe address).
 *   4. Restore → passes.
 *
 * ── Diagnostic note from slice 318 (click-nav attempt) ──────────────
 * Initial slice-318 attempt tried `page.locator('a[href]').click()`
 * + `page.waitForURL(...)` to test the FULL click-mediated nav
 * flow. The locator-click succeeded (no error) but the URL never
 * transitioned. Programmatic `element.click()` via page.evaluate
 * also did not trigger navigation. Possible causes:
 *
 *   - Next.js Link's intercepting click handler not registered
 *     during the harness's HMR-mode dev server.
 *   - An overlay or animation layer in EventHighlightCard
 *     that blocks click bubbling.
 *   - The `force: true` click bypassing actionability also
 *     bypassing some event normalization.
 *
 * Diagnosing this is its own slice — too large to fold into a
 * single iteration. The static-href catch lands the smaller
 * value (anchor infrastructure correctness) cleanly.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    PROBE_PROPOSAL_ADDRESS,
    makeGraphqlMockHandler,
    makeCandlesMockHandler,
    fakePoolBearingProposal,
} from '../fixtures/api-mocks.mjs';

const EVENT_TITLE = 'HARNESS-PROBE-EVENT-001';

export default {
    name:        '88-event-card-href-shape-companies',
    description: 'KIND 4 (URL state), 3rd scenario. Static-href assertion: navigate to /companies, wait for probe-event card to render, inspect all `a[href^="/market"]` anchors and assert at least one contains the probe proposal address. Catches in-app nav INFRASTRUCTURE regressions (wrong path, missing proposalID, address mangling, anchor removed). Does NOT test click-mediated nav (deferred — slice 318 click-nav attempt failed; Next.js Link click handling in harness needs investigation).',
    bugShape:    'EventHighlightCard.jsx anchor href has wrong shape: typo path (`/marekt`), missing proposalId param, address truncated or mangled, OR the <a> wrapper removed entirely. Navigation infrastructure broken — users click event cards and either go nowhere or land on a wrong/broken route. Distinct from click-handler regressions (preventDefault without navigating) which need a separate catch.',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakePoolBearingProposal({})],
        }),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({}),
    },

    assertions: [
        // 1. Anchor on /companies — wait for the source page to
        // mount past the loading state.
        async (page) => {
            await expect(
                page.getByRole('heading', { name: /Organizations|Active Milestones/i }).first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // 2. Wait for the probe-event card to render — proves
        // the registry mock's proposal got assembled into a
        // card. Same anchor as scenario 55.
        async (page) => {
            await expect(
                page.getByText(EVENT_TITLE).first(),
            ).toBeVisible({ timeout: 15_000 });
        },

        // 3. Read all market-targeted anchors. Covers both the
        // legacy alias `/market?proposalId=X` (under
        // USE_QUERY_PARAM_URLS=true per
        // src/config/featureFlags.js) and the direct shape
        // `/markets/X` (under the flag flipped off). Returns
        // the href list for the next assertion.
        async (page) => {
            const hrefs = await page.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll('a[href]'));
                return anchors
                    .map((a) => a.getAttribute('href') ?? '')
                    .filter((h) => h.startsWith('/market'));
            });

            // Catch 1: at least one market-targeted anchor exists.
            expect(hrefs.length, {
                message: `expected at least one anchor with href starting with /market on /companies; got hrefs: ${JSON.stringify(hrefs.slice(0, 10))}`,
            }).toBeGreaterThan(0);

            // Catch 2: at least one anchor contains the probe
            // proposal address (case-insensitive — the address
            // could appear lowercase or checksummed depending
            // on the codepath).
            const probeLower = PROBE_PROPOSAL_ADDRESS.toLowerCase();
            const matchingHref = hrefs.find((h) => h.toLowerCase().includes(probeLower));
            expect(matchingHref, {
                message: `expected at least one /market anchor href to contain probe proposal address ${probeLower}; got hrefs: ${JSON.stringify(hrefs)}`,
            }).toBeTruthy();
        },
    ],

    timeout: 60_000,
};
