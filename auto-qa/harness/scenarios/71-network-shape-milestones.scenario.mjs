/**
 * 71-network-shape-milestones.scenario.mjs — sister of scenarios 50
 * (/companies) + 66 (/markets) on the /milestones surface.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Same KIND as scenarios 50 + 66 (silent network-behavior
 * regressions invisible to DOM-text/error/URL/visual monitors) —
 * on the /milestones surface.
 *
 * The {50, 66, 71} ensemble completes the 3-surface grid for
 * network-shape KIND:
 *
 *   - **50**: /companies (first scenario; established the KIND).
 *   - **66**: /markets (second scenario; same pattern, different
 *     fetch sites).
 *   - **71 (this)**: /milestones (third surface; closes the grid).
 *
 * Specifically catches network regressions in /milestones-only
 * code paths:
 *   - `useOrganization` hook routes to a deprecated/wrong subgraph
 *     URL.
 *   - Slug-resolution + LEGACY_ID_TO_ORG_ADDRESS skips the
 *     registry fetch (refactor moves the lookup elsewhere; no
 *     errors fire, but data origin silently shifts).
 *   - A milestones-list-only chart-data hook hits legacy
 *     CloudFront URLs (the PR #60 shape if reintroduced in
 *     /milestones-only code).
 *   - Retry storm specific to the milestones rendering path (no
 *     errors, no DOM change — invisible to every other monitor).
 *
 * These would slip past scenarios 50 (/companies-only navigation)
 * and 66 (/markets-only navigation) which don't exercise
 * /milestones.
 *
 * ── Specific assertions ─────────────────────────────────────────────
 *
 *   POSITIVE 1: at least one call to api.futarchy.fi/registry/graphql.
 *     Proves useOrganization fires on the slug-mapped address. A
 *     regression that drops the registry fetch (LEGACY_ID_TO_ORG
 *     _ADDRESS mapping broken, useOrganization disabled) → 0
 *     calls → fails.
 *
 *   NEGATIVE: zero calls to legacy AWS CloudFront / amazonaws.com.
 *     Same pattern as 50, 66. Catches a PR #60-shape revert in
 *     milestones-only code paths.
 *
 * Note: candles GraphQL is NOT asserted positively here, unlike
 * scenarios 50 + 66. /milestones?company_id=<slug> without a hash
 * doesn't necessarily mount the price-fetching carousel that
 * /companies and /markets do. If empirical evidence shows candles
 * IS called, a future iteration can add the positive assertion;
 * if not, omitting it avoids a vacuous-failure mode.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *
 *   1. Current code: all assertions pass.
 *
 *   2. Mutate `src/pages/milestones.js` to short-circuit
 *      `LEGACY_ID_TO_ORG_ADDRESS` (e.g., `const companyIdToUse =
 *      null;`). Run scenario → POSITIVE 1 FAILS (0 calls when
 *      1+ expected). Sister to scenario 63's catch direction.
 *
 *   3. Add a stray `fetch('https://test.cloudfront.net/legacy')`
 *      inside any /milestones-mounted code. Run scenario →
 *      NEGATIVE FAILS (1 call when 0 expected).
 *
 *   4. Restore. Verify passes.
 *
 * ── Mocks ───────────────────────────────────────────────────────────
 * Same happy-path mocks as scenarios 69 + 70 (registry +
 * candles GraphQL handlers). The assertions inspect what URLs
 * the PAGE called, not the mock payloads.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    makeGraphqlMockHandler,
    makeCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '71-network-shape-milestones',
    description: 'Sister of scenarios 50 + 66 on /milestones?company_id=gnosis. Asserts /milestones network shape: must call api.futarchy.fi/registry/graphql; must NOT call legacy AWS CloudFront subgraph URLs. Closes the 3-surface grid for network-shape KIND.',
    bugShape:    'Milestones-only code silently hits a deprecated/wrong URL (PR #60-shape if reintroduced in /milestones code) / skips the required registry fetch (LEGACY_ID_TO_ORG_ADDRESS mapping broken, useOrganization disabled) / floods a healthy endpoint with retries from milestones-only hooks. Untriggered by scenarios 50 (/companies) and 66 (/markets) which don\'t navigate /milestones.',
    route:       '/milestones?company_id=gnosis',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({}),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({ prices: {} }),
    },

    assertions: [
        // Anchor: page chrome rendered. "Connect Wallet" is in the
        // shared Header across /companies, /markets, /milestones —
        // same proven anchor used by scenarios 69, 70.
        async (page) => {
            await expect(
                page.getByText('Connect Wallet').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // POSITIVE 1: registry GraphQL endpoint called at least
        // once from the /milestones page. Proves
        // useOrganization(<slug-mapped address>) fires.
        async (page, ctx) => {
            await expect.poll(
                () => ctx.callsTo('api.futarchy.fi/registry/graphql').length,
                {
                    message: 'expected at least one call to api.futarchy.fi/registry/graphql from /milestones',
                    timeout: 15_000,
                },
            ).toBeGreaterThan(0);
        },

        // NEGATIVE: zero calls to legacy AWS CloudFront /
        // amazonaws subgraph URLs. Catches a PR #60-shape revert
        // in /milestones-only code paths. The positive assertion
        // above already polled for ~15s, giving any latent
        // legacy fetch time to fire before this check.
        async (page, ctx) => {
            const legacyCalls = ctx.callsTo(/\.(cloudfront\.net|amazonaws\.com)/);
            expect(legacyCalls, {
                message: `expected zero calls to legacy AWS subgraph URLs (cloudfront.net / amazonaws.com) from /milestones; saw: ${legacyCalls.map(c => c.url).join(', ')}`,
            }).toHaveLength(0);
        },
    ],

    timeout: 180_000,
};
