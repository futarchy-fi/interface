// Increment D: TWAP window computed from the real Snapshot vote timing.
// The vote's `end` becomes closeTimestamp; deriveTwapTiming then anchors the
// 0xAlex window to it and openingTime lands 48h after close — no hand-typed
// dates, so the manually-misaligned windows that shipped twice can't recur.

export const SNAPSHOT_GRAPHQL_URL = 'https://hub.snapshot.org/graphql';
const SNAPSHOT_ID_RE = /^0x[a-fA-F0-9]{64}$/;

/**
 * Fetch a Snapshot proposal's vote-end time.
 * @param {string} snapshotId  proposal hash (0x… 32 bytes)
 * @param {typeof fetch} [fetchImpl]  injectable for tests
 * @returns {Promise<{end:number, state:string}|null>} epoch seconds, or null
 *          when the id is malformed, unknown, or the hub is unreachable.
 */
export async function fetchSnapshotVoteEnd(snapshotId, fetchImpl = fetch) {
  if (!SNAPSHOT_ID_RE.test(snapshotId || '')) return null;
  try {
    const response = await fetchImpl(SNAPSHOT_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'query ($id: String!) { proposal(id: $id) { end state } }',
        variables: { id: snapshotId },
      }),
    });
    if (!response.ok) return null;
    const { data } = await response.json();
    const proposal = data?.proposal;
    if (!proposal || !Number.isFinite(Number(proposal.end))) return null;
    return { end: Number(proposal.end), state: proposal.state || 'unknown' };
  } catch {
    return null;
  }
}
