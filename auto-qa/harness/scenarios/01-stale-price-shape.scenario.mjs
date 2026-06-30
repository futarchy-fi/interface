/**
 * 01-stale-price-shape.scenario.mjs — first captured bug-shape.
 *
 * Per ADR-002, scenarios are executable `.scenario.mjs` modules
 * exporting a `Scenario` object. The wrapper spec at
 * `flows/scenarios.spec.mjs` auto-discovers this file and emits one
 * Playwright `test()`.
 *
 * This scenario lifts slice 4c v3b's mocks + assertions into the
 * scenario format. The bug shape it guards against: PR #64-style
 * "frontend stale, API healthy" — where the prefetched-price short-
 * circuit silently breaks and the carousel falls back to its own
 * per-pool fetcher (which we don't mock here), making the card
 * render "0.00 SDAI" or a LoadingSpinner instead of the real price.
 *
 * Bug-shapes guarded:
 *   - prefetched-price short-circuit dropped or no-op'd
 *   - attachPrefetchedPrices regression (e.g. mutating wrong field)
 *   - useLatestPoolPrices preferring its own fetch over prefetched
 *   - formatter precision bug ("0.42" instead of "0.4200")
 *   - baseTokenSymbol fallback bug ("XDAI" instead of "SDAI")
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    PROBE_POOL_YES,
    PROBE_POOL_NO,
    makeGraphqlMockHandler,
    makeCandlesMockHandler,
    fakePoolBearingProposal,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '01-stale-price-shape',
    description: 'YES=0.42 from candles GraphQL flows through 6 layers of real React app code into the rendered DOM string "0.4200 SDAI".',
    bugShape:    'PR #64 stale-price-but-API-healthy',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [fakePoolBearingProposal({})],
        }),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({
            prices: {
                [PROBE_POOL_YES]: 0.42,
                [PROBE_POOL_NO]:  0.58,
            },
        }),
    },

    assertions: [
        // Pre-flight: confirm the carousel rendered our event at all
        // (proves the proposal got past visibility/resolved/etc.
        // filters and the carousel got far enough to mount the card).
        async (page) => {
            await expect(
                page.getByText('HARNESS-PROBE-EVENT-001').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        // Canonical assertion: formatter chain renders the mocked price.
        // YES=0.42 (<1) → high-precision branch → toFixed(4) = "0.4200"
        // baseTokenSymbol defaults to 'SDAI' since metadata.currencyTokens
        // is unset → final string: "0.4200 SDAI".
        async (page) => {
            await expect(
                page.getByText('0.4200 SDAI').first(),
            ).toBeVisible({ timeout: 15_000 });
        },
    ],

    timeout: 180_000,
};
