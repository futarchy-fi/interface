/**
 * 04-candles-partial.scenario.mjs — Phase 7 slice 2: partial-success chaos.
 *
 * Where 03-candles-down takes the entire CANDLES endpoint out, this
 * scenario keeps the endpoint UP but returns prices for only a
 * subset of the requested pools. Two events render side-by-side in
 * the carousel; one gets a real price, the other gets the
 * `prices.yes !== null ? … : '0.00 SDAI'` fallback.
 *
 * This is the "the API answered, but my data wasn't in the answer"
 * shape — distinct from 03's "the API didn't answer at all".
 *
 * Bug-shapes guarded:
 *   - missing price for ONE pool corrupts ALL prices (a shared cache
 *     or last-write-wins bug applies the wrong price to multiple cards)
 *   - card disappears when its price is missing (overzealous filter
 *     hides events with null prices instead of rendering "0.00")
 *   - formatter crashes on null prices for the unpriced card while
 *     the priced card renders fine (defensive-coding regression)
 *   - prices swap between cards (cache-key / address-comparison bug
 *     in `attachPrefetchedPrices`)
 *
 * Slice naming note: this is the "partial branch" of Phase 7 slice 2.
 * Slice 2's other listed sub-slices (WALLET RPC failure, mid-flight
 * failure) are still TODO; the wallet stub handles most methods
 * locally so wallet-RPC chaos has a smaller blast radius than
 * REGISTRY/CANDLES chaos, and mid-flight failure on /companies
 * indistinguishable-DOM from full failure (per the trace through
 * useAggregatorCompanies + CompaniesPage.jsx, which drops the hook's
 * `error` field; both fail-modes land at "No organizations found").
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    makeGraphqlMockHandler,
    makeCandlesMockHandler,
    fakePoolBearingProposal,
} from '../fixtures/api-mocks.mjs';

// Distinct addresses for the two events. The "priced" pair is in
// the candles mock; the "unpriced" pair is omitted.
const PRICED_PROPOSAL = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0001';
const PRICED_POOL_YES = '0xcccccccccccccccccccccccccccccccccccc0001';
const PRICED_POOL_NO  = '0xcccccccccccccccccccccccccccccccccccc0002';

const UNPRICED_PROPOSAL = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0002';
const UNPRICED_POOL_YES = '0xdddddddddddddddddddddddddddddddddddd0001';
const UNPRICED_POOL_NO  = '0xdddddddddddddddddddddddddddddddddddd0002';

// Distinctive titles so each card is uniquely findable in the DOM.
const PRICED_TITLE   = 'HARNESS-PROBE-EVENT-PRICED';
const UNPRICED_TITLE = 'HARNESS-PROBE-EVENT-UNPRICED';

export default {
    name:        '04-candles-partial',
    description: 'CANDLES is up but only returns prices for one of two requested pool sets; assert the priced card renders "0.4200 SDAI" while the unpriced card falls back to "0.00 SDAI" (NOT a hung spinner, NOT a vanished card, NOT swapped prices).',
    bugShape:    'partial-price-data corrupts unrelated cards / vanishes unpriced card / hangs spinner',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [
                fakePoolBearingProposal({
                    idSuffix:        '01',
                    proposalAddress: PRICED_PROPOSAL,
                    poolYes:         PRICED_POOL_YES,
                    poolNo:          PRICED_POOL_NO,
                    title:           PRICED_TITLE,
                }),
                fakePoolBearingProposal({
                    idSuffix:        '02',
                    proposalAddress: UNPRICED_PROPOSAL,
                    poolYes:         UNPRICED_POOL_YES,
                    poolNo:          UNPRICED_POOL_NO,
                    title:           UNPRICED_TITLE,
                }),
            ],
        }),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({
            // Only the PRICED pools are in the map. The UNPRICED
            // pools are omitted; the mock handler filters by
            // `Object.prototype.hasOwnProperty.call(prices, addr)`
            // so they're simply absent from the response — same
            // shape as a real candles endpoint that hasn't indexed
            // those pools yet.
            prices: {
                [PRICED_POOL_YES]: 0.42,
                [PRICED_POOL_NO]:  0.58,
            },
        }),
    },

    assertions: [
        // Both event cards render — proves no card vanishes due to
        // missing price data.
        async (page) => {
            await expect(
                page.getByText(PRICED_TITLE).first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        async (page) => {
            await expect(
                page.getByText(UNPRICED_TITLE).first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        // Priced card's YES price renders the formatter output —
        // proves the prefetched-price short-circuit still works
        // when other pools in the same batch are missing.
        async (page) => {
            await expect(
                page.getByText('0.4200 SDAI').first(),
            ).toBeVisible({ timeout: 15_000 });
        },
        // Unpriced card's YES price falls back to "0.00 SDAI" —
        // proves the formatter handles null prices without crashing
        // and without leaking the priced card's value.
        async (page) => {
            await expect(
                page.getByText('0.00 SDAI').first(),
            ).toBeVisible({ timeout: 15_000 });
        },
    ],

    timeout: 180_000,
};
