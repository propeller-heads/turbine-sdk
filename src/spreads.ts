import { MAX_DELTA_BPS, MIN_DELTA_BPS } from "./constants";
import { SpreadCurve } from "./models";

/**
 * Helpers for building {@link SpreadCurve} values.
 *
 * `windowBps` runs from `0` (order start) to `10_000` (order end), with interior
 * points in `[1, 9_999]`. `deltaBps` is signed, `[-10_000, 9_999]`.
 */

/** A flat curve that returns the same delta across the entire order window. */
export function constant(deltaBps: number): SpreadCurve {
    return {
        startDeltaBps: deltaBps,
        endDeltaBps: deltaBps,
        points: [],
    };
}

/** Parameters for {@link auto}. */
export interface AutoSpreadParams {
    /** Average market spread for the pair, in basis points. */
    fastSpreadBps: number;
    /** Duration of the order in seconds. Default: `600` (10 minutes). */
    durationSecs?: number;
    /** Fee in basis points. Default: `10`. */
    feeBps?: number;
}

export function auto(params: AutoSpreadParams): SpreadCurve {
    const durationSecs = params.durationSecs ?? 600;
    if (durationSecs <= 300) {
        const feeBps = params.feeBps ?? 10;
        return fast(params.fastSpreadBps, feeBps);
    } else {
        return maximizing(params.fastSpreadBps);
    }
}

/**
 * Curve suitable for fast market orders.
 * 
 * It starts at -fastSpread to have a chance for better price.
 * It quickly reaches fastSpread at 10% of the order window.
 * It then slowly widens the spread to reach fastSpread + fee at 80% of the order window.
 * This should already ensure filling at the fast spread even with fees taken into account.
 * After 80% of the order window, the spread goes even wider to reach fastSpread * 2 + fee
 * at the end of the order window, to guarantee filling.
 *
 * @param fastSpreadBps - The fast spread in basis points.
 * @param feeBps - The fee in basis points.
 * @returns The spread curve.
 */
export function fast(fastSpreadBps: number, feeBps: number): SpreadCurve {
    validateIntInDomain(fastSpreadBps, "fastSpreadBps", 1, MAX_DELTA_BPS);
    validateIntInDomain(feeBps, "feeBps", 0, Number.POSITIVE_INFINITY);
    return {
        startDeltaBps: -fastSpreadBps,
        points: [
            { windowBps: 1000, deltaBps: fastSpreadBps },
            { windowBps: 8000, deltaBps: fastSpreadBps + feeBps },
        ],
        endDeltaBps: fastSpreadBps * 2 + feeBps,
    } as SpreadCurve;
}

/**
 * Four-knot piecewise-linear spread curve.
 *
 * Anchors:
 *
 * | windowBps | deltaBps                |
 * |-----------|-------------------------|
 * | 0         | `yoloBps`               |
 * | 1000      | `-fastSpreadBps`        |
 * | 5000      | `fastSpreadBps - delta` |
 * | 10000     | `fastSpreadBps + delta` |
 *
 * Rejects parameters that would break monotonicity (`yoloBps ≥ -fastSpreadBps`,
 * `deltaBps ≥ 2 * fastSpreadBps`) or push the endpoint above `MAX_DELTA_BPS`.
 */
export function maximizing(fastSpreadBps: number, deltaBps?: number, yoloBps?: number): SpreadCurve {
    deltaBps ??= Math.max(1, Math.round(fastSpreadBps * 0.2));
    yoloBps ??= -1000;

    validateIntInDomain(fastSpreadBps, "fastSpreadBps", 1, MAX_DELTA_BPS);
    validateIntInDomain(deltaBps, "deltaBps", 1, MAX_DELTA_BPS);
    validateIntInDomain(yoloBps, "yoloBps", MIN_DELTA_BPS, MAX_DELTA_BPS);

    if (yoloBps >= -fastSpreadBps) {
        throw new Error(
            `auto-spread requires yoloBps (${yoloBps}) < -fastSpreadBps (${-fastSpreadBps})`
        );
    }
    if (deltaBps >= 2 * fastSpreadBps) {
        throw new Error(
            `auto-spread requires deltaBps (${deltaBps}) < 2 * fastSpreadBps (${2 * fastSpreadBps})`
        );
    }
    if (fastSpreadBps + deltaBps > MAX_DELTA_BPS) {
        throw new Error(
            `fastSpreadBps + deltaBps = ${fastSpreadBps + deltaBps} exceeds MAX_DELTA_BPS=${MAX_DELTA_BPS}`
        );
    }

    return {
        startDeltaBps: yoloBps,
        endDeltaBps: fastSpreadBps + deltaBps,
        points: [
            { windowBps: 1000, deltaBps: -fastSpreadBps },
            { windowBps: 5000, deltaBps: fastSpreadBps - deltaBps },
        ],
    };
}

function validateIntInDomain(n: number, name: string, min: number, max: number): void {
    if (!Number.isInteger(n)) {
        throw new Error(`${name} must be an integer, got ${n}`);
    }
    if (n < min || n > max) {
        throw new Error(`${name} must be in [${min}, ${max}], got ${n}`);
    }
}
