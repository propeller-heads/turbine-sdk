/**
 * All possible Turbine error codes
 * Includes both backend error codes and SDK-specific error codes
 */
const TURBINE_ERROR_CODES = [
    // Backend error codes
    "INTERNAL_ERROR",
    "TEE_ERROR",
    "INPUT_VALIDATION_ERROR",
    "ORDERBOOK_CAPACITY_ERROR",
    "USER_ORDER_LIMIT_REACHED",
    "MAX_ORDERS_IN_PAYLOAD",
    "VALIDATION_ERRORS",
    "ORDER_ALREADY_EXISTS",
    "DUPLICATED_ORDER",
    "USER_NOT_AUTHORIZED",
    "ALREADY_AUTHENTICATED",
    "NO_NONCE_GENERATED",
    "AUTHENTICATED_WITH_NONCE",
    "VERIFICATION_FAILED",
    "ORDER_NOT_AVAILABLE",
    "MID_PRICE_NOT_FOUND",
    // SDK-specific error codes
    "SDK_ERROR", // wrong usage of the SDK
    "PARSE_ERROR",
    "MISSING_FIELD",
    "MISSING_ORDER_HASH",
    "MISSING_ORDER_HASHES",
    "MISSING_INTENT_HASH",
    "USER_REJECTION",
    "AUTHENTICATION_FAILED",
    "AUTHENTICATION_ERROR",
    "UNAUTHORIZED",
    "INVALID_RESPONSE",
    "INTERNAL_SERVER_ERROR",
    "REMOVE_LIQUIDITY_INTENT_ONCHAIN_FAILED",
    "EXECUTE_PENDING_REMOVE_LIQUIDITY_INTENTS_FAILED",
    "FLUSH_EXPIRED_REMOVE_LIQUIDITY_INTENTS_FAILED",
    "POOL_CREATION_FAILED",
    "POOL_ALREADY_INITIALIZED",
    "CONFIG_FETCH_FAILED",
    "SERVICE_UNAVAILABLE",
    "UNKNOWN_ERROR",
] as const;

/**
 * Union type for all possible Turbine error codes
 */
export type TurbineErrorCode = (typeof TURBINE_ERROR_CODES)[number];

/**
 * Error response payload structure matching the backend format
 */
export interface ErrorResponsePayload {
    /** Error code in SNAKE_CASE format */
    code: TurbineErrorCode;
    /** Human-readable error message */
    message: string;
    /** Optional array of nested errors */
    inner?: ErrorResponsePayload[];
}

/**
 * TurbineError class provides structured error handling for Turbine SDK.
 */
export class TurbineError extends Error {
    public readonly code: TurbineErrorCode;
    public readonly message: string;
    public readonly inner?: TurbineError[];

    constructor(
        code: TurbineErrorCode,
        message: string,
        inner?: TurbineError[]
    ) {
        super(message);

        this.code = code;
        this.message = message;
        this.inner = inner;

        // Set the name to match the class name
        this.name = "TurbineError";

        // Maintains proper stack trace for where our error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, TurbineError);
        }
    }

    /**
     * Returns the raw error with technical details for logging
     */
    public getTechnicalDetails(): string {
        let details = `[${this.code}] ${this.message}`;
        if (this.inner && this.inner.length > 0) {
            details += `\nNested errors:\n${this.inner
                .map((err) => `  - ${err.getTechnicalDetails()}`)
                .join("\n")}`;
        }
        return details;
    }
}

/**
 * Validates and normalizes an error code to a TurbineErrorCode
 */
function validateErrorCode(code: string): TurbineErrorCode {
    return (TURBINE_ERROR_CODES.includes(code as TurbineErrorCode)
        ? code
        : "UNKNOWN_ERROR") as TurbineErrorCode;
}

/**
 * Validates that a value is a valid ErrorResponsePayload array
 * @param inner The inner field value to validate
 * @returns Validated ErrorResponsePayload array or undefined
 */
function validateInnerArray(
    inner: unknown
): ErrorResponsePayload[] | undefined {
    // If inner is undefined or null, return undefined
    if (inner === undefined || inner === null) {
        return undefined;
    }

    // If inner is not an array, return undefined (ignore invalid values)
    if (!Array.isArray(inner)) {
        return undefined;
    }

    // Validate and filter out invalid entries
    const validInner: ErrorResponsePayload[] = [];
    for (const item of inner) {
        // Only include items that have the correct structure
        if (
            item &&
            typeof item === "object" &&
            typeof item.code === "string" &&
            typeof item.message === "string"
        ) {
            validInner.push({
                code: validateErrorCode(item.code),
                message: item.message,
                inner: undefined,
            });
        }
    }

    return validInner.length > 0 ? validInner : undefined;
}

/**
 * Parses an error response from the API
 * @param responseText The response text body
 * @returns ErrorResponsePayload or null if parsing fails
 */
function parseErrorResponse(responseText: string): ErrorResponsePayload | null {
    try {
        if (!responseText) {
            return null;
        }

        const parsed = JSON.parse(responseText);

        // Validate structure matches ErrorResponsePayload
        if (
            parsed &&
            typeof parsed === "object" &&
            typeof parsed.code === "string" &&
            typeof parsed.message === "string"
        ) {
            return {
                code: validateErrorCode(parsed.code),
                message: parsed.message,
                inner: validateInnerArray(parsed.inner),
            };
        }

        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Converts an ErrorResponsePayload to a TurbineError, handling nested errors
 * @param payload The error response payload
 * @returns A TurbineError instance
 */
function errorPayloadToTurbineError(payload: ErrorResponsePayload): TurbineError {
    let innerErrors: TurbineError[] | undefined;
    if (payload.inner && payload.inner.length > 0) {
        innerErrors = payload.inner.map((innerPayload) => {
            // Log warning if nested errors have their own nested errors
            if (innerPayload.inner && innerPayload.inner.length > 0) {
                console.error(
                    "Warning: More than one level of nested errors detected. Only parsing first level."
                );
            }
            return new TurbineError(innerPayload.code, innerPayload.message);
        });
    }

    return new TurbineError(payload.code, payload.message, innerErrors);
}

/**
 * Creates a TurbineError from an API response error
 * @param response The response object from the fetch API
 * @returns A TurbineError instance
 */
export async function unsuccessfulResponseToTurbineError(
    response: Response
): Promise<TurbineError> {
    const responseText = await response.text();

    // Try to parse the new error format
    const errorPayload = parseErrorResponse(responseText);

    if (errorPayload) {
        return errorPayloadToTurbineError(errorPayload);
    }

    // Use INTERNAL_SERVER_ERROR for HTTP 500 status, otherwise UNKNOWN_ERROR
    const errorCode: TurbineErrorCode =
        response.status === 500 ? "INTERNAL_SERVER_ERROR" : "UNKNOWN_ERROR";
    return new TurbineError(
        errorCode,
        responseText || "An error occurred while processing your request. Please try again."
    );
}

/**
 * Creates appropriate TurbineError from various types of errors
 */
export function toTurbineError(error: unknown): TurbineError {
    if (error instanceof TurbineError) {
        return error;
    }

    // Default error
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new TurbineError("UNKNOWN_ERROR", errorMessage);
}
