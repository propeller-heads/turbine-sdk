/**
 * Validation utilities for Turbine SDK
 *
 * This module provides input validation to prevent CWE-20 (Improper Input Validation).
 * All validators throw TurbineError with INPUT_VALIDATION_ERROR code for invalid inputs.
 *
 * Validation occurs at multiple layers:
 * - Script layer: Validate CLI inputs
 * - SDK public methods: Validate function parameters
 * - Internal layer: Validate before API calls
 * - Response layer: Validate API responses
 */

import { Address, Hex, isAddress, isHex, hexToBytes, bytesToHex } from "viem";
import { TurbineError } from "./errorHandling";
import { NULL_ADDRESS } from "./constants";
import {
    OrderIntent,
    AddLiquidityIntent,
    RemoveLiquidityIntent,
    RemoveLiquidityIntentOnchain,
    LiquidityIntentStatus,
    PrimitiveSignature,
    TokenPermissions,
    SignedBatchSignatureTransfer,
    SignatureTransferPermitBatchTransferFrom,
    SignedSignatureTransferOnchain,
    SignatureTransferPermitTransferFrom,
    TurbineConfig,
} from "./models";

// ============================================================================
// PRIMITIVE TYPE VALIDATORS
// ============================================================================

/**
 * Validates that a value is a string
 * @param value - The value to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns The validated string
 * @throws TurbineError if validation fails
 */
export function validateString(value: unknown, fieldName: string): string {
    if (typeof value !== "string") {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be a string, got ${typeof value}`,
            { fieldName, receivedValue: value, receivedType: typeof value }
        );
    }
    return value;
}

/**
 * Validates that a value is a boolean
 * @param value - The value to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns The validated boolean
 * @throws TurbineError if validation fails
 */
export function validateBoolean(value: unknown, fieldName: string): boolean {
    if (typeof value !== "boolean") {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be a boolean, got ${typeof value}`,
            { fieldName, receivedValue: value, receivedType: typeof value }
        );
    }
    return value;
}

/**
 * Validates that a value is a number
 * @param value - The value to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns The validated number
 * @throws TurbineError if validation fails
 */
export function validateNumber(value: unknown, fieldName: string): number {
    if (typeof value !== "number") {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be a number, got ${typeof value}`,
            { fieldName, receivedValue: value, receivedType: typeof value }
        );
    }

    if (isNaN(value)) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be a valid number, got NaN`,
            { fieldName, receivedValue: value }
        );
    }

    if (!isFinite(value)) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be a finite number, got ${value}`,
            { fieldName, receivedValue: value }
        );
    }

    return value;
}

/**
 * Validates that a value is a positive number (> 0)
 * @param value - The value to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns The validated positive number
 * @throws TurbineError if validation fails
 */
export function validatePositiveNumber(value: unknown, fieldName: string): number {
    const num = validateNumber(value, fieldName);
    if (num <= 0) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be positive (> 0), got ${num}`,
            { fieldName, receivedValue: value }
        );
    }
    return num;
}

/**
 * Validates a block number from API responses.
 * Accepts both string and number types (APIs often return block numbers as strings).
 * Converts to number and validates it's positive.
 * @param value - The value to validate (can be string or number)
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns The validated positive block number
 * @throws TurbineError if validation fails
 */
export function validateBlockNumber(value: unknown, fieldName: string): number {
    let numValue: number;

    if (typeof value === "string") {
        numValue = Number(value);
    } else if (typeof value === "number") {
        numValue = value;
    } else {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be a number or numeric string, got ${typeof value}`,
            { fieldName, receivedValue: value, receivedType: typeof value }
        );
    }

    // Reuse validatePositiveNumber for the > 0 check
    return validatePositiveNumber(numValue, fieldName);
}

/**
 * Validates that a value can be converted to BigInt.
 * Useful for API responses that return large numbers as strings.
 * @param value - The value to validate (typically a string or number)
 * @param fieldName - Name of the field being validated (for error messages)
 * @throws TurbineError if validation fails
 */
export function validateBigIntConvertible(value: unknown, fieldName: string): bigint {
    try {
        return BigInt(value as any);
    } catch (error) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} cannot be converted to BigInt: ${value}`,
            { fieldName, receivedValue: value }
        );
    }
}

