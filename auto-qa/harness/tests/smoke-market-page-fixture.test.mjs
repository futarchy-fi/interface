// smoke-market-page-fixture — sanity check for the market-page
// fixture extensions in fixtures/api-mocks.mjs (Phase 7 pivot
// iteration 1).
//
// No browser, no Playwright — just imports the new exports and
// asserts they're present and shaped correctly. The actual
// scenarios that USE these helpers will validate their behavior
// against the live page; this smoke catches "I forgot to export
// it" / "I broke the helper signature" before that point.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    MARKET_PROBE_ADDRESS,
    MARKET_PROBE_TITLE,
    MARKET_PROBE_DESCRIPTION,
    MARKET_PROBE_CURRENCY_TKN,
    MARKET_PROBE_COMPANY_TKN,
    MARKET_PROBE_YES_POOL,
    MARKET_PROBE_NO_POOL,
    PROBE_AGG_ID,
    PUBLIC_GNOSIS_RPC_URLS,
    fakeMarketProposalEntity,
    makeMarketCandlesMockHandler,
    makeGraphqlMockHandler,
    makeAnvilRpcProxyHandler,
} from '../fixtures/api-mocks.mjs';

test('market-page fixture — constants exported with expected shape', () => {
    // Probe address is 0x-prefixed but mixed-case (must match
    // src/config/markets.js's MARKETS_CONFIG keys exactly because
    // Next.js dynamic routes are case-sensitive).
    assert.match(MARKET_PROBE_ADDRESS, /^0x[a-fA-F0-9]{40}$/);
    // Must match a real entry in interface src/config/markets.js so
    // the /markets/[address] page bypasses its "Market Not Found"
    // gate. The first key in MARKETS_CONFIG is GIP-145.
    // Case-sensitive — Next.js dynamic routes don't lowercase before
    // matching, so the probe address MUST match the exact case in
    // src/config/markets.js's MARKETS_CONFIG keys.
    assert.equal(MARKET_PROBE_ADDRESS, '0x45e1064348fD8A407D6D1F59Fc64B05F633b28FC');

    // Synthetic strings must be distinctive — vanishingly unlikely
    // to collide with any real on-chain or indexed value.
    assert.match(MARKET_PROBE_TITLE, /HARNESS-MARKET-PROBE/);
    assert.match(MARKET_PROBE_DESCRIPTION, /harness/i);

    // Pool + token addresses are synthetic 0x-prefixed 40-char hex.
    for (const addr of [
        MARKET_PROBE_CURRENCY_TKN,
        MARKET_PROBE_COMPANY_TKN,
        MARKET_PROBE_YES_POOL,
        MARKET_PROBE_NO_POOL,
    ]) {
        assert.match(addr, /^0x[a-f0-9]{40}$/);
    }
});

test('fakeMarketProposalEntity — default shape passes the consumer client-side filter', () => {
    const row = fakeMarketProposalEntity();

    // Required fields per src/adapters/registryAdapter.js's market-page query.
    assert.equal(row.proposalAddress, MARKET_PROBE_ADDRESS);
    assert.equal(row.title, MARKET_PROBE_TITLE);
    assert.equal(row.displayNameEvent, MARKET_PROBE_TITLE);
    assert.equal(row.displayNameQuestion, MARKET_PROBE_TITLE);
    assert.ok(row.organization, 'organization must be nested');
    // Adapter client-side-filters by aggregator id; default must equal
    // PROBE_AGG_ID (which equals DEFAULT_AGGREGATOR in the app config)
    // or the row gets dropped.
    assert.equal(row.organization.aggregator.id, PROBE_AGG_ID);

    // Metadata must be a JSON-stringified object with conditional_pools
    // (consumer parses this).
    const meta = JSON.parse(row.metadata);
    assert.equal(meta.chain, '100');
    assert.equal(meta.conditional_pools.yes.address, MARKET_PROBE_YES_POOL);
    assert.equal(meta.conditional_pools.no.address, MARKET_PROBE_NO_POOL);
});

