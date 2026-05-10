/**
 * 02-registry-down.scenario.mjs — Phase 7 slice 1: first chaos scenario.
 *
 * Phase 7's stated goal is "production-shape resilience signal" via
 * a chaos library. This is the first concrete chaos primitive: the
 * registry GraphQL endpoint returns 502 Bad Gateway instead of a
 * useful response. Validates the futarchy app's graceful-degradation
 * behavior — when the API is down, the user should see an empty
 * state, NOT a hard crash, hung spinner, or "Application error".
 *
 * Bug-shapes guarded:
 *   - hard crash on REGISTRY 5xx (page becomes unusable)
 *   - hung loading spinner with no terminal state (UX worse than empty)
 *   - error envelope leaked to UI ("Bad Gateway: …" raw text)
 *   - error swallowed in a way that fakes success (silent broken state)
 *
 * Note on Scenario format reuse: chaos scenarios use the SAME
 * `mocks` field as happy-path scenarios — a Playwright route handler
 * can return any status code. No format change needed; just a
 * different handler. This keeps Phase 7's chaos library composable
 * with Phase 6's scenario format.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '02-registry-down',
    description: 'Registry GraphQL returns 502; assert /companies degrades to the "No organizations found" empty state instead of crashing or hanging.',
    bugShape:    'hard-crash / hung-spinner / leaked-error on registry 5xx',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: async (route) => {
            // Both useAggregatorCompanies AND useAggregatorProposals
            // hit this URL with their three-query pipelines. With 502
            // on every request, both hooks' .catch branches fire:
            //   useAggregatorCompanies → setError(e.message), companies=[]
            //   fetchEventHighlightData → returns []
            // The carousel renders no cards; the OrganizationsTable
            // takes the `filteredOrgs.length === 0` branch and shows
            // "No organizations found" (per OrganizationsTable.jsx).
            await route.fulfill({
                status: 502,
                contentType: 'application/json',
                body: JSON.stringify({
                    errors: [{ message: 'Bad Gateway (chaos: registry-down)' }],
                }),
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
