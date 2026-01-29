import { describe, expect, test } from "@jest/globals";
import { Token } from "../src/models";
import { formatUnits, parseUnits } from "viem";

describe("Token precision handling", () => {
    const USDC = new Token("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", 6, "USDC");
    const WETH = new Token("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 18, "WETH");

    describe("toOnchainAmount/fromOnchainAmount preserve precision", () => {
        test("small values roundtrip correctly", () => {
            const original = "2363";
            const onchain = WETH.toOnchainAmount(original);
            const back = WETH.fromOnchainAmount(onchain);

            expect(back).toBe(original);
        });

        test("large values preserve all precision", () => {
            // A value that would have lost precision with number type
            const largeValue = "123456789123456789.123456789123456789";
            const onchain = WETH.toOnchainAmount(largeValue);
            const back = WETH.fromOnchainAmount(onchain);

            expect(back).toBe(largeValue);
        });

        test("works correctly for typical token amounts", () => {
            // USDC with 6 decimals
            const usdcAmount = "1000000.5"; // 1 million USDC
            const onchain = USDC.toOnchainAmount(usdcAmount);
            expect(onchain).toBe(1000000500000n);
            expect(USDC.fromOnchainAmount(onchain)).toBe(usdcAmount);

            // WETH with 18 decimals
            const wethAmount = "123.456789012345678901";
            const onchainWeth = WETH.toOnchainAmount(wethAmount);
            expect(WETH.fromOnchainAmount(onchainWeth)).toBe(wethAmount);
        });
    });

    describe("Precision loss tests", () => {
        test("these methods are safe for all calculations", () => {
            // Calculate a fee or price using these methods
            const price = "2363.123456789012345678";
            const quantity = "1000";

            // Convert price to onchain, multiply, then convert back
            const priceOnchain = WETH.toOnchainAmount(price);
            const quantityValue = BigInt(quantity);
            const totalOnchain = priceOnchain * quantityValue;
            const totalDisplay = WETH.fromOnchainAmount(totalOnchain);

            // Verify precision is maintained
            expect(totalDisplay).toBe("2363123.456789012345678");
        });

        test("handles edge cases without precision loss", () => {
            // Very small amounts
            const tiny = "0.000000000000000001";
            expect(WETH.fromOnchainAmount(WETH.toOnchainAmount(tiny))).toBe(tiny);

            // Very large amounts
            const huge = "999999999999999999.999999999999999999";
            expect(WETH.fromOnchainAmount(WETH.toOnchainAmount(huge))).toBe(huge);

            // Amounts with many decimal places
            const precise = "123.456789012345678901234567890123456789";
            // Note: will be truncated to 18 decimals (WETH precision)
            expect(WETH.fromOnchainAmount(WETH.toOnchainAmount(precise))).toBe(
                "123.456789012345678901"
            );
        });
    });
});