test('fakeMarketProposalEntity — opts override the defaults', () => {
    const row = fakeMarketProposalEntity({
        proposalAddress: '0x1111111111111111111111111111111111111111',
        title:           'OVERRIDE-TITLE',
        metadataExtra:   { spotPrice: 0.42 },
    });
    assert.equal(row.proposalAddress, '0x1111111111111111111111111111111111111111');
    assert.equal(row.title, 'OVERRIDE-TITLE');
    const meta = JSON.parse(row.metadata);
    assert.equal(meta.spotPrice, 0.42);
    // metadataExtra merges over defaults — chain + conditional_pools still present.
    assert.equal(meta.chain, '100');
    assert.ok(meta.conditional_pools);
});

test('makeMarketCandlesMockHandler — returns a function', () => {
    const handler = makeMarketCandlesMockHandler();
    assert.equal(typeof handler, 'function');
    assert.equal(handler.length, 1, 'route handler signature is async (route) => ...');
});

test('makeMarketCandlesMockHandler — discovery query returns proposal + tokens', async () => {
    const handler = makeMarketCandlesMockHandler();
    let fulfilled = null;

    // Stub Playwright route object — minimal surface needed.
    const stubRoute = {
        request: () => ({
            postData: () => JSON.stringify({
                query: `{ proposal(id: "${MARKET_PROBE_ADDRESS}") { id currencyToken companyToken } whitelistedtokens(where: { proposal: "${MARKET_PROBE_ADDRESS}" }) { address symbol decimals role } }`,
            }),
        }),
        fulfill: async (resp) => { fulfilled = resp; },
    };

    await handler(stubRoute);

    assert.ok(fulfilled, 'handler must call route.fulfill');
    assert.equal(fulfilled.status, 200);
    const body = JSON.parse(fulfilled.body);
    // Handler internally lowercases the proposal id (matches the
    // adapter's pre-query normalization), so the returned id is the
    // lowercased form.
    assert.equal(body.data.proposal.id, MARKET_PROBE_ADDRESS.toLowerCase());
    assert.equal(body.data.proposal.currencyToken, MARKET_PROBE_CURRENCY_TKN);
    assert.equal(body.data.proposal.companyToken, MARKET_PROBE_COMPANY_TKN);
    assert.equal(body.data.whitelistedtokens.length, 3, 'sDAI + YES + NO');
});

test('makeMarketCandlesMockHandler — latest-candle query returns the pool price', async () => {
    const handler = makeMarketCandlesMockHandler({ yesPrice: 0.73 });
    let fulfilled = null;
    const stubRoute = {
        request: () => ({
            postData: () => JSON.stringify({
                query: `{ candles(where: { pool: "${MARKET_PROBE_YES_POOL}" }, orderBy: time, orderDirection: desc, first: 1) { close } }`,
            }),
        }),
        fulfill: async (resp) => { fulfilled = resp; },
    };

    await handler(stubRoute);

    const body = JSON.parse(fulfilled.body);
    assert.equal(body.data.candles.length, 1);
    assert.equal(body.data.candles[0].close, '0.73');
});

test('makeMarketCandlesMockHandler — singular pool query returns pool detail', async () => {
    const handler = makeMarketCandlesMockHandler();
    let fulfilled = null;
    const stubRoute = {
        request: () => ({
            postData: () => JSON.stringify({
                query: `{ pool: pools(where: { id: "${MARKET_PROBE_NO_POOL}" }, first: 1) { id liquidity volumeToken0 volumeToken1 token0 token1 tick proposal } }`,
            }),
        }),
        fulfill: async (resp) => { fulfilled = resp; },
    };

    await handler(stubRoute);

    const body = JSON.parse(fulfilled.body);
    assert.equal(body.data.pool.length, 1);
    assert.equal(body.data.pool[0].id, MARKET_PROBE_NO_POOL);
    assert.equal(body.data.pool[0].proposal, MARKET_PROBE_ADDRESS.toLowerCase());
});

