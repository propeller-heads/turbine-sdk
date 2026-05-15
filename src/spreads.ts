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
    /** Opportunity-zone half-width in basis points. Default: `max(1, round(fastSpreadBps * 0.1))`. */
    deltaBps?: number;
    /** Starting depth in basis points; the curve starts at `-yoloBps`. Default: `1000`. */
    yoloBps?: number;
}

/**
 * Four-knot piecewise-linear "auto" spread curve.
 *
 * Anchors:
 *
 * | windowBps | deltaBps                |
 * |-----------|-------------------------|
 * | 0         | `-yoloBps`              |
 * | 1000      | `-fastSpreadBps`        |
 * | 5000      | `fastSpreadBps - delta` |
 * | 10000     | `fastSpreadBps + delta` |
 *
 * Rejects parameters that would break monotonicity (`yoloBps ≤ fastSpreadBps`,
 * `deltaBps ≥ 2 * fastSpreadBps`) or push the endpoint above `MAX_DELTA_BPS`.
 */
export function auto(params: AutoSpreadParams): SpreadCurve {
    const fastSpreadBps = params.fastSpreadBps;
    const deltaBps = params.deltaBps ?? Math.max(1, Math.round(fastSpreadBps * 0.1));
    const yoloBps = params.yoloBps ?? 1000;

    validatePositiveIntInDomain(fastSpreadBps, "fastSpreadBps", 1, MAX_DELTA_BPS);
    validatePositiveIntInDomain(deltaBps, "deltaBps", 1, MAX_DELTA_BPS);
    validatePositiveIntInDomain(yoloBps, "yoloBps", 1, -MIN_DELTA_BPS);

    if (yoloBps <= fastSpreadBps) {
        throw new Error(
            `auto-spread requires yoloBps (${yoloBps}) > fastSpreadBps (${fastSpreadBps})`
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
        startDeltaBps: -yoloBps,
        endDeltaBps: fastSpreadBps + deltaBps,
        points: [
            { windowBps: 1000, deltaBps: -fastSpreadBps },
            { windowBps: 5000, deltaBps: fastSpreadBps - deltaBps },
        ],
    };
}

function validatePositiveIntInDomain(
    n: number,
    name: string,
    min: number,
    max: number
): void {
    if (!Number.isInteger(n)) {
        throw new Error(`${name} must be an integer, got ${n}`);
    }
    if (n < min || n > max) {
        throw new Error(`${name} must be in [${min}, ${max}], got ${n}`);
    }
}