/**
 * Validates that a value is a bigint
 * @param value - The value to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns The validated bigint
 * @throws TurbineError if validation fails
 */
export function validateBigInt(value: unknown, fieldName: string): bigint {
    if (typeof value !== "bigint") {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be a bigint, got ${typeof value}`,
            { fieldName, receivedValue: value, receivedType: typeof value }
        );
    }
    return value;
}

/**
 * Validates that a value is a positive bigint (> 0)
 * @param value - The value to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns The validated positive bigint
 * @throws TurbineError if validation fails
 */
export function validatePositiveBigInt(value: unknown, fieldName: string): bigint {
    const bigIntValue = validateBigInt(value, fieldName);

    if (bigIntValue <= 0n) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be positive (> 0), got ${bigIntValue}`,
            { fieldName, receivedValue: value }
        );
    }

    return bigIntValue;
}

/**
 * Validates that a value is a non-negative bigint (>= 0)
 * @param value - The value to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns The validated non-negative bigint
 * @throws TurbineError if validation fails
 */
export function validateNonNegativeBigInt(value: unknown, fieldName: string): bigint {
    const bigIntValue = validateBigInt(value, fieldName);

    if (bigIntValue < 0n) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be non-negative (>= 0), got ${bigIntValue}`,
            { fieldName, receivedValue: value }
        );
    }

    return bigIntValue;
}

/**
 * Validates that a value is an object (non-null)
 * @param value - The value to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns The validated object
 * @throws TurbineError if validation fails
 */
export function validateObject(value: unknown, fieldName: string): object {
    if (typeof value !== "object" || value === null) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be a non-null object, got ${value === null ? "null" : typeof value}`,
            { fieldName, receivedValue: value }
        );
    }
    return value;
}

// ============================================================================
// ETHEREUM-SPECIFIC VALIDATORS
// ============================================================================

/**
 * Validates that a value is a valid Ethereum address
 * Uses viem's isAddress() for comprehensive validation including EIP-55 checksum
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns The validated address
 * @throws TurbineError if validation fails
 */
export function validateAddress(value: unknown, fieldName: string): Address {
    const strValue = validateString(value, fieldName);

    if (!isAddress(strValue)) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} is not a valid Ethereum address: ${strValue}. Expected format: 0x followed by 40 hexadecimal characters.`,
            { fieldName, receivedValue: value }
        );
    }

    return strValue as Address;
}

/**
 * Validates that a value is a valid hex string of any length
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns The validated hex string
 * @throws TurbineError if validation fails
 */
export function validateHex(value: unknown, fieldName: string): Hex {
    const strValue = validateString(value, fieldName);

    if (!isHex(strValue)) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} is not a valid hex string: ${strValue}. Expected format: 0x followed by hexadecimal characters (0-9, a-f, A-F).`,
            { fieldName, receivedValue: value }
        );
    }

    return strValue as Hex;
}

/**
 * Validates that a value is a valid 32-byte hash (0x + 64 hex characters)
 * Used for order hashes, intent hashes, transaction hashes, pool IDs, salts
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns The validated hash
 * @throws TurbineError if validation fails
 *
 * @example
 * validateHash('0x' + '1234...', 'orderHash') // Must be exactly 66 characters
 */
