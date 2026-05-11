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
        } else if (/proposalentities\s*\(/.test(q)) {
            // Matches both single-line ("proposalentities(where:") AND
            // multi-line ("proposalentities(\n      where:") forms.
            // The /companies hooks (useAggregatorCompanies,
            // useAggregatorProposals) use single-line; the market-page
            // adapter (registryAdapter.fetchProposalMetadataFromRegistry)
            // uses multi-line. Without the regex, the multi-line form
            // falls through to `data = {}` and the consumer sees
            // "No ProposalMetadata found", flips to the Supabase
            // fallback, and the per-market config never resolves.
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
        } else if (q.includes('swaps(where:')) {
            // Trade-history query (#6, added step 5a): subgraphTradesClient's
            // `fetchSwapsFromSubgraph`. Returns recent swaps for one or
            // more pools, ordered by timestamp desc. Default fixture
            // returns an empty list — fresh probe market with no trades
            // yet — which is what the trade-history table will render
            // as "No trades to display" or similar (the Loading…
            // spinner WILL clear since the response is well-formed).
            // Scenarios that need specific swap rows can override the
            // handler.
            data = { swaps: [] };
        } else if (q.includes('pools(where:') && q.includes('id_in:')) {
            // Pool-batch query (#7, added step 5a): the /companies-side
            // bulk fetcher pattern AND the subgraphTradesClient's pool-
            // ref lookup. Lighter shape than the per-pool detail (no
            // tick/liquidity fields needed). Returns the YES + NO probe
            // pools when their addresses are referenced.
            const idMatches = [...q.matchAll(/"(0x[a-fA-F0-9]{40})"/g)]
                .map((m) => m[1].toLowerCase());
            const pools = idMatches
                .filter((addr) => addr === yesPool || addr === noPool)
                .map((addr) => ({
                    id:          addr,
                    name:        `harness-pool-${addr.slice(2, 10)}`,
                    type:        'CONDITIONAL',
                    outcomeSide: addr === yesPool ? 'YES' : 'NO',
                }));
            data = { pools };
        } else if (q.includes('pools(where:') && q.includes('proposal:')) {
            // fetchPoolsForProposal query (#8, added step 5a): asks for
            // CONDITIONAL pools belonging to a specific proposal. Returns
            // the YES + NO probe pools when the proposal matches; empty
            // otherwise (so an unrelated proposalAddress doesn't get our
            // probes accidentally).
            const propMatch = q.match(/proposal:\s*"(0x[a-fA-F0-9]{40})"/);
            const queryProposal = propMatch ? propMatch[1].toLowerCase() : null;
            const pools = queryProposal === proposalLower ? [
                { id: yesPool, name: `harness-pool-${yesPool.slice(2, 10)}`,
                  type: 'CONDITIONAL', outcomeSide: 'YES' },
                { id: noPool,  name: `harness-pool-${noPool.slice(2, 10)}`,
                  type: 'CONDITIONAL', outcomeSide: 'NO' },
            ] : [];
            data = { pools };
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

// ── Public Gnosis RPC proxy → local anvil fork ──

/**
 * Public Gnosis RPC URLs that the futarchy app may probe.
 *
 * Two main code paths produce traffic to these URLs:
 *
 *   1. `src/utils/getBestRpc.js::getBestRpcProvider(100)` — read path
 *      used by `unifiedBalanceFetcher` for ERC20 / ERC1155 balanceOf
 *      calls. Probes the first four URLs below in parallel, picks the
 *      fastest, and constructs an `ethers.JsonRpcProvider` against it.
 *      Without proxying, balance reads land on real Gnosis mainnet —
 *      which has none of the wallet's fork-funded YES / NO / sDAI —
 *      and the panel renders 0 instead of the funded amount.
 *
 *   2. `src/providers/providers.jsx` (wagmi `http()` config) — the
 *      RainbowKit / wagmi fallback chain. The same first four URLs
 *      plus `gnosis.drpc.org` and `gnosis-mainnet.public.blastapi.io`
 *      go through it.
 *
 * Proxying every URL in the union unifies BOTH paths against the local
 * anvil fork so the app can't accidentally bypass the fork by picking
 * an un-mocked RPC.
 */
export const PUBLIC_GNOSIS_RPC_URLS = [
    'https://rpc.gnosischain.com',
    'https://gnosis-rpc.publicnode.com',
    'https://1rpc.io/gnosis',
    'https://rpc.ankr.com/gnosis',
    'https://gnosis.drpc.org',
    'https://gnosis-mainnet.public.blastapi.io',
];

/**
 * Default cache TTL for `eth_blockNumber` responses. The page polls
 * block number every few seconds; on Gnosis blocks come ~5s apart.
 * 500ms is short enough that the page sees fresh-enough data, long
 * enough that bursts of polls (multiple hooks calling
 * `useBlockNumber()` within one render cycle) all hit the cache.
 */
const ETH_BLOCK_NUMBER_CACHE_TTL_MS = 500;

/**
 * Build a Playwright route handler that forwards an intercepted
 * JSON-RPC POST to the local anvil fork (default `http://localhost:8546`).
 *
 * Uses an in-process `fetch` instead of `route.continue({ url })`
 * because anvil's CORS headers don't include the public RPCs' origins,
 * and Chromium would block the response otherwise. The fetch happens
 * inside Playwright's Node context, so CORS doesn't apply — we control
 * what gets fulfilled back to the page.
 *
 * **Step 14 caching**: `eth_chainId` is served from a constant
 * (chainId never changes for a forked Gnosis run) and
 * `eth_blockNumber` from a TTL cache. Together these account for
 * ~28% of the in-test anvil traffic (measured against /tmp/anvil.log
 * on a representative run). Reducing anvil's load reduces the
 * probability that mid-test mutation primitives time out behind a
 * deep request queue (see step 13 for the diagnosis).
 *
 * @param {object}   opts
 * @param {string}   [opts.anvilUrl='http://localhost:8546'] anvil endpoint
 * @param {(body:string)=>void} [opts.onCall]                 observer for each call
 * @param {boolean}  [opts.cache=true]   set false to disable the
 *                                       eth_chainId / eth_blockNumber
 *                                       short-circuit (e.g., when a
 *                                       scenario needs to assert that
 *                                       the page actually round-trips
 *                                       anvil for those calls)
 */
export function makeAnvilRpcProxyHandler({
    anvilUrl = 'http://localhost:8546',
    onCall,
    cache = true,
} = {}) {
    let blockNumberCache = null; // { value: string, expiresAt: number }

    // Step 17: pause gate. When `pause()` is called, page traffic
    // through this handler awaits the gate before forwarding. This
    // lets a scenario block page polling during a mutation window
    // (e.g., scenario #17's two `setStorageAt` calls) so anvil
    // doesn't have its request queue saturated by browser eth_calls
    // when the mutation lands. Mutations bypass this proxy entirely
    // (they fetch anvil directly from the Node-side scenario body),
    // so a pause stops PAGE traffic but leaves MUTATION traffic
    // free — exactly the asymmetry we want.
    //
    // Counter-based so nested pause/resume pairs compose cleanly
    // (caller A pauses, caller B pauses, caller A resumes — gate
    // stays closed until B also resumes).
    let pauseCount = 0;
    let pauseGate = null; // { promise, resolve } | null

    const handler = async (route) => {
        const request = route.request();
        const body = request.postData() || '';
        onCall?.(body);

        // Hold page requests at the gate while paused. Capture the
        // gate reference first so a concurrent resume() that nulls
        // pauseGate doesn't cause a race.
        const gate = pauseGate;
        if (gate) {
            await gate.promise;
        }

        // Cache fast path. Parse the body once, dispatch on method.
        // Failure to parse means the body is malformed; fall through
        // to the proxy fetch and let anvil decide.
        let parsed = null;
        if (cache) {
            try { parsed = JSON.parse(body); } catch { /* fall through */ }
        }
        if (parsed?.method === 'eth_chainId') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                // Echo the caller's `id` field so JSON-RPC clients
                // that match request↔response by id don't get
                // confused.
                body: JSON.stringify({ jsonrpc: '2.0', id: parsed.id ?? 1, result: '0x64' }),
            });
            return;
        }
        if (parsed?.method === 'eth_blockNumber') {
            const now = Date.now();
            if (blockNumberCache && blockNumberCache.expiresAt > now) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ jsonrpc: '2.0', id: parsed.id ?? 1, result: blockNumberCache.value }),
                });
                return;
            }
            // Fall through to fetch + cache the result below.
        }

        try {
            const response = await fetch(anvilUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            });
            const text = await response.text();

            // If the call we just forwarded was an eth_blockNumber
            // (cache miss path above), populate the cache from the
            // response. Tolerant of malformed responses — only
            // updates the cache when the parse + result extract
            // both succeed.
            if (cache && parsed?.method === 'eth_blockNumber') {
                try {
                    const respJson = JSON.parse(text);
                    if (typeof respJson.result === 'string' && respJson.result.startsWith('0x')) {
                        blockNumberCache = {
                            value: respJson.result,
                            expiresAt: Date.now() + ETH_BLOCK_NUMBER_CACHE_TTL_MS,
                        };
                    }
                } catch { /* ignore parse errors; serve direct response without caching */ }
            }

            await route.fulfill({
                status: response.status,
                contentType: 'application/json',
                body: text,
            });
        } catch (err) {
            // Anvil unreachable. Fail loudly with a JSON-RPC-shaped
            // error body so consumer code logs something readable
            // instead of a generic network error.
            await route.fulfill({
                status: 502,
                contentType: 'application/json',
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: null,
                    error: {
                        code: -32603,
                        message: `harness anvil proxy unreachable at ${anvilUrl}: ${err.message}`,
                    },
                }),
            });
        }
    };

    handler.pause = () => {
        pauseCount += 1;
        if (pauseCount === 1) {
            let resolve;
            const promise = new Promise((r) => { resolve = r; });
            pauseGate = { promise, resolve };
        }
    };
    handler.resume = () => {
        if (pauseCount === 0) return; // double-resume is a no-op
        pauseCount -= 1;
        if (pauseCount === 0 && pauseGate) {
            const g = pauseGate;
            pauseGate = null;
            g.resolve();
        }
    };
    // Step 18: `drainMs` option — after pausing, sleep this many
    // ms before yielding to `fn`. Pausing alone stops queue
    // GROWTH (no new page traffic forwarded to anvil) but
    // EXISTING in-flight requests at anvil keep blocking writes.
    // Sleeping during the pause window lets that backlog drain
    // before our mutation lands. Set to 0 (default) for the warm
    // path where there's no backlog to wait on; set ~3-10s for
    // cold-anvil scenarios that need to mutate after the page has
    // been polling for a while.
    handler.withPaused = async (fn, { drainMs = 0 } = {}) => {
        handler.pause();
        try {
            if (drainMs > 0) {
                await new Promise((r) => setTimeout(r, drainMs));
            }
            return await fn();
        } finally { handler.resume(); }
    };

    return handler;
}

/**
 * Convenience: register `makeAnvilRpcProxyHandler` against EVERY URL
 * in `PUBLIC_GNOSIS_RPC_URLS`. Call once per scenario `context`.
 *
 * Returns `{ urls, handler }` — `handler` carries the same
 * `pause()` / `resume()` / `withPaused(fn)` API as the underlying
 * `makeAnvilRpcProxyHandler` return value, so callers (e.g., the
 * scenarios runner) can hand the pause API into the per-scenario
 * assertion context for mutation-window blocking.
 */
export async function installAnvilRpcProxy(context, opts = {}) {
    const handler = makeAnvilRpcProxyHandler(opts);
    for (const url of PUBLIC_GNOSIS_RPC_URLS) {
        // Match the URL with OR without trailing slash and with
        // any path suffix — wagmi/ethers tend to POST to the
        // root path with a trailing slash.
        await context.route(`${url}**`, handler);
    }
    return { urls: PUBLIC_GNOSIS_RPC_URLS, handler };
}
