/**
 * 90-header-back-nav-anchor-milestones.scenario.mjs — sister of
 * scenario 88 (anchor-infrastructure on /companies) on the
 * /milestones surface. Lifts **KIND 4 (URL state)** static-href
 * sub-shape from 1-surface to 2-surface coverage. Catch direction
 * adjusted from "milestone-card → market" (intended) to "Header
 * /companies back-nav" (landed) per slice 321 discovery.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Static-href shape catch on /milestones — but for HEADER nav
 * infrastructure, not milestone-card market links. Slice-321
 * discovery: /milestones with the standard mock fixture renders
 * NO milestone cards (the `gnosis` company_id doesn't match any
 * mocked proposal's organizationId, and a custom probe
 * organizationId in the URL also doesn't surface cards). The
 * page DOES render the shared Header with anchors to home (`/`),
 * companies (`/companies`), and external resources (docs,
 * status, x.com, github).
 *
 * The catch focuses on what IS reliably rendered: the Header's
 * back-nav anchor to /companies. This is the primary way users
 * leave the /milestones page (back to the company list). If
 * the Header anchor breaks, users get stuck on /milestones.
 *
 * Bug shapes caught:
 *   - Header refactor drops the `/companies` Link (no
 *     back-nav from /milestones).
 *   - Header refactor changes the anchor href to `/company`
 *     (typo, singular), `#`, or empty.
 *   - Header conditionally hides the back-nav on certain
 *     surfaces (a feature-flag drift).
 *   - The href becomes a JavaScript URL (`javascript:void(0)`)
 *     that doesn't navigate.
 *
 * ── Slot in KIND 4 (URL state) — second static-href surface ─────────
 * KIND 4 catches before this scenario:
 *   49 (PR #52 URL hash rewrite via useEffect)
 *   54 (PR #55 `/market` singular redirect via routing config)
 *   88 (event-card href shape on /companies — slice 318)
 *
 * Slice 321 (this scenario): adds Header back-nav anchor catch
 * on /milestones. Different sub-shape from 88 (which catches
 * card-level anchors) but same KIND 4 mechanism (static-href
 * inspection via page.evaluate). Cross-surface diversity
 * within KIND 4 — 88 catches /companies-side outbound nav
 * infrastructure, 90 catches /milestones-side back-nav
 * infrastructure.
 *
 * After this slice, KIND 4 has 4 scenarios across 3 distinct
 * mechanisms (post-mount mutation, redirect, static-href) and
 * 3 distinct surfaces (/companies via 88, /milestones via
 * 90, with 49 + 54 also touching /milestones + /market routes).
 *
 * ── Slot in KIND 4 (URL state) — second static-href surface ─────────
 * KIND 4 catches before this scenario:
 *   49 (PR #52 URL hash rewrite via useEffect)
 *   54 (PR #55 `/market` singular redirect via routing config)
 *   88 (event-card href shape on /companies — slice 318)
 *
 * Slice 321 (this scenario): lifts the static-href catch from
 * scenario 88 to /milestones. After this slice, KIND 4 has 4
 * scenarios:
 *   - Post-mount mutation (49)
 *   - Routing-config redirect (54)
 *   - Static-href shape on /companies (88)
 *   - Static-href shape on /milestones (90 — this slice)
 *
 * The static-href sub-shape of KIND 4 is now at 2-surface
 * coverage (88 + 90). One more sister on /markets would close
 * its 3-surface grid.
 *
 * ── Why the catch direction landed differently ─────────────────────
 * Initial intent (slice 321 plan): mirror scenario 88's catch
 * exactly on /milestones — assert ≥1 anchor with `/market`
 * prefix exists (proves milestone cards have outbound market
 * links).
 *
 * Discovery: with our standard mock fixture, /milestones renders
 * NO market-prefixed anchors. Anchor diagnostic dump showed:
 *   ["/", "/companies", "https://docs.futarchy.fi",
 *    "https://status.futarchy.fi", "https://x.com/_futarchy",
 *    "https://github.com/futarchy-fi"]
 * Only Header anchors. Milestone cards don't render because
 * the `gnosis` company_id doesn't match any mocked proposal's
 * organizationId. Trying with a probe orgId in the URL also
 * didn't surface cards.
 *
 * Pivoted to assert what IS there: the `/companies` Header
 * back-nav anchor. This catches a meaningful KIND 4 sub-shape
 * (Header nav-infrastructure correctness) that complements
 * scenario 88's card-level catch.
 *
 * A future slice could add the milestone-card market-link
 * catch IF the mock fixture is extended to surface cards on
 * /milestones (would need investigation: how does the page
 * filter proposals by company_id, and what mocked
 * organizationId would match the URL filter).
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to /milestones?company_id=gnosis (matches
 *      scenario 49's proven route).
 *   2. Wait for "Connect Wallet" anchor (shared Header,
 *      proven mount signal across /milestones from scenarios
 *      69, 70, 84).
 *   3. Sleep 2s — gives Header to fully render.
 *   4. `page.evaluate` reads ALL `a[href]` anchors and
 *      returns ones with `/companies` href.
 *   5. Assert at least one such anchor exists.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: scenario PASSES (Header has a
 *      `/companies` Link).
 *   2. Mutate `src/components/common/Header.jsx` to remove
 *      the `/companies` Link or change its href → scenario
 *      FAILS.
 *   3. Restore → passes.
 *
 * ── What this scenario does NOT cover ───────────────────────────────
 *   - Milestone-card → market navigation (no cards render
 *     in the mock setup; deferred until fixture extension).
 *   - Click-mediated navigation (deferred — slice 318
 *     attempt failed in harness setup).
 *   - /markets sister of the same back-nav catch (would
 *     close a 3-surface grid for back-nav).
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    makeGraphqlMockHandler,
    makeCandlesMockHandler,
    fakePoolBearingProposal,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '90-header-back-nav-anchor-milestones',
    description: 'KIND 4 (URL state), 4th scenario; static-href catch on /milestones (companion to scenario 88 on /companies). Navigate to /milestones?company_id=gnosis, inspect Header anchors, assert at least one points to /companies (back-nav infrastructure). Catch direction adjusted from intended milestone-card market-link catch (no cards render with our standard mock setup — see slice 321 PROGRESS for discovery).',
    bugShape:    'Header back-nav refactor drops the /companies Link OR changes href to a typo (`/company`) / `#` / empty / javascript:URL. Users on /milestones can\'t navigate back to the company list — primary back-nav infrastructure breaks. Untriggered by /companies-scoped scenario 88 since back-nav originates from a different surface.',
    route:       '/milestones?company_id=gnosis',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakePoolBearingProposal({})],
        }),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({}),
    },

    assertions: [
        // 1. Mount anchor — shared Header across /companies,
        // /markets, /milestones (proven by scenarios 69, 70, 84).
        async (page) => {
            await expect(
                page.getByText('Connect Wallet').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // 2. Settle: give /milestones-specific elements (slug
        // resolution + useOrganization fetch + list components)
        // time to mount past the loading state. Without this,
        // the anchor probe could fire before milestone cards
        // render.
        async (page) => {
            await page.waitForTimeout(2000);
        },

        // 3. Read all anchors and filter for /companies hrefs.
        // The Header has a Link back to /companies — primary
        // back-nav infrastructure on /milestones. Catch: at
        // least one such anchor exists.
        async (page) => {
            const probe = await page.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll('a[href]'));
                const allHrefs = anchors.map((a) => a.getAttribute('href') ?? '');
                const companiesHrefs = allHrefs.filter((h) => h === '/companies');
                return { allHrefs, companiesHrefs };
            });

            expect(probe.companiesHrefs.length, {
                message: `expected at least one anchor with href "/companies" on /milestones (Header back-nav); got companiesHrefs: ${JSON.stringify(probe.companiesHrefs)}; ALL hrefs (first 30): ${JSON.stringify(probe.allHrefs.slice(0, 30))}`,
            }).toBeGreaterThan(0);
        },
    ],

    timeout: 180_000,
};