export function validateHash(value: unknown, fieldName: string): Hex {
    const hexValue = validateHex(value, fieldName);

    if (hexValue.length !== 66) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be a 32-byte hash (0x followed by 64 hexadecimal characters), got ${hexValue.length} characters. Received: ${hexValue}`,
            {
                fieldName,
                receivedValue: value,
                expectedLength: 66,
                actualLength: hexValue.length,
            }
        );
    }

    return hexValue;
}

/**
 * Validates that a value is a valid signature (0x + 130 hex characters = 65 bytes)
 * Used for validating raw signature format before conversion
 * Validates via Uint8Array for v value checking (simpler than string manipulation).
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns The validated signature hex
 * @throws TurbineError if validation fails
 */
export function validateSignatureHex(value: unknown, fieldName: string): Hex {
    const hexValue = validateHex(value, fieldName);

    // Validate length (must check string length since viem pads odd-length hex)
    if (hexValue.length !== 132) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be a 65-byte signature (0x followed by 130 hexadecimal characters), got ${hexValue.length} characters.`,
            {
                fieldName,
                receivedValue: value,
                expectedLength: 132,
                actualLength: hexValue.length,
            }
        );
    }

    // Convert to Uint8Array for v value validation
    const bytes = hexToBytes(hexValue);

    // Validate v value using array access
    const v = bytes[64];
    if (v !== 27 && v !== 28 && v !== 0 && v !== 1) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} has invalid v value: ${v}. Must be 27, 28 (legacy) or 0, 1 (EIP-2098).`,
            { fieldName, receivedValue: value, vValue: v }
        );
    }

    return hexValue;
}

// ============================================================================
// DOMAIN-SPECIFIC VALIDATORS
// ============================================================================

/**
 * Validates a fee value in hundredths of basis points
 * - 1 basis point = 0.01%
 * - 1 hundredth of basis point = 0.0001%
 * - 3000 = 0.3% (common Uniswap fee)
 * - Range: 0 to 1,000,000 (0% to 100%)
 *
 * @param fee - The fee value to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns The validated fee
 * @throws TurbineError if validation fails
 *
 * @example
 * validateFee(3000, 'fee') // 0.3% - OK
 * validateFee(1500000, 'fee') // > 100% - throws
 */
export function validateFee(fee: unknown, fieldName: string): number {
    const feeNum = validateNumber(fee, fieldName);

    // Fee must be an integer
    if (!Number.isInteger(feeNum)) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be an integer (in hundredths of basis points), got ${feeNum}`,
            { fieldName, receivedValue: fee }
        );
    }

    // Fee range: 0 to 1,000,000 (0% to 100%)
    if (feeNum < 0 || feeNum > 1000000) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be between 0 and 1000000 (0% to 100%), got ${feeNum}. Example: 3000 = 0.3%`,
            { fieldName, receivedValue: fee }
        );
    }

    return feeNum;
}

/**
 * Validates a mid-price delta value in basis points
 * - 1 basis point = 0.01%
 * - 500 = 5% (common tolerance)
 * - Range: 0 to 10,000 (0% to 100%)
 *
 * @param delta - The mid-price delta to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns The validated delta
 * @throws TurbineError if validation fails
 *
 * @example
 * validateMidPriceDelta(500, 'midPriceDelta') // 5% - OK
 * validateMidPriceDelta(15000, 'midPriceDelta') // > 100% - throws
 */
export function validateMidPriceDelta(delta: unknown, fieldName: string): number {
    const deltaNum = validateNumber(delta, fieldName);

    // Delta must be an integer
    if (!Number.isInteger(deltaNum)) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be an integer (in basis points), got ${deltaNum}`,
            { fieldName, receivedValue: delta }
        );
    }

    // Delta range: 0 to 10,000 (0% to 100%)
    if (deltaNum < 0 || deltaNum > 10000) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be between 0 and 10000 (0% to 100%), got ${deltaNum}. Example: 500 = 5%`,
            { fieldName, receivedValue: delta }
        );
    }

    return deltaNum;
}

/**
 * Validates a Unix timestamp (seconds since epoch)
 *
 * @param timestamp - The timestamp to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @param options - Validation options
 * @param options.allowPast - Allow timestamps in the past (default: true)
 * @param options.allowFuture - Allow timestamps in the future (default: true)
 * @returns The validated timestamp
 * @throws TurbineError if validation fails
 */
export function validateTimestamp(
    timestamp: unknown,
    fieldName: string,
    options: { allowPast?: boolean; allowFuture?: boolean } = {}
): bigint {
    const { allowPast = true, allowFuture = true } = options;

    const ts = validateBigInt(timestamp, fieldName);

    if (ts < 0n) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be non-negative, got ${ts}`,
            { fieldName, receivedValue: timestamp }
        );
    }

    const now = BigInt(Math.floor(Date.now() / 1000));

    if (!allowPast && ts < now) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} cannot be in the past. Got ${ts}, current time is ${now}`,
            { fieldName, receivedValue: timestamp, currentTime: now }
        );
    }

    if (!allowFuture && ts > now) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} cannot be in the future. Got ${ts}, current time is ${now}`,
            { fieldName, receivedValue: timestamp, currentTime: now }
        );
    }

    return ts;
}

