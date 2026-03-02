/**
 * Candle Builder
 * Processes swaps into hourly OHLC candles for multihop presets
 * Optimized for memory efficiency
 */

const { PRESETS } = require('../config/presets');

/**
 * Calculate price from a swap based on direction
 */
function calculateSwapPrice(swap, tokenIn, tokenOut) {
    const amtIn = parseFloat(swap.tokenAmountIn);
    const amtOut = parseFloat(swap.tokenAmountOut);

    if (amtIn === 0 || amtOut === 0) return null;

    if (swap.tokenIn.toLowerCase() === tokenIn.toLowerCase()) {
        return amtOut / amtIn;
    } else if (swap.tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
        return amtIn / amtOut;
    }

    return null;
}

/**
 * Build hourly candles from swaps for a single hop
 * Memory efficient: only stores OHLC, not all prices
 */
function buildHopCandles(swaps, tokenIn, tokenOut) {
    const hourlyData = {};

    for (const swap of swaps) {
        const price = calculateSwapPrice(swap, tokenIn, tokenOut);
        if (price === null) continue;

        const hourTs = Math.floor(swap.timestamp / 3600) * 3600;

        if (!hourlyData[hourTs]) {
            hourlyData[hourTs] = {
                open: price,
                high: price,
                low: price,
                close: price,
                swapCount: 1,
                firstTs: swap.timestamp,
                lastTs: swap.timestamp
            };
        } else {
            const c = hourlyData[hourTs];
            if (swap.timestamp < c.firstTs) {
                c.open = price;
                c.firstTs = swap.timestamp;
            }
            if (swap.timestamp > c.lastTs) {
                c.close = price;
                c.lastTs = swap.timestamp;
            }
            c.high = Math.max(c.high, price);
            c.low = Math.min(c.low, price);
            c.swapCount++;
        }
    }

    // Clean up temp fields
    for (const ts of Object.keys(hourlyData)) {
        delete hourlyData[ts].firstTs;
        delete hourlyData[ts].lastTs;
    }

    return hourlyData;
}

/**
 * Combine multiple hop candles into composite price candles
 */
function combineHopCandles(hopCandlesArray) {
    const allTimestamps = new Set();
    for (const hopCandles of hopCandlesArray) {
        Object.keys(hopCandles).forEach(ts => allTimestamps.add(parseInt(ts)));
    }

    const sortedTimestamps = [...allTimestamps].sort((a, b) => a - b);
    const lastPrices = hopCandlesArray.map(() => ({ close: 1 }));
    const compositeCandles = [];

    for (const ts of sortedTimestamps) {
        let compositeClose = 1;
        let totalSwaps = 0;

        for (let i = 0; i < hopCandlesArray.length; i++) {
            const hopCandle = hopCandlesArray[i][ts];
            if (hopCandle) {
                lastPrices[i] = hopCandle;
                compositeClose *= hopCandle.close;
                totalSwaps += hopCandle.swapCount || 0;
            } else {
                compositeClose *= lastPrices[i].close;
            }
        }

        compositeCandles.push({
            time: ts,
            open: compositeClose,  // Simplified: use close for all
            high: compositeClose,
            low: compositeClose,
            close: compositeClose,
            swapCount: totalSwaps
        });
    }

    return compositeCandles;
}

/**
 * Process swaps for a preset and return hourly composite candles
 */
function buildCompositeCandles(presetName, swapsByHop) {
    const preset = PRESETS[presetName];
    if (!preset) throw new Error(`Unknown preset: ${presetName}`);

    const hopCandlesArray = preset.hops.map((hop, i) => {
        return buildHopCandles(swapsByHop[i] || [], hop.tokenIn, hop.tokenOut);
    });

    return combineHopCandles(hopCandlesArray);
}

/**
 * Fill gaps in hourly candles
 */
function fillCandleGaps(candles) {
    if (candles.length === 0) return [];

    const filled = [];
    const sorted = [...candles].sort((a, b) => a.time - b.time);

    let last = sorted[0];
    filled.push(last);

    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        let expected = last.time + 3600;

        // Fill at most 24 gaps to prevent memory issues
        let gapsFilled = 0;
        while (expected < current.time && gapsFilled < 24) {
            filled.push({
                time: expected,
                open: last.close,
                high: last.close,
                low: last.close,
                close: last.close,
                swapCount: 0,
                isFilled: true
            });
            expected += 3600;
            gapsFilled++;
        }

        filled.push(current);
        last = current;
    }

    return filled;
}

module.exports = {
    calculateSwapPrice,
    buildHopCandles,
    combineHopCandles,
    buildCompositeCandles,
    fillCandleGaps
};
