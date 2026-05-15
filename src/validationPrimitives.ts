import { Address, isAddress, Hex, isHex, hexToBytes } from "viem";
import { TurbineError } from "./errorHandling";

// ============================================================================
// PRIMITIVE TYPE VALIDATORS
// ============================================================================
/**
 * Allows null to pass validation
 * @param value - The value to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @param validator - The validator to use for non-null values
 * @returns The validated value or null if the value is null
 * @throws Whatever the validator throws
 */

export function optional<Tin, Tout>(
    validator: (value: Tin, fieldName: string) => Tout,
    value: Tin | null,
    fieldName: string
): Tout | null {
    if (value === null) return null;
    return validator(value, fieldName);
}
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