/**
 * Validates that a time range is valid (startTime < endTime)
 *
 * @param startTime - The start timestamp
 * @param endTime - The end timestamp
 * @throws TurbineError if validation fails
 */
export function validateTimeRange(startTime: bigint, endTime: bigint): void {
    if (startTime >= endTime) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `endTime must be greater than startTime. Got startTime=${startTime}, endTime=${endTime}`,
            { startTime, endTime }
        );
    }
}

/**
 * Validates that two token addresses form a valid pair
 * - Tokens must be different
 * - Neither token can be the NULL_ADDRESS
 *
 * @param token0 - First token address
 * @param token1 - Second token address
 * @throws TurbineError if validation fails
 */
export function validateTokenPair(token0: Address, token1: Address): void {
    if (token0.toLowerCase() === token1.toLowerCase()) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `token0 and token1 must be different addresses. Both are ${token0}`,
            { token0, token1 }
        );
    }

    if (token0.toLowerCase() === NULL_ADDRESS.toLowerCase()) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `token0 cannot be the NULL_ADDRESS (${NULL_ADDRESS})`,
            { token0 }
        );
    }

    if (token1.toLowerCase() === NULL_ADDRESS.toLowerCase()) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `token1 cannot be the NULL_ADDRESS (${NULL_ADDRESS})`,
            { token1 }
        );
    }
}

/**
 * Validates a PrimitiveSignature object
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns The validated signature
 * @throws TurbineError if validation fails
 */
export function validatePrimitiveSignature(
    value: unknown,
    fieldName: string
): PrimitiveSignature {
    const obj = validateObject(value, fieldName);

    if (!("r" in obj) || !("s" in obj) || !("yParity" in obj)) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must have r, s, and yParity properties`,
            { fieldName, receivedValue: value }
        );
    }

    // Validate r and s are valid BigInts (note: BigInt with capital B is the constructor)
    if (typeof (obj as any).r !== "bigint") {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName}.r must be a bigint, got ${typeof (obj as any).r}`,
            { fieldName, receivedValue: value }
        );
    }

    if (typeof (obj as any).s !== "bigint") {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName}.s must be a bigint, got ${typeof (obj as any).s}`,
            { fieldName, receivedValue: value }
        );
    }

    validateBoolean((obj as any).yParity, `${fieldName}.yParity`);

    return obj as PrimitiveSignature;
}

// ============================================================================
// ARRAY VALIDATORS
// ============================================================================

/**
 * Validates an array and its elements
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @param validator - Function to validate each element
 * @returns The validated array
 * @throws TurbineError if validation fails
 */
export function validateArray<T>(
    value: unknown,
    fieldName: string,
    validator: (item: unknown, index: number) => T
): T[] {
    if (!Array.isArray(value)) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be an array, got ${typeof value}`,
            { fieldName, receivedValue: value }
        );
    }

    return value.map((item, index) => {
        try {
            return validator(item, index);
        } catch (error) {
            if (error instanceof TurbineError) {
                // Re-throw with index information
                throw new TurbineError(
                    error.code,
                    `${fieldName}[${index}]: ${error.message}`,
                    error.details
                );
            }
            throw error;
        }
    });
}

/**
 * Validates a non-empty array and its elements
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @param validator - Function to validate each element
 * @returns The validated non-empty array
 * @throws TurbineError if validation fails
 */
