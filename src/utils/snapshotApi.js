/**
 * Snapshot API Utility
 *
 * Handles fetching proposal data from Snapshot GraphQL API
 * Supports both real API calls and mock data for development
 */

const SNAPSHOT_GRAPHQL_ENDPOINT = 'https://hub.snapshot.org/graphql';

/**
 * Smart percentage formatting - matches Snapshot.box format
 * Always includes % sign, uses smart precision to avoid 0.00%
 * @param {number} percentage - The percentage value (0-100)
 * @returns {string} Formatted percentage with % sign (e.g., "80.19%", "0.04%")
 */
function formatSmartPercentage(percentage) {
  if (percentage === 0) return '0%';

  // For percentages >= 0.01, use 2 decimals (like Snapshot: "80.19%", "0.04%")
  if (percentage >= 0.01) return `${percentage.toFixed(2)}%`;

  // For very small percentages, use more decimals to avoid showing 0.00%
  if (percentage >= 0.001) return `${percentage.toFixed(3)}%`;
  if (percentage >= 0.0001) return `${percentage.toFixed(4)}%`;

  return `${percentage.toFixed(5)}%`;
}

/**
 * Fetch proposal data from Snapshot
 * @param {string} proposalId - The Snapshot proposal ID (hex string)
 * @returns {Promise<Object>} Proposal data
 */
