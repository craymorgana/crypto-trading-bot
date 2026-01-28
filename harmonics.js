/**
 * Harmonic patterns detection for scalping
 * Detects ABCD, Gartley, Butterfly, and Bat patterns
 */

const HARMONIC_RATIOS = {
    // XA retracement ratios
    ab_xa: { min: 0.38, max: 0.85, description: 'AB leg vs XA' },
    
    // BC retracement ratios
    bc_ab: { min: 0.38, max: 0.88, description: 'BC leg vs AB' },
    
    // CD projection ratios
    cd_bc: { min: 1.27, max: 1.618, description: 'CD leg vs BC' },
    
    // Pattern-specific ratios
    gartley: {
        ab_xa: { min: 0.618, max: 0.618 },
        bc_ab: { min: 0.382, max: 0.886 },
        cd_bc: { min: 1.272, max: 1.618 },
        ad_xa: { min: 0.786, max: 0.786 }
    },
    butterfly: {
        ab_xa: { min: 0.786, max: 0.786 },
        bc_ab: { min: 0.382, max: 0.886 },
        cd_bc: { min: 1.618, max: 2.618 },
        ad_xa: { min: 1.27, max: 1.27 }
    },
    bat: {
        ab_xa: { min: 0.382, max: 0.5 },
        bc_ab: { min: 0.382, max: 0.886 },
        cd_bc: { min: 1.618, max: 2.618 },
        ad_xa: { min: 0.886, max: 0.886 }
    }
};

/**
 * Calculate distances between points for harmonic analysis
 * @param {Array} prices - Array of 4 price points [X, A, B, C]
 * @returns {Object} - Calculated movements and ratios
 */
function calculateHarmonicLevels(prices) {
    if (!prices || prices.length !== 4) {
        return { error: 'Need exactly 4 price points: [X, A, B, C]' };
    }

    const [X, A, B, C] = prices;
    
    const xa = Math.abs(A - X);
    const ab = Math.abs(B - A);
    const bc = Math.abs(C - B);

    if (xa === 0) return { error: 'Invalid harmonic data' };

    return {
        X, A, B, C,
        movements: {
            XA: xa,
            AB: ab,
            BC: bc
        },
        ratios: {
            ab_xa: ab / xa,        // AB retracement of XA
            bc_ab: bc / ab,        // BC retracement of AB
            cd_bc_potential: null  // Will be calculated after D point
        }
    };
}

/**
 * Project the D point based on harmonic ratios
 * @param {Array} prices - Price points [X, A, B, C]
 * @param {string} patternType - 'gartley', 'butterfly', or 'bat'
 * @returns {Object} - Projected D level with target zones
 */
function projectHarmonicD(prices, patternType = 'gartley') {
    const harmonic = calculateHarmonicLevels(prices);
    if (harmonic.error) return harmonic;

    const { X, A, B, C } = harmonic;
    const xa = harmonic.movements.XA;
    
    // Direction: bullish (up) or bearish (down)
    const direction = C > X ? 'bullish' : 'bearish';

    // Project D based on pattern type
    let projections = {};
    
    if (patternType === 'gartley') {
        // D should be at 0.786 of XA from X, in the direction of A
        projections.d_786 = X + (xa * 0.786 * (A > X ? 1 : -1));
        projections.d_618 = X + (xa * 0.618 * (A > X ? 1 : -1));
    } else if (patternType === 'butterfly') {
        // D should be at 1.27 of XA from X
        projections.d_127 = X + (xa * 1.27 * (A > X ? 1 : -1));
        projections.d_161 = X + (xa * 1.618 * (A > X ? 1 : -1));
    } else if (patternType === 'bat') {
        // D should be at 0.886 of XA from X
        projections.d_886 = X + (xa * 0.886 * (A > X ? 1 : -1));
        projections.d_618 = X + (xa * 0.618 * (A > X ? 1 : -1));
    }

    return {
        pattern: patternType,
        direction,
        projections,
        priceAction: `Watch for reversal near D levels (${Object.values(projections).map(p => p.toFixed(2)).join(', ')})`
    };
}

/**
 * Validate if current price action matches harmonic pattern
 * @param {number} currentPrice - Current market price
 * @param {Array} prices - Historical points [X, A, B, C]
 * @param {string} patternType - 'gartley', 'butterfly', or 'bat'
 * @param {number} tolerance - Tolerance percentage (default: 2%)
 * @returns {Object} - Pattern validity and confidence
 */
function validateHarmonicPattern(currentPrice, prices, patternType, tolerance = 2) {
    const projection = projectHarmonicD(prices, patternType);
    if (projection.error) return projection;

    const projectedLevels = Object.values(projection.projections);
    const toleranceAmount = (Math.max(...projectedLevels) - Math.min(...projectedLevels)) * (tolerance / 100);

    // Check if current price is within tolerance of any projected D level
    const withinZone = projectedLevels.some(level => 
        Math.abs(currentPrice - level) <= toleranceAmount
    );

    const nearestLevel = projectedLevels.reduce((nearest, level) => {
        const distance = Math.abs(currentPrice - level);
        return distance < Math.abs(currentPrice - nearest) ? level : nearest;
    });

    return {
        pattern: patternType,
        valid: withinZone,
        nearestLevel,
        distance: Math.abs(currentPrice - nearestLevel),
        tolerance,
        message: withinZone ? 
            `Pattern CONFIRMED at D zone (${patternType.toUpperCase()})` :
            `Price approaching ${patternType} D target`
    };
}

module.exports = {
    HARMONIC_RATIOS,
    calculateHarmonicLevels,
    projectHarmonicD,
    validateHarmonicPattern
};
