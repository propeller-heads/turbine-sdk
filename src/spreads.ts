import { SpreadCurve } from "./models";

/**
 * Helpers for building {@link SpreadCurve} values.
 *
 * The curve is order-window-relative: `windowBps` runs from `0` (order start) to
 * `10_000` (order end), with interior points strictly inside `(0, 10_000)`.
 * `deltaBps` is a signed integer in `[-10_000, 10_000)`.
 */

/** A flat curve that returns the same delta across the entire order window. */
export function constant(deltaBps: number): SpreadCurve {
    return {
        startDeltaBps: deltaBps,
        endDeltaBps: deltaBps,
        points: [],
    };
}
