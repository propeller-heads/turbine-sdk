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
    /** Per-order fee in basis points. */
    feeBps: number;
    /**
     * Signed starting delta in basis points. Default: `-(fastSpreadBps + feeBps) * 3`.
     */
    yoloBps?: number;
}

/**
 * Four-knot piecewise-linear "auto" spread curve.
 *
 * Anchors (`g = fastSpreadBps + feeBps`):
 *
 * | windowBps | deltaBps          |
 * |-----------|-------------------|
 * | 0         | `yoloBps`         |
 * | 1000      | `round(-g / 2)`   |
 * | 7500      | `g`               |
 * | 10000     | `2 * g`           |
 *
 * Rejects parameters that would break monotonicity (`yoloBps` not strictly below
 * the second knot) or push the endpoint above `MAX_DELTA_BPS`.
 */
export function auto(params: AutoSpreadParams): SpreadCurve {
    const fastSpreadBps = params.fastSpreadBps;
    const feeBps = params.feeBps;

    validateIntInDomain(fastSpreadBps, "fastSpreadBps", 1, MAX_DELTA_BPS);
    validateIntInDomain(feeBps, "feeBps", 0, MAX_DELTA_BPS);

    const grossBps = fastSpreadBps + feeBps;
    const yoloBps = params.yoloBps ?? -grossBps * 3;
    validateIntInDomain(yoloBps, "yoloBps", MIN_DELTA_BPS, MAX_DELTA_BPS);

    const halfBps = Math.round(-grossBps / 2) || 0;
    const endBps = 2 * grossBps;

    if (yoloBps >= halfBps) {
        throw new Error(
            `auto-spread requires yoloBps (${yoloBps}) < second knot (${halfBps})`
        );
    }
    if (endBps > MAX_DELTA_BPS) {
        throw new Error(
            `2 * (fastSpreadBps + feeBps) = ${endBps} exceeds MAX_DELTA_BPS=${MAX_DELTA_BPS}`
        );
    }

    return {
        startDeltaBps: yoloBps,
        endDeltaBps: endBps,
        points: [
            { windowBps: 1000, deltaBps: halfBps },
            { windowBps: 7500, deltaBps: grossBps },
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
