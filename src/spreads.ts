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
    validateIntInDomain(deltaBps, "deltaBps", MIN_DELTA_BPS, MAX_DELTA_BPS);
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
    /** Duration of the order in seconds */
    durationSecs: number;
    /** Fee in basis points */
    feeBps: number;
}

export interface AutoSpreadResult {
    curve: SpreadCurve;
    strategy: "fast" | "maximizing";
    metadata: SpreadCurveMetadata;
}

export interface SpreadResult {
    curve: SpreadCurve;
    metadata: SpreadCurveMetadata;
}

export interface SpreadCurveMetadata {
    realisticSpreadComponents: {
        fastSpreadBps: number;
        feeBps: number;
        bufferBps: number;
    };
    maxSpreadComponents: {
        fastSpreadBps: number;
        feeBps: number;
        bufferBps: number;
    };
}

export function auto(params: AutoSpreadParams): AutoSpreadResult {
    if (params.durationSecs <= 300) {
        const { curve, metadata } = fast(params.fastSpreadBps, params.feeBps);
        return {
            curve,
            strategy: "fast",
            metadata,
        };
    } else {
        const { curve, metadata } = maximizing(params.fastSpreadBps, params.feeBps);
        return {
            curve,
            strategy: "maximizing",
            metadata,
        };
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
 * @returns The spread curve and metadata.
 */
export function fast(fastSpreadBps: number, feeBps: number): SpreadResult {
    validateIntInDomain(fastSpreadBps, "fastSpreadBps", 1, MAX_DELTA_BPS);
    validateIntInDomain(feeBps, "feeBps", 0, Number.POSITIVE_INFINITY);

    // Cap the "fee" and "buffer" components of the spread if the resulting spread would exceed MAX_DELTA_BPS.
    const effectiveFeeBps = Math.min(feeBps, MAX_DELTA_BPS - fastSpreadBps);
    const bufferBps = Math.min(
        fastSpreadBps,
        MAX_DELTA_BPS - fastSpreadBps - effectiveFeeBps
    );
    const curve: SpreadCurve = {
        startDeltaBps: -fastSpreadBps,
        points: [
            { windowBps: 1000, deltaBps: fastSpreadBps },
            {
                windowBps: 8000,
                deltaBps: fastSpreadBps + effectiveFeeBps, // i.e. fastSpreadBps + feeBps, but capped to MAX_DELTA_BPS
            },
        ],
        endDeltaBps: fastSpreadBps + effectiveFeeBps + bufferBps, // i.e. fastSpreadBps * 2 + feeBps, but capped to MAX_DELTA_BPS
    } as SpreadCurve;
    return {
        curve,
        metadata: {
            realisticSpreadComponents: {
                fastSpreadBps,
                feeBps: effectiveFeeBps,
                bufferBps: 0,
            },
            maxSpreadComponents: {
                fastSpreadBps,
                feeBps: effectiveFeeBps,
                bufferBps,
            },
        },
    };
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
 * | 5000      | `fastSpreadBps + feeBps - bufferBps` |
 * | 10000     | `fastSpreadBps + feeBps + bufferBps` |
 *
 * Rejects parameters that would break monotonicity (`yoloBps ≥ -fastSpreadBps`,
 * `deltaBps ≥ 2 * fastSpreadBps`) or push the endpoint above `MAX_DELTA_BPS`.
 */
export function maximizing(
    fastSpreadBps: number,
    feeBps: number,
    bufferBps?: number,
    yoloBps?: number
): SpreadResult {
    bufferBps ??= Math.min(
        MAX_DELTA_BPS - fastSpreadBps - feeBps,
        Math.max(1, Math.round(fastSpreadBps * 0.2))
    );
    yoloBps ??= Math.min(-fastSpreadBps - 1, -1000);

    validateIntInDomain(fastSpreadBps, "fastSpreadBps", 1, MAX_DELTA_BPS - 1);
    validateIntInDomain(bufferBps, "bufferBps", 1, MAX_DELTA_BPS);
    validateIntInDomain(yoloBps, "yoloBps", MIN_DELTA_BPS, MAX_DELTA_BPS);
    validateIntInDomain(feeBps, "feeBps", 0, Number.POSITIVE_INFINITY);

    if (yoloBps >= -fastSpreadBps) {
        throw new Error(
            `maximizing spread requires yoloBps (${yoloBps}) < -fastSpreadBps (${-fastSpreadBps})`
        );
    }
    if (bufferBps >= 2 * fastSpreadBps) {
        throw new Error(
            `maximizing spread requires bufferBps (${bufferBps}) < 2 * fastSpreadBps (${2 * fastSpreadBps})`
        );
    }
    if (fastSpreadBps + feeBps + bufferBps > MAX_DELTA_BPS) {
        throw new Error(
            `fastSpreadBps + feeBps + bufferBps = ${fastSpreadBps + feeBps + bufferBps} exceeds MAX_DELTA_BPS=${MAX_DELTA_BPS}`
        );
    }

    const curve: SpreadCurve = {
        startDeltaBps: yoloBps,
        points: [
            { windowBps: 1000, deltaBps: -fastSpreadBps },
            { windowBps: 5000, deltaBps: fastSpreadBps + feeBps - bufferBps },
        ],
        endDeltaBps: fastSpreadBps + feeBps + bufferBps,
    };
    return {
        curve,
        metadata: {
            // "Realistic" is 75% of the order window in this case. That's when the curve
            // crosses the fast spread + fee line.
            realisticSpreadComponents: {
                fastSpreadBps,
                feeBps,
                bufferBps: 0,
            },
            maxSpreadComponents: {
                fastSpreadBps,
                feeBps,
                bufferBps,
            },
        },
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
