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
const DEFAULT_FEE_BPS = 10;

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
                curve: {
                    startDeltaBps: -100,
                    points: [
                        { windowBps: 1000, deltaBps: 100 },
                        { windowBps: 8000, deltaBps: 110 },
                    ],
                    endDeltaBps: 210,
                },
                metadata: {
                    realisticSpreadComponents: {
                        fastSpreadBps: 100,
                        feeBps: 10,
                        bufferBps: 0,
                    },
                    maxSpreadComponents: {
                        fastSpreadBps: 100,
                        feeBps: 10,
                        bufferBps: 100,
                    },
                },
            });
        });

        it.each([
            [1, 0],
            [100, 10],
            [MAX_DELTA_BPS, 10],
        ])(
            "fastSpreadBps=%i feeBps=%i stays within bounds",
            (fastSpreadBps, feeBps) => {
                const { curve } = spreads.fast(fastSpreadBps, feeBps);
                expect(curve.startDeltaBps).toBe(-fastSpreadBps);
                assertCurveWithinBounds(curve);
                assertStrictlyIncreasingWindowBps(curve);
            }
        );

        it("passes validateSpreadCurve", () => {
            expect(() =>
                validateSpreadCurve(spreads.fast(100, 10).curve, "fast")
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
            const { curve } = spreads.fast(200, 15);
            const deltas = curveKnots(curve).map((k) => k.deltaBps);
            for (let i = 1; i < deltas.length; i++) {
                expect(deltas[i]).toBeGreaterThanOrEqual(deltas[i - 1]);
            }
        });
    });

    describe("maximizing", () => {
        it("uses default buffer and yolo when omitted", () => {
            expect(spreads.maximizing(100, DEFAULT_FEE_BPS)).toEqual({
                curve: {
                    startDeltaBps: -1000,
                    endDeltaBps: 130,
                    points: [
                        { windowBps: 1000, deltaBps: -100 },
                        { windowBps: 5000, deltaBps: 90 },
                    ],
                },
                metadata: {
                    realisticSpreadComponents: {
                        fastSpreadBps: 100,
                        feeBps: DEFAULT_FEE_BPS,
                        bufferBps: 0,
                    },
                    maxSpreadComponents: {
                        fastSpreadBps: 100,
                        feeBps: DEFAULT_FEE_BPS,
                        bufferBps: 20,
                    },
                },
            });
        });

        it("honours custom bufferBps and yoloBps", () => {
            expect(spreads.maximizing(500, DEFAULT_FEE_BPS, 50, -2000)).toEqual({
                curve: {
                    startDeltaBps: -2000,
                    endDeltaBps: 560,
                    points: [
                        { windowBps: 1000, deltaBps: -500 },
                        { windowBps: 5000, deltaBps: 460 },
                    ],
                },
                metadata: {
                    realisticSpreadComponents: {
                        fastSpreadBps: 500,
                        feeBps: DEFAULT_FEE_BPS,
                        bufferBps: 0,
                    },
                    maxSpreadComponents: {
                        fastSpreadBps: 500,
                        feeBps: DEFAULT_FEE_BPS,
                        bufferBps: 50,
                    },
                },
            });
        });

        it.each([1, 100, MAX_DELTA_BPS - DEFAULT_FEE_BPS - 1])(
            "fastSpreadBps=%i with defaults stays within bounds",
            (fastSpreadBps) => {
                const { curve } = spreads.maximizing(fastSpreadBps, DEFAULT_FEE_BPS);
                assertCurveWithinBounds(curve);
                assertStrictlyIncreasingWindowBps(curve);
                assertStrictlyIncreasingDeltas(curve);
            }
        );

        it("passes validateSpreadCurve", () => {
            expect(() =>
                validateSpreadCurve(
                    spreads.maximizing(100, DEFAULT_FEE_BPS).curve,
                    "maximizing"
                )
            ).not.toThrow();
        });

        it("accepts boundary parameters", () => {
            expect(
                spreads.maximizing(100, DEFAULT_FEE_BPS, 20, -101).curve.startDeltaBps
            ).toBe(-101);

            const { curve: maxDelta } = spreads.maximizing(100, DEFAULT_FEE_BPS, 199);
            expect(maxDelta.points[1]).toEqual({ windowBps: 5000, deltaBps: -89 });
            expect(maxDelta.endDeltaBps).toBe(309);
            assertCurveWithinBounds(maxDelta);
        });

        it("rejects invalid parameters", () => {
            expect(() => spreads.maximizing(0, DEFAULT_FEE_BPS)).toThrow(
                /fastSpreadBps must be in/
            );
            expect(() => spreads.maximizing(-10, DEFAULT_FEE_BPS)).toThrow(
                /fastSpreadBps must be in/
            );
            expect(() => spreads.maximizing(MAX_DELTA_BPS, DEFAULT_FEE_BPS)).toThrow(
                /fastSpreadBps must be in/
            );
            expect(() => spreads.maximizing(100, DEFAULT_FEE_BPS, 5.5)).toThrow(
                /bufferBps must be an integer/
            );
            expect(() => spreads.maximizing(1000, DEFAULT_FEE_BPS, 50, -1000)).toThrow(
                /yoloBps .* < -fastSpreadBps/
            );
            expect(() =>
                spreads.maximizing(1000, DEFAULT_FEE_BPS, undefined, -999)
            ).toThrow(/yoloBps .* < -fastSpreadBps/);
            expect(() => spreads.maximizing(100, DEFAULT_FEE_BPS, 200)).toThrow(
                /bufferBps .* < 2 \* fastSpreadBps/
            );
            expect(() =>
                spreads.maximizing(8000, DEFAULT_FEE_BPS, 2500, -9000)
            ).toThrow(/exceeds MAX_DELTA_BPS/);
        });

        it("rounds default buffer to at least 1 for tiny spreads", () => {
            const { curve } = spreads.maximizing(1, DEFAULT_FEE_BPS);
            expect(curve.points[1].deltaBps).toBe(10);
            assertCurveWithinBounds(curve);
        });
    });

    describe("auto", () => {
        it("delegates to fast for durationSecs <= 300", () => {
            expect(spreads.auto({ fastSpreadBps: 100, durationSecs: 300 })).toEqual({
                ...spreads.fast(100, 10),
                strategy: "fast",
            });
            expect(spreads.auto({ fastSpreadBps: 100, durationSecs: 60 })).toEqual({
                ...spreads.fast(100, 10),
                strategy: "fast",
            });
        });

        it("delegates to maximizing for durationSecs > 300", () => {
            expect(spreads.auto({ fastSpreadBps: 100, durationSecs: 301 })).toEqual({
                ...spreads.maximizing(100, 10),
                strategy: "maximizing",
            });
            expect(spreads.auto({ fastSpreadBps: 100 })).toEqual({
                ...spreads.maximizing(100, 10),
                strategy: "maximizing",
            });
        });

        it("passes custom feeBps to fast for short orders", () => {
            expect(
                spreads.auto({ fastSpreadBps: 100, durationSecs: 120, feeBps: 25 })
            ).toEqual({
                ...spreads.fast(100, 25),
                strategy: "fast",
            });
        });

        it("uses default duration 600 and fee 10", () => {
            expect(spreads.auto({ fastSpreadBps: 50 })).toEqual({
                ...spreads.maximizing(50, 10),
                strategy: "maximizing",
            });
            expect(spreads.auto({ fastSpreadBps: 50, durationSecs: 120 })).toEqual({
                ...spreads.fast(50, 10),
                strategy: "fast",
            });
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
