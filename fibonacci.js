/**
 * Fibonacci levels for support/resistance identification
 * Used for scalping entry/exit targets
 */

const FIBONACCI_RATIOS = {
    '0.0': 0.0,
    '23.6': 0.236,
    '38.2': 0.382,
    '50.0': 0.5,
    '61.8': 0.618,
    '78.6': 0.786,
    '100.0': 1.0,
    '127.2': 1.272,
    '161.8': 1.618,
    '200.0': 2.0
};

/**
 * Calculate Fibonacci retracement levels
 * @param {number} swingHigh - Highest point in the swing
 * @param {number} swingLow - Lowest point in the swing
 * @returns {Object} - Fibonacci levels keyed by percentage
 */
function calculateFibonacciLevels(swingHigh, swingLow) {
    if (swingHigh <= swingLow) {
        return { error: 'Swing High must be greater than Swing Low' };
    }

    const range = swingHigh - swingLow;
    const levels = {};

    Object.entries(FIBONACCI_RATIOS).forEach(([percentage, ratio]) => {
        levels[percentage] = swingLow + (range * ratio);
    });

    return {
        swingHigh,
        swingLow,
        range,
        levels
    };
}

/**
 * Find Fibonacci level closest to current price
 * @param {number} currentPrice - Current market price
 * @param {Object} fibLevels - Output from calculateFibonacciLevels()
 * @returns {Object} - Nearest level and distance
 */
function getNearestFibLevel(currentPrice, fibLevels) {
    if (!fibLevels || !fibLevels.levels) {
        return { error: 'Invalid Fibonacci levels' };
    }

    let nearest = { level: null, percentage: null, distance: Infinity };

    Object.entries(fibLevels.levels).forEach(([percentage, price]) => {
        const distance = Math.abs(currentPrice - price);
        if (distance < nearest.distance) {
            nearest = { level: price, percentage, distance };
        }
    });

    return nearest;
}

/**
 * Check if price is near a Fibonacci level (within tolerance)
 * @param {number} currentPrice - Current market price
 * @param {Object} fibLevels - Output from calculateFibonacciLevels()
 * @param {number} tolerance - Percentage tolerance (default: 0.5%)
 * @returns {Array} - Nearby levels within tolerance
 */
function getFibLevelsNear(currentPrice, fibLevels, tolerance = 0.5) {
    if (!fibLevels || !fibLevels.levels) {
        return [];
    }

    const toleranceAmount = (fibLevels.range * tolerance) / 100;
    const nearby = [];

    Object.entries(fibLevels.levels).forEach(([percentage, price]) => {
        if (Math.abs(currentPrice - price) <= toleranceAmount) {
            nearby.push({
                percentage,
                level: price,
                distance: Math.abs(currentPrice - price)
            });
        }
    });

    return nearby.sort((a, b) => a.distance - b.distance);
}

module.exports = {
    FIBONACCI_RATIOS,
    calculateFibonacciLevels,
    getNearestFibLevel,
    getFibLevelsNear
};
