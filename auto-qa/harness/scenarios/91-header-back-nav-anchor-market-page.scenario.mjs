/**
 * 91-header-back-nav-anchor-market-page.scenario.mjs — sister of
 * scenario 90 (Header back-nav on /milestones) on the /markets
 * surface. Lifts the **KIND 4 (URL state)** Header-back-nav
 * sub-shape from 1-surface to 2-surface coverage.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Same Header-back-nav anchor catch as scenario 90, surfacing on
 * the /markets page. The shared Header component renders on
 * every user-facing route (/companies, /markets, /milestones).
 * If a refactor breaks the back-nav anchor on the Header, the
 * regression surfaces on EVERY route — but each surface needs
 * its own scenario because:
 *
 *   - Header rendering may differ per surface (some surfaces
 *     conditionally hide nav links via flag/state).
 *   - Surface-specific overlays / portals may obscure the
 *     Header anchor without affecting other routes.
 *   - The anchor query operates on the surface's full DOM —
 *     same query, different DOM shape per surface.
 *
 * Specifically catches MarketPage-specific regressions:
 *   - Trading-page-specific overlay that hides Header nav.
 *   - MarketPageShowcase wrapper unintentionally re-portaling
 *     the Header outside the queryable DOM.
 *   - A flag like "minimal trading mode" that scopes Header
 *     hiding too broadly.
 *
 * ── Slot in KIND 4 (URL state) — second back-nav surface ────────────
 * KIND 4 catches before this scenario:
 *   49 (PR #52 URL hash rewrite via useEffect)
 *   54 (PR #55 `/market` singular redirect via routing config)
 *   88 (event-card outbound static-href on /companies)
 *   90 (Header back-nav anchor on /milestones)
 *
 * Slice 322 (this scenario): adds Header back-nav catch on
 * /markets. Lifts back-nav sub-shape from 1-surface (1/3) to
 * 2-surface (2/3). One more sister on /companies (or any future
 * surface that the Header would render back-nav on) would close
 * the back-nav 3-surface grid.
 *
 * Wait — /companies IS a destination of the back-nav. There's
 * no need to back-nav FROM /companies TO /companies. So the
 * back-nav 3-surface grid is naturally bounded at 2 surfaces
 * (/markets + /milestones, both back to /companies). After
 * this slice the grid is structurally complete for that
 * sub-shape.
 *
 * ── Surface-by-sub-shape KIND 4 matrix after slice 322 ──────────────
 * ```
 *                      /companies  /markets  /milestones
 * post-mount mutation       —         —          49
 * routing redirect          —         54         —
 * outbound static-href      88        —          —
 * back-nav static-href      n/a       91*       90
 * ```
 * (* = this scenario)
 *
 * The "back-nav" row reaches its natural 2-surface ceiling
 * (back-nav from /companies wouldn't make sense — it's the
 * destination). Other rows can still be lifted to more
 * surfaces by future slices.
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to /markets/<MARKET_PROBE_ADDRESS> (mirrors
 *      scenario 83's market-page boilerplate).
 *   2. Wait for "Trading Pair" heading (proven /markets
 *      mount signal — scenarios 10, 24, 57, 60, 66-68, 74,
 *      83, 85).
 *   3. `page.evaluate` reads ALL `a[href]` anchors and
 *      filters for those with href exactly `/companies`.
 *   4. Assert at least one such anchor exists.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *   1. Current code: scenario PASSES (Header has a
 *      `/companies` Link rendered on /markets).
 *   2. Mutate `src/components/common/Header.jsx` to remove
 *      the `/companies` Link or change its href → BOTH
 *      scenarios 90 + 91 FAIL (regression surfaces on
 *      multiple surfaces, as expected for shared Header).
 *   3. Add a MarketPage-specific overlay that hides the
 *      Header → only scenario 91 FAILS, scenario 90 still
 *      passes — proves cross-surface coverage value.
 *   4. Restore → passes.
 *
 * ── What this scenario does NOT cover ───────────────────────────────
 *   - Click-mediated back-nav (just verifies anchor exists).
 *   - Other Header anchors (/, docs, github, x.com).
 *   - /companies-side back-nav (n/a — /companies IS the
 *     destination).
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
    name:        '91-header-back-nav-anchor-market-page',
    description: 'KIND 4 (URL state), 5th scenario; sister of 90 on /markets/<probe>. Navigate to /markets/<MARKET_PROBE_ADDRESS>, inspect Header anchors, assert at least one points to /companies (back-nav infrastructure). Lifts Header-back-nav sub-shape from 1-surface to 2-surface coverage. Closes the natural 2-surface ceiling for back-nav (/companies is the destination — back-nav from it is n/a).',
    bugShape:    'MarketPage-specific overlay/portal hides Header back-nav OR shared Header refactor drops the /companies Link OR changes href to typo / # / empty / javascript:URL. Trading users on /markets can\'t navigate back to the company list — primary back-nav infrastructure breaks specifically on /markets. Untriggered by /milestones-scoped scenario 90 if the regression is MarketPage-specific.',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakeMarketProposalEntity()],
        }),
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    assertions: [
        // 1. Anchor on /markets — wait for the page-shell to
        // mount past the loading state. "Trading Pair" heading
        // is the proven /markets mount signal.
        async (page) => {
            await expect(
                page.getByText('Trading Pair').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // 2. Read all anchors and filter for /companies hrefs.
        // Catch: at least one such anchor exists. Same pattern
        // as scenario 90 on /milestones.
        async (page) => {
            const probe = await page.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll('a[href]'));
                const allHrefs = anchors.map((a) => a.getAttribute('href') ?? '');
                const companiesHrefs = allHrefs.filter((h) => h === '/companies');
                return { allHrefs, companiesHrefs };
            });

            expect(probe.companiesHrefs.length, {
                message: `expected at least one anchor with href "/companies" on /markets (Header back-nav); got companiesHrefs: ${JSON.stringify(probe.companiesHrefs)}; ALL hrefs (first 30): ${JSON.stringify(probe.allHrefs.slice(0, 30))}`,
            }).toBeGreaterThan(0);
        },
    ],

    timeout: 180_000,
};