export function validateNonEmptyArray<T>(
    value: unknown,
    fieldName: string,
    validator: (item: unknown, index: number) => T
): T[] {
    const arr = validateArray(value, fieldName, validator);

    if (arr.length === 0) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be a non-empty array`,
            { fieldName, receivedValue: value }
        );
    }

    return arr;
}

// ============================================================================
// OBJECT FIELD VALIDATORS
// ============================================================================

/**
 * Validates multiple fields of an object using provided validators.
 * This helper reduces boilerplate in complex object validators by:
 * - Checking all required fields exist
 * - Applying validators to each field
 * - Automatically constructing field paths (e.g., "orderIntent.owner")
 *
 * @param obj - The object to validate (already validated as an object)
 * @param fieldValidators - Map of field names to validator functions
 * @param contextName - Context name for error messages (e.g., "orderIntent")
 * @returns Validated object with all fields typed correctly
 * @throws TurbineError if any field is missing or invalid
 *
 * @example
 * const validated = validateFields<OrderIntent>(intent, {
 *     owner: validateAddress,
 *     sellAmount: validatePositiveBigInt,
 *     partialFill: validateBoolean,
 *     endTime: (v, n) => validateTimestamp(v, n, { allowPast: false })
 * }, "orderIntent");
 */
export function validateFields<T>(
    obj: unknown,
    fieldValidators: Record<string, (val: unknown, name: string) => any>,
    contextName: string
): T {
    // First, validate it's an object
    const validObj = validateObject(obj, contextName);

    // Check all required fields exist
    const missingFields: string[] = [];
    for (const field of Object.keys(fieldValidators)) {
        if (!(field in validObj)) {
            missingFields.push(field);
        }
    }

    if (missingFields.length > 0) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${contextName} is missing required field${missingFields.length > 1 ? "s" : ""}: ${missingFields.join(", ")}`,
            { contextName, missingFields, receivedValue: obj }
        );
    }

    // Validate each field
    const validated: any = {};
    const objAny = validObj as any;

    for (const [field, validator] of Object.entries(fieldValidators)) {
        const fieldPath = `${contextName}.${field}`;
        validated[field] = validator(objAny[field], fieldPath);
    }

    return validated as T;
}

// ============================================================================
// COMPLEX OBJECT VALIDATORS
// ============================================================================

/**
 * Validates an OrderIntent object
 * Performs comprehensive validation of all fields
 *
 * @param intent - The order intent to validate
 * @returns The validated order intent
 * @throws TurbineError if validation fails
 */
export function validateOrderIntent(intent: unknown): OrderIntent {
    const validated = validateFields<OrderIntent>(
        intent,
        {
            owner: validateAddress,
            sellToken: validateAddress,
            buyToken: validateAddress,
            sellAmount: validatePositiveBigInt,
            minBuyAmount: validatePositiveBigInt,
            midPriceDelta: validateMidPriceDelta,
            startTime: validateTimestamp,
            endTime: (v, n) => validateTimestamp(v, n, { allowPast: false }),
            partialFill: validateBoolean,
            callData: validateHex,
            callDataTarget: validateAddress,
            salt: validateHex,
        },
        "orderIntent"
    );

    // Relationship validation
    validateTimeRange(validated.startTime, validated.endTime);
    validateTokenPair(validated.sellToken, validated.buyToken);

    return validated;
}

/**
 * Validates an AddLiquidityIntent object
 *
 * @param intent - The add liquidity intent to validate
 * @returns The validated intent
 * @throws TurbineError if validation fails
 */
export function validateAddLiquidityIntent(intent: unknown): AddLiquidityIntent {
    const validated = validateFields<AddLiquidityIntent>(
        intent,
        {
            owner: validateAddress,
            token0: validateAddress,
            token1: validateAddress,
            fee: validateFee,
            token0Amount: validateNonNegativeBigInt,
            token1Amount: validateNonNegativeBigInt,
            exact: validateBoolean,
            salt: validateHex,
        },
        "addLiquidityIntent"
    );

    // Check that at least one amount is positive (allow single-sided liquidity)
    if (validated.token0Amount === 0n && validated.token1Amount === 0n) {
        throw new TurbineError(
            "ZERO_LIQUIDITY",
            "At least one token amount must be greater than zero for liquidity addition."
        );
    }

    // Relationship validation
    validateTokenPair(validated.token0, validated.token1);

    return validated;
}

/**
 * Validates a RemoveLiquidityIntent object
 *
 * @param intent - The remove liquidity intent to validate
 * @returns The validated intent
 * @throws TurbineError if validation fails
 */
export function validateRemoveLiquidityIntent(intent: unknown): RemoveLiquidityIntent {
    const validated = validateFields<RemoveLiquidityIntent>(
        intent,
        {
            owner: validateAddress,
            token0: validateAddress,
            token1: validateAddress,
            fee: validateFee,
            lpToken: validateAddress,
            lpTokenAmount: validatePositiveBigInt,
            salt: validateHex,
        },
        "removeLiquidityIntent"
    );

    // Check that LP token amount is positive
    if (validated.lpTokenAmount === 0n) {
        throw new TurbineError(
            "ZERO_LIQUIDITY",
            "LP token amount must be greater than zero for liquidity removal."
        );
    }

    // Relationship validation
    validateTokenPair(validated.token0, validated.token1);

    return validated;
}

