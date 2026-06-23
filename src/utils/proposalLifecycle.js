export function normalizeUnixTimestamp(value) {
    if (value === null || value === undefined || value === '') return null;

    const numeric = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
    if (!Number.isFinite(numeric) || Number.isNaN(numeric) || numeric <= 0) return null;

    return numeric > 10000000000 ? Math.floor(numeric / 1000) : numeric;
}

export function getProposalCloseTimestamp(metadata = {}) {
    return normalizeUnixTimestamp(metadata.closeTimestamp ?? metadata.endTime);
}

export function isProposalArchived(metadata = {}) {
    return metadata.archived === true || metadata.archived === 'true';
}

export function isProposalHidden(metadata = {}) {
    return metadata.visibility === 'hidden';
}

export function isProposalResolved(metadata = {}) {
    const outcome = metadata.resolution_outcome ?? metadata.finalOutcome;
    return metadata.resolution_status === 'resolved' || (outcome !== null && outcome !== undefined && outcome !== '');
}

export function isProposalClosed(metadata = {}, nowSeconds = Math.floor(Date.now() / 1000)) {
    const closeTimestamp = getProposalCloseTimestamp(metadata);
    return closeTimestamp !== null && closeTimestamp <= nowSeconds;
}

export function isProposalActive(metadata = {}, nowSeconds = Math.floor(Date.now() / 1000)) {
    return !isProposalArchived(metadata)
        && !isProposalHidden(metadata)
        && !isProposalResolved(metadata)
        && !isProposalClosed(metadata, nowSeconds);
}
