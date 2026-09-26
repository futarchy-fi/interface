// Pure helpers for wizard steps 2–3: the org metadata write and the
// post-pool invert-flag verification. Kept free of wagmi/ethers imports so
// node:test covers them directly.

/**
 * Args for Organization.createAndAddProposalMetadata — the exact tuple
 * OrganizationManagerModal broadcasts, shared so the wizard and the modal
 * can never drift.
 */
export function buildProposalMetadataArgs({ proposalAddress, question, event, description, metadata }) {
  return [proposalAddress, question, event, description, JSON.stringify(metadata), ''];
}

/**
 * validateMetadata ctx from on-chain reads: each pool's token0 paired with
 * that pool's CONDITIONAL company token (wrappedOutcome 0=YES_COMPANY,
 * 1=NO_COMPANY — the market page's authoritative invert rule).
 */
export function buildInvertContext({ yesCompanyToken, noCompanyToken, yesPoolToken0, noPoolToken0 }) {
  const pools = {};
  if (yesPoolToken0 && yesCompanyToken) {
    pools.yes = { token0: yesPoolToken0, conditionalCompanyToken: yesCompanyToken };
  }
  if (noPoolToken0 && noCompanyToken) {
    pools.no = { token0: noPoolToken0, conditionalCompanyToken: noCompanyToken };
  }
  return { pools };
}

/**
 * Flags-only patch from a validateMetadata `corrected` result: returns just
 * the invert flags that actually changed, or null when nothing did — the
 * corrective updateExtendedMetadata must touch nothing else.
 */
export function buildInvertPatch(original, corrected) {
  if (!corrected) return null;
  const patch = {};
  for (const key of ['invertTwapPoolYes', 'invertTwapPoolNo']) {
    if (Boolean(original?.[key]) !== Boolean(corrected[key])) {
      patch[key] = Boolean(corrected[key]);
    }
  }
  return Object.keys(patch).length ? patch : null;
}
