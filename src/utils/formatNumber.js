/**
 * Format numbers to match Snapshot's display style
 */

/**
 * Format a number with k/M suffix like Snapshot
 * @param {number} num - The number to format
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted number
 */
export function formatSnapshotNumber(num, decimals = 1) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(decimals) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(decimals) + 'k';
  }
  // For numbers under 1000, show full number with decimals if not integer
  if (Number.isInteger(num)) {
    return num.toString();
  }
  return num.toFixed(decimals);
}

/**
 * Format percentage to 2 decimal places like Snapshot
 * @param {number} percentage - The percentage value
 * @returns {string} Formatted percentage
 */
export function formatSnapshotPercentage(percentage) {
  return percentage.toFixed(2) + '%';
}

/**
 * Format count for display - uses k suffix for large numbers
 * Shows full precision for small numbers
 * @param {number} count - The count to format
 * @returns {string} Formatted count
 */
export function formatCount(count) {
  if (count >= 1000) {
    // Use k suffix with 1 decimal for numbers >= 1000
    return formatSnapshotNumber(count, 1);
  }
  // For smaller numbers, show with appropriate decimals
  if (count < 1) {
    return count.toFixed(3);
  }
  if (count < 100) {
    return count.toFixed(2);
  }
  return count.toFixed(1);
}
