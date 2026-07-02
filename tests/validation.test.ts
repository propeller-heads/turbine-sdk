import { describe, expect, it } from "@jest/globals";
import { Address, Hex } from "viem";
import { TurbineError } from "../src/errorHandling";
import {
    MAX_SPREAD_CURVE_POINTS,
    NULL_ADDRESS,
    USDC,
    WBTC,
    WETH,
} from "../src/constants";
import {
    validateNumber,
    validatePositiveBigInt,
    validateAddress,
    validateHash,
    validateSignatureHex,
    validateFee,
    validateSpreadCurve,
    validateTimeRange,
    validateTokenPair,
    validateOrderIntent,
    validateAddLiquidityIntent,
    validateRemoveLiquidityIntent,
    validateSignedBatchSignatureTransfer,
    validateString,
    validateBoolean,
    validatePositiveNumber,
    validateBlockNumber,
    validateBigIntConvertible,
    validateBigInt,
    validateObject,
    validateHex,
    validateTimestamp,
    validatePrimitiveSignature,
    validateArray,
    validateNonEmptyArray,
    validateFields,
    validateTokenPermissions,
    validateTokenPermissionsArray,
    validateSignedSignatureTransferOnchain,
    validateRemoveLiquidityIntentOnchain,
    validateAddLiquidityPayload,
    validatePoolData,
    validateBalanceResult,
    validateTurbineConfig,
    validateOrderExecutionResponse,
    validatePrice,
    validateOrderStateResponse,
    validateOrderDetailsResponse,
    validateLiquidityIntentStateResponse,
    hexToSignature,
    parseSignatureBytes,
    signatureToComponents,
    bytesToBigInt,
} from "../src/validation";
import {
    ACCOUNT,
    VALID_HASH,
    INVALID_ADDRESS_TOO_SHORT,
    INVALID_HASH_TOO_SHORT,
    INVALID_HASH_TOO_LONG,
    INVALID_SIGNATURE_WRONG_V,
    VALID_PRIMITIVE_SIGNATURE,
    VALID_SIGNED_BATCH_SIGNATURE_TRANSFER,
    VALID_ADDRESS,
    VALID_SIGNATURE_HEX,
    VALID_TOKEN_PERMISSIONS,
    MOCK_TURBINE_CONFIG,
} from "./constants";
import * as spreads from "../src/spreads";
import { OrderIntent, AddLiquidityIntent, RemoveLiquidityIntent } from "../src/models";

