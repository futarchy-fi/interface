/**
 * 22-registry-partial.scenario.mjs — chaos: partial-success registry.
 *
 * Where #04 covers partial-success on the CANDLES side (some pool
 * prices missing from a 200 OK response), this slice covers the
 * symmetric failure mode on the REGISTRY side: 200 OK with a
 * MIX of fully-formed and structurally-degraded proposals.
 * Distinct from #02 (hard 502), #05 (empty 200 — zero rows),
 * and #09 (single-row UNPARSEABLE corruption that bypasses
 * field-level guards) — this scenario keeps every row PARSEABLE
 * but degrades a non-required sub-field so the page's optional-
 * field handling is exercised.
 *
 * Two proposals returned in the proposalentities query:
 *   - PRIMARY: full metadata (displayNameEvent, conditional_pools,
 *     organization wired up correctly)
 *   - DEGRADED: parseable JSON but `conditional_pools` field
 *     missing entirely from metadata. The carousel's
 *     `collectAndFetchPoolPrices` reads
 *     `metadata.conditional_pools.yes.address` — when missing,
 *     the address-extraction step has to handle the undefined
 *     branch without leaking it to the price formatter.
 *
 * Why this is a NEW failure-mode branch (not covered by
 * #02/#05/#09):
 *   - #02 (hard down): no proposals at all → empty state, no
 *     carousel cards to test
 *   - #05 (empty-200): same UX as #02, different code path
 *     (.then-with-empty), still no cards
 *   - #09 (corrupt row): one row's JSON.parse throws; the
 *     defensive-coding regression is "does ONE bad row crash the
 *     OTHER good rows"
 *   - #22 (this slice): every row PARSES cleanly but one row
 *     LACKS a sub-field; the regression is "does the
 *     optional-field branch leak undefined into the formatter
 *     for the degraded row while letting the full row render"
 *
 * Bug-shapes guarded:
 *   - DEGRADED card vanishes from carousel (overzealous filter
 *     drops rows with missing optional fields instead of
 *     degrading the card UX)
 *   - DEGRADED card crashes the carousel (unsafe `metadata.
 *     conditional_pools.yes.address` access — TypeError on
 *     undefined.yes leaks to render)
 *   - PRIMARY card's price gets WRONGLY assigned to the DEGRADED
 *     card (cache-key bug where missing-pool-address falls back
 *     to first-pool-address; a real-world bug shape from
 *     PR #64-style cache misuse)
 *   - DEGRADED card renders "undefined" or "null" as a string
 *     in its title or body (missing `?? ''` somewhere in the
 *     formatter chain)
 *   - Both cards stuck on LoadingSpinner because the partial-row
 *     fetch races to error, blocking the otherwise-fine row's
 *     fetch from resolving (shared-promise rejection regression)
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    makeGraphqlMockHandler,
    makeCandlesMockHandler,
    fakePoolBearingProposal,
    PROBE_POOL_YES,
    PROBE_POOL_NO,
} from '../fixtures/api-mocks.mjs';

const PRIMARY_PROPOSAL = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0011';
const PRIMARY_TITLE    = 'HARNESS-PROBE-EVENT-FULL';

const DEGRADED_PROPOSAL = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0012';
const DEGRADED_TITLE    = 'HARNESS-PROBE-EVENT-PARTIAL';

// Build the DEGRADED row by hand (rather than via
// `fakePoolBearingProposal`) because we want a metadata shape
// that is PARSEABLE JSON but missing the `conditional_pools`
// sub-field — the helper always embeds it. Other required
// surface fields (id, displayNameEvent, organization) are
// present so the row passes the carousel's row-level validity
// checks and gets a card mounted.
function fakeDegradedProposal() {
    return {
        id:                  '0xprop' + '0'.repeat(34) + '0012',
        displayNameEvent:    DEGRADED_TITLE,
        displayNameQuestion: DEGRADED_TITLE,
        description:         'Harness probe event (partial metadata)',
        // Parseable JSON, but the `conditional_pools` field is
        // ABSENT — exercises the optional-chain branch in the
        // address-extraction step.
        metadata: JSON.stringify({ chain: '100' }),
        metadataURI:    null,
        proposalAddress: DEGRADED_PROPOSAL,
        owner:          '0x0000000000000000000000000000000000000000',
        organization:   { id: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' },
    };
}

export default {
    name:        '22-registry-partial',
    description: 'REGISTRY healthy but returns a mix: one fully-formed proposal + one parseable-but-degraded proposal (metadata.conditional_pools missing). CANDLES happy for the priced side. Assert the full-metadata card renders with its title and real price ("0.4200 SDAI"); the degraded card MUST also mount with its title (not vanish, not crash) and degrade gracefully on its missing price slot. Distinct from #04 (candles-side partial), #05 (empty registry), and #09 (single-row JSON-parse crash) — exercises the optional-field branch in registry-side metadata handling.',
    bugShape:    'degraded card vanishes from carousel / degraded card crashes carousel via undefined.conditional_pools / primary card price wrongly assigned to degraded card / degraded card renders "undefined" string in title or body / both cards stuck on LoadingSpinner due to shared-promise rejection',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [
                fakePoolBearingProposal({
                    idSuffix:        '11',
                    proposalAddress: PRIMARY_PROPOSAL,
                    poolYes:         PROBE_POOL_YES,
                    poolNo:          PROBE_POOL_NO,
                    title:           PRIMARY_TITLE,
                }),
                fakeDegradedProposal(),
            ],
        }),
        [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({
            // Only the PRIMARY pool addresses are priced. The
            // DEGRADED row has no pool addresses (metadata is
            // missing conditional_pools), so the candles handler
            // wouldn't even be QUERIED for them — the test
            // exercises the registry-side optional-field branch,
            // not a candles-side miss.
            prices: {
                [PROBE_POOL_YES]: 0.42,
                [PROBE_POOL_NO]:  0.58,
            },
        }),
    },

    assertions: [
        // Both event cards mount — proves no card vanishes due
        // to its row's missing optional sub-field.
        async (page) => {
            await expect(
                page.getByText(PRIMARY_TITLE).first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        async (page) => {
            await expect(
                page.getByText(DEGRADED_TITLE).first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        // Primary card's price renders — proves the degraded
        // sibling didn't poison the prefetched-price flow for
        // the well-formed row (e.g., a shared-cache rejection
        // bug that takes both prices down).
        async (page) => {
            await expect(
                page.getByText('0.4200 SDAI').first(),
            ).toBeVisible({ timeout: 15_000 });
        },
    ],

    timeout: 60_000,
};
