import { bigIntSqrt, computeSqrtPriceX96 } from "../src/math";

describe("bigIntSqrt", () => {
    test("handles small exact squares", () => {
        expect(bigIntSqrt(0n)).toBe(0n);
        expect(bigIntSqrt(1n)).toBe(1n);
        expect(bigIntSqrt(4n)).toBe(2n);
        expect(bigIntSqrt(9n)).toBe(3n);
        expect(bigIntSqrt(16n)).toBe(4n);
    });

    test("handles small non-squares (floors)", () => {
        expect(bigIntSqrt(2n)).toBe(1n);
        expect(bigIntSqrt(3n)).toBe(1n);
        expect(bigIntSqrt(5n)).toBe(2n);
        expect(bigIntSqrt(8n)).toBe(2n);
        expect(bigIntSqrt(15n)).toBe(3n);
    });

    test("property: x^2 <= n < (x+1)^2 for random values", () => {
        const rand = (bits: number): bigint => {
            const bytes = Math.ceil(bits / 8);
            let acc = 0n;
            for (let i = 0; i < bytes; i++) {
                acc = (acc << 8n) + BigInt(Math.floor(Math.random() * 256));
            }
            return acc;
        };

        for (let i = 0; i < 50; i++) {
            const n = rand(256); // up to 256-bit numbers
            const x = bigIntSqrt(n);
            expect(x * x).toBeLessThanOrEqual(n);
            expect((x + 1n) * (x + 1n)).toBeGreaterThan(n);
        }
    });

    test("throws on negative", () => {
        expect(() => (bigIntSqrt as any)(-1n)).toThrow();
    });
});

describe("computeSqrtPriceX96", () => {
    const Q96 = 2n ** 96n;

    test("1:1 amounts returns 2^96", () => {
        const r = computeSqrtPriceX96(1000n, 1000n);
        expect(r).toBe(Q96);
    });

    test("4:9 ratio ~ 1.5 * 2^96", () => {
        const r = computeSqrtPriceX96(4n, 9n);
        // Expected = floor(1.5 * 2^96)
        const expected = (Q96 * 3n) / 2n;
        expect(r).toBe(expected);
    });

    test("scales with large numbers", () => {
        const a0 = 10_000_000_000_000_000_000n;
        const a1 = 25_000_000_000_000_000_000n;
        const r = computeSqrtPriceX96(a0, a1);
        // ratio is 2.5, sqrt ~ 1.5811 -> r ~ 1.5811 * 2^96 (floored)
        // Check property closeness by back-computing price bounds
        const priceLower = (r * r) >> 192n; // floor of (r^2 / 2^192)
        // Ensure priceLower <= a1/a0
        expect(priceLower).toBeLessThanOrEqual(a1 / a0);
        // And (r+1)^2 / 2^192 > a1/a0
        const next = r + 1n;
        const priceUpper = (next * next) >> 192n;
        expect(priceUpper).toBeGreaterThanOrEqual(a1 / a0);
    });
});


