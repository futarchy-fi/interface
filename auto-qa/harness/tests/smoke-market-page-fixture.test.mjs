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
    fakeMarketProposalEntity,
    makeMarketCandlesMockHandler,
    makeGraphqlMockHandler,
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
