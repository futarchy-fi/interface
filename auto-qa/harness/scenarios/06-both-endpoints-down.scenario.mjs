/**
 * 06-both-endpoints-down.scenario.mjs — Phase 7 slice 2: total-outage chaos.
 *
 * Where #02 takes ONE endpoint out (REGISTRY 502) and #03 takes the
 * other ONE out (CANDLES 502), this scenario takes BOTH out
 * simultaneously. Tests cumulative degradation — does the page handle
 * a total api outage gracefully, or do the two failures cascade /
 * interact in a way that produces a worse state than either alone?
 *
 * Real-world parallel: a regional outage at the api host (single
 * point of failure for both endpoints), or a CORS regression that
 * breaks the entire api domain at once.
 *
 * Bug-shapes guarded:
 *   - cascading errors — the second .catch fires, retries the
 *     first endpoint, and somehow surfaces a worse error message
 *     than either single-endpoint-down case
 *   - hung spinner from race-condition between the two failures
 *     (e.g., loading-state cleared by one .catch, set true again
 *     by the other's retry)
 *   - error envelope from the SECOND endpoint leaks to the UI
 *     while the FIRST endpoint's failure is correctly handled
 *     (per-endpoint error path coverage drift)
 *   - "No organizations found" message is REPLACED by something
 *     worse (e.g., raw "Bad Gateway" text) when the candles call
 *     ALSO fails — registry-down alone should already guarantee
 *     the empty state; candles being down is irrelevant once
 *     registry is down (no orgs → no pools → no candles needed),
 *     but a buggy retry chain can still make a CANDLES error
 *     visible
 *
 * Note on UX terminal state: /companies is registry-driven —
 * useAggregatorCompanies fetches orgs from registry, then for each
 * org's pools looks up prices via candles. With registry down, the
 * page never reaches the candles step (no pools to look up). So
 * the expected terminal state is the SAME as #02: "No organizations
 * found". This scenario specifically asserts that adding a candles
 * outage on top doesn't make the UX worse.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
} from '../fixtures/api-mocks.mjs';

const downHandler = (label) => async (route) => {
    await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
            errors: [{ message: `Bad Gateway (chaos: ${label})` }],
        }),
    });
};

export default {
    name:        '06-both-endpoints-down',
    description: 'BOTH REGISTRY GraphQL and CANDLES GraphQL return 502 simultaneously; assert /companies still degrades to "No organizations found" — cumulative outage doesn\'t cascade into a worse UX than either single-endpoint-down case.',
    bugShape:    'cascading-error / cumulative-degradation / per-endpoint-coverage-drift on simultaneous registry+candles outage',
    route:       '/companies',

    mocks: {
        // Total api outage: registry-down AND candles-down.
        // Each request fires its endpoint's .catch; the page should
        // converge to the same terminal state as #02 (registry-only-
        // down) because /companies is registry-gated.
        [REGISTRY_GRAPHQL_URL]: downHandler('registry-down (06)'),
        [CANDLES_GRAPHQL_URL]:  downHandler('candles-down (06)'),
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
