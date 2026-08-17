import { getSubgraphEndpoint } from '../config/subgraphEndpoints';

export const MIN_ACTIVE_MARKET_LIQUIDITY_USD = 1_000;

const DEFAULT_RPC_URLS = {
  1: process.env.NEXT_PUBLIC_MAINNET_RPC_URL || 'https://ethereum-rpc.publicnode.com',
  100: process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.gnosischain.com',
};

const BALANCE_OF_SELECTOR = '70a08231';

const normalizeAddress = (value) => {
  const text = String(value || '').toLowerCase();
  return text.includes('-') ? text.split('-').at(-1) : text;
};

const toHumanNumber = (rawValue, decimals) => {
  let raw;
  try {
    raw = typeof rawValue === 'bigint' ? rawValue : BigInt(rawValue);
  } catch (_) {
    return null;
  }

  const safeDecimals = Number(decimals);
  if (!Number.isInteger(safeDecimals) || safeDecimals < 0 || safeDecimals > 36) return null;

  const divisor = 10n ** BigInt(safeDecimals);
  const whole = raw / divisor;
  const fractional = (raw % divisor).toString().padStart(safeDecimals, '0').slice(0, 12);
  const value = Number(whole) + (fractional ? Number(`0.${fractional}`) : 0);
  return Number.isFinite(value) ? value : null;
};

const isCurrencyToken = (token) => {
  const role = String(token?.role || '').toUpperCase();
  return role.includes('CURRENCY') || role.includes('COLLATERAL');
};

/**
 * Value a conditional pool from its real ERC-20 reserves, not virtual V3/Algebra L.
 * Currency wrappers (sDAI/USDS/etc.) are treated as the one-dollar numeraire.
 */
export function calculatePoolLiquidityUsd(pool, tokensByAddress, balancesByTokenAndPool) {
  if (!pool) return null;

  const token0Address = normalizeAddress(pool.token0);
  const token1Address = normalizeAddress(pool.token1);
  const poolAddress = normalizeAddress(pool.id);
  const token0 = tokensByAddress.get(token0Address);
  const token1 = tokensByAddress.get(token1Address);

  if (!token0 || !token1 || isCurrencyToken(token0) === isCurrencyToken(token1)) return null;

  const raw0 = balancesByTokenAndPool.get(`${token0Address}:${poolAddress}`);
  const raw1 = balancesByTokenAndPool.get(`${token1Address}:${poolAddress}`);
  const amount0 = toHumanNumber(raw0, token0.decimals);
  const amount1 = toHumanNumber(raw1, token1.decimals);
  const tick = Number(pool.tick);

  if (amount0 === null || amount1 === null || !Number.isFinite(tick)) return null;

  // Algebra tick is raw token1/token0. Correct for token decimal differences
  // before using it to value the company-token reserve in currency units.
  const token1PerToken0 = Math.exp(Math.log(1.0001) * tick)
    * Math.pow(10, Number(token0.decimals) - Number(token1.decimals));
  if (!Number.isFinite(token1PerToken0) || token1PerToken0 <= 0) return null;

  const currencyIsToken0 = isCurrencyToken(token0);
  const currencyAmount = currencyIsToken0 ? amount0 : amount1;
  const companyAmount = currencyIsToken0 ? amount1 : amount0;
  const currencyPerCompany = currencyIsToken0 ? 1 / token1PerToken0 : token1PerToken0;
  const total = currencyAmount + companyAmount * currencyPerCompany;

  return Number.isFinite(total) && total >= 0 ? total : null;
}

const balanceOfCalldata = (poolAddress) => (
  `0x${BALANCE_OF_SELECTOR}${normalizeAddress(poolAddress).replace(/^0x/, '').padStart(64, '0')}`
);

