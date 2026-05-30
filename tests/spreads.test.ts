import { describe, expect, it } from "@jest/globals";
import {
    MAX_DELTA_BPS,
    MAX_WINDOW_BPS,
    MIN_DELTA_BPS,
    MIN_WINDOW_BPS,
} from "../src/constants";
import { SpreadCurve } from "../src/models";
import * as spreads from "../src/spreads";
import { validateSpreadCurve } from "../src/validation";

const WINDOW_END_BPS = 10_000;

function curveKnots(
    curve: SpreadCurve
): Array<{ windowBps: number; deltaBps: number }> {
    return [
        { windowBps: 0, deltaBps: curve.startDeltaBps },
        ...curve.points,
        { windowBps: WINDOW_END_BPS, deltaBps: curve.endDeltaBps },
    ];
}

function assertCurveWithinBounds(curve: SpreadCurve): void {
    expect(Number.isInteger(curve.startDeltaBps)).toBe(true);
    expect(curve.startDeltaBps).toBeGreaterThanOrEqual(MIN_DELTA_BPS);
    expect(curve.startDeltaBps).toBeLessThanOrEqual(MAX_DELTA_BPS);
    for (const point of curve.points) {
        expect(Number.isInteger(point.windowBps)).toBe(true);
        expect(point.windowBps).toBeGreaterThanOrEqual(MIN_WINDOW_BPS);
        expect(point.windowBps).toBeLessThanOrEqual(MAX_WINDOW_BPS);
        expect(Number.isInteger(point.deltaBps)).toBe(true);
        expect(point.deltaBps).toBeGreaterThanOrEqual(MIN_DELTA_BPS);
        expect(point.deltaBps).toBeLessThanOrEqual(MAX_DELTA_BPS);
    }
    expect(Number.isInteger(curve.endDeltaBps)).toBe(true);
    expect(curve.endDeltaBps).toBeGreaterThanOrEqual(MIN_DELTA_BPS);
    expect(curve.endDeltaBps).toBeLessThanOrEqual(MAX_DELTA_BPS);
}

function assertStrictlyIncreasingWindowBps(curve: SpreadCurve): void {
    let prev = 0;
    for (const point of curve.points) {
        expect(point.windowBps).toBeGreaterThan(prev);
        prev = point.windowBps;
    }
    expect(prev).toBeLessThan(WINDOW_END_BPS);
}

function assertStrictlyIncreasingDeltas(curve: SpreadCurve): void {
    let prev = curve.startDeltaBps;
    for (const point of curve.points) {
        expect(point.deltaBps).toBeGreaterThan(prev);
        prev = point.deltaBps;
    }
    expect(curve.endDeltaBps).toBeGreaterThan(prev);
}

