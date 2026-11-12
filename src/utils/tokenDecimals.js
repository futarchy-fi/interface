import { ethers } from 'ethers';

/**
 * Token-decimals helpers.
 *
 * Most futarchy markets use 18-decimal collateral, but not all: on Robinhood
 * Chain (4663) the currency token USDG and its YES/NO outcome tokens have 6
 * decimals. Outcome tokens always share their collateral's decimals.
 */

/** Coerce a decimals value to a safe integer; defaults to 18. */
export function normalizeDecimals(value, fallback = 18) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 36 ? n : fallback;
}

/** Decimals of the currency / company side of a market config. */
export function getSideDecimals(baseTokensConfig, side) {
  return normalizeDecimals(baseTokensConfig?.[side]?.decimals);
}

/**
 * Truncate a human-readable decimal string to at most `decimals` fractional
 * digits so ethers.parseUnits does not throw on over-precise input.
 */
export function truncateToDecimals(amount, decimals = 18) {
  const str = String(amount ?? '0').trim();
  if (!str.includes('.')) return str;
  const [whole, frac = ''] = str.split('.');
  const d = normalizeDecimals(decimals);
  if (d === 0) return whole || '0';
  return `${whole || '0'}.${frac.slice(0, d)}`;
}

/** parseUnits that tolerates more fractional digits than the token has. */
export function parseTokenAmount(amount, decimals = 18) {
  const d = normalizeDecimals(decimals);
  return ethers.utils.parseUnits(truncateToDecimals(amount, d), d);
}

/**
 * Amount for the futarchy-sdk cartridges (split / merge / redeem).
 *
 * The cartridges call viem parseEther() on string amounts and use bigint
 * amounts as-is. For 18-decimal tokens we keep passing the string (unchanged
 * behaviour); for any other decimals we pass the raw base-unit bigint so the
 * amount is not mis-scaled by 10^(18 - decimals).
 */
export function toSdkAmount(amount, decimals = 18) {
  const d = normalizeDecimals(decimals);
  if (d === 18) return amount.toString();
  return BigInt(parseTokenAmount(amount, d).toString());
}
