/**
 * api-mocks.mjs — shared Playwright route-handler factories for the
 * futarchy app's API surface.
 *
 * Extracted from `flows/dom-api-invariant.spec.mjs` (Phase 5 slice 4)
 * so Phase 6 scenarios can reuse the same helpers without depending
 * on a spec file. Both the spec and any `*.scenario.mjs` import from
 * here.
 *
 * Currently covers:
 *   - REGISTRY GraphQL (`https://api.futarchy.fi/registry/graphql`)
 *     with operation-name dispatch (aggregator / organizations /
 *     proposalentities)
 *   - CANDLES GraphQL (`https://api.futarchy.fi/candles/graphql`)
 *     with `id_in` parsing for `collectAndFetchPoolPrices`
 *
 * Each factory returns a Playwright route handler suitable for
 * `context.route(URL, handler)`.
 */

// ── Endpoint URLs (see src/config/subgraphEndpoints.js) ──
export const REGISTRY_GRAPHQL_URL = 'https://api.futarchy.fi/registry/graphql';
export const CANDLES_GRAPHQL_URL  = 'https://api.futarchy.fi/candles/graphql';

// ── Distinctive probe values — vanishingly unlikely to appear in
//    real data, so any DOM/network match is unambiguously ours. ──
export const PROBE_AGG_ID   = '0xc5eb43d53e2fe5fdde5faf400cc4167e5b5d4fc1'; // matches DEFAULT_AGGREGATOR
export const PROBE_AGG_NAME = 'HARNESS-PROBE-AGG-001';
export const PROBE_ORG_ID   = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
export const PROBE_ORG_NAME = 'HARNESS-PROBE-ORG-001';
export const PROBE_POOL_YES = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa01';
export const PROBE_POOL_NO  = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa02';
export const PROBE_PROPOSAL_ADDRESS = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

// ── Registry GraphQL ──

/**
 * Build a route handler for `REGISTRY_GRAPHQL_URL` that dispatches
 * on the GraphQL operation embedded in the POST body.
 *
 * @param {object}   opts
 * @param {object[]} [opts.proposals=[]]   payload for the
 *                                         proposalentities operation
 * @param {string|null} [opts.orgMetadata=null] string written to
 *                                         organizations[0].metadata
 *                                         (parsed via JSON.parse by
 *                                         the consumer hook; e.g.
 *                                         `JSON.stringify({chain: '10'})`
 *                                         flips ChainBadge → "Optimism")
 * @param {(query:string)=>void} [opts.onCall] observer for the
 *                                         operation, useful in
 *                                         failure-trace assertions
 */
export function makeGraphqlMockHandler({ proposals = [], orgMetadata = null, onCall } = {}) {
    return async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        const q = body.query || '';
        onCall?.(q);

        let data;
        if (q.includes('aggregator(id:')) {
            data = {
                aggregator: {
                    id:          PROBE_AGG_ID,
                    name:        PROBE_AGG_NAME,
                    description: 'Synthetic aggregator (harness)',
                    metadata:    null,
                },
            };
        } else if (q.includes('organizations(where:')) {
            data = {
                organizations: [{
                    id:           PROBE_ORG_ID,
                    name:         PROBE_ORG_NAME,
                    description:  'Probe org returned by mocked GraphQL',
                    metadata:     orgMetadata,
                    metadataURI:  null,
                    owner:        '0x0000000000000000000000000000000000000000',
                    editor:       '0x0000000000000000000000000000000000000000',
                }],
            };
        } else if (q.includes('proposalentities(where:')) {
            data = { proposalentities: proposals };
        } else {
            data = {};
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data }),
        });
    };
}

/**
 * Stub `proposalentity` row in the `useAggregatorCompanies.PROPOSALS_QUERY`
 * shape (id + metadata + organization{id}). The metadata field
 * is JSON-stringified so the consumer's `parseMetadata` round-trips
 * correctly. Pass `metadataExtra` to pin `archived: true`,
 * `visibility: 'hidden'`, etc.
 */
export function fakeProposal(idSuffix, metadataExtra = {}) {
    return {
        id: `0xprop${String(idSuffix).padStart(40, '0').slice(-40)}`,
        metadata: JSON.stringify(metadataExtra),
        organization: { id: PROBE_ORG_ID },
    };
}

/**
 * Stub `proposalentity` row in the
 * `useAggregatorProposals.PROPOSALS_QUERY` shape (the carousel-side
 * fetcher). Adds `displayNameEvent`, `displayNameQuestion`,
 * `description`, `proposalAddress`, `owner`. Embeds
 * `metadata.conditional_pools.{yes,no}.address` so the carousel's
 * `collectAndFetchPoolPrices` step picks up the right addresses to
 * query against the candles endpoint.
 */
export function fakePoolBearingProposal(opts = {}) {
    const {
        idSuffix        = '01',
        proposalAddress = PROBE_PROPOSAL_ADDRESS,
        poolYes         = PROBE_POOL_YES,
        poolNo          = PROBE_POOL_NO,
        title           = 'HARNESS-PROBE-EVENT-001',
        chain           = 100,
    } = opts;
    return {
        id:                  `0xprop${String(idSuffix).padStart(40, '0').slice(-40)}`,
        displayNameEvent:    title,
        displayNameQuestion: title,
        description:         'Harness probe event',
        metadata: JSON.stringify({
            chain: String(chain),
            conditional_pools: {
                yes: { address: poolYes },
                no:  { address: poolNo  },
            },
        }),
        metadataURI:    null,
        proposalAddress,
        owner:          '0x0000000000000000000000000000000000000000',
        organization:   { id: PROBE_ORG_ID },
    };
}

// ── Candles GraphQL ──

/**
 * Build a route handler for `CANDLES_GRAPHQL_URL`. Parses the bulk
 * fetcher's `pools(where: id_in: ["0x...", ...])` query, returns
 * only the pools the test seeded prices for, optionally records each
 * call's address list via `onCall`.
 *
 * @param {object} opts
 * @param {Record<string, number>} [opts.prices={}] lowercased pool
 *                                                  address → price
 * @param {(query:string)=>void} [opts.onCall]      observer
 */
export function makeCandlesMockHandler({ prices = {}, onCall } = {}) {
    return async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        const q = body.query || '';
        onCall?.(q);

        const idMatches = [...q.matchAll(/"(0x[a-fA-F0-9]{40})"/g)]
            .map((m) => m[1].toLowerCase());

        const pools = idMatches
            .filter((addr) => Object.prototype.hasOwnProperty.call(prices, addr))
            .map((addr) => ({
                id:          addr,
                name:        `harness-pool-${addr.slice(2, 10)}`,
                price:       prices[addr],
                type:        'CONDITIONAL',
                outcomeSide: 'YES',
            }));

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { pools } }),
        });
    };
}
