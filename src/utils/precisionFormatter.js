import { PRECISION_CONFIG } from '../components/futarchyFi/marketPage/constants/contracts';

/**
 * Format a number with precision based on config type
 * @param {number|string} value - The value to format
 * @param {string} type - The precision type: 'price', 'amount', 'balance', 'percentage', 'default', 'smallNumbers'
 * @param {object} config - Optional custom precision config (defaults to PRECISION_CONFIG). Can be PRECISION_CONFIG or config.PRECISION_CONFIG from useContractConfig
 * @returns {string} Formatted number string
 *
 * @example
 * formatWith(3.23456, 'price') // "3.2346" (uses price precision = 4)
 * formatWith(0.00000123, 'balance') // "0.00000123000000000000" (uses smallNumbers precision)
 * formatWith(1234.5, 'amount') // "1234.500000" (uses amount precision = 6)
 */
export function formatWith(value, type = 'default', config = null) {
  // Use provided config, or fallback to PRECISION_CONFIG
  const precisionConfig = config || PRECISION_CONFIG;
  // Handle invalid inputs
  if (value === null || value === undefined || value === '' || isNaN(value)) {
    return 'N/A';
  }

  // Convert to number
  const num = typeof value === 'string' ? parseFloat(value) : value;

  // Handle special cases
  if (!isFinite(num)) return 'N/A';
  if (num === 0) return '0';

  // Get precision from config
  let precision = precisionConfig?.display?.[type] ?? precisionConfig?.display?.default ?? 2;

  // For very small numbers (< 0.0001), use high precision
  if (Math.abs(num) < 0.0001 && Math.abs(num) > 0) {
    const smallPrecision = precisionConfig?.display?.smallNumbers ?? 20;
    return num.toFixed(smallPrecision).replace(/\.?0+$/, '');
  }

  // Standard formatting with smart precision increase
  let formatted = num.toFixed(precision);
  const originalPrecision = precision;

  // Smart precision: If value rounds to 0, increase precision until we show the actual value
  // Max precision to try: 20 decimals
  const maxPrecision = precisionConfig?.display?.smallNumbers ?? 20;

  console.log(`[formatWith] value=${num}, type=${type}, initialPrecision=${precision}, formatted="${formatted}", parsedAsZero=${parseFloat(formatted) === 0}`);
  console.log(`[formatWith] Loop conditions: parsedAsZero=${parseFloat(formatted) === 0}, precision=${precision}, maxPrecision=${maxPrecision}, numNotZero=${num !== 0}`);

  let loopCount = 0;
  while (parseFloat(formatted) === 0 && precision < maxPrecision && num !== 0) {
    loopCount++;
    precision++;
    formatted = num.toFixed(precision);
    console.log(`[formatWith] Loop iteration ${loopCount}: increased precision to ${precision}, formatted="${formatted}", parsedAsZero=${parseFloat(formatted) === 0}`);
  }

  console.log(`[formatWith] Exited loop after ${loopCount} iterations, final precision=${precision}, formatted="${formatted}"`);

  // If still showing as 0 after max precision, clean up trailing zeros
  if (parseFloat(formatted) === 0 && num !== 0) {
    console.log(`[formatWith] still zero after max precision, using fallback`);
    return num.toFixed(maxPrecision).replace(/\.?0+$/, '');
  }

  // Clean trailing zeros for smart precision results (when precision was increased)
  if (precision > originalPrecision) {
    console.log(`[formatWith] precision was increased from ${originalPrecision} to ${precision}, cleaning zeros`);
    return formatted.replace(/\.?0+$/, '');
  }

  // For balance type, clean trailing zeros to avoid showing "1.0" as "1.000000"
  // but keep at least original precision for display consistency when non-zero
  if (type === 'balance') {
    return formatted.replace(/\.?0+$/, '');
  }

  // Keep trailing zeros for consistency
  return formatted;
}

/**
 * Format a number with precision and remove trailing zeros
 * @param {number|string} value - The value to format
 * @param {string} type - The precision type
 * @param {object} config - Optional custom precision config
 * @returns {string} Formatted number string without trailing zeros
 */
export function formatWithClean(value, type = 'default', config = null) {
  const formatted = formatWith(value, type, config);
  if (formatted === 'N/A') return formatted;
  return formatted.replace(/\.?0+$/, '');
}

/**
 * Format a percentage value
 * @param {number|string} value - The decimal value (e.g., 0.5 for 50%)
 * @param {object} config - Optional custom precision config
 * @returns {string} Formatted percentage string with % symbol
 */
export function formatPercentage(value, config = null) {
  if (value === null || value === undefined || value === '' || isNaN(value)) {
    return 'N/A';
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;
  const percentage = num * 100;

  return `${formatWith(percentage, 'percentage', config)}%`;
}

/**
 * Get precision value for a specific type
 * @param {string} type - The precision type
 * @param {object} config - Optional custom precision config
 * @returns {number} Precision value
 */
export function getPrecision(type = 'default', config = null) {
  const precisionConfig = config || PRECISION_CONFIG;
  return precisionConfig?.display?.[type] ?? precisionConfig?.display?.default ?? 2;
}