// ============================================================================
// PERMIT2 AND LIQUIDITY VALIDATORS
// ============================================================================

/**
 * Validates a TokenPermissions object
 *
 * @param value - The value to validate
 * @returns The validated token permissions
 * @throws TurbineError if validation fails
 */
export function validateTokenPermissions(value: unknown): TokenPermissions {
    return validateFields<TokenPermissions>(
        value,
        {
            token: validateAddress,
            amount: validateNonNegativeBigInt,
        },
        "tokenPermissions"
    );
}

/**
 * Validates an array of TokenPermissions objects
 *
 * @param value - The value to validate
 * @param expectedLength - Optional expected length of the array
 * @throws TurbineError if validation fails
 */
export function validateTokenPermissionsArray(
    value: unknown,
    expectedLength?: number
): void {
    if (!Array.isArray(value)) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            "tokenPermissions must be an array",
            { receivedValue: value, receivedType: typeof value }
        );
    }

    if (expectedLength !== undefined && value.length !== expectedLength) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `tokenPermissions array must have exactly ${expectedLength} elements, got ${value.length}`,
            { expectedLength, actualLength: value.length }
        );
    }

    value.forEach((item, index) => {
        try {
            validateTokenPermissions(item);
        } catch (error) {
            if (error instanceof TurbineError) {
                throw new TurbineError(
                    error.code,
                    `tokenPermissions[${index}]: ${error.message}`,
                    error.details
                );
            }
            throw error;
        }
    });
}

/**
 * Validates a SignedBatchSignatureTransfer object
 * Used for batch token approvals (e.g., token0 and token1 for liquidity)
 *
 * @param value - The value to validate
 * @throws TurbineError if validation fails
 */
export function validateSignedBatchSignatureTransfer(value: unknown): void {
    // Helper validator for permitted array
    const validatePermittedArray = (
        v: unknown,
        fieldName: string
    ): TokenPermissions[] => {
        if (!Array.isArray(v)) {
            throw new TurbineError(
                "INPUT_VALIDATION_ERROR",
                `${fieldName} must be an array for batch signature transfer`,
                { fieldName, receivedValue: v }
            );
        }
        return v.map((item, index) => {
            try {
                return validateTokenPermissions(item);
            } catch (error) {
                if (error instanceof TurbineError) {
                    throw new TurbineError(
                        error.code,
                        `${fieldName}[${index}]: ${error.message}`,
                        error.details
                    );
                }
                throw error;
            }
        });
    };

    validateFields<SignedBatchSignatureTransfer>(
        value,
        {
            signature: validatePrimitiveSignature,
            permit: (v, n) =>
                validateFields<SignatureTransferPermitBatchTransferFrom>(
                    v,
                    {
                        permitted: validatePermittedArray,
                        nonce: validateBigInt,
                        deadline: validatePositiveBigInt,
                    },
                    n
                ),
        },
        "signedBatchSignatureTransfer"
    );
}

/**
 * Validates a SignedSignatureTransferOnchain object
 * Used for onchain permit transfers with raw signature hex
 *
 * @param value - The value to validate
 * @returns The validated signed signature transfer
 * @throws TurbineError if validation fails
 */
export function validateSignedSignatureTransferOnchain(
    value: unknown
): SignedSignatureTransferOnchain {
    return validateFields<SignedSignatureTransferOnchain>(
        value,
        {
            signature: validateSignatureHex,
            permit: (v, n) =>
                validateFields<SignatureTransferPermitTransferFrom>(
                    v,
                    {
                        permitted: validateTokenPermissions,
                        nonce: validateBigInt,
                        deadline: validatePositiveBigInt,
                    },
                    n
                ),
        },
        "signedSignatureTransferOnchain"
    );
}

/**
 * Validates a RemoveLiquidityIntentOnchain object
 *
 * @param intent - The intent to validate
 * @throws TurbineError if validation fails
 */
export function validateRemoveLiquidityIntentOnchain(intent: unknown): void {
    validateFields<RemoveLiquidityIntentOnchain>(
        intent,
        {
            owner: validateAddress,
            poolId: validateHash,
            lpTokenAmount: validatePositiveBigInt,
            salt: validateHex,
        },
        "removeLiquidityIntentOnchain"
    );
}

