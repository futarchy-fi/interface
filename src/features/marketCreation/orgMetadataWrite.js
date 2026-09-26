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

/**
 * Step 2 must describe the proposal that step 1 actually created, not whatever
 * the form holds now (after a refresh the form resets to defaults, and the
 * close date and Snapshot fields stay editable). Takes the proposal's on-chain
 * reads and returns the close time and question to write, or errors when the
 * proposal does not belong to the selected organization's token pair.
 * closeTimestamp = Reality opening time - the opening buffer step 1 added.
 */
export function bindProposalToOrganization({
  openingTs,
  collateralToken1,
  collateralToken2,
  marketName,
  organization,
  openingBufferSeconds,
}) {
  const same = (a, b) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());
  const errors = [];
  const opening = Number(openingTs);
  if (!Number.isFinite(opening) || opening <= 0) {
    errors.push('Could not read the proposal opening time from Reality.eth.');
  }
  if (!same(collateralToken1, organization?.companyToken?.address)) {
    errors.push(`The proposal's company token (${collateralToken1 || 'unreadable'}) is not ${organization?.name || 'this organization'}'s.`);
  }
  if (!same(collateralToken2, organization?.currencyToken?.address)) {
    errors.push(`The proposal's currency token (${collateralToken2 || 'unreadable'}) is not ${organization?.name || 'this organization'}'s.`);
  }
  if (typeof marketName !== 'string' || !marketName.trim()) {
    errors.push('Could not read the proposal question.');
  }
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    closeTimestamp: opening - openingBufferSeconds,
    question: marketName,
  };
}