export async function fetchSnapshotProposal(proposalId) {
  const query = `
    query {
      proposal (id: "${proposalId}") {
        title
        space {
          id
          name
        }
        choices
        scores
        scores_total
        scores_state
        votes
        quorum
        quorumType
        state
        end
        type
      }
    }
  `;

  try {
    const response = await fetch(SNAPSHOT_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Snapshot API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return {
      success: true,
      data: result.data.proposal,
    };
  } catch (error) {
    console.error('Error fetching Snapshot proposal:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Transform Snapshot data to widget format
 * @param {Object} proposalData - Raw proposal data from Snapshot
 * @returns {Object} Formatted data for the widget
 */
export function transformSnapshotData(proposalData) {
  if (!proposalData || !proposalData.choices || !proposalData.scores) {
    return null;
  }

  const { choices, scores, scores_total, quorum, quorumType, votes, type, state, end } = proposalData;

  // Map choices to items with counts
  const items = choices.map((choice, index) => {
    const count = scores[index] || 0;
    const percentageValue = scores_total > 0 ? (count / scores_total) * 100 : 0;
    const percentage = formatSmartPercentage(percentageValue);

    // Determine icon and color based on choice name
    let iconType = 'line';
    let colorKey = 'neutral';

    const lowerChoice = choice.toLowerCase();
    if (lowerChoice.includes('for') || lowerChoice.includes('yes') || lowerChoice.includes('approve')) {
      iconType = 'check';
      colorKey = 'success';
    } else if (lowerChoice.includes('against') || lowerChoice.includes('no') || lowerChoice.includes('reject')) {
      iconType = 'x';
      colorKey = 'danger';
    } else if (lowerChoice.includes('abstain')) {
      iconType = 'line';
      colorKey = 'neutral';
    }

    return {
      key: choice.toLowerCase().replace(/\s+/g, '_'),
      label: choice,
      count,
      percentage, // Keep as string to preserve smart precision
      percentageValue, // Keep numeric value for calculations
      iconType,
      colorKey,
    };
  })
  // Sort by count (highest first) - matches Snapshot.box UX
  .sort((a, b) => b.count - a.count);

  // Calculate quorum percentage (if quorum is provided)
  // Quorum % = (current total / quorum required) * 100
  // e.g., if scores_total = 25456 and quorum = 75000, then 33.9%
  // Note: Snapshot uses 1 decimal and appears to truncate (floor), not round
  // Example: 89.7014... → 89.6% (not 89.7%)
  const quorumPercentValue = quorum && quorum > 0 ? (scores_total / quorum) * 100 : null;
  const quorumPercent = quorumPercentValue !== null
    ? `${(Math.floor(quorumPercentValue * 10) / 10).toFixed(1)}%`
    : null;

  // Determine if quorum is met
  const quorumMet = quorum ? scores_total >= quorum : null;

  // Determine the winning choice (highest score)
  let winningChoice = null;
  let winningChoiceIndex = -1;
  let maxScore = -1;

  items.forEach((item, index) => {
    if (item.count > maxScore) {
      maxScore = item.count;
      winningChoiceIndex = index;
      winningChoice = item;
    }
  });

  // Determine final result: APPROVED or REJECTED
  // Rules:
  // 1. If quorum NOT met -> REJECTED (futarchy red)
  // 2. If quorum met AND winning choice is "For"/"Yes"/"Approve" -> APPROVED (futarchy green)
  // 3. If quorum met AND winning choice is "Against"/"No"/"Reject" -> REJECTED (futarchy red)
  let proposalApproved = null;

  if (state === 'closed') {
    // First check: Did quorum pass?
    if (quorumMet === false) {
      // Quorum not met = automatic rejection
      proposalApproved = false;
    } else if (quorumMet === true && winningChoice) {
      // Quorum met, check winning choice
      const label = winningChoice.label.toLowerCase();
      proposalApproved = label.includes('for') || label.includes('yes') || label.includes('approve');
    }
    // If quorumMet is null (no quorum requirement), just use winning choice
    else if (quorumMet === null && winningChoice) {
      const label = winningChoice.label.toLowerCase();
      proposalApproved = label.includes('for') || label.includes('yes') || label.includes('approve');
    }
  }

  return {
    items,
    totalCount: scores_total,
    quorumPercent, // Keep as string to preserve smart precision
    quorumPercentValue, // Keep numeric value for calculations
    quorumMet,
    quorumType,
    votes,
    title: proposalData.title,
    spaceName: proposalData.space?.name,
    spaceId: proposalData.space?.id,
    state: state,
    end: end, // Unix timestamp (seconds)
    type: type, // Voting type
    winningChoice, // The choice object that won (highest score)
    winningChoiceIndex, // Index of winning choice
    proposalApproved, // true = APPROVED (green), false = REJECTED (red), null = not closed yet
  };
}

/**
 * Get mock Snapshot data for development
 * @returns {Object} Mock proposal data
 */
export function getMockSnapshotData() {
  return {
    title: "GIP-139: Should GnosisDAO support ProbeLab to produce network performance and security metrics for the Gnosis Chain P2P network?",
    space: {
      id: "gnosis.eth",
      name: "GnosisDAO"
    },
    choices: ["For", "Against", "Abstain"],
    scores: [20414.39585799576, 10.462900697079805, 5031.6398355173],
    scores_total: 25456.49859421014,
    scores_state: "pending",
    votes: 85,
    quorum: 75000, // Updated to match ~33.9% shown on Snapshot (25456/75000 ≈ 33.9%)
    quorumType: "default",
    state: "active"
  };
}

/**
 * Fetch and transform Snapshot data with fallback to mock
 * @param {string} proposalId - The Snapshot proposal ID
 * @param {boolean} useMock - Force use of mock data
 * @returns {Promise<Object>} Transformed widget data
 */
export async function getSnapshotWidgetData(proposalId, useMock = false) {
  if (useMock || !proposalId) {
    const mockData = getMockSnapshotData();
    return {
      success: true,
      data: transformSnapshotData(mockData),
      source: 'mock',
    };
  }

  const result = await fetchSnapshotProposal(proposalId);

  if (!result.success || !result.data) {
    console.warn('Failed to fetch Snapshot data, falling back to mock');
    const mockData = getMockSnapshotData();
    return {
      success: true,
      data: transformSnapshotData(mockData),
      source: 'mock_fallback',
      error: result.error,
    };
  }

  return {
    success: true,
    data: transformSnapshotData(result.data),
    source: 'api',
  };
}
