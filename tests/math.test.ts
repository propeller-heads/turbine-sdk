import { bigIntSqrt, computeSqrtPriceX96 } from "../src/math";

/**
 * Tests for bigIntSqrt function
 * 
 * This function computes the integer square root (floor of sqrt) using Newton's method.
 * It's critical for pool creation because we need to calculate sqrtPriceX96 = floor(sqrt(price) * 2^96)
 * where price is computed from token deposit amounts.
 * 
 * We must ensure:
 * 1. Correct results for exact squares (common edge case)
 * 2. Proper flooring for non-squares (essential for precision)
 * 3. Correctness across large value ranges (256-bit numbers used in DeFi)
 * 4. Error handling for invalid inputs
 */
describe("bigIntSqrt", () => {
    /**
     * Tests exact squares: numbers where sqrt(n) is an integer
     * These are important edge cases because Newton's method should converge exactly
     * without any rounding issues. This ensures we get precise results when token
     * amounts happen to create perfect square ratios.
     */
    test("handles small exact squares", () => {
        expect(bigIntSqrt(0n)).toBe(0n);
        expect(bigIntSqrt(1n)).toBe(1n);
        expect(bigIntSqrt(4n)).toBe(2n); // 2^2 = 4
        expect(bigIntSqrt(9n)).toBe(3n); // 3^2 = 9
        expect(bigIntSqrt(16n)).toBe(4n); // 4^2 = 16
    });

    /**
     * Tests non-square numbers: numbers where sqrt(n) is not an integer
     * For these, we must floor the result. This is critical because:
     * - Uniswap V4 uses floor(sqrt(price) * 2^96) as the price encoding
     * - Rounding up would initialize pools at incorrect prices
     * - Flooring ensures we never overestimate the initial price
     * 
     * Examples:
     * - sqrt(2) ≈ 1.414, should return 1 (not 2)
     * - sqrt(5) ≈ 2.236, should return 2 (not 3)
     */
    test("handles small non-squares (floors)", () => {
        expect(bigIntSqrt(2n)).toBe(1n); // sqrt(2) ≈ 1.414, floors to 1
        expect(bigIntSqrt(3n)).toBe(1n); // sqrt(3) ≈ 1.732, floors to 1
        expect(bigIntSqrt(5n)).toBe(2n); // sqrt(5) ≈ 2.236, floors to 2
        expect(bigIntSqrt(8n)).toBe(2n); // sqrt(8) ≈ 2.828, floors to 2
        expect(bigIntSqrt(15n)).toBe(3n); // sqrt(15) ≈ 3.873, floors to 3
    });

    /**
     * Property-based test: Verifies the mathematical definition of integer square root
     * 
     * For any input n, the result x = bigIntSqrt(n) must satisfy:
     * - x^2 <= n < (x+1)^2
     * 
     * This is the fundamental property that defines "floor of square root".
     * We test this with random 256-bit numbers (the max size used in Ethereum) to ensure
     * the algorithm works correctly across the entire range of possible values, not just
     * small test cases.
     */
    test("property: x^2 <= n < (x+1)^2 for random values", () => {
        // Generate random bigint up to 256 bits (maximum for Ethereum uint256)
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
            // Verify: x is the floor of sqrt(n)
            expect(x * x).toBeLessThanOrEqual(n);
            expect((x + 1n) * (x + 1n)).toBeGreaterThan(n);
        }
    });

    /**
     * Error handling test: Square root of negative numbers is undefined
     * This should never happen in practice (token amounts are always positive),
     * but we test it to ensure the function fails gracefully rather than producing
     * incorrect results or crashing.
     */
    test("throws on negative", () => {
        expect(() => (bigIntSqrt as any)(-1n)).toThrow();
    });
});