async function fetchIndexedPools(events, fetchImpl) {
  const poolIds = [];
  const proposalIds = [];

  for (const event of events) {
    const chainId = Number(event.chainId || event.metadata?.chain || 100);
    const proposalAddress = normalizeAddress(event.proposalAddress || event.eventId);
    if (proposalAddress) proposalIds.push(`${chainId}-${proposalAddress}`);
    for (const address of [event.poolAddresses?.yes, event.poolAddresses?.no]) {
      if (address) poolIds.push(`${chainId}-${normalizeAddress(address)}`);
    }
  }

  if (poolIds.length === 0 || proposalIds.length === 0) {
    return { pools: [], tokens: [] };
  }

  const endpoint = getSubgraphEndpoint(100);
  const query = `
    query ActiveMarketLiquidity($poolIds: [String!]!, $proposalIds: [String!]!) {
      pools(where: { id_in: $poolIds }, first: 1000) {
        id proposal type outcomeSide token0 token1 tick
      }
      whitelistedtokens(where: { proposal_in: $proposalIds }, first: 2000) {
        proposal address decimals role symbol
      }
    }
  `;
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      variables: {
        poolIds: [...new Set(poolIds)],
        proposalIds: [...new Set(proposalIds)],
      },
    }),
  });
  if (!response.ok) throw new Error(`Liquidity index returned HTTP ${response.status}`);
  const result = await response.json();
  if (result.errors?.length) throw new Error(result.errors[0]?.message || 'Liquidity index query failed');
  return { pools: result.data?.pools || [], tokens: result.data?.whitelistedtokens || [] };
}

async function fetchReserveBalances(pools, events, fetchImpl, rpcUrls) {
  const chainByPool = new Map();
  for (const event of events) {
    const chainId = Number(event.chainId || event.metadata?.chain || 100);
    for (const address of [event.poolAddresses?.yes, event.poolAddresses?.no]) {
      if (address) chainByPool.set(normalizeAddress(address), chainId);
    }
  }

  const callsByChain = new Map();
  let nextId = 1;
  for (const pool of pools) {
    if (String(pool.type || '').toUpperCase() !== 'CONDITIONAL') continue;
    const poolAddress = normalizeAddress(pool.id);
    const chainId = chainByPool.get(poolAddress);
    if (!chainId) continue;
    if (!callsByChain.has(chainId)) callsByChain.set(chainId, []);

    for (const token of [pool.token0, pool.token1]) {
      const tokenAddress = normalizeAddress(token);
      callsByChain.get(chainId).push({
        id: nextId++,
        key: `${tokenAddress}:${poolAddress}`,
        request: {
          jsonrpc: '2.0',
          id: nextId - 1,
          method: 'eth_call',
          params: [{ to: tokenAddress, data: balanceOfCalldata(poolAddress) }, 'latest'],
        },
      });
    }
  }

  const balances = new Map();
  await Promise.all([...callsByChain.entries()].map(async ([chainId, calls]) => {
    const rpcUrl = rpcUrls[chainId];
    if (!rpcUrl) return;
    const response = await fetchImpl(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(calls.map(({ request }) => request)),
    });
    if (!response.ok) return;
    const results = await response.json();
    if (!Array.isArray(results)) return;
    const resultById = new Map(results.map((item) => [item.id, item]));
    for (const call of calls) {
      const result = resultById.get(call.id);
      if (!result?.result || result.error) continue;
      try {
        balances.set(call.key, BigInt(result.result));
      } catch (_) {
        // Fail closed for this market below.
      }
    }
  }));

  return balances;
}

/**
 * Fail closed: a market appears in Active Milestones only when both
 * conditional pools are indexed and their real reserves prove the floor.
 */
export async function filterEventsByMinimumLiquidity(
  events,
  {
    minimumUsd = MIN_ACTIVE_MARKET_LIQUIDITY_USD,
    fetchImpl = fetch,
    rpcUrls = DEFAULT_RPC_URLS,
  } = {}
) {
  if (!events?.length) return [];

  try {
    const { pools, tokens } = await fetchIndexedPools(events, fetchImpl);
    const poolByAddress = new Map(pools.map((pool) => [normalizeAddress(pool.id), pool]));
    const tokensByAddress = new Map(tokens.map((token) => [normalizeAddress(token.address), token]));
    const balances = await fetchReserveBalances(pools, events, fetchImpl, rpcUrls);

    return events.filter((event) => {
      const yesPool = poolByAddress.get(normalizeAddress(event.poolAddresses?.yes));
      const noPool = poolByAddress.get(normalizeAddress(event.poolAddresses?.no));
      const yesUsd = calculatePoolLiquidityUsd(yesPool, tokensByAddress, balances);
      const noUsd = calculatePoolLiquidityUsd(noPool, tokensByAddress, balances);

      if (yesUsd === null || noUsd === null) return false;
      event.liquidityUsd = yesUsd + noUsd;
      return event.liquidityUsd >= minimumUsd;
    });
  } catch (error) {
    console.warn('[Active Milestones] Liquidity gate failed closed:', error.message);
    return [];
  }
}

