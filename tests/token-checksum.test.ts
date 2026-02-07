import { Token } from "../src/models";

describe("Token address checksum validation (EIP55 checksum without the chainID)", () => {
    const validChecksummedAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC
    const validLowercaseAddress = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"; // USDC lowercase
    const invalidChecksumAddress = "0xA0B86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // Wrong checksum (first 'b' should be lowercase)

    it("should accept valid checksummed address", () => {
        expect(() => {
            new Token(validChecksummedAddress as any, 6, "USDC");
        }).not.toThrow();
    });

    it("should accept valid lowercase address", () => {
        expect(() => {
            new Token(validLowercaseAddress as any, 6, "USDC");
        }).not.toThrow();
    });

    it("should reject address with invalid checksum", () => {
        expect(() => {
            new Token(invalidChecksumAddress as any, 6, "USDC");
        }).toThrow(/address is not a valid Ethereum address/);
    });

    it("should reject invalid address format", () => {
        expect(() => {
            new Token("not-an-address" as any, 6, "USDC");
        }).toThrow(/address is not a valid Ethereum address/);
    });

    it("should reject address without 0x prefix", () => {
        expect(() => {
            new Token("A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as any, 6, "USDC");
        }).toThrow(/address is not a valid Ethereum address/);
    });

    it("should reject address with wrong length", () => {
        expect(() => {
            new Token("0xA0b86991c6218b36c1d19D4a2e9Eb0cE360" as any, 6, "USDC");
        }).toThrow(/address is not a valid Ethereum address/);
    });
});
