/**
 * 34-market-page-registry-corrupt-row.scenario.mjs — chaos:
 * per-row corruption on /markets/[address] from the REGISTRY
 * side.
 *
 * Where #09 covers per-row corruption on /companies (multiple
 * orgs returned, one with missing required `name` field), this
 * slice covers the symmetric failure on the market page where
 * the lookup typically returns ONE row matched by address. The
 * row IS present and the GraphQL envelope IS structurally
 * valid, but the row's `metadata` field — supposed to be a
 * JSON-stringified payload — contains UNPARSEABLE JSON
 * (`'{not valid json'`). Any code path that calls
 * `JSON.parse(metadata)` will throw SyntaxError.
 *
 * Distinct from #32 (registry-partial) which has parseable
 * metadata with optional sub-fields missing — #34 has metadata
 * that fails parse OUTRIGHT. The two failure modes hit
 * different defensive-coding patterns:
 *   - #32 partial: tests `?.` chains and `?? defaults` for
 *     missing nested fields
 *   - #34 corrupt: tests `try/catch` around `JSON.parse`
 *
 * Distinct from #28 (registry malformed-body) which has the
 * ENTIRE response body as non-JSON — #34 has a structurally-
 * valid GraphQL envelope where ONE FIELD WITHIN A ROW is the
 * unparseable JSON string. Different layers of the parsing
 * stack.
 *
 * Real-world parallel: a hot-fix migration that left some
 * proposal rows with `metadata = '{partial-write...'` because
 * the indexer crashed mid-write. The DB returned the row
 * cleanly, GraphQL serialized it without complaint (it's a
 * valid string), but consumers that need to interpret the
 * string as JSON crash on parse.
 *
 * Bug-shapes guarded:
 *   - Page CRASHES on `JSON.parse(metadata)` SyntaxError
 *     (the parse call lacks a try/catch wrapper)
 *   - Page renders raw "{not valid json" string in the
 *     proposal title or chart panel placeholder (someone
 *     decided to fall back to the unparsed string when
 *     parse fails — leaks corrupt data to UI)
 *   - "Market Not Found" FALSE-POSITIVE (the metadata-
 *     parse error trips the same gate that's intended for
 *     missing-from-MARKETS_CONFIG; same wrong-code-path
 *     collapse class as #24/#26/#28)
 *   - Chart panel goes BLANK because the metadata-parse
 *     error propagates up the chart-config-derivation
 *     chain (chart needs to read pool addresses from the
 *     parsed metadata)
 *   - Page hangs in loading state forever (parse error
 *     thrown synchronously inside an async hook bypasses
 *     the loading=false setter)
 *
 * Why no `useAnvilRpcProxy: true`: same rationale as prior
 * market-page chaos slices.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    MARKET_PROBE_ADDRESS,
    PROBE_ORG_ID,
    PROBE_ORG_NAME,
    PROBE_AGG_ID,
    MARKET_PROBE_TITLE,
    MARKET_PROBE_DESCRIPTION,
    makeMarketCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';

// Hand-construct a proposal row with UNPARSEABLE metadata JSON.
// All other fields are well-formed so the GraphQL envelope and
// row shape both pass validation; the corruption is concealed
// inside the metadata string and only surfaces when a consumer
// calls `JSON.parse(metadata)`.
function fakeCorruptMetadataMarketProposalEntity() {
    return {
        id:                  `proposal-${MARKET_PROBE_ADDRESS.slice(2, 10)}`,
        proposalAddress:     MARKET_PROBE_ADDRESS,
        // INTENTIONALLY UNPARSEABLE — this string starts with
        // `{` so it looks like JSON but the next char isn't a
        // valid key. Any `JSON.parse(metadata)` call throws
        // SyntaxError. Real-world parallel: an indexer hot-fix
        // that wrote partial JSON before the process crashed.
        metadata:            '{not valid json',
        title:               MARKET_PROBE_TITLE,
        description:         MARKET_PROBE_DESCRIPTION,
        displayNameEvent:    MARKET_PROBE_TITLE,
        displayNameQuestion: MARKET_PROBE_TITLE,
        owner:               '0x0000000000000000000000000000000000000000',
        organization: {
            id:         PROBE_ORG_ID,
            name:       PROBE_ORG_NAME,
            aggregator: { id: PROBE_AGG_ID },
        },
    };
}

export default {
    name:        '34-market-page-registry-corrupt-row',
    description: 'REGISTRY returns a structurally-valid envelope with the matching row PRESENT but its `metadata` field is UNPARSEABLE JSON ("{not valid json"). All other row fields well-formed. CANDLES happy. Asserts the page-shell still mounts (Trading Pair + wallet shorthand visible) — proves JSON.parse defensive wrapping works on the proposal metadata path. Distinct from #32 (parseable but partially degraded fields) and #28 (entire response body non-JSON).',
    bugShape:    'page crashes on JSON.parse(metadata) SyntaxError / page renders raw "{not valid json" in title or chart placeholder / "Market Not Found" false-positive on metadata-parse error / chart panel blank from metadata-parse error propagating up chart-config-derivation chain / page hangs in loading state forever (parse error thrown synchronously bypasses loading=false setter)',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        // REGISTRY: row present + structurally valid envelope
        // + corrupt metadata. Inline mock dispatches on query
        // shape — same pattern as #26/#32.
        [REGISTRY_GRAPHQL_URL]: async (route) => {
            const body = JSON.parse(route.request().postData() || '{}');
            const q = body.query || '';
            let data;
            if (/proposalentities\s*\(/.test(q)) {
                data = { proposalentities: [fakeCorruptMetadataMarketProposalEntity()] };
            } else if (q.includes('aggregator(id:')) {
                data = {
                    aggregator: {
                        id:          PROBE_AGG_ID,
                        name:        'Synthetic aggregator (harness — corrupt-row scenario)',
                        description: 'Synthetic aggregator (harness)',
                        metadata:    null,
                    },
                };
            } else if (q.includes('organizations(where:')) {
                data = { organizations: [] };
            } else {
                data = {};
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data }),
            });
        },
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    assertions: [
        async (page) => {
            await expect(
                page.getByText('Trading Pair').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        async (page) => {
            await expect(
                page.getByText('0xf3…2266').first(),
            ).toBeVisible({ timeout: 15_000 });
        },
    ],

    timeout: 60_000,
};
