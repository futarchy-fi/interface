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

// ── Market-page probe values (Phase 7 pivot) ──
//
// Distinct from the /companies probes above because the /markets/[address]
// page has a "Market Not Found" gate that only renders if the URL address
// is in `MARKETS_CONFIG`. So MARKET_PROBE_ADDRESS uses a REAL configured
// address (GIP-145, the first key in MARKETS_CONFIG); everything dynamic
// on TOP of that — proposalentity rows, pool data, candles — gets mocked
// via the handlers below. The page-shell metadata (title, image) comes
// from the static MARKETS_CONFIG lookup, so scenarios that assert on
// dynamic content target the harness probe values, not the GIP-145 strings.
// **Case-sensitive**: must match the exact case in
// `src/config/markets.js`'s `MARKETS_CONFIG` keys, because
// Next.js dynamic routes (`pages/markets/[address].js`) are
// case-sensitive — a case mismatch returns 404 in dev.
export const MARKET_PROBE_ADDRESS       = '0x45e1064348fD8A407D6D1F59Fc64B05F633b28FC';
export const MARKET_PROBE_TITLE         = 'HARNESS-MARKET-PROBE-001';
export const MARKET_PROBE_DESCRIPTION   = 'Synthetic market proposal (harness)';
export const MARKET_PROBE_CURRENCY_TKN  = '0xcccccccccccccccccccccccccccccccccccccc01';
export const MARKET_PROBE_COMPANY_TKN   = '0xcccccccccccccccccccccccccccccccccccccc02';
export const MARKET_PROBE_YES_POOL      = '0xdddddddddddddddddddddddddddddddddddddd01';
export const MARKET_PROBE_NO_POOL       = '0xdddddddddddddddddddddddddddddddddddddd02';

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

/**
 * Stub `proposalentity` row in the market-page query shape used by
 * `src/adapters/registryAdapter.js`'s
 * `fetchProposalMetadataFromRegistry`. Distinct from the /companies
 * shapes (`fakeProposal`, `fakePoolBearingProposal`):
 *   - filtered by `proposalAddress` (not `id`), so the row's
 *     `proposalAddress` field must match the URL segment
 *   - includes `title`, `description`, `displayNameQuestion`,
 *     `displayNameEvent`, `owner`
 *   - nested `organization { id, name, aggregator { id } }` —
 *     the consumer client-side-filters by aggregator id, so the
 *     nested aggregator must equal `PROBE_AGG_ID` for the row to
 *     pass the filter
 *
 * Pass `metadataExtra` to embed `conditional_pools.{yes,no}.address`,
 * `chain`, `spotPrice`, etc. — the consumer's various
 * `extract*FromMetadata` helpers parse this object.
 */