/**
 * Validates an AddLiquidity payload object
 * Used for adding liquidity with signed permit
 *
 * @param payload - The payload to validate
 * @throws TurbineError if validation fails
 */
export function validateAddLiquidityPayload(payload: unknown): void {
    const obj = validateObject(payload, "addLiquidityPayload");

    // Validate required fields exist
    if (!("addLiquidity" in obj) || !("permitTokens" in obj)) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            "addLiquidityPayload must have addLiquidity and permitTokens properties",
            { receivedValue: payload }
        );
    }

    const payloadAny = obj as any;

    validateAddLiquidityIntent(payloadAny.addLiquidity);
    validateSignedBatchSignatureTransfer(payloadAny.permitTokens);
}

// ============================================================================
// CONTRACT RESPONSE VALIDATORS
// ============================================================================

/**
 * Validates pool data returned from the TurbineHook contract
 *
 * @param poolData - The pool data object from the contract
 * @param index - Index of the pool in the array (for error messages)
 * @throws TurbineError if validation fails
 */
export function validatePoolData(poolData: unknown, index: number): void {
    const validated = validateFields<any>(
        poolData,
        {
            token0: validateAddress,
            token1: validateAddress,
            fee: validateFee,
            lpToken: validateAddress,
            reserve0: validateBigIntConvertible,
            reserve1: validateBigIntConvertible,
            liquidity: validateBigIntConvertible,
        },
        `poolData[${index}]`
    );

    // Relationship validation
    validateTokenPair(validated.token0, validated.token1);
}

/**
 * Validates a balance result from a multicall
 *
 * @param result - The balance result from multicall
 * @param fieldName - Name of the field being validated (for error messages)
 * @throws TurbineError if validation fails
 */
export function validateBalanceResult(result: unknown, fieldName: string): void {
    const obj = validateObject(result, fieldName);

    if (!("status" in obj)) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} is missing required field: status`,
            { receivedValue: result }
        );
    }

    const resultAny = obj as any;
    const status = validateString(resultAny.status, `${fieldName}.status`);

    if (status !== "success" && status !== "failure") {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName}.status must be "success" or "failure", got ${status}`,
            { receivedValue: result }
        );
    }

    if (status === "success") {
        if (!("result" in resultAny)) {
            throw new TurbineError(
                "INPUT_VALIDATION_ERROR",
                `${fieldName} with status "success" must have result field`,
                { receivedValue: result }
            );
        }
        // Validate result is a bigint
        validateBigInt(resultAny.result, `${fieldName}.result`);
    }
}

/**
 * Validates a TurbineConfig object
 *
 * @param config - The config object to validate
 * @returns The validated config
 * @throws TurbineError if validation fails
 */
export function validateTurbineConfig(config: unknown): TurbineConfig {
    return validateFields<TurbineConfig>(
        config,
        {
            turbineSettlerAddress: validateAddress,
            lpHookAddress: validateAddress,
            lpRouterAddress: validateAddress,
            poolManagerAddress: validateAddress,
            submitSettlements: validateBoolean,
            siweDomain: validateString,
            siweUri: validateString,
        },
        "TurbineConfig"
    );
}

// ============================================================================
// API RESPONSE VALIDATORS
// ============================================================================

/**
 * Validates a raw OrderExecution response from the API (with snake_case fields).
 * Only validates structure and types, does not transform the data.
 *
 * @param value - The value to validate
 * @throws TurbineError if validation fails
 */
export function validateOrderExecutionResponse(value: unknown): void {
    const obj = validateObject(value, "orderExecution");

    const requiredFields = [
        "tx_hash",
        "block_number",
        "sold_amount",
        "bought_amount",
        "surplus_buy_amount",
    ];

    for (const field of requiredFields) {
        if (!(field in obj)) {
            throw new TurbineError(
                "INPUT_VALIDATION_ERROR",
                `orderExecution is missing required field: ${field}`,
                { field, receivedValue: value }
            );
        }
    }

    const execAny = obj as any;

    validateHash(execAny.tx_hash, "orderExecution.tx_hash");
    validateBlockNumber(execAny.block_number, "orderExecution.block_number");

    validateBigIntConvertible(execAny.sold_amount, "orderExecution.sold_amount");
    validateBigIntConvertible(execAny.bought_amount, "orderExecution.bought_amount");
    validateBigIntConvertible(
        execAny.surplus_buy_amount,
        "orderExecution.surplus_buy_amount"
    );
}