describe("Validation Functions", () => {
    describe("Primitive Type Validators", () => {
        describe("validateString", () => {
            it("should validate strings correctly", () => {
                // Valid cases
                expect(validateString("hello", "testString")).toBe("hello");
                expect(validateString("", "testString")).toBe("");
                expect(validateString("123", "testString")).toBe("123");

                // Invalid: wrong type (number)
                expect(() => validateString(123 as any, "testString")).toThrow(
                    TurbineError
                );
                expect(() => validateString(123 as any, "testString")).toThrow(
                    /must be a string/
                );

                // Invalid: wrong type (object)
                expect(() => validateString({} as any, "testString")).toThrow(
                    TurbineError
                );

                // Check error details
                try {
                    validateString(null as any, "testField");
                    fail("Should have thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(TurbineError);
                    expect((error as TurbineError).code).toBe("INPUT_VALIDATION_ERROR");
                    expect((error as TurbineError).details.fieldName).toBe("testField");
                }
            });
        });

        describe("validateBoolean", () => {
            it("should validate booleans correctly", () => {
                // Valid cases
                expect(validateBoolean(true, "testBool")).toBe(true);
                expect(validateBoolean(false, "testBool")).toBe(false);

                // Invalid: wrong type (number)
                expect(() => validateBoolean(1 as any, "testBool")).toThrow(
                    TurbineError
                );
                expect(() => validateBoolean(1 as any, "testBool")).toThrow(
                    /must be a boolean/
                );

                // Invalid: wrong type (string)
                expect(() => validateBoolean("true" as any, "testBool")).toThrow(
                    TurbineError
                );

                // Check error details
                try {
                    validateBoolean(0 as any, "testField");
                    fail("Should have thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(TurbineError);
                    expect((error as TurbineError).code).toBe("INPUT_VALIDATION_ERROR");
                }
            });
        });

        describe("validateNumber", () => {
            it("should validate numbers correctly", () => {
                // Valid cases
                expect(validateNumber(42, "testNumber")).toBe(42);
                expect(validateNumber(3.14159, "testNumber")).toBe(3.14159);
                expect(validateNumber(0, "testNumber")).toBe(0);
                expect(validateNumber(-5, "testNumber")).toBe(-5);

                // Invalid: NaN
                expect(() => validateNumber(NaN, "testNumber")).toThrow(TurbineError);
                expect(() => validateNumber(NaN, "testNumber")).toThrow(
                    /must be a valid number/
                );

                // Invalid: Infinity
                expect(() => validateNumber(Infinity, "testNumber")).toThrow(
                    TurbineError
                );
                expect(() => validateNumber(Infinity, "testNumber")).toThrow(
                    /must be a finite number/
                );

                // Invalid: wrong type
                expect(() => validateNumber("123" as any, "testNumber")).toThrow(
                    TurbineError
                );
                expect(() => validateNumber("123" as any, "testNumber")).toThrow(
                    /must be a number/
                );

                // Check error details
                try {
                    validateNumber(NaN, "testField");
                    fail("Should have thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(TurbineError);
                    expect((error as TurbineError).code).toBe("INPUT_VALIDATION_ERROR");
                    expect((error as TurbineError).details.fieldName).toBe("testField");
                }
            });
        });

        describe("validatePositiveBigInt", () => {
            it("should validate positive bigints correctly", () => {
                // Valid: positive bigints
                expect(validatePositiveBigInt(1n, "testBigInt")).toBe(1n);
                expect(validatePositiveBigInt(1000000n, "testBigInt")).toBe(1000000n);
                expect(
                    validatePositiveBigInt(
                        BigInt(Number.MAX_SAFE_INTEGER) + 1n,
                        "testBigInt"
                    )
                ).toBe(BigInt(Number.MAX_SAFE_INTEGER) + 1n);

                // Invalid: zero
                expect(() => validatePositiveBigInt(0n, "testBigInt")).toThrow(
                    TurbineError
                );
                expect(() => validatePositiveBigInt(0n, "testBigInt")).toThrow(
                    /must be positive/
                );

                // Invalid: negative
                expect(() => validatePositiveBigInt(-5n, "testBigInt")).toThrow(
                    TurbineError
                );
                expect(() => validatePositiveBigInt(-5n, "testBigInt")).toThrow(
                    /must be positive/
                );

                // Invalid: wrong type
                expect(() => validatePositiveBigInt(123 as any, "testBigInt")).toThrow(
                    TurbineError
                );
                expect(() => validatePositiveBigInt(123 as any, "testBigInt")).toThrow(
                    /must be a bigint/
                );

                // Check error details
                try {
                    validatePositiveBigInt(0n, "testField");
                    fail("Should have thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(TurbineError);
                    expect((error as TurbineError).code).toBe("INPUT_VALIDATION_ERROR");
                    expect((error as TurbineError).details.fieldName).toBe("testField");
                }
            });
        });

        describe("validatePositiveNumber", () => {
            it("should validate positive numbers correctly", () => {
                // Valid cases
                expect(validatePositiveNumber(1, "testNum")).toBe(1);
                expect(validatePositiveNumber(3.14, "testNum")).toBe(3.14);
                expect(validatePositiveNumber(0.001, "testNum")).toBe(0.001);

                // Invalid: zero
                expect(() => validatePositiveNumber(0, "testNum")).toThrow(
                    TurbineError
                );
                expect(() => validatePositiveNumber(0, "testNum")).toThrow(
                    /must be positive/
                );

                // Invalid: negative
                expect(() => validatePositiveNumber(-5, "testNum")).toThrow(
                    TurbineError
                );

                // Invalid: NaN
                expect(() => validatePositiveNumber(NaN, "testNum")).toThrow(
                    TurbineError
                );
            });
        });

        describe("validateBlockNumber", () => {
            it("should validate block numbers correctly", () => {
                // Valid: number
                expect(validateBlockNumber(12345, "blockNum")).toBe(12345);

                // Valid: string that can be converted
                expect(validateBlockNumber("12345", "blockNum")).toBe(12345);

                // Invalid: zero
                expect(() => validateBlockNumber(0, "blockNum")).toThrow(TurbineError);
                expect(() => validateBlockNumber(0, "blockNum")).toThrow(
                    /must be positive/
                );

                // Invalid: negative
                expect(() => validateBlockNumber(-100, "blockNum")).toThrow(
                    TurbineError
                );

                // Invalid: wrong type (object)
                expect(() => validateBlockNumber({} as any, "blockNum")).toThrow(
                    TurbineError
                );
            });
        });

        describe("validateBigIntConvertible", () => {
            it("should validate bigint convertible values correctly", () => {
                // Valid: string
                expect(validateBigIntConvertible("12345", "testBigInt")).toBe(12345n);

                // Valid: number
                expect(validateBigIntConvertible(12345, "testBigInt")).toBe(12345n);

                // Valid: bigint
                expect(validateBigIntConvertible(12345n, "testBigInt")).toBe(12345n);

                // Invalid: non-convertible string
                expect(() => validateBigIntConvertible("abc", "testBigInt")).toThrow(
                    TurbineError
                );

                // Invalid: object
                expect(() => validateBigIntConvertible({}, "testBigInt")).toThrow(
                    TurbineError
                );

                // Invalid: type-confused values that BigInt() would silently
                // coerce to 0n/1n instead of rejecting
                expect(() => validateBigIntConvertible(true, "testBigInt")).toThrow(
                    TurbineError
                );
                expect(() => validateBigIntConvertible(false, "testBigInt")).toThrow(
                    TurbineError
                );
                expect(() => validateBigIntConvertible("", "testBigInt")).toThrow(
                    TurbineError
                );
                expect(() => validateBigIntConvertible("   ", "testBigInt")).toThrow(
                    TurbineError
                );
                expect(() => validateBigIntConvertible([], "testBigInt")).toThrow(
                    TurbineError
                );
                expect(() => validateBigIntConvertible(["5"], "testBigInt")).toThrow(
                    TurbineError
                );

                // Invalid: non-integer number
                expect(() => validateBigIntConvertible(1.5, "testBigInt")).toThrow(
                    TurbineError
                );

                // Check error details
                try {
                    validateBigIntConvertible("invalid", "testField");
                    fail("Should have thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(TurbineError);
                    expect((error as TurbineError).code).toBe("INPUT_VALIDATION_ERROR");
                }
            });
        });

        describe("validateBigInt", () => {
            it("should validate bigint values correctly", () => {
                // Valid cases
                expect(validateBigInt(0n, "testBigInt")).toBe(0n);
                expect(validateBigInt(12345n, "testBigInt")).toBe(12345n);
                expect(validateBigInt(-5n, "testBigInt")).toBe(-5n);

                // Invalid: number
                expect(() => validateBigInt(123 as any, "testBigInt")).toThrow(
                    TurbineError
                );
                expect(() => validateBigInt(123 as any, "testBigInt")).toThrow(
                    /must be a bigint/
                );

                // Invalid: string
                expect(() => validateBigInt("123" as any, "testBigInt")).toThrow(
                    TurbineError
                );

                // Check error details
                try {
                    validateBigInt(123 as any, "testField");
                    fail("Should have thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(TurbineError);
                    expect((error as TurbineError).code).toBe("INPUT_VALIDATION_ERROR");
                }
            });
        });

        describe("validateObject", () => {
            it("should validate objects correctly", () => {
                // Valid cases
                expect(validateObject({}, "testObj")).toEqual({});
                expect(validateObject({ key: "value" }, "testObj")).toEqual({
                    key: "value",
                });
                expect(validateObject([], "testObj")).toEqual([]);

                // Invalid: null
                expect(() => validateObject(null, "testObj")).toThrow(TurbineError);
                expect(() => validateObject(null, "testObj")).toThrow(
                    /must be a non-null object/
                );

                // Invalid: primitive types
                expect(() => validateObject(123 as any, "testObj")).toThrow(
                    TurbineError
                );
                expect(() => validateObject("string" as any, "testObj")).toThrow(
                    TurbineError
                );

                // Check error details
                try {
                    validateObject(null, "testField");
                    fail("Should have thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(TurbineError);
                    expect((error as TurbineError).code).toBe("INPUT_VALIDATION_ERROR");
                }
            });
        });

        describe("validateHex", () => {
            it("should validate hex strings correctly", () => {
                // Valid cases
                expect(validateHex("0x", "testHex")).toBe("0x");
                expect(validateHex("0x123abc", "testHex")).toBe("0x123abc");
                expect(validateHex("0xABCDEF", "testHex")).toBe("0xABCDEF");

                // Invalid: no 0x prefix
                expect(() => validateHex("123abc", "testHex")).toThrow(TurbineError);
                expect(() => validateHex("123abc", "testHex")).toThrow(
                    /not a valid hex string/
                );

                // Invalid: invalid characters
                expect(() => validateHex("0xGGG", "testHex")).toThrow(TurbineError);

                // Invalid: wrong type
                expect(() => validateHex(123 as any, "testHex")).toThrow(TurbineError);

                // Check error details
                try {
                    validateHex("invalid", "testField");
                    fail("Should have thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(TurbineError);
                    expect((error as TurbineError).code).toBe("INPUT_VALIDATION_ERROR");
                }
            });
        });
    });

    describe("Ethereum-Specific Validators", () => {
        describe("validateAddress", () => {
            it("should validate addresses correctly", () => {
                // Valid: checksummed address
                expect(validateAddress(USDC.address, "testAddress")).toBe(USDC.address);

                // Valid: lowercase address
                expect(validateAddress(USDC.address.toLowerCase(), "testAddress")).toBe(
                    USDC.address.toLowerCase()
                );

                // Invalid: wrong type
                expect(() => validateAddress(123 as any, "testAddress")).toThrow(
                    TurbineError
                );
                expect(() => validateAddress(123 as any, "testAddress")).toThrow(
                    /must be a string/
                );

                // Invalid: not hex
                expect(() => validateAddress("not-an-address", "testAddress")).toThrow(
                    TurbineError
                );
                expect(() => validateAddress("not-an-address", "testAddress")).toThrow(
                    /not a valid Ethereum address/
                );

                // Invalid: too short
                expect(() =>
                    validateAddress(INVALID_ADDRESS_TOO_SHORT, "testAddress")
                ).toThrow(TurbineError);
                expect(() =>
                    validateAddress(INVALID_ADDRESS_TOO_SHORT, "testAddress")
                ).toThrow(/not a valid Ethereum address/);

                // Check error details
                try {
                    validateAddress("invalid", "testField");
                    fail("Should have thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(TurbineError);
                    expect((error as TurbineError).code).toBe("INPUT_VALIDATION_ERROR");
                    expect((error as TurbineError).details.fieldName).toBe("testField");
                }
            });
        });

        describe("validateHash", () => {
            it("should validate hashes correctly", () => {
                // Valid: 32-byte hash (66 characters)
                expect(validateHash(VALID_HASH, "testHash")).toBe(VALID_HASH);

                // Invalid: wrong type
                expect(() => validateHash(123 as any, "testHash")).toThrow(
                    TurbineError
                );
                expect(() => validateHash(123 as any, "testHash")).toThrow(
                    /must be a string/
                );

                // Invalid: too short
                expect(() => validateHash(INVALID_HASH_TOO_SHORT, "testHash")).toThrow(
                    TurbineError
                );
                expect(() => validateHash(INVALID_HASH_TOO_SHORT, "testHash")).toThrow(
                    /must be a 32-byte hash/
                );

                // Invalid: too long
                expect(() => validateHash(INVALID_HASH_TOO_LONG, "testHash")).toThrow(
                    TurbineError
                );
                expect(() => validateHash(INVALID_HASH_TOO_LONG, "testHash")).toThrow(
                    /must be a 32-byte hash/
                );

                // Check error details include expectedLength
                try {
                    validateHash(INVALID_HASH_TOO_SHORT, "testField");
                    fail("Should have thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(TurbineError);
                    expect((error as TurbineError).code).toBe("INPUT_VALIDATION_ERROR");
                    expect((error as TurbineError).details.fieldName).toBe("testField");
                    expect((error as TurbineError).details.expectedLength).toBe(66);
                }
            });
        });

        describe("validateSignatureHex", () => {
            it("should validate signature hex correctly", () => {
                // Valid: v=27 (0x1b)
                const sig27 = "0x" + "1".repeat(128) + "1b";
                expect(validateSignatureHex(sig27, "testSig")).toBe(sig27);

                // Valid: v=28 (0x1c)
                const sig28 = "0x" + "1".repeat(128) + "1c";
                expect(validateSignatureHex(sig28, "testSig")).toBe(sig28);

                // Valid: v=0 (EIP-2098)
                const sig0 = "0x" + "1".repeat(128) + "00";
                expect(validateSignatureHex(sig0, "testSig")).toBe(sig0);

                // Valid: v=1 (EIP-2098)
                const sig1 = "0x" + "1".repeat(128) + "01";
                expect(validateSignatureHex(sig1, "testSig")).toBe(sig1);

                // Invalid: v=26 (0x1a)
                expect(() =>
                    validateSignatureHex(INVALID_SIGNATURE_WRONG_V, "testSig")
                ).toThrow(TurbineError);
                expect(() =>
                    validateSignatureHex(INVALID_SIGNATURE_WRONG_V, "testSig")
                ).toThrow(/invalid v value/);

                // Invalid: too short
                const tooShort = "0x" + "1".repeat(129);
                expect(() => validateSignatureHex(tooShort, "testSig")).toThrow(
                    TurbineError
                );
                expect(() => validateSignatureHex(tooShort, "testSig")).toThrow(
                    /must be a 65-byte signature/
                );

                // Check error details include vValue
                try {
                    validateSignatureHex(INVALID_SIGNATURE_WRONG_V, "testField");
                    fail("Should have thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(TurbineError);
                    expect((error as TurbineError).code).toBe("INPUT_VALIDATION_ERROR");
                    expect((error as TurbineError).details.vValue).toBe(26);
                }
            });
        });
    });

    describe("Domain-Specific Validators", () => {
        describe("validateFee", () => {
            it("should validate fee values correctly", () => {
                // Valid
                expect(validateFee(0, "fee")).toBe(0);
                expect(validateFee(3000, "fee")).toBe(3000);
                expect(validateFee(1000000, "fee")).toBe(1000000);

                // Invalid: non-integer
                expect(() => validateFee(3000.5, "fee")).toThrow(TurbineError);
                expect(() => validateFee(3000.5, "fee")).toThrow(/must be an integer/);

                // Invalid: negative
                expect(() => validateFee(-100, "fee")).toThrow(TurbineError);
                expect(() => validateFee(-100, "fee")).toThrow(
                    /must be between 0 and 1000000/
                );

                // Invalid: exceeds max
                expect(() => validateFee(1000001, "fee")).toThrow(TurbineError);
                expect(() => validateFee(1000001, "fee")).toThrow(
                    /must be between 0 and 1000000/
                );

                // Check error details
                try {
                    validateFee(-1, "testField");
                    fail("Should have thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(TurbineError);
                    expect((error as TurbineError).code).toBe("INPUT_VALIDATION_ERROR");
                    expect((error as TurbineError).details.fieldName).toBe("testField");
                }
            });
        });

        describe("validateSpreadCurve", () => {
            it("accepts a flat curve with no interior points", () => {
                const curve = {
                    startDeltaBps: 500,
                    endDeltaBps: 500,
                    points: [],
                };
                expect(validateSpreadCurve(curve, "spreadCurve")).toEqual(curve);
            });

            it("accepts a curve with strictly increasing interior points", () => {
                const curve = {
                    startDeltaBps: 100,
                    endDeltaBps: 500,
                    points: [
                        { windowBps: 2500, deltaBps: 200 },
                        { windowBps: 5000, deltaBps: 300 },
                        { windowBps: 7500, deltaBps: 400 },
                    ],
                };
                expect(validateSpreadCurve(curve, "spreadCurve")).toEqual(curve);
            });

            it("rejects deltaBps outside [-10000, 10000)", () => {
                for (const bad of [-10001, 10000, 10001]) {
                    expect(() =>
                        validateSpreadCurve(
                            { startDeltaBps: bad, endDeltaBps: 500, points: [] },
                            "spreadCurve"
                        )
                    ).toThrow(TurbineError);
                    expect(() =>
                        validateSpreadCurve(
                            { startDeltaBps: 500, endDeltaBps: bad, points: [] },
                            "spreadCurve"
                        )
                    ).toThrow(TurbineError);
                    expect(() =>
                        validateSpreadCurve(
                            {
                                startDeltaBps: 500,
                                endDeltaBps: 500,
                                points: [{ windowBps: 5000, deltaBps: bad }],
                            },
                            "spreadCurve"
                        )
                    ).toThrow(TurbineError);
                }
            });

            it("accepts zero and negative deltaBps", () => {
                expect(() =>
                    validateSpreadCurve(
                        { startDeltaBps: 0, endDeltaBps: 500, points: [] },
                        "spreadCurve"
                    )
                ).not.toThrow();
                expect(() =>
                    validateSpreadCurve(
                        { startDeltaBps: -10000, endDeltaBps: -500, points: [] },
                        "spreadCurve"
                    )
                ).not.toThrow();
                expect(() =>
                    validateSpreadCurve(
                        {
                            startDeltaBps: -1000,
                            endDeltaBps: 1000,
                            points: [{ windowBps: 5000, deltaBps: 0 }],
                        },
                        "spreadCurve"
                    )
                ).not.toThrow();
            });

            it("rejects windowBps outside [1, 9999]", () => {
                for (const bad of [0, 10000, -1, 10001]) {
                    expect(() =>
                        validateSpreadCurve(
                            {
                                startDeltaBps: 500,
                                endDeltaBps: 500,
                                points: [{ windowBps: bad, deltaBps: 500 }],
                            },
                            "spreadCurve"
                        )
                    ).toThrow(/must be in \[1, 9999\]/);
                }
            });

            it("rejects non-integer bps values", () => {
                expect(() =>
                    validateSpreadCurve(
                        { startDeltaBps: 500.5, endDeltaBps: 500, points: [] },
                        "spreadCurve"
                    )
                ).toThrow(/must be an integer/);
            });

            it("rejects non-monotonic interior points", () => {
                expect(() =>
                    validateSpreadCurve(
                        {
                            startDeltaBps: 100,
                            endDeltaBps: 500,
                            points: [
                                { windowBps: 5000, deltaBps: 200 },
                                { windowBps: 2500, deltaBps: 300 },
                            ],
                        },
                        "spreadCurve"
                    )
                ).toThrow(/strictly increasing windowBps/);
            });

            it("rejects duplicate windowBps", () => {
                expect(() =>
                    validateSpreadCurve(
                        {
                            startDeltaBps: 100,
                            endDeltaBps: 500,
                            points: [
                                { windowBps: 5000, deltaBps: 200 },
                                { windowBps: 5000, deltaBps: 300 },
                            ],
                        },
                        "spreadCurve"
                    )
                ).toThrow(/strictly increasing windowBps/);
            });

            it("rejects non-array points", () => {
                expect(() =>
                    validateSpreadCurve(
                        { startDeltaBps: 500, endDeltaBps: 500, points: "nope" },
                        "spreadCurve"
                    )
                ).toThrow(/points must be an array/);
            });

            it("rejects more than MAX_SPREAD_CURVE_POINTS points (DoS guard)", () => {
                const tooMany = Array.from({ length: 1025 }, (_, i) => ({
                    windowBps: i + 1,
                    deltaBps: 500,
                }));
                expect(() =>
                    validateSpreadCurve(
                        { startDeltaBps: 500, endDeltaBps: 500, points: tooMany },
                        "spreadCurve"
                    )
                ).toThrow(/max is 1024/);
            });

            it("accepts exactly MAX_SPREAD_CURVE_POINTS points (boundary)", () => {
                const justEnough = Array.from({ length: 1024 }, (_, i) => ({
                    windowBps: i + 1,
                    deltaBps: 500,
                }));
                expect(() =>
                    validateSpreadCurve(
                        {
                            startDeltaBps: 500,
                            endDeltaBps: 500,
                            points: justEnough,
                        },
                        "spreadCurve"
                    )
                ).not.toThrow();
            });
        });

        describe("validateTimeRange", () => {
            it("should validate time ranges correctly", () => {
                const now = BigInt(Math.floor(Date.now() / 1000));
                const later = now + 3600n;

                // Valid: start < end
                expect(() => validateTimeRange(now, later)).not.toThrow();

                // Invalid: equal times (start == end)
                expect(() => validateTimeRange(now, now)).toThrow(TurbineError);
                expect(() => validateTimeRange(now, now)).toThrow(
                    /endTime must be greater than startTime/
                );

                // Invalid: start > end
                expect(() => validateTimeRange(later, now)).toThrow(TurbineError);
                expect(() => validateTimeRange(later, now)).toThrow(
                    /endTime must be greater than startTime/
                );

                // Check error details
                try {
                    validateTimeRange(later, now);
                    fail("Should have thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(TurbineError);
                    expect((error as TurbineError).code).toBe("INPUT_VALIDATION_ERROR");
                    expect((error as TurbineError).details.startTime).toBeDefined();
                    expect((error as TurbineError).details.endTime).toBeDefined();
                }
            });
        });

        describe("validateTokenPair", () => {
            it("should validate token pairs correctly", () => {
                // Valid: distinct tokens
                expect(() =>
                    validateTokenPair(USDC.address, WETH.address)
                ).not.toThrow();

                // Invalid: same token (exact match)
                expect(() => validateTokenPair(USDC.address, USDC.address)).toThrow(
                    TurbineError
                );
                expect(() => validateTokenPair(USDC.address, USDC.address)).toThrow(
                    /must be different addresses/
                );

                // Invalid: same token (case insensitive)
                expect(() =>
                    validateTokenPair(
                        USDC.address,
                        USDC.address.toLowerCase() as Address
                    )
                ).toThrow(TurbineError);

                // Invalid: token0 is NULL_ADDRESS
                expect(() => validateTokenPair(NULL_ADDRESS, WETH.address)).toThrow(
                    TurbineError
                );
                expect(() => validateTokenPair(NULL_ADDRESS, WETH.address)).toThrow(
                    /token0 cannot be the NULL_ADDRESS/
                );

                // Invalid: token1 is NULL_ADDRESS
                expect(() => validateTokenPair(USDC.address, NULL_ADDRESS)).toThrow(
                    TurbineError
                );
                expect(() => validateTokenPair(USDC.address, NULL_ADDRESS)).toThrow(
                    /token1 cannot be the NULL_ADDRESS/
                );

                // Check error details
                try {
                    validateTokenPair(USDC.address, USDC.address);
                    fail("Should have thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(TurbineError);
                    expect((error as TurbineError).code).toBe("INPUT_VALIDATION_ERROR");
                }
            });
        });

        describe("validateTimestamp", () => {
            it("should validate timestamps correctly", () => {
                const now = BigInt(Math.floor(Date.now() / 1000));
                const future = now + 3600n;
                const past = now - 3600n;

                // Valid: any timestamp with defaults
                expect(validateTimestamp(now, "timestamp")).toBe(now);
                expect(validateTimestamp(future, "timestamp")).toBe(future);
                expect(validateTimestamp(past, "timestamp")).toBe(past);

                // Valid: future with allowFuture=true
                expect(
                    validateTimestamp(future, "timestamp", { allowFuture: true })
                ).toBe(future);

                // Valid: past with allowPast=true
                expect(validateTimestamp(past, "timestamp", { allowPast: true })).toBe(
                    past
                );

                // Invalid: negative timestamp
                expect(() => validateTimestamp(-1n, "timestamp")).toThrow(TurbineError);
                expect(() => validateTimestamp(-1n, "timestamp")).toThrow(
                    /must be non-negative/
                );

                // Invalid: future with allowFuture=false
                expect(() =>
                    validateTimestamp(future, "timestamp", { allowFuture: false })
                ).toThrow(TurbineError);

                // Invalid: past with allowPast=false
                expect(() =>
                    validateTimestamp(past, "timestamp", { allowPast: false })
                ).toThrow(TurbineError);
            });
        });

        describe("validatePrimitiveSignature", () => {
            it("should validate primitive signatures correctly", () => {
                // Valid signature
                expect(() =>
                    validatePrimitiveSignature(VALID_PRIMITIVE_SIGNATURE, "signature")
                ).not.toThrow();

                // Missing field: r
                const missingR = { s: VALID_PRIMITIVE_SIGNATURE.s, yParity: false };
                expect(() => validatePrimitiveSignature(missingR, "signature")).toThrow(
                    TurbineError
                );

                // Invalid r type (string)
                const invalidR = {
                    r: "0x123" as any,
                    s: VALID_PRIMITIVE_SIGNATURE.s,
                    yParity: false,
                };
                expect(() => validatePrimitiveSignature(invalidR, "signature")).toThrow(
                    TurbineError
                );
                expect(() => validatePrimitiveSignature(invalidR, "signature")).toThrow(
                    /must be a bigint/
                );

                // Invalid s type (number)
                const invalidS = {
                    r: VALID_PRIMITIVE_SIGNATURE.r,
                    s: 123 as any,
                    yParity: false,
                };
                expect(() => validatePrimitiveSignature(invalidS, "signature")).toThrow(
                    TurbineError
                );

                // Invalid yParity type (number)
                const invalidYParity = {
                    r: VALID_PRIMITIVE_SIGNATURE.r,
                    s: VALID_PRIMITIVE_SIGNATURE.s,
                    yParity: 0 as any,
                };
                expect(() =>
                    validatePrimitiveSignature(invalidYParity, "signature")
                ).toThrow(TurbineError);
            });
        });
    });

    describe("Array Validators", () => {
        describe("validateArray", () => {
            it("should validate arrays correctly", () => {
                // Valid: empty array
                const result1 = validateArray(
                    [],
                    "testArray",
                    (item) => item as number
                );
                expect(result1).toEqual([]);

                // Valid: array with validator
                const result2 = validateArray(
                    [1, 2, 3],
                    "testArray",
                    (item) => item as number
                );
                expect(result2).toEqual([1, 2, 3]);

                // Invalid: not an array
                expect(() =>
                    validateArray({} as any, "testArray", (item) => item)
                ).toThrow(TurbineError);
                expect(() =>
                    validateArray({} as any, "testArray", (item) => item)
                ).toThrow(/must be an array/);

                // Invalid: validator throws for an element
                expect(() =>
                    validateArray([1, "invalid", 3], "testArray", (item) => {
                        if (typeof item !== "number") {
                            throw new TurbineError(
                                "INPUT_VALIDATION_ERROR",
                                "Must be number"
                            );
                        }
                        return item;
                    })
                ).toThrow(TurbineError);
            });
        });

        describe("validateNonEmptyArray", () => {
            it("should validate non-empty arrays correctly", () => {
                // Valid: non-empty array
                const result = validateNonEmptyArray(
                    [1, 2, 3],
                    "testArray",
                    (item) => item as number
                );
                expect(result).toEqual([1, 2, 3]);

                // Invalid: empty array
                expect(() =>
                    validateNonEmptyArray([], "testArray", (item) => item)
                ).toThrow(TurbineError);
                expect(() =>
                    validateNonEmptyArray([], "testArray", (item) => item)
                ).toThrow(/must be a non-empty array/);

                // Invalid: not an array
                expect(() =>
                    validateNonEmptyArray({} as any, "testArray", (item) => item)
                ).toThrow(TurbineError);
            });
        });
    });

    describe("Object Field Validators", () => {
        describe("validateFields", () => {
            it("should validate all fields successfully", () => {
                const obj = {
                    name: "Alice",
                    age: 25,
                    active: true,
                };

                const validated = validateFields<any>(
                    obj,
                    {
                        name: validateString,
                        age: validatePositiveNumber,
                        active: validateBoolean,
                    },
                    "testObject"
                );

                expect(validated.name).toBe("Alice");
                expect(validated.age).toBe(25);
                expect(validated.active).toBe(true);
            });

            it("should validate address fields correctly", () => {
                const obj = {
                    owner: VALID_ADDRESS,
                    token: USDC.address,
                };

                const validated = validateFields<any>(
                    obj,
                    {
                        owner: validateAddress,
                        token: validateAddress,
                    },
                    "addressTest"
                );

                expect(validated.owner).toBe(VALID_ADDRESS);
                expect(validated.token).toBe(USDC.address);
            });

            it("should throw for missing single field", () => {
                const obj = { name: "Alice" };

                expect(() =>
                    validateFields<any>(
                        obj,
                        {
                            name: validateString,
                            age: validatePositiveNumber,
                        },
                        "testObject"
                    )
                ).toThrow(TurbineError);

                expect(() =>
                    validateFields<any>(
                        obj,
                        {
                            name: validateString,
                            age: validatePositiveNumber,
                        },
                        "testObject"
                    )
                ).toThrow(/missing required field: age/);
            });

            it("should throw for multiple missing fields", () => {
                const obj = { name: "Alice" };

                expect(() =>
                    validateFields<any>(
                        obj,
                        {
                            name: validateString,
                            age: validatePositiveNumber,
                            active: validateBoolean,
                        },
                        "testObject"
                    )
                ).toThrow(TurbineError);

                expect(() =>
                    validateFields<any>(
                        obj,
                        {
                            name: validateString,
                            age: validatePositiveNumber,
                            active: validateBoolean,
                        },
                        "testObject"
                    )
                ).toThrow(/missing required fields: age, active/);
            });

            it("should throw for invalid field value", () => {
                const obj = { name: "Alice", age: "not-a-number" };

                expect(() =>
                    validateFields<any>(
                        obj,
                        {
                            name: validateString,
                            age: validatePositiveNumber,
                        },
                        "testObject"
                    )
                ).toThrow(TurbineError);

                expect(() =>
                    validateFields<any>(
                        obj,
                        {
                            name: validateString,
                            age: validatePositiveNumber,
                        },
                        "testObject"
                    )
                ).toThrow(/testObject.age/);
            });

            it("should construct correct field paths in errors", () => {
                const obj = { address: "not-an-address" };

                try {
                    validateFields<any>(
                        obj,
                        {
                            address: validateAddress,
                        },
                        "orderIntent"
                    );
                    fail("Should have thrown");
                } catch (error) {
                    expect(error).toBeInstanceOf(TurbineError);
                    expect((error as TurbineError).message).toContain(
                        "orderIntent.address"
                    );
                }
            });

            it("should support custom validator options", () => {
                const futureTime = BigInt(Math.floor(Date.now() / 1000) + 3600);
                const obj = {
                    startTime: BigInt(Math.floor(Date.now() / 1000)),
                    endTime: futureTime,
                };

                const validated = validateFields<any>(
                    obj,
                    {
                        startTime: validateTimestamp,
                        endTime: (v, n) =>
                            validateTimestamp(v, n, { allowPast: false }),
                    },
                    "intent"
                );

                expect(validated.startTime).toBeDefined();
                expect(validated.endTime).toBe(futureTime);
            });

            it("should throw if not an object", () => {
                expect(() =>
                    validateFields<any>(
                        "not-an-object",
                        {
                            name: validateString,
                        },
                        "testObject"
                    )
                ).toThrow(TurbineError);

                expect(() =>
                    validateFields<any>(
                        null,
                        {
                            name: validateString,
                        },
                        "testObject"
                    )
                ).toThrow(/must be a non-null object/);
            });

            it("should handle bigint fields correctly", () => {
                const obj = {
                    amount: 1000000n,
                    nonce: 0n,
                };

                const validated = validateFields<any>(
                    obj,
                    {
                        amount: validatePositiveBigInt,
                        nonce: validateBigInt,
                    },
                    "tokenData"
                );

                expect(validated.amount).toBe(1000000n);
                expect(validated.nonce).toBe(0n);
            });

            it("should handle nested validation via lambda", () => {
                const obj = {
                    signature: VALID_PRIMITIVE_SIGNATURE,
                    permit: {
                        nonce: 123n,
                        deadline: 456n,
                    },
                };

                const validated = validateFields<any>(
                    obj,
                    {
                        signature: validatePrimitiveSignature,
                        permit: (v, n) =>
                            validateFields<any>(
                                v,
                                {
                                    nonce: validateBigInt,
                                    deadline: validatePositiveBigInt,
                                },
                                n
                            ),
                    },
                    "signedTransfer"
                );

                expect(validated.signature).toEqual(VALID_PRIMITIVE_SIGNATURE);
                expect(validated.permit.nonce).toBe(123n);
                expect(validated.permit.deadline).toBe(456n);
            });
        });
    });

    describe("Complex Object Validators", () => {
        describe("validateOrderIntent", () => {
            it("should validate order intent correctly", () => {
                // Helper to create valid intent
                const createValid = (): OrderIntent => ({
                    owner: ACCOUNT.address,
                    sellToken: USDC.address,
                    buyToken: WETH.address,
                    sellAmount: 1000000n,
                    minBuyAmount: 950000n,
                    spreadCurve: spreads.constant(500),
                    startTime: BigInt(Math.floor(Date.now() / 1000)),
                    endTime: BigInt(Math.floor(Date.now() / 1000) + 3600),
                    partialFill: true,
                    callData: "0x" as Hex,
                    callDataTarget: NULL_ADDRESS,
                    salt: ("0x" + "1".repeat(64)) as Hex,
                });

                // Valid intent
                expect(() => validateOrderIntent(createValid())).not.toThrow();

                // Missing field: owner
                const missingOwner = createValid();
                delete (missingOwner as any).owner;
                expect(() => validateOrderIntent(missingOwner)).toThrow(TurbineError);
                expect(() => validateOrderIntent(missingOwner)).toThrow(
                    /missing required field: owner/
                );

                // Invalid owner (not an address)
                const invalidOwner = {
                    ...createValid(),
                    owner: "not-an-address" as Address,
                };
                expect(() => validateOrderIntent(invalidOwner)).toThrow(TurbineError);

                // Same sell and buy token
                const sameTokens = { ...createValid(), buyToken: USDC.address };
                expect(() => validateOrderIntent(sameTokens)).toThrow(TurbineError);
                expect(() => validateOrderIntent(sameTokens)).toThrow(
                    /must be different addresses/
                );

                // Zero sellAmount
                const zeroAmount = { ...createValid(), sellAmount: 0n };
                expect(() => validateOrderIntent(zeroAmount)).toThrow(TurbineError);
                expect(() => validateOrderIntent(zeroAmount)).toThrow(
                    /must be positive/
                );

                // Invalid time range (start >= end)
                const now = BigInt(Math.floor(Date.now() / 1000));
                const invalidTimeRange = {
                    ...createValid(),
                    startTime: now,
                    endTime: now,
                };
                expect(() => validateOrderIntent(invalidTimeRange)).toThrow(
                    TurbineError
                );
                expect(() => validateOrderIntent(invalidTimeRange)).toThrow(
                    /endTime must be greater than startTime/
                );

                // Salt must be exactly bytes32 (protocol encodes it as bytes32)
                const shortSalt = { ...createValid(), salt: "0x1234" as Hex };
                expect(() => validateOrderIntent(shortSalt)).toThrow(
                    /must be a 32-byte hash/
                );

                const oversizedSalt = {
                    ...createValid(),
                    salt: ("0x" + "ab".repeat(4096)) as Hex,
                };
                expect(() => validateOrderIntent(oversizedSalt)).toThrow(
                    /must be a 32-byte hash/
                );
            });

            it("rejects curves whose windowBps truncate to order boundaries (short duration)", () => {
                const now = BigInt(Math.floor(Date.now() / 1000));
                // 100s order: min effective windowBps step = ceil(10000/100) = 100.
                // windowBps=50 → offset = 50*100/10000 = 0 → boundary collision.
                const intent: OrderIntent = {
                    owner: ACCOUNT.address,
                    sellToken: USDC.address,
                    buyToken: WETH.address,
                    sellAmount: 1000000n,
                    minBuyAmount: 950000n,
                    spreadCurve: {
                        startDeltaBps: 100,
                        endDeltaBps: 500,
                        points: [{ windowBps: 50, deltaBps: 200 }],
                    },
                    startTime: now,
                    endTime: now + 100n,
                    partialFill: true,
                    callData: "0x" as Hex,
                    callDataTarget: NULL_ADDRESS,
                    salt: ("0x" + "1".repeat(64)) as Hex,
                };
                expect(() => validateOrderIntent(intent)).toThrow(
                    /truncates to time offset 0/
                );
            });

            it("rejects curves where distinct windowBps collide after truncation", () => {
                const now = BigInt(Math.floor(Date.now() / 1000));
                // 100s order: windowBps 250 and 300 both → floor(250*100/10000)=2 and
                // floor(300*100/10000)=3, so try a tighter case. windowBps 250 → 2, 299 → 2.
                const intent: OrderIntent = {
                    owner: ACCOUNT.address,
                    sellToken: USDC.address,
                    buyToken: WETH.address,
                    sellAmount: 1000000n,
                    minBuyAmount: 950000n,
                    spreadCurve: {
                        startDeltaBps: 100,
                        endDeltaBps: 500,
                        points: [
                            { windowBps: 250, deltaBps: 200 },
                            { windowBps: 299, deltaBps: 300 },
                        ],
                    },
                    startTime: now,
                    endTime: now + 100n,
                    partialFill: true,
                    callData: "0x" as Hex,
                    callDataTarget: NULL_ADDRESS,
                    salt: ("0x" + "1".repeat(64)) as Hex,
                };
                expect(() => validateOrderIntent(intent)).toThrow(
                    /collides with points\[0\] after truncation/
                );
            });

            it("accepts short-duration curves whose windowBps spacing matches the resolution", () => {
                const now = BigInt(Math.floor(Date.now() / 1000));
                // 100s order: min spacing = 100 windowBps per second. Use 1000, 5000, 9000.
                const intent: OrderIntent = {
                    owner: ACCOUNT.address,
                    sellToken: USDC.address,
                    buyToken: WETH.address,
                    sellAmount: 1000000n,
                    minBuyAmount: 950000n,
                    spreadCurve: {
                        startDeltaBps: 100,
                        endDeltaBps: 500,
                        points: [
                            { windowBps: 1000, deltaBps: 200 },
                            { windowBps: 5000, deltaBps: 300 },
                            { windowBps: 9000, deltaBps: 400 },
                        ],
                    },
                    startTime: now,
                    endTime: now + 100n,
                    partialFill: true,
                    callData: "0x" as Hex,
                    callDataTarget: NULL_ADDRESS,
                    salt: ("0x" + "1".repeat(64)) as Hex,
                };
                expect(() => validateOrderIntent(intent)).not.toThrow();
            });

            it("accepts a regular order with a negative deltaBps curve", () => {
                // Regression guard: the [-10_000, 10_000) signed domain must not
                // get re-narrowed to non-negative by a future change.
                const now = BigInt(Math.floor(Date.now() / 1000));
                const intent: OrderIntent = {
                    owner: ACCOUNT.address,
                    sellToken: USDC.address,
                    buyToken: WETH.address,
                    sellAmount: 1000000n,
                    minBuyAmount: 950000n,
                    spreadCurve: {
                        startDeltaBps: -1000,
                        endDeltaBps: 1000,
                        points: [{ windowBps: 5000, deltaBps: 0 }],
                    },
                    startTime: now,
                    endTime: now + 3600n,
                    partialFill: true,
                    callData: "0x" as Hex,
                    callDataTarget: NULL_ADDRESS,
                    salt: ("0x" + "1".repeat(64)) as Hex,
                };
                expect(() => validateOrderIntent(intent)).not.toThrow();
            });

            it("accepts smart orders carrying a spreadCurve", () => {
                const smart: OrderIntent = {
                    owner: ACCOUNT.address,
                    sellToken: USDC.address,
                    buyToken: WETH.address,
                    sellAmount: 1000000n,
                    minBuyAmount: 950000n,
                    spreadCurve: spreads.constant(500),
                    startTime: BigInt(Math.floor(Date.now() / 1000)),
                    endTime: BigInt(Math.floor(Date.now() / 1000) + 3600),
                    partialFill: true,
                    callData: "0x12345678" as Hex,
                    callDataTarget: WETH.address,
                    salt: ("0x" + "1".repeat(64)) as Hex,
                };

                expect(() => validateOrderIntent(smart)).not.toThrow();
            });

            it("rejects half-set callData/callDataTarget", () => {
                const now = BigInt(Math.floor(Date.now() / 1000));
                const base = {
                    owner: ACCOUNT.address,
                    sellToken: USDC.address,
                    buyToken: WETH.address,
                    sellAmount: 1000000n,
                    minBuyAmount: 950000n,
                    spreadCurve: spreads.constant(500),
                    startTime: now,
                    endTime: now + 3600n,
                    partialFill: true,
                    salt: ("0x" + "1".repeat(64)) as Hex,
                };

                // callData set, callDataTarget null
                expect(() =>
                    validateOrderIntent({
                        ...base,
                        callData: "0x12345678" as Hex,
                        callDataTarget: NULL_ADDRESS,
                    })
                ).toThrow(/both be set for a smart order or both unset/);

                // callDataTarget set, callData "0x"
                expect(() =>
                    validateOrderIntent({
                        ...base,
                        callData: "0x" as Hex,
                        callDataTarget: WETH.address,
                    })
                ).toThrow(/both be set for a smart order or both unset/);
            });
        });

        describe("validateAddLiquidityIntent", () => {
            it("should validate add liquidity intent correctly", () => {
                // Helper to create valid intent
                const createValid = (): AddLiquidityIntent => ({
                    owner: ACCOUNT.address,
                    token0: USDC.address,
                    token1: WETH.address,
                    fee: 3000,
                    token0Amount: 1000000n,
                    token1Amount: 1000000000000000000n,
                    exact: true,
                    salt: ("0x" + "1".repeat(64)) as Hex,
                });

                // Valid intent
                expect(() => validateAddLiquidityIntent(createValid())).not.toThrow();

                // Missing field: owner
                const missingOwner = createValid();
                delete (missingOwner as any).owner;
                expect(() => validateAddLiquidityIntent(missingOwner)).toThrow(
                    TurbineError
                );
                expect(() => validateAddLiquidityIntent(missingOwner)).toThrow(
                    /missing required field: owner/
                );

                // Same token0 and token1
                const sameTokens = { ...createValid(), token1: USDC.address };
                expect(() => validateAddLiquidityIntent(sameTokens)).toThrow(
                    TurbineError
                );
                expect(() => validateAddLiquidityIntent(sameTokens)).toThrow(
                    /must be different addresses/
                );

                // Invalid fee (negative)
                const negativeFee = { ...createValid(), fee: -100 };
                expect(() => validateAddLiquidityIntent(negativeFee)).toThrow(
                    TurbineError
                );
                expect(() => validateAddLiquidityIntent(negativeFee)).toThrow(
                    /must be between 0 and 1000000/
                );

                // Single zero amount is allowed (single-sided liquidity)
                const zeroToken0 = { ...createValid(), token0Amount: 0n };
                expect(() => validateAddLiquidityIntent(zeroToken0)).not.toThrow();

                const zeroToken1 = { ...createValid(), token1Amount: 0n };
                expect(() => validateAddLiquidityIntent(zeroToken1)).not.toThrow();

                // Both zero amounts should throw
                const bothZero = {
                    ...createValid(),
                    token0Amount: 0n,
                    token1Amount: 0n,
                };
                expect(() => validateAddLiquidityIntent(bothZero)).toThrow(
                    TurbineError
                );
                expect(() => validateAddLiquidityIntent(bothZero)).toThrow(
                    /At least one token amount must be greater than zero/
                );

                // Salt must be exactly bytes32 (protocol encodes it as bytes32)
                const shortSalt = { ...createValid(), salt: "0x1234" as Hex };
                expect(() => validateAddLiquidityIntent(shortSalt)).toThrow(
                    /must be a 32-byte hash/
                );

                const oversizedSalt = {
                    ...createValid(),
                    salt: ("0x" + "ab".repeat(4096)) as Hex,
                };
                expect(() => validateAddLiquidityIntent(oversizedSalt)).toThrow(
                    /must be a 32-byte hash/
                );
            });
        });

        describe("validateRemoveLiquidityIntent", () => {
            it("should validate remove liquidity intent correctly", () => {
                // Helper to create valid intent
                const createValid = (): RemoveLiquidityIntent => ({
                    owner: ACCOUNT.address,
                    token0: USDC.address,
                    token1: WETH.address,
                    fee: 3000,
                    lpToken: NULL_ADDRESS,
                    lpTokenAmount: 1000000n,
                    salt: ("0x" + "1".repeat(64)) as Hex,
                });

                // Valid intent
                expect(() =>
                    validateRemoveLiquidityIntent(createValid())
                ).not.toThrow();

                // Missing field: lpToken
                const missingLpToken = createValid();
                delete (missingLpToken as any).lpToken;
                expect(() => validateRemoveLiquidityIntent(missingLpToken)).toThrow(
                    TurbineError
                );
                expect(() => validateRemoveLiquidityIntent(missingLpToken)).toThrow(
                    /missing required field: lpToken/
                );

                // NULL_ADDRESS as token0
                const nullToken0 = { ...createValid(), token0: NULL_ADDRESS };
                expect(() => validateRemoveLiquidityIntent(nullToken0)).toThrow(
                    TurbineError
                );
                expect(() => validateRemoveLiquidityIntent(nullToken0)).toThrow(
                    /token0 cannot be the NULL_ADDRESS/
                );

                // Zero lpTokenAmount
                const zeroAmount = { ...createValid(), lpTokenAmount: 0n };
                expect(() => validateRemoveLiquidityIntent(zeroAmount)).toThrow(
                    TurbineError
                );
                expect(() => validateRemoveLiquidityIntent(zeroAmount)).toThrow(
                    /removeLiquidityIntent.lpTokenAmount must be positive/
                );

                // Salt must be exactly bytes32 (protocol encodes it as bytes32)
                const shortSalt = { ...createValid(), salt: "0x1234" as Hex };
                expect(() => validateRemoveLiquidityIntent(shortSalt)).toThrow(
                    /must be a 32-byte hash/
                );
            });
        });

        describe("validateSignedBatchSignatureTransfer", () => {
            it("should validate signed batch signature transfer correctly", () => {
                // Valid complete signature transfer
                expect(() =>
                    validateSignedBatchSignatureTransfer(
                        VALID_SIGNED_BATCH_SIGNATURE_TRANSFER
                    )
                ).not.toThrow();

                // Missing signature field
                const missingSignature = {
                    permit: VALID_SIGNED_BATCH_SIGNATURE_TRANSFER.permit,
                };
                expect(() =>
                    validateSignedBatchSignatureTransfer(missingSignature)
                ).toThrow(TurbineError);
                expect(() =>
                    validateSignedBatchSignatureTransfer(missingSignature)
                ).toThrow(/missing required field/);

                // Invalid signature.r type (string instead of bigint)
                const invalidSignature = {
                    signature: {
                        r: "0x123" as any,
                        s: VALID_PRIMITIVE_SIGNATURE.s,
                        yParity: false,
                    },
                    permit: VALID_SIGNED_BATCH_SIGNATURE_TRANSFER.permit,
                };
                expect(() =>
                    validateSignedBatchSignatureTransfer(invalidSignature)
                ).toThrow(TurbineError);
                expect(() =>
                    validateSignedBatchSignatureTransfer(invalidSignature)
                ).toThrow(/must be a bigint/);

                // permit.permitted not array
                const notArray = {
                    signature: VALID_PRIMITIVE_SIGNATURE,
                    permit: {
                        permitted: "not-an-array" as any,
                        nonce: 0n,
                        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
                    },
                };
                expect(() => validateSignedBatchSignatureTransfer(notArray)).toThrow(
                    TurbineError
                );
                expect(() => validateSignedBatchSignatureTransfer(notArray)).toThrow(
                    /must be an array/
                );

                // Invalid deadline (zero: 0n - should be positive)
                const zeroDeadline = {
                    signature: VALID_PRIMITIVE_SIGNATURE,
                    permit: {
                        permitted:
                            VALID_SIGNED_BATCH_SIGNATURE_TRANSFER.permit.permitted,
                        nonce: 0n,
                        deadline: 0n,
                    },
                };
                expect(() =>
                    validateSignedBatchSignatureTransfer(zeroDeadline)
                ).toThrow(TurbineError);
                expect(() =>
                    validateSignedBatchSignatureTransfer(zeroDeadline)
                ).toThrow(/must be positive/);
            });
        });
    });

    describe("Permit2 and Liquidity Validators", () => {
        describe("validateTokenPermissions", () => {
            it("should validate token permissions correctly", () => {
                // Valid token permissions
                expect(() =>
                    validateTokenPermissions(VALID_TOKEN_PERMISSIONS)
                ).not.toThrow();

                // Missing token field
                const missingToken = { amount: 1000n };
                expect(() => validateTokenPermissions(missingToken)).toThrow(
                    TurbineError
                );

                // Missing amount field
                const missingAmount = { token: USDC.address };
                expect(() => validateTokenPermissions(missingAmount)).toThrow(
                    TurbineError
                );

                // Invalid token (not address)
                const invalidToken = { token: "invalid", amount: 1000n };
                expect(() => validateTokenPermissions(invalidToken)).toThrow(
                    TurbineError
                );
            });
        });

        describe("validateTokenPermissionsArray", () => {
            it("should validate token permissions arrays correctly", () => {
                // Valid array
                expect(() =>
                    validateTokenPermissionsArray([VALID_TOKEN_PERMISSIONS])
                ).not.toThrow();

                // Invalid: not an array
                expect(() => validateTokenPermissionsArray("not-array" as any)).toThrow(
                    TurbineError
                );

                // Invalid: wrong length
                expect(() =>
                    validateTokenPermissionsArray([VALID_TOKEN_PERMISSIONS], 2)
                ).toThrow(TurbineError);
                expect(() =>
                    validateTokenPermissionsArray([VALID_TOKEN_PERMISSIONS], 2)
                ).toThrow(/must have exactly 2 elements/);

                // Invalid element in array
                expect(() =>
                    validateTokenPermissionsArray([{ invalid: "data" }])
                ).toThrow(TurbineError);
            });
        });

        describe("validateSignedSignatureTransferOnchain", () => {
            it("should validate signed signature transfer onchain correctly", () => {
                const validTransfer = {
                    signature: VALID_SIGNATURE_HEX,
                    permit: {
                        permitted: VALID_TOKEN_PERMISSIONS,
                        nonce: 0n,
                        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
                    },
                };

                // Valid transfer
                expect(() =>
                    validateSignedSignatureTransferOnchain(validTransfer)
                ).not.toThrow();

                // Missing signature
                const missingSignature = { permit: validTransfer.permit };
                expect(() =>
                    validateSignedSignatureTransferOnchain(missingSignature)
                ).toThrow(TurbineError);

                // Invalid signature (not valid hex)
                const invalidSig = {
                    ...validTransfer,
                    signature: "invalid" as Hex,
                };
                expect(() =>
                    validateSignedSignatureTransferOnchain(invalidSig)
                ).toThrow(TurbineError);

                // Invalid deadline (zero)
                const zeroDeadline = {
                    ...validTransfer,
                    permit: { ...validTransfer.permit, deadline: 0n },
                };
                expect(() =>
                    validateSignedSignatureTransferOnchain(zeroDeadline)
                ).toThrow(TurbineError);
            });
        });

        describe("validateRemoveLiquidityIntentOnchain", () => {
            it("should validate remove liquidity intent onchain correctly", () => {
                const validIntent = {
                    owner: ACCOUNT.address,
                    poolId: VALID_HASH,
                    lpTokenAmount: 1000000n,
                    salt: "0x" + "1".repeat(64),
                };

                // Valid intent
                expect(() =>
                    validateRemoveLiquidityIntentOnchain(validIntent)
                ).not.toThrow();

                // Missing field
                const missingOwner = { ...validIntent };
                delete (missingOwner as any).owner;
                expect(() =>
                    validateRemoveLiquidityIntentOnchain(missingOwner)
                ).toThrow(TurbineError);

                // Invalid poolId (too short)
                const invalidPoolId = {
                    ...validIntent,
                    poolId: "0x123",
                };
                expect(() =>
                    validateRemoveLiquidityIntentOnchain(invalidPoolId)
                ).toThrow(TurbineError);

                // Zero lpTokenAmount
                const zeroAmount = { ...validIntent, lpTokenAmount: 0n };
                expect(() => validateRemoveLiquidityIntentOnchain(zeroAmount)).toThrow(
                    TurbineError
                );

                // Salt shorter than bytes32 must be rejected at the validation
                // boundary, not deferred to the bytes32 ABI encoder.
                const shortSalt = { ...validIntent, salt: "0x1234" };
                expect(() => validateRemoveLiquidityIntentOnchain(shortSalt)).toThrow(
                    /must be a 32-byte hash/
                );
            });
        });

        describe("validateAddLiquidityPayload", () => {
            it("should validate add liquidity payload correctly", () => {
                const validPayload = {
                    addLiquidity: {
                        owner: ACCOUNT.address,
                        token0: USDC.address,
                        token1: WETH.address,
                        fee: 3000,
                        token0Amount: 1000000n,
                        token1Amount: 1000000000000000000n,
                        exact: true,
                        salt: ("0x" + "1".repeat(64)) as Hex,
                    },
                    permitTokens: {
                        signature: VALID_PRIMITIVE_SIGNATURE,
                        permit: {
                            permitted: [
                                { token: USDC.address as Address, amount: 1000000n },
                                {
                                    token: WETH.address as Address,
                                    amount: 1000000000000000000n,
                                },
                            ],
                            nonce: 0n,
                            deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
                        },
                    },
                };

                // Valid payload
                expect(() => validateAddLiquidityPayload(validPayload)).not.toThrow();

                // Missing addLiquidity
                const missingAddLiquidity = { permitTokens: validPayload.permitTokens };
                expect(() => validateAddLiquidityPayload(missingAddLiquidity)).toThrow(
                    TurbineError
                );

                // Missing permitTokens
                const missingPermit = { addLiquidity: validPayload.addLiquidity };
                expect(() => validateAddLiquidityPayload(missingPermit)).toThrow(
                    TurbineError
                );
            });

            it("should validate single-sided liquidity payload (token0Amount = 0)", () => {
                // Single-sided liquidity with only token1 (token0Amount = 0)
                // Token permissions should allow 0 amount for token0
                const permitTokensWithZero = {
                    signature: VALID_PRIMITIVE_SIGNATURE,
                    permit: {
                        permitted: [
                            { token: USDC.address as Address, amount: 0n }, // Zero amount for token0
                            {
                                token: WETH.address as Address,
                                amount: 1000000000000000000n,
                            },
                        ],
                        nonce: 0n,
                        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
                    },
                };

                const singleSidedPayload = {
                    addLiquidity: {
                        owner: ACCOUNT.address,
                        token0: USDC.address,
                        token1: WETH.address,
                        fee: 3000,
                        token0Amount: 0n,
                        token1Amount: 1000000000000000000n,
                        exact: true,
                        salt: ("0x" + "1".repeat(64)) as Hex,
                    },
                    permitTokens: permitTokensWithZero,
                };

                // Validate token permissions with 0 amount pass
                expect(() =>
                    validateTokenPermissions(permitTokensWithZero.permit.permitted[0])
                ).not.toThrow();

                // Both intent validation and permit validation should pass
                expect(() =>
                    validateAddLiquidityPayload(singleSidedPayload)
                ).not.toThrow();
                expect(() =>
                    validateAddLiquidityIntent(singleSidedPayload.addLiquidity)
                ).not.toThrow();
                expect(() =>
                    validateSignedBatchSignatureTransfer(
                        singleSidedPayload.permitTokens
                    )
                ).not.toThrow();
            });

            it("should reject permit arrays not bound to the intent tokens", () => {
                const basePayload = {
                    addLiquidity: {
                        owner: ACCOUNT.address,
                        token0: USDC.address,
                        token1: WETH.address,
                        fee: 3000,
                        token0Amount: 1000000n,
                        token1Amount: 1000000000000000000n,
                        exact: true,
                        salt: ("0x" + "1".repeat(64)) as Hex,
                    },
                    permitTokens: {
                        signature: VALID_PRIMITIVE_SIGNATURE,
                        permit: {
                            permitted: [
                                { token: USDC.address as Address, amount: 1000000n },
                                {
                                    token: WETH.address as Address,
                                    amount: 1000000000000000000n,
                                },
                            ],
                            nonce: 0n,
                            deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
                        },
                    },
                };

                // Baseline: tokens match token0/token1 in order
                expect(() => validateAddLiquidityPayload(basePayload)).not.toThrow();

                // Extra (unbounded) permitted entries beyond the two intent tokens
                const oversized = {
                    ...basePayload,
                    permitTokens: {
                        ...basePayload.permitTokens,
                        permit: {
                            ...basePayload.permitTokens.permit,
                            permitted: [
                                ...basePayload.permitTokens.permit.permitted,
                                { token: WBTC.address as Address, amount: 1n },
                            ],
                        },
                    },
                };
                expect(() => validateAddLiquidityPayload(oversized)).toThrow(
                    TurbineError
                );

                // Permitted token that is not one of the intent tokens
                const mismatched = {
                    ...basePayload,
                    permitTokens: {
                        ...basePayload.permitTokens,
                        permit: {
                            ...basePayload.permitTokens.permit,
                            permitted: [
                                { token: WBTC.address as Address, amount: 1n },
                                {
                                    token: WETH.address as Address,
                                    amount: 1000000000000000000n,
                                },
                            ],
                        },
                    },
                };
                expect(() => validateAddLiquidityPayload(mismatched)).toThrow(
                    TurbineError
                );

                // Tokens match the intent but an amount differs
                const amountMismatch = {
                    ...basePayload,
                    permitTokens: {
                        ...basePayload.permitTokens,
                        permit: {
                            ...basePayload.permitTokens.permit,
                            permitted: [
                                {
                                    token: USDC.address as Address,
                                    amount: basePayload.addLiquidity.token0Amount - 1n,
                                },
                                {
                                    token: WETH.address as Address,
                                    amount: 1000000000000000000n,
                                },
                            ],
                        },
                    },
                };
                expect(() => validateAddLiquidityPayload(amountMismatch)).toThrow(
                    TurbineError
                );
            });
        });
    });

    describe("Contract Response Validators", () => {
        describe("validatePoolData", () => {
            it("should validate pool data correctly", () => {
                const validPoolData = {
                    token0: USDC.address,
                    token1: WETH.address,
                    fee: 3000,
                    lpToken: VALID_ADDRESS,
                    reserve0: 1000000n,
                    reserve1: 1000000000000000000n,
                    liquidity: 100000000n,
                };

                // Valid pool data
                expect(() => validatePoolData(validPoolData, 0)).not.toThrow();

                // Missing field
                const missingToken0 = { ...validPoolData };
                delete (missingToken0 as any).token0;
                expect(() => validatePoolData(missingToken0, 0)).toThrow(TurbineError);

                // Invalid token pair (same tokens)
                const sameTokens = { ...validPoolData, token1: USDC.address };
                expect(() => validatePoolData(sameTokens, 0)).toThrow(TurbineError);

                // Invalid fee
                const invalidFee = { ...validPoolData, fee: -100 };
                expect(() => validatePoolData(invalidFee, 0)).toThrow(TurbineError);
            });
        });

        describe("validateBalanceResult", () => {
            it("should validate balance result correctly", () => {
                // Valid: success status with result
                const validSuccess = {
                    status: "success",
                    result: 1000000n,
                };
                expect(() =>
                    validateBalanceResult(validSuccess, "balance")
                ).not.toThrow();

                // Valid: failure status
                const validFailure = { status: "failure" };
                expect(() =>
                    validateBalanceResult(validFailure, "balance")
                ).not.toThrow();

                // Missing status
                const missingStatus = { result: 1000n };
                expect(() => validateBalanceResult(missingStatus, "balance")).toThrow(
                    TurbineError
                );

                // Invalid status value
                const invalidStatus = { status: "invalid" };
                expect(() => validateBalanceResult(invalidStatus, "balance")).toThrow(
                    TurbineError
                );

                // Success without result
                const successNoResult = { status: "success" };
                expect(() => validateBalanceResult(successNoResult, "balance")).toThrow(
                    TurbineError
                );
            });
        });

        describe("validateTurbineConfig", () => {
            const API_URL = MOCK_TURBINE_CONFIG.siweUri;

            it("should validate turbine config correctly", () => {
                // Valid config
                expect(() =>
                    validateTurbineConfig(MOCK_TURBINE_CONFIG, API_URL)
                ).not.toThrow();

                // Missing field
                const missingField = { ...MOCK_TURBINE_CONFIG };
                delete (missingField as any).turbineSettlerAddress;
                expect(() => validateTurbineConfig(missingField, API_URL)).toThrow(
                    TurbineError
                );

                // Missing version (required)
                const missingVersion = { ...MOCK_TURBINE_CONFIG };
                delete (missingVersion as any).version;
                expect(() =>
                    validateTurbineConfig(missingVersion, API_URL)
                ).toThrow(TurbineError);

                // Invalid address
                const invalidAddress = {
                    ...MOCK_TURBINE_CONFIG,
                    turbineSettlerAddress: "invalid",
                };
                expect(() => validateTurbineConfig(invalidAddress, API_URL)).toThrow(
                    TurbineError
                );

                // Invalid boolean
                const invalidBoolean = {
                    ...MOCK_TURBINE_CONFIG,
                    submitSettlements: "true",
                };
                expect(() => validateTurbineConfig(invalidBoolean, API_URL)).toThrow(
                    TurbineError
                );

                // Invalid siweUri (not a URL)
                const invalidSiweUri = { ...MOCK_TURBINE_CONFIG, siweUri: "not a url" };
                expect(() => validateTurbineConfig(invalidSiweUri, API_URL)).toThrow(
                    TurbineError
                );

                // siweUri not matching the configured API URL
                expect(() =>
                    validateTurbineConfig(
                        MOCK_TURBINE_CONFIG,
                        "https://different-api.example.com"
                    )
                ).toThrow(TurbineError);

                // Optional minTradeSizeUsdc: absent is valid (backwards compat)
                expect(() =>
                    validateTurbineConfig(MOCK_TURBINE_CONFIG, API_URL)
                ).not.toThrow();

                // Optional minTradeSizeUsdc: decimal string converted to bigint
                const withMinTradeSize = {
                    ...MOCK_TURBINE_CONFIG,
                    minTradeSizeUsdc: "10000000",
                };
                expect(
                    validateTurbineConfig(withMinTradeSize, API_URL).minTradeSizeUsdc
                ).toBe(10000000n);

                // Optional minTradeSizeUsdc: non-numeric string rejected
                const invalidMinTradeSize = {
                    ...MOCK_TURBINE_CONFIG,
                    minTradeSizeUsdc: "not-a-number",
                };
                expect(() =>
                    validateTurbineConfig(invalidMinTradeSize, API_URL)
                ).toThrow(TurbineError);

                // Optional minTradeSizeUsdc: zero rejected (min trade size must be > 0)
                expect(() =>
                    validateTurbineConfig(
                        { ...MOCK_TURBINE_CONFIG, minTradeSizeUsdc: "0" },
                        API_URL
                    )
                ).toThrow(TurbineError);

                // Optional minTradeSizeUsdc: negative rejected
                expect(() =>
                    validateTurbineConfig(
                        { ...MOCK_TURBINE_CONFIG, minTradeSizeUsdc: "-1" },
                        API_URL
                    )
                ).toThrow(TurbineError);
            });
        });
    });

    describe("API Response Validators", () => {
        describe("validatePrice", () => {
            it("should validate a price with non-zero denominator", () => {
                expect(() =>
                    validatePrice({ numerator: "1", denominator: "2" }, "price")
                ).not.toThrow();
            });

            it("should reject a zero denominator", () => {
                expect(() =>
                    validatePrice({ numerator: "1", denominator: "0" }, "price")
                ).toThrow(/denominator must be non-zero/);
                expect(() =>
                    validatePrice({ numerator: 1n, denominator: 0n }, "price")
                ).toThrow(/denominator must be non-zero/);
                try {
                    validatePrice({ numerator: "1", denominator: "0" }, "price");
                } catch (error) {
                    expect((error as TurbineError).code).toBe("INPUT_VALIDATION_ERROR");
                }
            });
        });

        describe("validateOrderExecutionResponse", () => {
            it("should validate order execution response correctly", () => {
                const validExecution = {
                    txHash: VALID_HASH,
                    blockNumber: 12345,
                    soldAmount: "1000000",
                    boughtAmount: "950000",
                    surplusBuyAmount: "50000",
                };

                // Valid execution
                expect(() =>
                    validateOrderExecutionResponse(validExecution)
                ).not.toThrow();

                // Valid execution with null txHash
                const validExecutionWithNullTxHash = {
                    ...validExecution,
                    txHash: null,
                };
                expect(() =>
                    validateOrderExecutionResponse(validExecutionWithNullTxHash)
                ).not.toThrow();

                // Missing field
                const missingTxHash = { ...validExecution };
                delete (missingTxHash as any).txHash;
                expect(() => validateOrderExecutionResponse(missingTxHash)).toThrow(
                    TurbineError
                );

                // Invalid txHash (too short)
                const invalidTxHash = { ...validExecution, txHash: "0x123" };
                expect(() => validateOrderExecutionResponse(invalidTxHash)).toThrow(
                    TurbineError
                );

                // Invalid blockNumber (zero)
                const invalidBlockNumber = { ...validExecution, blockNumber: 0 };
                expect(() =>
                    validateOrderExecutionResponse(invalidBlockNumber)
                ).toThrow(TurbineError);
            });

            it("should validate optional midPrice field", () => {
                const validExecution = {
                    txHash: VALID_HASH,
                    blockNumber: 12345,
                    soldAmount: "1000000",
                    boughtAmount: "950000",
                    surplusBuyAmount: "50000",
                };

                // midPrice absent
                expect(() =>
                    validateOrderExecutionResponse(validExecution)
                ).not.toThrow();

                // midPrice present and valid
                expect(() =>
                    validateOrderExecutionResponse({
                        ...validExecution,
                        midPrice: {
                            numerator: "99970127000000000000",
                            denominator: "235230203657",
                        },
                    })
                ).not.toThrow();

                // midPrice null
                expect(() =>
                    validateOrderExecutionResponse({
                        ...validExecution,
                        midPrice: null,
                    })
                ).not.toThrow();

                // midPrice undefined
                expect(() =>
                    validateOrderExecutionResponse({
                        ...validExecution,
                        midPrice: undefined,
                    })
                ).not.toThrow();

                // missing numerator
                expect(() =>
                    validateOrderExecutionResponse({
                        ...validExecution,
                        midPrice: { denominator: "235230203657" },
                    })
                ).toThrow(/missing required field.*numerator/);

                // missing denominator
                expect(() =>
                    validateOrderExecutionResponse({
                        ...validExecution,
                        midPrice: { numerator: "99970127000000000000" },
                    })
                ).toThrow(/missing required field.*denominator/);

                // invalid numerator value
                expect(() =>
                    validateOrderExecutionResponse({
                        ...validExecution,
                        midPrice: {
                            numerator: "not-a-number",
                            denominator: "235230203657",
                        },
                    })
                ).toThrow(/cannot be converted to BigInt/);
            });
        });

        describe("validateOrderStateResponse", () => {
            it("should validate order state response correctly", () => {
                const validExecution = {
                    txHash: VALID_HASH,
                    blockNumber: 12345,
                    soldAmount: "1000000",
                    boughtAmount: "950000",
                    surplusBuyAmount: "50000",
                };

                const validState = {
                    hash: VALID_HASH,
                    status: "Active",
                    execution: [validExecution],
                };

                // Valid state
                expect(() => validateOrderStateResponse(validState)).not.toThrow();

                // Missing field
                const missingHash = { ...validState };
                delete (missingHash as any).hash;
                expect(() => validateOrderStateResponse(missingHash)).toThrow(
                    TurbineError
                );

                // Invalid hash
                const invalidHash = { ...validState, hash: "0x123" };
                expect(() => validateOrderStateResponse(invalidHash)).toThrow(
                    TurbineError
                );

                // Invalid execution (not array)
                const invalidExecution = { ...validState, execution: "not-array" };
                expect(() => validateOrderStateResponse(invalidExecution)).toThrow(
                    TurbineError
                );
            });
        });

        describe("validateOrderDetailsResponse", () => {
            const validDetails = {
                sellToken: VALID_ADDRESS,
                buyToken: USDC.address,
                sellAmount: "1000000",
                limitPrice: { numerator: "1", denominator: "3500" },
                startTime: "1713264000",
                endTime: "1713350400",
                spreadCurve: {
                    startSecs: 1713264000,
                    endSecs: 1713350400,
                    startDeltaBps: 50,
                    endDeltaBps: 250,
                    points: [{ timeSecs: 1713307200, deltaBps: 150 }],
                },
                createdTimestamp: "2026-04-16T12:00:00",
            };

            it("accepts a well-formed orderDetails with resolved spreadCurve", () => {
                expect(() => validateOrderDetailsResponse(validDetails)).not.toThrow();
            });

            it("accepts an empty points array", () => {
                expect(() =>
                    validateOrderDetailsResponse({
                        ...validDetails,
                        spreadCurve: { ...validDetails.spreadCurve, points: [] },
                    })
                ).not.toThrow();
            });

            it("rejects orderDetails missing spreadCurve", () => {
                const missing = { ...validDetails };
                delete (missing as any).spreadCurve;
                expect(() => validateOrderDetailsResponse(missing)).toThrow(
                    /missing required field: spreadCurve/
                );
            });

            it("rejects a spreadCurve missing a required field", () => {
                const { startSecs: _omit, ...partialCurve } = validDetails.spreadCurve;
                expect(() =>
                    validateOrderDetailsResponse({
                        ...validDetails,
                        spreadCurve: partialCurve,
                    })
                ).toThrow(
                    /orderDetails\.spreadCurve is missing required field: startSecs/
                );
            });

            it("rejects a non-array points field", () => {
                expect(() =>
                    validateOrderDetailsResponse({
                        ...validDetails,
                        spreadCurve: { ...validDetails.spreadCurve, points: 5 },
                    })
                ).toThrow(/orderDetails\.spreadCurve\.points must be an array/);
            });

            it("rejects a points array over the cap", () => {
                const tooMany = Array.from(
                    { length: MAX_SPREAD_CURVE_POINTS + 1 },
                    (_, i) => ({ timeSecs: i + 1, deltaBps: 1 })
                );
                expect(() =>
                    validateOrderDetailsResponse({
                        ...validDetails,
                        spreadCurve: { ...validDetails.spreadCurve, points: tooMany },
                    })
                ).toThrow(/points has \d+ entries; max is/);
            });

            it("rejects an out-of-range startDeltaBps", () => {
                expect(() =>
                    validateOrderDetailsResponse({
                        ...validDetails,
                        spreadCurve: {
                            ...validDetails.spreadCurve,
                            startDeltaBps: 50000,
                        },
                    })
                ).toThrow(/orderDetails\.spreadCurve\.startDeltaBps must be in/);
            });

            it("rejects an out-of-range deltaBps inside a point", () => {
                expect(() =>
                    validateOrderDetailsResponse({
                        ...validDetails,
                        spreadCurve: {
                            ...validDetails.spreadCurve,
                            points: [{ timeSecs: 1713307200, deltaBps: -20000 }],
                        },
                    })
                ).toThrow(
                    /orderDetails\.spreadCurve\.points\[0\]\.deltaBps must be in/
                );
            });

            it("rejects a point missing deltaBps", () => {
                expect(() =>
                    validateOrderDetailsResponse({
                        ...validDetails,
                        spreadCurve: {
                            ...validDetails.spreadCurve,
                            points: [{ timeSecs: 1713307200 }],
                        },
                    })
                ).toThrow(
                    /orderDetails\.spreadCurve\.points\[0\] must have timeSecs and deltaBps/
                );
            });
        });

        describe("validateLiquidityIntentStateResponse", () => {
            it("should validate liquidity intent state response correctly", () => {
                const validState = {
                    hash: VALID_HASH,
                    status: "Pending",
                };

                // Valid state
                expect(() =>
                    validateLiquidityIntentStateResponse(validState)
                ).not.toThrow();

                // Missing field
                const missingHash = { status: "Pending" };
                expect(() => validateLiquidityIntentStateResponse(missingHash)).toThrow(
                    TurbineError
                );

                // Invalid hash
                const invalidHash = { hash: "0x123", status: "Pending" };
                expect(() => validateLiquidityIntentStateResponse(invalidHash)).toThrow(
                    TurbineError
                );

                // Invalid status (not in enum)
                const invalidStatus = { hash: VALID_HASH, status: "InvalidStatus" };
                expect(() =>
                    validateLiquidityIntentStateResponse(invalidStatus)
                ).toThrow(TurbineError);
                expect(() =>
                    validateLiquidityIntentStateResponse(invalidStatus)
                ).toThrow(/invalid value/);
            });
        });
    });

    describe("Signature Utilities", () => {
        const VALID_SIGNATURE_HEX = ("0x" + "1".repeat(128) + "1b") as Hex; // v=27
        const VALID_SIGNATURE_V1 = ("0x" + "2".repeat(128) + "01") as Hex; // v=1

        describe("hexToSignature", () => {
            it("should convert valid 65-byte hex to Uint8Array (v=27)", () => {
                const signature = hexToSignature(VALID_SIGNATURE_HEX);
                expect(signature).toBeInstanceOf(Uint8Array);
                expect(signature.length).toBe(65);
                expect(signature[64]).toBe(27); // v value
            });

            it("should accept v=28", () => {
                const sigV28 = ("0x" + "1".repeat(128) + "1c") as Hex; // v=28
                const signature = hexToSignature(sigV28);
                expect(signature[64]).toBe(28);
            });

            it("should accept v=0 (EIP-2098)", () => {
                const sigV0 = ("0x" + "1".repeat(128) + "00") as Hex; // v=0
                const signature = hexToSignature(sigV0);
                expect(signature[64]).toBe(0);
            });

            it("should accept v=1 (EIP-2098)", () => {
                const signature = hexToSignature(VALID_SIGNATURE_V1);
                expect(signature[64]).toBe(1);
            });
        });

        describe("parseSignatureBytes", () => {
            it("should parse signature into r, s, v components", () => {
                const signature = hexToSignature(VALID_SIGNATURE_HEX);
                const { r, s, v } = parseSignatureBytes(signature);

                expect(r).toBeInstanceOf(Uint8Array);
                expect(r.length).toBe(32);
                expect(s).toBeInstanceOf(Uint8Array);
                expect(s.length).toBe(32);
                expect(v).toBe(27);
            });

            it("should correctly extract v=1", () => {
                const signature = hexToSignature(VALID_SIGNATURE_V1);
                const { v } = parseSignatureBytes(signature);
                expect(v).toBe(1);
            });

            it("should correctly extract components for v=28", () => {
                const sigV28 = ("0x" + "a".repeat(64) + "b".repeat(64) + "1c") as Hex;
                const signature = hexToSignature(sigV28);
                const { r, s, v } = parseSignatureBytes(signature);

                expect(r[0]).toBe(0xaa);
                expect(r[31]).toBe(0xaa);
                expect(s[0]).toBe(0xbb);
                expect(s[31]).toBe(0xbb);
                expect(v).toBe(28);
            });
        });

        describe("signatureToComponents", () => {
            it("should convert signature to bigint components (v=27)", () => {
                const signature = hexToSignature(VALID_SIGNATURE_HEX);
                const { r, s, yParity } = signatureToComponents(signature);

                expect(typeof r).toBe("bigint");
                expect(typeof s).toBe("bigint");
                expect(typeof yParity).toBe("boolean");
                expect(yParity).toBe(false); // v=27 → yParity=false
            });

            it("should convert v=28 to yParity=true", () => {
                const sigV28 = ("0x" + "1".repeat(128) + "1c") as Hex; // v=28
                const signature = hexToSignature(sigV28);
                const { yParity } = signatureToComponents(signature);
                expect(yParity).toBe(true);
            });

            it("should convert v=0 to yParity=false", () => {
                const sigV0 = ("0x" + "1".repeat(128) + "00") as Hex; // v=0
                const signature = hexToSignature(sigV0);
                const { yParity } = signatureToComponents(signature);
                expect(yParity).toBe(false);
            });

            it("should convert v=1 to yParity=true", () => {
                const signature = hexToSignature(VALID_SIGNATURE_V1);
                const { yParity } = signatureToComponents(signature);
                expect(yParity).toBe(true);
            });

            it("should correctly convert specific r, s values", () => {
                const rHex = "0x" + "1".repeat(64);
                const sHex = "0x" + "f".repeat(64);
                const sigHex = (rHex + sHex.slice(2) + "1b") as Hex;

                const signature = hexToSignature(sigHex);
                const { r, s } = signatureToComponents(signature);

                expect(r).toBe(BigInt(rHex));
                expect(s).toBe(BigInt("0x" + "f".repeat(64)));
            });
        });

        describe("bytesToBigInt", () => {
            it("should convert bytes to bigint", () => {
                const bytes = new Uint8Array([0x01, 0x02, 0x03]);
                const value = bytesToBigInt(bytes);
                expect(value).toBe(0x010203n);
            });

            it("should handle zero", () => {
                const bytes = new Uint8Array([0x00]);
                const value = bytesToBigInt(bytes);
                expect(value).toBe(0n);
            });

            it("should handle large values", () => {
                const bytes = new Uint8Array(32).fill(0xff);
                const value = bytesToBigInt(bytes);
                const expected =
                    0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;
                expect(value).toBe(expected);
            });

            it("should handle empty bytes", () => {
                const bytes = new Uint8Array([]);
                const value = bytesToBigInt(bytes);
                expect(value).toBe(0n);
            });
        });
    });
});
