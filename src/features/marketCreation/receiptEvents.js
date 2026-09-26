import { ethers } from 'ethers';

const FACTORY_EVENTS = [
  'event NewProposal(address indexed proposal, string marketName, bytes32 conditionId, bytes32 questionId)',
];

const ORGANIZATION_EVENTS = [
  'event ProposalCreatedAndAdded(address indexed proposalMetadata, address indexed proposalAddress)',
];

function sameAddress(left, right) {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

function parseReceiptLog(log, iface, address) {
  if (!log || !sameAddress(log.address, address)) return null;
  try {
    return iface.parseLog({ topics: log.topics, data: log.data });
  } catch {
    return null;
  }
}

/**
 * Return the proposal emitted by the factory transaction, or null when the
 * receipt does not contain the factory's authoritative NewProposal event.
 */
export function findCreatedProposalAddress(logs, factoryAddress) {
  const iface = new ethers.utils.Interface(FACTORY_EVENTS);
  for (const log of logs || []) {
    const parsed = parseReceiptLog(log, iface, factoryAddress);
    if (parsed?.name === 'NewProposal') return parsed.args.proposal;
  }
  return null;
}

/**
 * Return the metadata contract emitted for this proposal, or null when the
 * organization receipt does not contain a matching ProposalCreatedAndAdded.
 * The proposal match prevents a concurrent org write from being accepted.
 */
export function findCreatedMetadataAddress(logs, organizationAddress, proposalAddress) {
  const iface = new ethers.utils.Interface(ORGANIZATION_EVENTS);
  for (const log of logs || []) {
    const parsed = parseReceiptLog(log, iface, organizationAddress);
    if (
      parsed?.name === 'ProposalCreatedAndAdded'
      && sameAddress(parsed.args.proposalAddress, proposalAddress)
    ) {
      return parsed.args.proposalMetadata;
    }
  }
  return null;
}