export function fakeMarketProposalEntity(opts = {}) {
    const {
        proposalAddress = MARKET_PROBE_ADDRESS,
        title           = MARKET_PROBE_TITLE,
        description     = MARKET_PROBE_DESCRIPTION,
        owner           = '0x0000000000000000000000000000000000000000',
        aggregatorId    = PROBE_AGG_ID,
        organizationId  = PROBE_ORG_ID,
        organizationName = PROBE_ORG_NAME,
        metadataExtra   = {},
    } = opts;

    return {
        id:                  `proposal-${proposalAddress.slice(2, 10)}`,
        proposalAddress,
        metadata: JSON.stringify({
            chain: '100',
            conditional_pools: {
                yes: { address: MARKET_PROBE_YES_POOL },
                no:  { address: MARKET_PROBE_NO_POOL  },
            },
            ...metadataExtra,
        }),
        title,
        description,
        displayNameEvent:    title,
        displayNameQuestion: title,
        owner,
        organization: {
            id:         organizationId,
            name:       organizationName,
            aggregator: { id: aggregatorId },
        },
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

/**
 * Build a route handler for `CANDLES_GRAPHQL_URL` that knows the FOUR
 * distinct query shapes the market page emits via `usePoolData` /
 * `useYesNoPoolData`:
 *
 *   1. `{ proposal(id: "0x...") { id, currencyToken, companyToken } +
 *        whitelistedtokens(where: { proposal: "0x..." }) { ... } }`
 *      — initial discovery query that tells the hook which
 *      currency/company tokens this proposal uses.
 *
 *   2. `{ pools: pools(where: { id: "0x..." }) { id, liquidity,
 *        volumeToken0, volumeToken1, token0, token1, tick, proposal } }`
 *      — per-pool detail query (singular `id`, NOT `id_in`).
 *
 *   3. `{ candles(where: { pool: "0x..." }, orderBy: time,
 *        orderDirection: desc, first: 1) { close } }` — latest
 *      candle for spot price.
 *
 *   4. `{ whitelistedtokens(where: { proposal: "0x..." }) { ... } }`
 *      — token-list-only refresh.
 *
 * The /companies-side `makeCandlesMockHandler` only handles a 5th
 * shape (`pools(where: { id_in: [...] })`); the two are non-overlapping
 * so a market-page scenario uses THIS handler instead.
 *
 * Defaults render a complete + internally consistent happy path —
 * pools have plausible liquidity/volume, candles return spot=0.5,
 * tokens have YES+NO+sDAI roles. Per-key overrides via opts let
 * scenarios degrade specific surfaces.
 */
export function makeMarketCandlesMockHandler(opts = {}) {
    const {
        proposalAddress = MARKET_PROBE_ADDRESS,
        currencyToken   = MARKET_PROBE_CURRENCY_TKN,
        companyToken    = MARKET_PROBE_COMPANY_TKN,
        yesPool         = MARKET_PROBE_YES_POOL,
        noPool          = MARKET_PROBE_NO_POOL,
        yesPrice        = 0.5,
        noPrice         = 0.5,
        onCall,
    } = opts;

    const proposalLower = proposalAddress.toLowerCase();
    const tokens = [
        { address: currencyToken, symbol: 'sDAI', decimals: 18, role: 'CURRENCY' },
        { address: yesPool,       symbol: 'YES',  decimals: 18, role: 'YES'      },
        { address: noPool,        symbol: 'NO',   decimals: 18, role: 'NO'       },
    ];

    const fakePool = (id, role) => ({
        id,
        liquidity:    '1000000000000000000000',
        volumeToken0: '1000000000000000000',
        volumeToken1: '1000000000000000000',
        token0:       currencyToken,
        token1:       role === 'YES' ? yesPool : noPool,
        tick:         '0',
        proposal:     proposalLower,
    });

    return async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        const q = body.query || '';
        onCall?.(q);

        let data;
        if (q.includes('proposal(id:') && q.includes('whitelistedtokens')) {
            // Discovery query (#1): proposal + tokens in one request.
            data = {
                proposal: { id: proposalLower, currencyToken, companyToken },
                whitelistedtokens: tokens,
            };
        } else if (q.includes('candles(where:')) {
            // Latest-candle query (#3) — extract the pool id and
            // return that pool's price as the close.
            const poolMatch = q.match(/pool:\s*"(0x[a-fA-F0-9]{40})"/);
            const poolId = poolMatch ? poolMatch[1].toLowerCase() : null;
            const close = poolId === yesPool ? yesPrice
                        : poolId === noPool  ? noPrice
                        : null;
            data = { candles: close == null ? [] : [{ close: String(close) }] };
        } else if (q.includes('pools(where:') && q.includes('id:') && !q.includes('id_in:')) {
            // Per-pool detail query (#2) — singular id form.
            const idMatch = q.match(/id:\s*"(0x[a-fA-F0-9]{40})"/);
            const poolId = idMatch ? idMatch[1].toLowerCase() : null;
            const pool = poolId === yesPool ? fakePool(yesPool, 'YES')
                       : poolId === noPool  ? fakePool(noPool,  'NO')
                       : null;
            data = { pool: pool ? [pool] : [] };
        } else if (q.includes('whitelistedtokens')) {
            // Token-list refresh (#4).
            data = { whitelistedtokens: tokens };
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
