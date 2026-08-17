import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const sourcePath = resolve(root, 'src/utils/activeMarketLiquidity.js');
const source = await readFile(sourcePath, 'utf8');

// The pure reserve valuation has no runtime dependency; strip the application
// import so Node can evaluate it in isolation under the repository's CJS mode.
const testableSource = source.replace(
  "import { getSubgraphEndpoint } from '../config/subgraphEndpoints';",
  'const getSubgraphEndpoint = () => "https://example.invalid/graphql";'
);
const liquidity = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(testableSource)}`);

const {
  calculatePoolLiquidityUsd,
  filterEventsByMinimumLiquidity,
  MIN_ACTIVE_MARKET_LIQUIDITY_USD,
} = liquidity;

const COMPANY = '0x0000000000000000000000000000000000000001';
const CURRENCY = '0x0000000000000000000000000000000000000002';
const YES_POOL = '0x0000000000000000000000000000000000000011';
const NO_POOL = '0x0000000000000000000000000000000000000012';
const PROPOSAL = '0x0000000000000000000000000000000000000021';

const tokens = new Map([
  [COMPANY, { address: COMPANY, decimals: 18, role: 'YES_COMPANY' }],
  [CURRENCY, { address: CURRENCY, decimals: 18, role: 'YES_CURRENCY' }],
]);

const wei = (amount) => BigInt(amount) * 10n ** 18n;

test('liquidity floor is exactly $1,000', () => {
  assert.equal(MIN_ACTIVE_MARKET_LIQUIDITY_USD, 1_000);
});

test('pool valuation uses real reserves and values either token orientation', () => {
  const balances = new Map([
    [`${COMPANY}:${YES_POOL}`, wei(600)],
    [`${CURRENCY}:${YES_POOL}`, wei(400)],
  ]);
  const companyFirst = calculatePoolLiquidityUsd(
    { id: YES_POOL, token0: COMPANY, token1: CURRENCY, tick: 0 },
    tokens,
    balances
  );
  assert.equal(companyFirst, 1_000);

  const reversedBalances = new Map([
    [`${CURRENCY}:${YES_POOL}`, wei(400)],
    [`${COMPANY}:${YES_POOL}`, wei(600)],
  ]);
  const currencyFirst = calculatePoolLiquidityUsd(
    { id: YES_POOL, token0: CURRENCY, token1: COMPANY, tick: 0 },
    tokens,
    reversedBalances
  );
  assert.equal(currencyFirst, 1_000);
});

test('pool valuation fails closed for missing balances or ambiguous token roles', () => {
  const pool = { id: YES_POOL, token0: COMPANY, token1: CURRENCY, tick: 0 };
  assert.equal(calculatePoolLiquidityUsd(pool, tokens, new Map()), null);

  const ambiguous = new Map([
    [COMPANY, { decimals: 18, role: 'YES_COMPANY' }],
    [CURRENCY, { decimals: 18, role: 'NO_COMPANY' }],
  ]);
  assert.equal(calculatePoolLiquidityUsd(pool, ambiguous, new Map()), null);
});

test('active filter requires both indexed pools and at least $1,000 combined real reserves', async () => {
  const events = [{
    chainId: 100,
    proposalAddress: PROPOSAL,
    eventId: PROPOSAL,
    poolAddresses: { yes: YES_POOL, no: NO_POOL },
  }];

  const graphqlData = {
    data: {
      pools: [
        { id: YES_POOL, proposal: PROPOSAL, type: 'CONDITIONAL', outcomeSide: 'YES', token0: COMPANY, token1: CURRENCY, tick: 0 },
        { id: NO_POOL, proposal: PROPOSAL, type: 'CONDITIONAL', outcomeSide: 'NO', token0: COMPANY, token1: CURRENCY, tick: 0 },
      ],
      whitelistedtokens: [...tokens.values()],
    },
  };

  const makeFetch = (currencyPerPool) => async (url, options) => {
    if (String(url).includes('graphql')) {
      return { ok: true, json: async () => graphqlData };
    }
    const requests = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => requests.map((request, index) => ({
        jsonrpc: '2.0',
        id: request.id,
        // Per pool: 100 company + configurable currency at tick zero.
        result: `0x${(index % 2 === 0 ? wei(100) : wei(currencyPerPool)).toString(16)}`,
      })),
    };
  };

  const below = await filterEventsByMinimumLiquidity(events.map((event) => ({ ...event })), {
    fetchImpl: makeFetch(399),
    rpcUrls: { 100: 'https://rpc.example' },
  });
  assert.equal(below.length, 0, '$998 must remain hidden');

  const exact = await filterEventsByMinimumLiquidity(events.map((event) => ({ ...event })), {
    fetchImpl: makeFetch(400),
    rpcUrls: { 100: 'https://rpc.example' },
  });
  assert.equal(exact.length, 1, '$1,000 must be active');
  assert.equal(exact[0].liquidityUsd, 1_000);
});

test('active filter fails closed when either pool or RPC evidence is unavailable', async () => {
  const event = {
    chainId: 100,
    proposalAddress: PROPOSAL,
    poolAddresses: { yes: YES_POOL, no: NO_POOL },
  };
  const fetchImpl = async (url) => {
    if (String(url).includes('graphql')) {
      return {
        ok: true,
        json: async () => ({
          data: {
            pools: [{ id: YES_POOL, proposal: PROPOSAL, type: 'CONDITIONAL', token0: COMPANY, token1: CURRENCY, tick: 0 }],
            whitelistedtokens: [...tokens.values()],
          },
        }),
      };
    }
    return { ok: false, status: 503, json: async () => ({}) };
  };

  assert.deepEqual(await filterEventsByMinimumLiquidity([event], {
    fetchImpl,
    rpcUrls: { 100: 'https://rpc.example' },
  }), []);
});

