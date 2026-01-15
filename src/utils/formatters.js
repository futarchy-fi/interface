import { ethers } from 'ethers';

// Default display precision configuration
const DEFAULT_DISPLAY_CONFIG = {
  balance: 6,      // For balance displays
  price: 4,        // For price displays
  percentage: 2,   // For percentage displays
  small: 18        // For very small numbers
};

/**
 * Formats a value for display purposes only.
 * IMPORTANT: This should only be used for visual display in JSX, never for calculations
 * @param {string} value - The raw value to format (should be a string to maintain precision)
 * @param {string} type - The type of value ('balance', 'price', 'percentage', 'small')
 * @param {Object} config - Optional configuration to override default precision
 * @returns {string} Formatted value for display
 */
export const formatForDisplay = (value, type = 'balance', config = {}) => {
  try {
    // If value is falsy or not a valid number, return '0'
    if (!value || isNaN(value)) return '0';

    // Merge config with defaults
    const displayConfig = { ...DEFAULT_DISPLAY_CONFIG, ...config };
    
    // Convert to BigNumber to handle scientific notation and very small numbers
    const valueBN = ethers.utils.parseUnits(value, 18);
    
    // If it's zero, return '0'
    if (valueBN.isZero()) return '0';

    // Get the decimal string representation
    const fullString = ethers.utils.formatUnits(valueBN, 18);

    // Handle very small numbers
    if (Number(fullString) > 0 && Number(fullString) < 0.000001) {
      // Use scientific notation for very small numbers
      return Number(fullString).toExponential(displayConfig.small);
    }

    // Get precision based on type
    const precision = displayConfig[type] || DEFAULT_DISPLAY_CONFIG[type];

    // Split into whole and decimal parts
    const [whole, decimal = ''] = fullString.split('.');

    // If no decimal part, return whole
    if (!decimal) return whole;

    // Take only up to specified precision of decimal places, always rounding down
    const truncatedDecimal = decimal.slice(0, precision);

    // Remove trailing zeros
    const cleanDecimal = truncatedDecimal.replace(/0+$/, '');

    // Combine whole and decimal (if there's a decimal part left)
    return cleanDecimal ? `${whole}.${cleanDecimal}` : whole;
  } catch (error) {
    console.error('Error formatting value for display:', error);
    return '0';
  }
};

/**
 * Formats a percentage for display
 * @param {string} value - Raw percentage value
 * @param {Object} config - Optional configuration
 * @returns {string} Formatted percentage
 */
export const formatPercentage = (value, config = {}) => {
  const formatted = formatForDisplay(value, 'percentage', config);
  return `${formatted}%`;
};

/**
 * Formats a price for display
 * @param {string} value - Raw price value
 * @param {Object} config - Optional configuration
 * @returns {string} Formatted price
 */
export const formatPrice = (value, config = {}) => {
  return formatForDisplay(value, 'price', config);
};

/**
 * Formats a balance for display
 * @param {string} value - Raw balance value
 * @param {string} symbol - Optional token symbol to append
 * @param {Object} config - Optional configuration
 * @returns {string} Formatted balance with optional symbol
 */
export const formatBalance = (value, symbol = '', config = {}) => {
  const formatted = formatForDisplay(value, 'balance', config);
  return symbol ? `${formatted} ${symbol}` : formatted;
}; 