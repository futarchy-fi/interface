export function normalizeUnixTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    return value > 10000000000 ? Math.floor(value / 1000) : Math.floor(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return normalizeUnixTimestamp(numeric);
    }

    const parsedMs = Date.parse(trimmed);
    if (Number.isFinite(parsedMs)) {
      return Math.floor(parsedMs / 1000);
    }
  }

  return null;
}

export function getProposalEndTime(proposal) {
  if (!proposal) return null;

  return normalizeUnixTimestamp(
    proposal.endTime ??
    proposal.closeTimestamp ??
    proposal.end_time ??
    proposal.endDate ??
    proposal.closeDate ??
    proposal.metadata?.closeTimestamp ??
    proposal.metadata?.endTime ??
    proposal.metadata?.end_time
  );
}

export function hasResolutionOutcome(proposal) {
  if (!proposal) return false;

  const outcome =
    proposal.resolution_outcome ??
    proposal.resolutionOutcome ??
    proposal.finalOutcome ??
    proposal.metadata?.resolution_outcome ??
    proposal.metadata?.resolutionOutcome ??
    proposal.metadata?.finalOutcome;

  return outcome !== null && outcome !== undefined && outcome !== '';
}

export function isResolvedProposal(proposal) {
  if (!proposal) return false;

  const status =
    proposal.resolution_status ??
    proposal.resolutionStatus ??
    proposal.status ??
    proposal.metadata?.resolution_status ??
    proposal.metadata?.resolutionStatus;

  return status === 'resolved' || hasResolutionOutcome(proposal);
}

export function isClosedProposal(proposal, nowSeconds = Date.now() / 1000) {
  const endTime = getProposalEndTime(proposal);
  return endTime !== null && endTime <= nowSeconds;
}