test('makeMarketCandlesMockHandler — swaps query returns empty list (default)', async () => {
    const handler = makeMarketCandlesMockHandler();
    let fulfilled = null;
    const stubRoute = {
        request: () => ({
            postData: () => JSON.stringify({
                query: `{ swaps(where: { pool_in: ["${MARKET_PROBE_YES_POOL}"] }, first: 30, orderBy: timestamp, orderDirection: desc) { id timestamp } }`,
            }),
        }),
        fulfill: async (resp) => { fulfilled = resp; },
    };
    await handler(stubRoute);
    const body = JSON.parse(fulfilled.body);
    assert.deepEqual(body.data.swaps, []);
});

test('makeMarketCandlesMockHandler — pools id_in batch returns matching probe pools', async () => {
    const handler = makeMarketCandlesMockHandler();
    let fulfilled = null;
    const stubRoute = {
        request: () => ({
            postData: () => JSON.stringify({
                query: `{ pools(where: { id_in: ["${MARKET_PROBE_YES_POOL}", "${MARKET_PROBE_NO_POOL}"] }) { id name type outcomeSide } }`,
            }),
        }),
        fulfill: async (resp) => { fulfilled = resp; },
    };
    await handler(stubRoute);
    const body = JSON.parse(fulfilled.body);
    assert.equal(body.data.pools.length, 2);
    assert.equal(body.data.pools[0].outcomeSide, 'YES');
    assert.equal(body.data.pools[1].outcomeSide, 'NO');
});

test('makeMarketCandlesMockHandler — pools id_in batch filters out unknown addresses', async () => {
    const handler = makeMarketCandlesMockHandler();
    let fulfilled = null;
    const stubRoute = {
        request: () => ({
            postData: () => JSON.stringify({
                query: `{ pools(where: { id_in: ["0x9999999999999999999999999999999999999999"] }) { id name type outcomeSide } }`,
            }),
        }),
        fulfill: async (resp) => { fulfilled = resp; },
    };
    await handler(stubRoute);
    const body = JSON.parse(fulfilled.body);
    assert.deepEqual(body.data.pools, []);
});

test('makeMarketCandlesMockHandler — pools by proposal returns YES + NO probe pools', async () => {
    const handler = makeMarketCandlesMockHandler();
    let fulfilled = null;
    const stubRoute = {
        request: () => ({
            postData: () => JSON.stringify({
                query: `{ pools(where: { proposal: "${MARKET_PROBE_ADDRESS.toLowerCase()}", type: "CONDITIONAL" }) { id name type outcomeSide } }`,
            }),
        }),
        fulfill: async (resp) => { fulfilled = resp; },
    };
    await handler(stubRoute);
    const body = JSON.parse(fulfilled.body);
    assert.equal(body.data.pools.length, 2);
    const ids = body.data.pools.map((p) => p.id);
    assert.ok(ids.includes(MARKET_PROBE_YES_POOL));
    assert.ok(ids.includes(MARKET_PROBE_NO_POOL));
});

test('makeMarketCandlesMockHandler — pools by proposal returns empty when proposal mismatches', async () => {
    const handler = makeMarketCandlesMockHandler();
    let fulfilled = null;
    const stubRoute = {
        request: () => ({
            postData: () => JSON.stringify({
                query: `{ pools(where: { proposal: "0x9999999999999999999999999999999999999999", type: "CONDITIONAL" }) { id name type outcomeSide } }`,
            }),
        }),
        fulfill: async (resp) => { fulfilled = resp; },
    };
    await handler(stubRoute);
    const body = JSON.parse(fulfilled.body);
    assert.deepEqual(body.data.pools, []);
});

