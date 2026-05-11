/**
 * 23-candles-corrupt-pool.scenario.mjs — chaos: per-row pool corruption.
 *
 * Closes out the chaos coverage matrix on /companies (12/12 cells:
 * {REGISTRY, CANDLES} × {hard-502, partial, empty-200, malformed,
 * per-row-corrupt, slow}). Mirrors #09 (registry-corrupt-org) on
 * the candles side: the candles GraphQL endpoint returns a
 * structurally-valid envelope with TWO pools — one well-formed,
 * one corrupt. The price card for the well-formed proposal must
 * render; the corrupt pool must NOT take down the carousel.
 *
 * Distinct from prior candles-side scenarios:
 *   - #03 hard 502: every pool fetch fails → all cards fall back
 *   - #04 partial 200: pools array missing some addresses entirely
 *     (filtered out by `Object.prototype.hasOwnProperty`-equivalent)
 *   - #08 malformed body: response body isn't JSON at all
 *   - #20 slow: response delayed but eventually full
 *   - #21 empty 200: pools array is `[]`
 *   - #23 (this slice): pools array contains a row with the right
 *     SHAPE for the GraphQL schema (id present so it parses) but
 *     missing the `price` field — the consumer's
 *     `attachPrefetchedPrices` reads `pool.price` and gets
 *     undefined; defensive code must not crash, must not assign
 *     `undefined` as a price to the WELL-FORMED pool, must not
 *     leak "undefined" to the DOM
 *
 * Real-world parallel: indexer migration left some pools with
 * `price = NaN` or `null`; a partial-resync left old pool rows
 * with stale fields; a hot-fix that fixed forward-going pools
 * but not historical ones.
 *
 * Bug-shapes guarded:
 *   - one corrupt pool CRASHES the entire carousel (no
 *     defensive guard around `pool.price` access; the
 *     `attachPrefetchedPrices` loop throws on the first
 *     undefined price)
 *   - corrupt pool's "price" leaks into the well-formed pool's
 *     card via cache-key collision (e.g., the corrupt pool's
 *     `id` matches the well-formed one and the wrong row
 *     wins the lookup)
 *   - well-formed pool's price gets WRONGLY ASSIGNED `undefined`
 *     because the loop continues past the corrupt row but
 *     leaves a sentinel in shared state
 *   - corrupt pool renders "undefined SDAI" or "NaN SDAI" in
 *     its card (formatter doesn't guard against the missing
 *     price; same shape as #04's "0.00 SDAI" fallback would
 *     be acceptable, raw "undefined" wouldn't)
 *   - both cards stuck on LoadingSpinner because the
 *     prefetched-price flow's promise rejects on the corrupt
 *     row and takes down the well-formed row's render too
 *
 * Order in the pools array matters: corrupt FIRST so the
 * consumer's per-pool loop hits it before the well-formed one.
 * If a buggy reducer crashes on the corrupt row, the well-formed
 * row never gets its turn — and the assertion fails. Same
 * defensive-test rationale as #09.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    makeGraphqlMockHandler,
    fakePoolBearingProposal,
    PROBE_POOL_YES,
    PROBE_POOL_NO,
} from '../fixtures/api-mocks.mjs';

// Distinct addresses for two proposals. Both are referenced in
// the registry response so both cards mount; the candles side
// returns one well-formed pool entry and one corrupt entry.
const WELLFORMED_PROPOSAL = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0021';
const WELLFORMED_TITLE    = 'HARNESS-PROBE-EVENT-WELLFORMED';

const CORRUPT_PROPOSAL = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0022';
const CORRUPT_POOL_YES = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0001';
const CORRUPT_POOL_NO  = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0002';
const CORRUPT_TITLE    = 'HARNESS-PROBE-EVENT-CORRUPT-POOL';

// Custom candles handler: same routing as `makeCandlesMockHandler`
// (id_in query, returns matching pools), but the response array
// MIXES a well-formed pool row with a corrupt one. Inline rather
// than promoted to api-mocks because no other scenario currently
// needs the "structurally-corrupt pool" construction.
function makeCorruptCandlesHandler() {
    return async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        const q = body.query || '';

        const idMatches = [...q.matchAll(/"(0x[a-fA-F0-9]{40})"/g)]
            .map((m) => m[1].toLowerCase());

        const pools = [];

        // Corrupt pool entries FIRST. Asked? present in the
        // request id_in list. Each corrupt entry has the GraphQL-
        // required `id` field (so the response parses) but is
        // MISSING the `price` field — defensive code must not
        // crash on the undefined.
        for (const addr of [CORRUPT_POOL_YES, CORRUPT_POOL_NO]) {
            if (idMatches.includes(addr.toLowerCase())) {
                pools.push({
                    id:          addr,
                    name:        `harness-pool-${addr.slice(2, 10)}`,
                    // price: MISSING — this is the corruption
                    type:        'CONDITIONAL',
                    outcomeSide: addr === CORRUPT_POOL_YES ? 'YES' : 'NO',
                });
            }
        }

        // Well-formed pool entries SECOND. Same shape the standard
        // helper produces.
        const wellformedPrices = {
            [PROBE_POOL_YES]: 0.42,
            [PROBE_POOL_NO]:  0.58,
        };
        for (const [addr, price] of Object.entries(wellformedPrices)) {
            if (idMatches.includes(addr)) {
                pools.push({
                    id:          addr,
                    name:        `harness-pool-${addr.slice(2, 10)}`,
                    price,
                    type:        'CONDITIONAL',
                    outcomeSide: 'YES',
                });
            }
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { pools } }),
        });
    };
}

export default {
    name:        '23-candles-corrupt-pool',
    description: 'CANDLES returns a structurally-valid envelope with TWO pools — one well-formed (price=0.42) + one corrupt (missing `price` field). Asserts the well-formed pool\'s card renders "0.4200 SDAI" — proves per-row defensive coding works on the candles side. Closes the {REGISTRY, CANDLES} × {hard-502, partial, empty-200, malformed, per-row-corrupt, slow} chaos coverage matrix on /companies (12/12 cells).',
    bugShape:    'corrupt pool crashes carousel via undefined price access / corrupt pool\'s price leaks into well-formed pool card / well-formed pool wrongly assigned undefined / corrupt pool renders raw "undefined SDAI" or "NaN SDAI" / both cards stuck on LoadingSpinner from shared-promise rejection',
    route:       '/companies',

    mocks: {
        // REGISTRY happy path: TWO proposals so both cards mount,
        // each tied to a different pool pair. Same shape as #04
        // — keeps the test focused on the candles-side per-row
        // corruption.
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [
                fakePoolBearingProposal({
                    idSuffix:        '21',
                    proposalAddress: WELLFORMED_PROPOSAL,
                    poolYes:         PROBE_POOL_YES,
                    poolNo:          PROBE_POOL_NO,
                    title:           WELLFORMED_TITLE,
                }),
                fakePoolBearingProposal({
                    idSuffix:        '22',
                    proposalAddress: CORRUPT_PROPOSAL,
                    poolYes:         CORRUPT_POOL_YES,
                    poolNo:          CORRUPT_POOL_NO,
                    title:           CORRUPT_TITLE,
                }),
            ],
        }),
        [CANDLES_GRAPHQL_URL]: makeCorruptCandlesHandler(),
    },

    assertions: [
        // Both cards mount — proves no card vanishes due to its
        // pool's missing optional sub-field.
        async (page) => {
            await expect(
                page.getByText(WELLFORMED_TITLE).first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        async (page) => {
            await expect(
                page.getByText(CORRUPT_TITLE).first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        // Well-formed pool's price renders — proves the corrupt
        // sibling didn't poison the prefetched-price flow for
        // the well-formed row.
        async (page) => {
            await expect(
                page.getByText('0.4200 SDAI').first(),
            ).toBeVisible({ timeout: 15_000 });
        },
    ],

    timeout: 60_000,
};
