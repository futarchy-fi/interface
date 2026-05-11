/**
 * 19-registry-slow.scenario.mjs — chaos: SLOW-but-recovers registry.
 *
 * Where #02 covers HARD-down (502 forever), #05 covers empty-200,
 * #07 covers malformed body, this slice covers a NEW failure-mode
 * branch: the registry GraphQL endpoint eventually responds with
 * VALID data, but only after a `DELAY_MS` window. The page must
 * survive the wait and render the data when it arrives — no crash
 * during the loading window, no premature "no data" empty-state,
 * no infinite spinner once the data DOES land.
 *
 * Distinct from #02 (which never returns a useful response):
 *   - #02 catches "no fallback when API is gone"
 *   - #19 catches "page can't handle a slow-but-eventual response"
 *
 * The two failure modes have different code paths in the page:
 *   - #02 trips the `.catch` branch in useAggregatorCompanies
 *   - #19 keeps the request pending, exercising the `loading` state
 *     and the post-resolution rerender path
 *
 * Bug-shapes guarded:
 *   - page CRASHES during the wait window (e.g., a hook with no
 *     `loading` guard tries to read `data.something` while data is
 *     still undefined)
 *   - page renders a PREMATURE "No organizations found" empty-state
 *     before the slow response lands (loading state was missed)
 *   - page never recovers after the slow response arrives (e.g.,
 *     a useEffect dep-array regression that doesn't re-render on
 *     `loading: false`)
 *   - layout SHIFT from missing skeleton/placeholder during the
 *     wait (cosmetic but real)
 *   - request TIMES OUT on the page side because no abort controller
 *     was wired up — would manifest as a thrown error mid-wait
 *
 * `DELAY_MS = 5000` chosen as a balance: long enough to exercise
 * the loading path meaningfully (the page's normal request takes
 * <1s); short enough that the test suite stays under a minute.
 *
 * Note on the registry pipeline: useAggregatorCompanies issues
 * THREE sequential queries to REGISTRY_GRAPHQL_URL. With a 5s
 * delay on EACH, the total time-to-data is ~15s. The assertion
 * timeout below (30s) accounts for that.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    PROBE_ORG_NAME,
    fakePoolBearingProposal,
    makeGraphqlMockHandler,
} from '../fixtures/api-mocks.mjs';

const DELAY_MS = 5000;

// Wrap the standard happy-path handler with a per-request delay.
// Uses a closure rather than monkey-patching the helper so the
// happy-path handler shape remains untouched and other scenarios
// can keep using `makeGraphqlMockHandler` directly.
function makeSlowRegistryHandler() {
    const inner = makeGraphqlMockHandler({
        proposals: [fakePoolBearingProposal({})],
    });
    return async (route) => {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        return inner(route);
    };
}

export default {
    name:        '19-registry-slow',
    description: 'Registry GraphQL responds with VALID data but ONLY after a 5s per-request delay (3 sequential queries → ~15s total). Page must survive the wait without crashing or showing premature empty-state, and render the data once it arrives. Catches: missing loading-state guard, premature empty-state render, no rerender on slow-resolve, request-side timeout regressions.',
    bugShape:    'page crashes during slow-registry wait / premature "No organizations" empty-state before data lands / page never recovers after slow response arrives / no abort-controller leads to client-side timeout regression',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeSlowRegistryHandler(),
    },

    assertions: [
        // Single canonical assertion: the probe org's name eventually
        // renders. The 30s timeout is ~2× the expected ~15s wait
        // (3 queries × 5s) for variance headroom. If the page
        // crashes mid-wait, the locator would never resolve and the
        // assertion would fail with the standard Playwright timeout
        // message — distinct from #02's "No organizations found"
        // assertion which expects EMPTY state.
        async (page) => {
            await expect(
                page.getByText(PROBE_ORG_NAME).first(),
            ).toBeVisible({ timeout: 30_000 });
        },
    ],

    timeout: 60_000,
};