test('makeGraphqlMockHandler — accepts a market-shaped proposal row', async () => {
    // The existing /companies-side handler dispatches on
    // `proposalentities(where:` and returns the `proposals` array.
    // Confirm the market-shaped row passes through unchanged so a
    // happy-path scenario can do `proposals: [fakeMarketProposalEntity()]`.
    const row = fakeMarketProposalEntity();
    const handler = makeGraphqlMockHandler({ proposals: [row] });
    let fulfilled = null;
    const stubRoute = {
        request: () => ({
            postData: () => JSON.stringify({
                query: `{ proposalentities(where: { proposalAddress: "${MARKET_PROBE_ADDRESS}" }) { id title } }`,
            }),
        }),
        fulfill: async (resp) => { fulfilled = resp; },
    };

    await handler(stubRoute);

    const body = JSON.parse(fulfilled.body);
    assert.equal(body.data.proposalentities.length, 1);
    assert.equal(body.data.proposalentities[0].title, MARKET_PROBE_TITLE);
    assert.equal(body.data.proposalentities[0].organization.aggregator.id, PROBE_AGG_ID);
});

test('makeGraphqlMockHandler — matches multi-line proposalentities form', async () => {
    // Step 5b regression guard. The market-page registry adapter
    // (`src/adapters/registryAdapter.js::fetchProposalMetadataFromRegistry`)
    // sends a multi-line GraphQL query — `proposalentities(\n      where:`.
    // The original substring check `q.includes('proposalentities(where:')`
    // ONLY matched the single-line `/companies` form, so the multi-line
    // form fell through to `data = {}`, the registry hook saw "No
    // ProposalMetadata found", flipped to the Supabase fallback (which
    // can't reach the dummy URL in test), and the per-market config
    // never resolved → useBalanceManager stayed gated → balance panel
    // stuck on "Loading balances...". The fix replaces the substring
    // check with `/proposalentities\s*\(/`, matching both forms. This
    // test exercises the multi-line form verbatim against the actual
    // registry-adapter template literal so the regression can't return
    // silently.
    const row = fakeMarketProposalEntity();
    const handler = makeGraphqlMockHandler({ proposals: [row] });
    let fulfilled = null;
    const stubRoute = {
        request: () => ({
            postData: () => JSON.stringify({
                query: `{
    proposalentities(
      where: { proposalAddress: "${MARKET_PROBE_ADDRESS.toLowerCase()}" },
      first: 5
    ) {
      id
      proposalAddress
      metadata
      title
      organization { id name aggregator { id } }
    }
  }`,
            }),
        }),
        fulfill: async (resp) => { fulfilled = resp; },
    };

    await handler(stubRoute);

    const body = JSON.parse(fulfilled.body);
    assert.equal(body.data.proposalentities.length, 1, 'multi-line form must hit the proposalentities branch');
    assert.equal(body.data.proposalentities[0].title, MARKET_PROBE_TITLE);
});

test('PUBLIC_GNOSIS_RPC_URLS — covers the four RPCs in src/utils/getBestRpc.js + the two extras from src/providers/providers.jsx', () => {
    // The harness's RPC proxy installs handlers for every URL in
    // this set. If `src/utils/getBestRpc.js::RPC_LISTS[100]` ever
    // gains a new entry, OR `src/providers/providers.jsx` adds
    // another wagmi `http()` URL, the new endpoint slips past the
    // proxy and balance reads land on real Gnosis mainnet again.
    // This smoke test re-derives the expected union — bumping the
    // assertion forces a deliberate update of the proxy URL list.
    const expected = [
        // src/utils/getBestRpc.js (read path via getBestRpcProvider)
        'https://rpc.gnosischain.com',
        'https://gnosis-rpc.publicnode.com',
        'https://1rpc.io/gnosis',
        'https://rpc.ankr.com/gnosis',
        // src/providers/providers.jsx (wagmi fallback chain) only
        // adds these two not already in getBestRpc.js
        'https://gnosis.drpc.org',
        'https://gnosis-mainnet.public.blastapi.io',
    ];
    assert.deepEqual(
        [...PUBLIC_GNOSIS_RPC_URLS].sort(),
        [...expected].sort(),
        'PUBLIC_GNOSIS_RPC_URLS must be the union of getBestRpc.js + providers.jsx Gnosis URLs',
    );
});