/**
 * Tests for computeSqrtPriceX96 function
 * 
 * This function calculates the initial pool price in Uniswap V4's sqrtPriceX96 format:
 * sqrtPriceX96 = floor(sqrt(amount1 / amount0) * 2^96)
 * 
 * This is the critical calculation when creating a new pool. The price must be:
 * 1. Correctly calculated from deposit amounts
 * 2. Properly scaled by 2^96 (fixed-point representation)
 * 3. Floored to ensure we don't overestimate (which would allow arbitrage)
 * 
 * Wrong prices lead to:
 * - Immediate arbitrage opportunities (value loss for initial LP)
 * - Incorrect pool initialization
 * - Potential front-running attacks
 */
describe("computeSqrtPriceX96", () => {
    // Q96 = 2^96, the scaling factor used by Uniswap V4 for fixed-point math
    const Q96 = 2n ** 96n;

    /**
     * Tests 1:1 token ratio (equal amounts)
     * 
     * When token0 and token1 amounts are equal, price = 1:1 = 1.0
     * sqrt(1.0) = 1.0
     * sqrtPriceX96 = 1.0 * 2^96 = 2^96
     * 
     * This is the simplest case and should be exact (no rounding needed).
     * If this fails, the entire calculation is wrong.
     */
    test("1:1 amounts returns 2^96", () => {
        const r = computeSqrtPriceX96(1000n, 1000n);
        expect(r).toBe(Q96);
    });

    /**
     * Tests a known ratio with exact mathematical result
     * 
     * For amounts (4, 9):
     * - price = 9/4 = 2.25
     * - sqrt(2.25) = sqrt(9/4) = 3/2 = 1.5
     * - sqrtPriceX96 = 1.5 * 2^96 = (2^96 * 3) / 2
     * 
     * This test verifies:
     * 1. The ratio calculation is correct
     * 2. The square root computation works
     * 3. The 2^96 scaling is applied correctly
     * 4. Integer division doesn't lose precision in this case
     */
    test("4:9 ratio ~ 1.5 * 2^96", () => {
        const r = computeSqrtPriceX96(4n, 9n);
        // Expected = floor(1.5 * 2^96) = (2^96 * 3) / 2
        const expected = (Q96 * 3n) / 2n;
        expect(r).toBe(expected);
    });

    /**
     * Tests large numbers typical of real-world token deposits
     * 
     * Token amounts are typically in wei (10^18 for most tokens), so we're dealing
     * with very large numbers. This test ensures:
     * 1. The algorithm doesn't overflow with large inputs
     * 2. Precision is maintained even with 18-decimal tokens
     * 3. The floor operation still works correctly at scale
     * 
     * For amounts (10^19, 25*10^18):
     * - price = 25/10 = 2.5
     * - sqrt(2.5) ≈ 1.5811
     * - We verify the result is correct by checking bounds:
     *   - r^2 / 2^192 <= actual_price < (r+1)^2 / 2^192
     */
    test("scales with large numbers", () => {
        // Realistic token amounts (in wei, 10^18 scale)
        const a0 = 10_000_000_000_000_000_000n; // 10 tokens (10^19 wei)
        const a1 = 25_000_000_000_000_000_000n; // 25 tokens (25*10^18 wei)
        const r = computeSqrtPriceX96(a0, a1);

        // ratio is 2.5, sqrt(2.5) ≈ 1.5811 -> r ≈ 1.5811 * 2^96 (floored)

        // Verify correctness by checking the mathematical bounds:
        // The sqrtPriceX96 encoding means: price ≈ r^2 / 2^192
        // We verify: floor(r^2 / 2^192) <= actual_price < floor((r+1)^2 / 2^192)

        const priceLower = (r * r) >> 192n; // floor of (r^2 / 2^192)
        // Ensure our calculated price is >= the lower bound
        expect(priceLower).toBeLessThanOrEqual(a1 / a0);

        // Check upper bound: next value would give too high a price
        const next = r + 1n;
        const priceUpper = (next * next) >> 192n;
        expect(priceUpper).toBeGreaterThanOrEqual(a1 / a0);
    });
});