/**
 * Validates a raw OrderState response from the API (with snake_case fields).
 * Only validates structure and types, does not transform the data.
 *
 * @param value - The value to validate
 * @throws TurbineError if validation fails
 */
export function validateOrderStateResponse(value: unknown): void {
    const obj = validateObject(value, "orderState");

    const requiredFields = ["hash", "status", "execution"];

    for (const field of requiredFields) {
        if (!(field in obj)) {
            throw new TurbineError(
                "INPUT_VALIDATION_ERROR",
                `orderState is missing required field: ${field}`,
                { field, receivedValue: value }
            );
        }
    }

    const stateAny = obj as any;

    validateHash(stateAny.hash, "orderState.hash");
    validateString(stateAny.status, "orderState.status");

    // Validate execution array and each execution
    validateArray(stateAny.execution, "orderState.execution", (exec) => {
        validateOrderExecutionResponse(exec);
    });
}

/**
 * Validates a raw LiquidityIntentState response from the API.
 * Only validates structure and types, does not transform the data.
 *
 * @param value - The value to validate
 * @throws TurbineError if validation fails
 */
export function validateLiquidityIntentStateResponse(value: unknown): void {
    const obj = validateObject(value, "liquidityIntentState");

    const requiredFields = ["hash", "status"];

    for (const field of requiredFields) {
        if (!(field in obj)) {
            throw new TurbineError(
                "INPUT_VALIDATION_ERROR",
                `liquidityIntentState is missing required field: ${field}`,
                { field, receivedValue: value }
            );
        }
    }

    const stateAny = obj as any;

    // Validate field types and formats
    validateHash(stateAny.hash, "liquidityIntentState.hash");
    const statusStr = validateString(stateAny.status, "liquidityIntentState.status");

    // Validate status is a valid enum value
    const statusKey = statusStr as keyof typeof LiquidityIntentStatus;
    if (!(statusKey in LiquidityIntentStatus)) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `liquidityIntentState.status has invalid value: ${statusStr}. Must be one of: ${Object.keys(LiquidityIntentStatus).join(", ")}`,
            {
                receivedValue: statusStr,
                validValues: Object.keys(LiquidityIntentStatus),
            }
        );
    }
}

// ============================================================================
// SIGNATURE UTILITIES
// ============================================================================

/**
 * Convert hex string to 65-byte signature.
 * Does not validate - caller should validate using validateSignatureHex if needed.
 *
 * @param hex - 132-character hex string (0x + 130 hex chars)
 * @returns 65-byte signature
 */
export function hexToSignature(hex: Hex): Uint8Array {
    return hexToBytes(hex);
}

/**
 * Parse a 65-byte signature into its components.
 *
 * @param signature - 65-byte signature (r: 32, s: 32, v: 1)
 * @returns Object with r, s, and v components
 */
export function parseSignatureBytes(signature: Uint8Array): {
    r: Uint8Array; // 32 bytes
    s: Uint8Array; // 32 bytes
    v: number; // 1 byte (27/28 or 0/1)
} {
    return {
        r: signature.slice(0, 32),
        s: signature.slice(32, 64),
        v: signature[64],
    };
}

/**
 * Convert a 65-byte signature to bigint components.
 * This format is used in the PrimitiveSignature interface.
 *
 * @param signature - 65-byte signature
 * @returns Object with bigint r, s and boolean yParity
 */
export function signatureToComponents(signature: Uint8Array): {
    r: bigint;
    s: bigint;
    yParity: boolean;
} {
    const { r, s, v } = parseSignatureBytes(signature);

    return {
        r: bytesToBigInt(r),
        s: bytesToBigInt(s),
        yParity: v === 28 || v === 1, // Convert v (27/28 or 0/1) to yParity (false/true)
    };
}

/**
 * Convert Uint8Array to BigInt.
 * Interprets bytes as big-endian unsigned integer.
 *
 * @param bytes - Byte array to convert
 * @returns BigInt representation
 */
export function bytesToBigInt(bytes: Uint8Array): bigint {
    if (bytes.length === 0) {
        return 0n;
    }
    return BigInt(bytesToHex(bytes));
}