test('makeAnvilRpcProxyHandler — forwards POST body to anvilUrl + fulfills with response', async () => {
    // Stub anvil endpoint via globalThis.fetch monkey-patch — no
    // network or live anvil needed. Confirms that whatever body the
    // page sent is the body the proxy fetches with, AND the response
    // text round-trips back to the page via route.fulfill.
    const sentBody = JSON.stringify({
        jsonrpc: '2.0',
        id: 42,
        method: 'eth_call',
        params: [{ to: '0xabc', data: '0xdeadbeef' }, 'latest'],
    });
    const fakeAnvilResponse = JSON.stringify({
        jsonrpc: '2.0',
        id: 42,
        result: '0x0000000000000000000000000000000000000000000000000000000000000064',
    });

    const originalFetch = globalThis.fetch;
    let capturedFetchUrl = null;
    let capturedFetchInit = null;
    globalThis.fetch = async (url, init) => {
        capturedFetchUrl = url;
        capturedFetchInit = init;
        return {
            status: 200,
            text: async () => fakeAnvilResponse,
        };
    };

    try {
        const handler = makeAnvilRpcProxyHandler({ anvilUrl: 'http://localhost:8546' });
        let fulfilled = null;
        const stubRoute = {
            request: () => ({ postData: () => sentBody }),
            fulfill: async (resp) => { fulfilled = resp; },
        };

        await handler(stubRoute);

        assert.equal(capturedFetchUrl, 'http://localhost:8546');
        assert.equal(capturedFetchInit.method, 'POST');
        assert.equal(capturedFetchInit.body, sentBody, 'proxy must forward the page body verbatim');
        assert.equal(fulfilled.status, 200);
        assert.equal(fulfilled.body, fakeAnvilResponse, 'proxy must round-trip the anvil response back');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('makeAnvilRpcProxyHandler — fails loudly with JSON-RPC error when anvil unreachable', async () => {
    // When anvil is down the page would otherwise see a generic
    // network error from the proxied URL. A scenario debugging that
    // failure mode would be misled into thinking the public RPC was
    // at fault. Returning a JSON-RPC error body with a clear message
    // names the actual cause inline.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:8546');
    };

    try {
        const handler = makeAnvilRpcProxyHandler({ anvilUrl: 'http://localhost:8546' });
        let fulfilled = null;
        const stubRoute = {
            request: () => ({ postData: () => '{}' }),
            fulfill: async (resp) => { fulfilled = resp; },
        };

        await handler(stubRoute);

        assert.equal(fulfilled.status, 502);
        const body = JSON.parse(fulfilled.body);
        assert.equal(body.jsonrpc, '2.0');
        assert.equal(body.error.code, -32603);
        assert.match(body.error.message, /harness anvil proxy unreachable/);
        assert.match(body.error.message, /localhost:8546/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('makeAnvilRpcProxyHandler — eth_chainId served from cache (no anvil round-trip)', async () => {
    // Step 14: eth_chainId is ~18% of the in-test anvil traffic.
    // The proxy short-circuits it with a constant 0x64 (Gnosis)
    // response so anvil's request queue isn't loaded with calls
    // for a value that never changes.
    const originalFetch = globalThis.fetch;
    let fetchCount = 0;
    globalThis.fetch = async () => { fetchCount++; throw new Error('fetch should NOT be called for cached eth_chainId'); };

    try {
        const handler = makeAnvilRpcProxyHandler({ anvilUrl: 'http://localhost:8546' });
        let fulfilled = null;
        const stubRoute = {
            request: () => ({ postData: () => JSON.stringify({ jsonrpc: '2.0', id: 42, method: 'eth_chainId', params: [] }) }),
            fulfill: async (resp) => { fulfilled = resp; },
        };

        await handler(stubRoute);

        assert.equal(fetchCount, 0, 'cached method MUST NOT round-trip anvil');
        assert.equal(fulfilled.status, 200);
        const body = JSON.parse(fulfilled.body);
        assert.equal(body.jsonrpc, '2.0');
        assert.equal(body.id, 42, 'response MUST echo the request id');
        assert.equal(body.result, '0x64');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('makeAnvilRpcProxyHandler — eth_blockNumber cached for the TTL window', async () => {
    // Step 14: eth_blockNumber is ~10% of in-test traffic. Cache it
    // for ~500ms so bursty page polling (multiple hooks calling
    // useBlockNumber within one render) all hit the cache. The
    // FIRST call goes to anvil; subsequent calls within the TTL
    // window read the cached value.
    const originalFetch = globalThis.fetch;
    let fetchCount = 0;
    globalThis.fetch = async () => {
        fetchCount++;
        return {
            status: 200,
            text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x1234' }),
        };
    };

    try {
        const handler = makeAnvilRpcProxyHandler({ anvilUrl: 'http://localhost:8546' });
        const makeRoute = (id) => {
            const route = {
                request: () => ({ postData: () => JSON.stringify({ jsonrpc: '2.0', id, method: 'eth_blockNumber', params: [] }) }),
                fulfill: async (resp) => { route.lastResp = resp; },
            };
            return route;
        };

        // First call: cache miss, hits anvil.
        const r1 = makeRoute(1);
        await handler(r1);
        assert.equal(fetchCount, 1);
        assert.equal(JSON.parse(r1.lastResp.body).result, '0x1234');

        // Second call within TTL: served from cache, no anvil
        // round-trip. Echoes the new request id.
        const r2 = makeRoute(2);
        await handler(r2);
        assert.equal(fetchCount, 1, 'second call within TTL MUST NOT re-fetch');
        const body2 = JSON.parse(r2.lastResp.body);
        assert.equal(body2.result, '0x1234');
        assert.equal(body2.id, 2);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('makeAnvilRpcProxyHandler — cache=false disables both short-circuits', async () => {
    // Escape hatch for scenarios that need to assert anvil
    // ROUND-TRIPS for eth_chainId / eth_blockNumber (e.g., a
    // scenario that probes the page's wallet-init RPC pattern).
    const originalFetch = globalThis.fetch;
    let fetchCount = 0;
    globalThis.fetch = async () => {
        fetchCount++;
        return { status: 200, text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x64' }) };
    };

    try {
        const handler = makeAnvilRpcProxyHandler({ anvilUrl: 'http://localhost:8546', cache: false });
        const stubRoute = {
            request: () => ({ postData: () => JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }) }),
            fulfill: async () => {},
        };

        await handler(stubRoute);
        await handler(stubRoute);
        assert.equal(fetchCount, 2, 'cache=false MUST forward every call to anvil');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('makeAnvilRpcProxyHandler — pause() blocks page traffic until resume()', async () => {
    // Step 17: scenarios with mid-test mutations need to keep anvil's
    // request queue clear during the mutation window. Pausing the
    // page proxy holds page eth_calls at the gate; resume() releases
    // them. The mutation path bypasses this proxy (Node-side direct
    // fetch), so a paused proxy stops PAGE traffic without blocking
    // the scenario's own writes.
    //
    // cache=false so the eth_call we send to test gating doesn't
    // get short-circuited by the chainId / blockNumber cache.
    const originalFetch = globalThis.fetch;
    let fetchCount = 0;
    globalThis.fetch = async () => {
        fetchCount++;
        return { status: 200, text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x42' }) };
    };

    try {
        const handler = makeAnvilRpcProxyHandler({ anvilUrl: 'http://localhost:8546', cache: false });
        const stubRoute = {
            request: () => ({ postData: () => JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: '0xabc', data: '0x' }, 'latest'] }) }),
            fulfill: async () => {},
        };

        handler.pause();
        const blocked = handler(stubRoute);
        // Yield once to let the handler advance to its `await gate`.
        // Without this, the assertion below races the handler's
        // synchronous prefix.
        await new Promise((r) => setImmediate(r));
        assert.equal(fetchCount, 0, 'pause() must hold page traffic before forwarding to anvil');

        handler.resume();
        await blocked;
        assert.equal(fetchCount, 1, 'resume() must release the held request');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('makeAnvilRpcProxyHandler — pause/resume counter composes (nested pairs)', async () => {
    // Two callers nest pause/resume. The gate stays closed until
    // BOTH have resumed. Without this, a sub-block resuming would
    // prematurely release page traffic mid-mutation in the outer
    // block. Counter semantics are what makes nested mutation
    // helpers safe to compose.
    const originalFetch = globalThis.fetch;
    let fetchCount = 0;
    globalThis.fetch = async () => {
        fetchCount++;
        return { status: 200, text: async () => '{}' };
    };

    try {
        const handler = makeAnvilRpcProxyHandler({ anvilUrl: 'http://localhost:8546', cache: false });
        const stubRoute = {
            request: () => ({ postData: () => JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [] }) }),
            fulfill: async () => {},
        };

        handler.pause();
        handler.pause(); // count = 2
        const blocked = handler(stubRoute);
        await new Promise((r) => setImmediate(r));

        handler.resume(); // count = 1; gate stays closed
        await new Promise((r) => setImmediate(r));
        assert.equal(fetchCount, 0, 'first resume() must NOT release while a second pause is still active');

        handler.resume(); // count = 0; gate opens
        await blocked;
        assert.equal(fetchCount, 1, 'second resume() opens the gate and the held request lands');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('makeAnvilRpcProxyHandler — withPaused({drainMs}) sleeps after pausing, before fn', async () => {
    // Step 18: drainMs lets the existing in-flight anvil backlog
    // drain after the proxy gate closes. The sleep happens
    // INSIDE the pause window (so no new page traffic is being
    // forwarded to anvil during the drain), and BEFORE fn runs
    // (so the mutation lands when anvil is quiet).
    const handler = makeAnvilRpcProxyHandler({ anvilUrl: 'http://localhost:8546', cache: false });

    const t0 = Date.now();
    let fnRanAt = null;
    await handler.withPaused(async () => {
        fnRanAt = Date.now();
    }, { drainMs: 100 });
    const elapsed = Date.now() - t0;
    const fnDelay = fnRanAt - t0;

    assert.ok(fnDelay >= 100, `fn must run AFTER drainMs sleep — saw ${fnDelay}ms < 100ms`);
    assert.ok(elapsed >= 100, `withPaused must wait the full drain window — saw ${elapsed}ms < 100ms`);
});

test('makeAnvilRpcProxyHandler — withPaused() with no opts skips the drain (default 0)', async () => {
    // Warm-path mutations don't need the drain; default of 0 keeps
    // them fast. Regression guard against accidentally making the
    // drain mandatory.
    const handler = makeAnvilRpcProxyHandler({ anvilUrl: 'http://localhost:8546', cache: false });

    const t0 = Date.now();
    await handler.withPaused(async () => {
        // no-op
    });
    const elapsed = Date.now() - t0;

    assert.ok(elapsed < 50, `default withPaused must be sleep-free — saw ${elapsed}ms ≥ 50ms`);
});

test('makeAnvilRpcProxyHandler — withPaused(fn) always resumes, even on throw', async () => {
    // The convenience wrapper is the safer surface for scenarios:
    // it guarantees the gate gets released even when the wrapped
    // mutation throws. Without try/finally semantics, a thrown
    // mutation would strand the proxy in a permanently-paused
    // state and the next page poll would hang forever.
    const handler = makeAnvilRpcProxyHandler({ anvilUrl: 'http://localhost:8546', cache: false });

    let caughtFromHelper = null;
    try {
        await handler.withPaused(async () => {
            throw new Error('mutation failed');
        });
    } catch (err) {
        caughtFromHelper = err;
    }
    assert.equal(caughtFromHelper?.message, 'mutation failed', 'withPaused must propagate the inner throw');

    // After the throw, a follow-up call should NOT be gated — the
    // pause was released by the finally block.
    const originalFetch = globalThis.fetch;
    let fetchCount = 0;
    globalThis.fetch = async () => {
        fetchCount++;
        return { status: 200, text: async () => '{}' };
    };
    try {
        const stubRoute = {
            request: () => ({ postData: () => JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [] }) }),
            fulfill: async () => {},
        };
        await handler(stubRoute);
        assert.equal(fetchCount, 1, 'after a thrown withPaused, subsequent traffic must NOT be gated');
    } finally {
        globalThis.fetch = originalFetch;
    }
});
