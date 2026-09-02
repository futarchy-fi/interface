// The ONE place createProposal calldata is assembled. Both the broadcast path
// (useCreateProposal) and the simulate path import from here, so a signature or
// param change can never make "Would succeed" validate different calldata than
// the transaction that follows it.

export const FUTARCHY_FACTORY_ABI = [
  'function createProposal((string,address,address,string,string,uint256,uint32)) returns (address)',
  'function proposals(uint256) view returns (address)',
  'function marketsCount() view returns (uint256)',
];

/**
 * Build the createProposal param tuple from wizard/debug form data.
 * openingTimeUnix (epoch seconds, number) is authoritative when present —
 * the string `openingTime` path parses in the OPERATOR'S LOCAL timezone and
 * exists only for the legacy debug modal's datetime-local input.
 * @returns {Array} the 7-element tuple for createProposal
 */
export function buildProposalParams(formData) {
  let openingUnix;
  if (Number.isFinite(formData.openingTimeUnix)) {
    openingUnix = Math.floor(formData.openingTimeUnix);
  } else {
    openingUnix = Math.floor(new Date(formData.openingTime).getTime() / 1000);
  }
  if (!Number.isFinite(openingUnix)) {
    throw new Error('Invalid opening time');
  }
  return [
    formData.marketName,
    formData.companyToken,
    formData.currencyToken,
    formData.category,
    formData.language,
    formData.minBond,
    openingUnix,
  ];
}
