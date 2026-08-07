// Metadata validation for the Create Market wizard.
//
// Encodes the ratified guards against the incidents that actually shipped:
//  - TWAP invert flags disagreeing with on-chain token0 order (KIP-88 & KIP-90:
//    a ~22,000x price-display bug). The authoritative rule is the one the market
//    page already uses (MarketPageShowcase.jsx fetchPoolTwap):
//    invert === (token0 !== CONDITIONAL company token). The pools hold the
//    wrapped YES/NO tokens, never the base company token — comparing against
//    the base token makes the check always-wrong.
//  - TWAP windows that start before the market exists → oracle reads revert.
//  - Missing coingecko_ticker → spot price silently hidden.
//  - JSON that doesn't survive a round-trip → frontend JSON.parse falls back to
//    {} and the market renders wrong (the Gnosisscan escape-stripping incident).
//  - updateExtendedMetadata overwrites the WHOLE blob, so every edit must be a
//    read-modify-write that preserves all keys.

const ADDR = /^0x[a-fA-F0-9]{40}$/;

// Grace so a freshly-derived "live from proposal start" window doesn't error
// over seconds of review time. ponytail: step 2 (metadata write) must
// recompute the window at write time; this gate just refuses stale drafts.
const TWAP_START_GRACE_SECONDS = 15 * 60;

/**
 * Validate a metadata object before it is written on-chain.
 * @param {object} metadata          the metadata blob to write
 * @param {object} [ctx]
 * @param {{yes?:{token0:string,conditionalCompanyToken:string},
 *          no?:{token0:string,conditionalCompanyToken:string}}} [ctx.pools]
 *        Per-pool on-chain token0() and the pool's wrapped (conditional)
 *        company token. Omit before pools exist — invert checks are deferred.
 * @param {number} [ctx.nowUnix]     current epoch seconds; enables the
 *        window-starts-in-the-past check.
 * @returns {{ok:boolean, errors:string[], warnings:string[], corrected:object|null}}
 */
export function validateMetadata(metadata, ctx = {}) {
  const errors = [];
  const warnings = [];
  let corrected = null;
  const m = metadata || {};

  // JSON round-trip: the object must serialize and parse back identically.
  try {
    const rt = JSON.parse(JSON.stringify(m));
    if (JSON.stringify(rt) !== JSON.stringify(m)) {
      errors.push('metadata is not JSON round-trip stable (would corrupt on write)');
    }
  } catch (e) {
    errors.push(`metadata is not serializable: ${e.message}`);
  }

  // Required keys the market page and TWAP pipeline depend on.
  for (const key of ['chain', 'snapshot_id', 'closeTimestamp', 'twapStartTimestamp', 'twapDurationHours']) {
    if (m[key] === undefined || m[key] === null || m[key] === '') {
      errors.push(`missing required key: ${key}`);
    }
  }

  // Ticker present, else spot price is silently hidden.
  if (!m.coingecko_ticker) {
    errors.push('coingecko_ticker is empty — spot price will be hidden on the market page');
  }

  // TWAP window must not start before the market can exist (a page-load-stale
  // draft would record a window predating the pools → oracle reads revert).
  if (Number.isFinite(ctx.nowUnix) && Number.isFinite(Number(m.twapStartTimestamp))
      && Number(m.twapStartTimestamp) < ctx.nowUnix - TWAP_START_GRACE_SECONDS) {
    errors.push('TWAP window starts in the past (before market creation) — move the close date later or shorten the window');
  }

  // Invert flags vs on-chain token order (the authoritative check). Each pool
  // holds the CONDITIONAL company token; the base token never appears in a pool.
  const pools = ctx.pools || {};
  const sides = ['yes', 'no'].filter((s) => pools[s]?.token0 && pools[s]?.conditionalCompanyToken);
  if (sides.length) {
    const fixes = {};
    for (const side of sides) {
      const token0 = String(pools[side].token0).toLowerCase();
      const conditional = String(pools[side].conditionalCompanyToken).toLowerCase();
      if (!ADDR.test(token0) || !ADDR.test(conditional)) continue;
      const expected = token0 !== conditional; // raw price = token1/token0; invert when the conditional company token isn't token0
      const flagKey = side === 'yes' ? 'invertTwapPoolYes' : 'invertTwapPoolNo';
      const actual = Boolean(m[flagKey]);
      if (actual !== expected) {
        errors.push(`${flagKey}=${actual} disagrees with on-chain token0 (should be ${expected}) — the shipped-wrong-price bug`);
        fixes[flagKey] = expected;
      }
    }
    if (Object.keys(fixes).length) corrected = { ...m, ...fixes };
  } else {
    warnings.push('invert flags not verified — pools do not exist yet (re-run after pool creation)');
  }

  return { ok: errors.length === 0, errors, warnings, corrected };
}

/**
 * Read-modify-write helper. Given the FULL existing on-chain metadata and a
 * patch, return the merged blob so updateExtendedMetadata never drops keys.
 * Throws if `existing` doesn't parse — refusing to write is safer than
 * overwriting the whole blob with a partial object.
 * @param {string|object} existing  current on-chain metadata (raw string or object)
 * @param {object} patch            keys to change/add
 * @returns {object} merged metadata, safe to serialize and write
 */
export function mergeMetadataForUpdate(existing, patch) {
  let base;
  if (typeof existing === 'string') {
    try {
      base = JSON.parse(existing || '{}');
    } catch (e) {
      throw new Error(`refusing to write: existing metadata does not parse (${e.message}). ` +
        'Overwriting would drop every key.');
    }
  } else {
    base = { ...(existing || {}) };
  }
  return { ...base, ...(patch || {}) };
}
