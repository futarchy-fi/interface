/**
 * Subgraph Data Adapter
 * 
 * Transforms data from The Graph subgraph format to the format
 * expected by the TripleChart component and other chart consumers.
 * 
 * This is a pure module with no React dependencies.
 */

/**
 * Adapts subgraph candle data to chart-compatible format
 * 
 * Input (Subgraph format):
 * {
 *   periodStartUnix: "1704067200",
 *   open: "100.5",
 *   high: "101.2",
 *   low: "99.8",
 *   close: "100.9"
 * }
 * 
 * Output (Chart format - same as TripleChart/MarketPageShowcase):
 * {
 *   time: 1704067200,
 *   value: 100.9
 * }
 * 
 * @param {Array} candles - Array of candle objects from subgraph
 * @param {Object} options - Transformation options
 * @param {boolean} options.invert - Whether to invert the price (1/price)
 * @param {string} options.priceField - Which price field to use ('close', 'open', 'high', 'low')
 * @returns {Array} Array of chart-compatible data points
 */
export function adaptCandlesToChartFormat(candles, options = {}) {
    const { invert = false, priceField = 'close' } = options;

    if (!candles || !Array.isArray(candles)) {
        return [];
    }

    return candles
        .map(candle => {
            const timestamp = parseInt(candle.periodStartUnix, 10);
            let price = parseFloat(candle[priceField] || candle.close);

            // Handle inversion if needed (for pools where price is inverted)
            if (invert && price !== 0) {
                price = 1 / price;
            }

            return {
                time: timestamp,
                value: price
            };
        })
        .filter(point => !isNaN(point.time) && !isNaN(point.value))
        .sort((a, b) => a.time - b.time); // Ascending order for chart
}

/**
 * Adapts pool data from subgraph to a simplified format
 * 
 * @param {Object} pool - Pool object from subgraph
 * @returns {Object} Simplified pool object
 */
export function adaptPoolToSimpleFormat(pool) {
    if (!pool) return null;

    return {
        address: pool.id,
        name: pool.name,
        type: pool.type,
        outcomeSide: pool.outcomeSide,
        price: parseFloat(pool.price),
        isInverted: pool.isInverted,
        proposalId: pool.proposal?.id || null,
        marketName: pool.proposal?.marketName || null
    };
}

/**
 * Filters pools to get only CONDITIONAL YES/NO pools
 * 
 * @param {Array} pools - Array of pool objects from subgraph
 * @returns {Object} Object with yesPools and noPools arrays
 */
export function filterConditionalPools(pools) {
    if (!pools || !Array.isArray(pools)) {
        return { yesPools: [], noPools: [] };
    }

    const conditionalPools = pools.filter(p => p.type === 'CONDITIONAL');

    return {
        yesPools: conditionalPools.filter(p => p.outcomeSide === 'YES'),
        noPools: conditionalPools.filter(p => p.outcomeSide === 'NO')
    };
}

/**
 * Creates chart data structure compatible with TripleChart
 * 
 * @param {Object} params - Parameters
 * @param {Array} params.yesCandles - Candles for YES pool
 * @param {Array} params.noCandles - Candles for NO pool
 * @param {Object} params.yesPool - YES pool metadata
 * @param {Object} params.noPool - NO pool metadata
 * @returns {Object} Chart-ready data structure
 */
export function createChartDataStructure({ yesCandles, noCandles, yesPool, noPool }) {
    // Adapt candles to chart format
    // NOTE: isInverted is just an informational flag - prices are already correct in subgraph
    const yesData = adaptCandlesToChartFormat(yesCandles);

    const noData = adaptCandlesToChartFormat(noCandles);

    // Get latest prices
    const yesLatestPrice = yesData.length > 0 ? yesData[yesData.length - 1].value : (yesPool?.price || null);
    const noLatestPrice = noData.length > 0 ? noData[noData.length - 1].value : (noPool?.price || null);

    return {
        // Historical candle data for chart lines
        yesData,
        noData,

        // Current prices for ChartParameters display
        yesPrice: yesLatestPrice,
        noPrice: noLatestPrice,

        // Pool metadata
        yesPools: yesPool ? [adaptPoolToSimpleFormat(yesPool)] : [],
        noPools: noPool ? [adaptPoolToSimpleFormat(noPool)] : [],

        // Status
        hasData: yesData.length > 0 || noData.length > 0,
        yesDataCount: yesData.length,
        noDataCount: noData.length
    };
}

/**
 * Calculate impact from YES and NO prices
 * Formula: (YES - NO) / SPOT * 100 (or if no spot, use max of YES/NO)
 * 
 * @param {number} yesPrice - YES pool price
 * @param {number} noPrice - NO pool price
 * @param {number} spotPrice - Optional spot price
 * @returns {number} Impact percentage
 */
export function calculateImpact(yesPrice, noPrice, spotPrice = null) {
    if (yesPrice === null || noPrice === null) return 0;

    const denominator = spotPrice || Math.max(yesPrice, noPrice);

    if (denominator === 0) return 0;

    return ((yesPrice - noPrice) / denominator) * 100;
}

// CommonJS export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        adaptCandlesToChartFormat,
        adaptPoolToSimpleFormat,
        filterConditionalPools,
        createChartDataStructure,
        calculateImpact
    };
}
