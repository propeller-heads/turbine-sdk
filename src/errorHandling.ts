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
                inner: parsed.inner,
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

    // Fallback to backward compatibility: set code to UNKNOWN_ERROR and use raw body text
    return new TurbineError(
        "UNKNOWN_ERROR",
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

    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle parse errors
    if (errorMessage.includes("Failed to parse response as JSON")) {
        return new TurbineError(
            "PARSE_ERROR",
            "Failed to process the server response. Please try again later."
        );
    }

    // Handle missing field errors
    if (errorMessage.includes("Response missing required")) {
        return new TurbineError(
            "MISSING_FIELD",
            "Transaction was submitted but some confirmation details are missing. Please check your orders/transactions to verify if it was processed."
        );
    }

    // Handle user rejection errors
    if (
        errorMessage.includes("User rejected") ||
        errorMessage.includes("user rejected")
    ) {
        return new TurbineError(
            "USER_REJECTION",
            "Rejected by the wallet. Please try again if you want to complete this operation."
        );
    }

    // Handle authentication/verification endpoint errors with detailed server response
    if (errorMessage.includes("Verify endpoint failed:")) {
        return new TurbineError(
            "AUTHENTICATION_FAILED",
            `Authentication failed: ${errorMessage}`
        );
    }

    // Default error
    return new TurbineError(
        "UNKNOWN_ERROR",
        "An unexpected error occurred. Please try again."
    );
}