describe("spreads", () => {
    describe("constant", () => {
        it("returns a flat curve with no interior points", () => {
            expect(spreads.constant(500)).toEqual({
                startDeltaBps: 500,
                endDeltaBps: 500,
                points: [],
            });
        });
    });

    describe("fast", () => {
        it("builds the documented three-segment curve", () => {
            expect(spreads.fast(100, 10)).toEqual({
                startDeltaBps: -100,
                points: [
                    { windowBps: 1000, deltaBps: 100 },
                    { windowBps: 8000, deltaBps: 110 },
                ],
                endDeltaBps: 210,
            });
        });

        it.each([
            [1, 0],
            [100, 10],
            [MAX_DELTA_BPS, 10],
        ])(
            "fastSpreadBps=%i feeBps=%i stays within bounds",
            (fastSpreadBps, feeBps) => {
                const curve = spreads.fast(fastSpreadBps, feeBps);
                expect(curve.startDeltaBps).toBe(-fastSpreadBps);
                assertCurveWithinBounds(curve);
                assertStrictlyIncreasingWindowBps(curve);
            }
        );

        it("passes validateSpreadCurve", () => {
            expect(() =>
                validateSpreadCurve(spreads.fast(100, 10), "fast")
            ).not.toThrow();
        });

        it("rejects invalid parameters", () => {
            expect(() => spreads.fast(0, 10)).toThrow(/fastSpreadBps must be in/);
            expect(() => spreads.fast(-1, 10)).toThrow(/fastSpreadBps must be in/);
            expect(() => spreads.fast(MAX_DELTA_BPS + 1, 10)).toThrow(
                /fastSpreadBps must be in/
            );
            expect(() => spreads.fast(10.5, 10)).toThrow(
                /fastSpreadBps must be an integer/
            );
            expect(() => spreads.fast(10, 1.5)).toThrow(/feeBps must be an integer/);
            expect(() => spreads.fast(100, -1)).toThrow(/feeBps must be in/);
        });

        it("produces a monotonically non-decreasing curve", () => {
            const curve = spreads.fast(200, 15);
            const deltas = curveKnots(curve).map((k) => k.deltaBps);
            for (let i = 1; i < deltas.length; i++) {
                expect(deltas[i]).toBeGreaterThanOrEqual(deltas[i - 1]);
            }
        });
    });

    describe("maximizing", () => {
        it("uses default delta and yolo when omitted", () => {
            expect(spreads.maximizing(100)).toEqual({
                startDeltaBps: -1000,
                endDeltaBps: 120,
                points: [
                    { windowBps: 1000, deltaBps: -100 },
                    { windowBps: 5000, deltaBps: 80 },
                ],
            });
        });

        it("offsets the endpoint by the raw fee without scaling the buffer", () => {
            // buffer = max(1, round(100 * 0.2)) = 20 (raw spread only).
            // endpoint = 100 + 20 + 13 (raw fee, flat offset) = 133.
            expect(spreads.maximizing(100, undefined, undefined, 13)).toEqual({
                startDeltaBps: -1000,
                endDeltaBps: 133,
                points: [
                    { windowBps: 1000, deltaBps: -100 },
                    { windowBps: 5000, deltaBps: 80 },
                ],
            });
        });

        it("rejects a non-integer or negative feeBps", () => {
            expect(() => spreads.maximizing(100, undefined, undefined, 1.5)).toThrow(
                /feeBps must be an integer/
            );
            expect(() => spreads.maximizing(100, undefined, undefined, -1)).toThrow(
                /feeBps must be in/
            );
        });

        it("counts the fee against MAX_DELTA_BPS at the endpoint", () => {
            expect(() =>
                spreads.maximizing(9000, 998, undefined, 2)
            ).toThrow(/exceeds MAX_DELTA_BPS/);
        });

        it("honours custom deltaBps and yoloBps", () => {
            expect(spreads.maximizing(500, 50, -2000)).toEqual({
                startDeltaBps: -2000,
                endDeltaBps: 550,
                points: [
                    { windowBps: 1000, deltaBps: -500 },
                    { windowBps: 5000, deltaBps: 450 },
                ],
            });
        });

        it.each([1, 100, MAX_DELTA_BPS - 1])(
            "fastSpreadBps=%i with defaults stays within bounds",
            (fastSpreadBps) => {
                const curve = spreads.maximizing(fastSpreadBps);
                assertCurveWithinBounds(curve);
                assertStrictlyIncreasingWindowBps(curve);
                assertStrictlyIncreasingDeltas(curve);
            }
        );

        it("passes validateSpreadCurve", () => {
            expect(() =>
                validateSpreadCurve(spreads.maximizing(100), "maximizing")
            ).not.toThrow();
        });

        it("accepts boundary parameters", () => {
            expect(spreads.maximizing(100, 20, -101).startDeltaBps).toBe(-101);

            const maxDelta = spreads.maximizing(100, 199);
            expect(maxDelta.points[1]).toEqual({ windowBps: 5000, deltaBps: -99 });
            expect(maxDelta.endDeltaBps).toBe(299);
            assertCurveWithinBounds(maxDelta);
        });

        it("rejects invalid parameters", () => {
            expect(() => spreads.maximizing(0)).toThrow(/fastSpreadBps must be in/);
            expect(() => spreads.maximizing(-10)).toThrow(/fastSpreadBps must be in/);
            expect(() => spreads.maximizing(MAX_DELTA_BPS)).toThrow(
                /fastSpreadBps must be in/
            );
            expect(() => spreads.maximizing(100, 5.5)).toThrow(
                /bufferBps must be an integer/
            );
            expect(() => spreads.maximizing(1000, 50, -1000)).toThrow(
                /yoloBps .* < -fastSpreadBps/
            );
            expect(() => spreads.maximizing(1000, undefined, -999)).toThrow(
                /yoloBps .* < -fastSpreadBps/
            );
            expect(() => spreads.maximizing(100, 200)).toThrow(
                /bufferBps .* < 2 \* fastSpreadBps/
            );
            expect(() => spreads.maximizing(8000, 2500, -9000)).toThrow(
                /exceeds MAX_DELTA_BPS/
            );
        });

        it("rounds default delta to at least 1 for tiny spreads", () => {
            const curve = spreads.maximizing(1);
            expect(curve.points[1].deltaBps).toBe(0);
            assertCurveWithinBounds(curve);
        });
    });

    describe("auto", () => {
        it("delegates to fast for durationSecs <= 300", () => {
            expect(spreads.auto({ fastSpreadBps: 100, durationSecs: 300 })).toEqual(
                spreads.fast(100, 10)
            );
            expect(spreads.auto({ fastSpreadBps: 100, durationSecs: 60 })).toEqual(
                spreads.fast(100, 10)
            );
        });

        it("delegates to maximizing for durationSecs > 300, offsetting by the default fee", () => {
            expect(spreads.auto({ fastSpreadBps: 100, durationSecs: 301 })).toEqual(
                spreads.maximizing(100, undefined, undefined, 10)
            );
            expect(spreads.auto({ fastSpreadBps: 100 })).toEqual(
                spreads.maximizing(100, undefined, undefined, 10)
            );
        });

        it("passes custom feeBps to fast for short orders", () => {
            expect(
                spreads.auto({ fastSpreadBps: 100, durationSecs: 120, feeBps: 25 })
            ).toEqual(spreads.fast(100, 25));
        });

        it("passes custom feeBps to maximizing for long orders", () => {
            expect(
                spreads.auto({ fastSpreadBps: 100, durationSecs: 3600, feeBps: 25 })
            ).toEqual(spreads.maximizing(100, undefined, undefined, 25));
        });

        it("uses default duration 600 and fee 10", () => {
            expect(spreads.auto({ fastSpreadBps: 50 })).toEqual(
                spreads.maximizing(50, undefined, undefined, 10)
            );
            expect(spreads.auto({ fastSpreadBps: 50, durationSecs: 120 })).toEqual(
                spreads.fast(50, 10)
            );
        });

        it("rejects non-positive fastSpreadBps", () => {
            expect(() => spreads.auto({ fastSpreadBps: 0 })).toThrow(
                /fastSpreadBps must be in/
            );
            expect(() => spreads.auto({ fastSpreadBps: -10 })).toThrow(
                /fastSpreadBps must be in/
            );
        });
    });
});
