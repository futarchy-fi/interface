/**
 * 05-registry-empty-orgs.scenario.mjs — Phase 7 slice 2: empty-data chaos.
 *
 * Where 02-registry-down takes the registry endpoint OUT (502), this
 * scenario keeps it UP and HEALTHY but the org catalog is empty —
 * `organizations: []` in the response. Distinct code path through
 * useAggregatorCompanies: this scenario fires the `.then` branch
 * (success with empty data) instead of the `.catch` branch (5xx).
 * Both should land at the same UX terminal state: "No organizations
 * found". Pinning the empty-200 path catches a bug class where the
 * `.then(empty)` branch silently hangs (loading=true forever),
 * shows a different message ("No data" vs "No organizations found"),
 * or worse — fails the empty check and crashes on the empty array.
 *
 * Bug-shapes guarded:
 *   - empty-200 path silently hangs (loading=true never clears
 *     because the hook only sets loading=false on .catch, not on
 *     successful-with-empty)
 *   - different terminal message between empty-200 vs 5xx paths
 *     (the user can't tell whether to retry or whether there's
 *     genuinely no data)
 *   - .then branch doesn't guard against empty array → crashes
 *     trying to read first item ("Cannot read property '.id' of
 *     undefined")
 *   - silent partial state — UI shows org filter dropdown populated
 *     from cached state but no rows underneath (mismatch between
 *     dropdown model + table model when both should be empty)
 *
 * Slice naming note: Phase 7 slice 2 originally bundled
 * REGISTRY/CANDLES chaos. The breakdown evolved:
 *   #02 → REGISTRY 5xx (hard failure)
 *   #03 → CANDLES 5xx (hard failure)
 *   #04 → CANDLES partial-200 (subset of requested data)
 *   #05 → REGISTRY empty-200 (this scenario; symmetric to #04 on
 *         the other endpoint)
 * That gives us a 2×2 chaos coverage matrix: {REGISTRY, CANDLES} ×
 * {5xx-down, 200-degraded}. All four hit DIFFERENT code branches
 * with the SAME expected UX (empty state vs degraded card).
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '05-registry-empty-orgs',
    description: 'Registry GraphQL responds 200 with empty organizations array; assert /companies degrades to "No organizations found" empty state — distinct code path from the 5xx scenario (#02) which fires .catch, vs this one which fires .then(empty).',
    bugShape:    'empty-200 path hangs / shows wrong message / crashes on empty array (different code branch in useAggregatorCompanies than the 5xx path; same expected UX)',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: async (route) => {
            // Respond 200 + valid GraphQL shape but with empty data
            // for every query type the page issues. This is the
            // CONTRAPOSITIVE of 02-registry-down: same UX terminal
            // state, opposite control-flow. The .then branch of
            // useAggregatorCompanies fires (loading=false, error=null,
            // companies=[]). If the hook only clears loading=false
            // on .catch, this scenario hangs forever.
            const body = JSON.parse(route.request().postData() || '{}');
            const q = body.query || '';
            let data;
            if (q.includes('organizations(where:')) {
                data = { organizations: [] };
            } else if (q.includes('aggregator(id:')) {
                data = { aggregator: null };
            } else if (q.includes('proposalentities(where:')) {
                data = { proposalentities: [] };
            } else {
                // Catch-all for any other query the page might issue.
                // Returning empty data on every shape is the most
                // restrictive empty-200 simulation.
                data = {};
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data }),
            });
        },
    },

    assertions: [
        async (page) => {
            await expect(
                page.getByText('No organizations found').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
    ],

    timeout: 180_000,
};
