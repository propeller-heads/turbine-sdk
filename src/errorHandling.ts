/**
 * All possible Turbine error codes
 * Includes both backend error codes and SDK-specific error codes
 */
const TURBINE_ERROR_CODES = [
    // Backend error codes
    "INTERNAL_ERROR", // something went very wrong and Turbine is aware of it
    "TEE_ERROR", // problem related to the trusted execution environment
    "INPUT_VALIDATION_ERROR", // specific validation errors
    "ORDERBOOK_CAPACITY_ERROR", // orderbook is full
    "USER_ORDER_LIMIT_REACHED", // user has reached the maximum number of orders they can have
    "MAX_ORDERS_IN_PAYLOAD", // the number of orders in the payload is too large
    "VALIDATION_ERRORS", // multiple validation errors occurred, expect inner errors
    "ORDER_ALREADY_EXISTS", // order already exists (can be returned only when the SAME user submits the same order again)
    "DUPLICATED_ORDER", // same order present in a single payload multiple times
    "USER_NOT_AUTHORIZED", // user not authenticated or authenticated with a different address
    "ALREADY_AUTHENTICATED", // tried to authenticate again without logging out first
    "NO_NONCE_GENERATED", // tried to verify without generating a nonce first
    "AUTHENTICATED_WITH_NONCE", // authenticated, but nonce still present in the backend; this should never happen
    "VERIFICATION_FAILED", // failed to verify authentication request
    "ORDER_NOT_AVAILABLE", // order not found or owner is not authenticated
    "MID_PRICE_NOT_FOUND", // Turbine coudln't determine mid-price necessary to perform the operation
    // SDK-specific error codes
    "SDK_ERROR", // developer error, wrong usage of the SDK
    "UNEXPECTED_CANCELLATION_RESPONSE", // server returned a successful but unexpected response format for a cancellation request
    "UNEXPECTED_ADD_ORDER_RESPONSE", // server returned a successful but unexpected response format for an add order(s) request
    "UNEXPECTED_REMOVE_LIQUIDITY_RESPONSE", // server returned a successful but unexpected response format for a remove liquidity request
    "UNEXPECTED_ADD_LIQUIDITY_RESPONSE", // server returned a successful but unexpected response format for an add liquidity request
    "USER_REJECTION", // user rejected the operation in the wallet
    "AUTHENTICATION_FAILED", // tried to authenticate but backend still answers as if unauthenticated
    "AUTHENTICATION_ERROR", // some other error occurred during authentication
    "UNAUTHORIZED", // authenticated user does not match the owner of submitted intent
    "INVALID_RESPONSE", // server returned an unexpected response format; the response is in the details field
    "INTERNAL_SERVER_ERROR", // server returned a 500 error
    "REMOVE_LIQUIDITY_INTENT_ONCHAIN_FAILED", // remove liquidity intent onchain transaction was reverted
    "EXECUTE_PENDING_REMOVE_LIQUIDITY_INTENTS_FAILED", // execute pending remove liquidity intents transaction was reverted
    "FLUSH_EXPIRED_REMOVE_LIQUIDITY_INTENTS_FAILED", // flush expired remove liquidity intents transaction was reverted
    "POOL_ALREADY_INITIALIZED", // pool already initialized
    "POOL_CREATION_FAILED", // pool creation transaction was reverted for some other reason
    "CONFIG_FETCH_FAILED", // unable to fetch configuration
    "SERVICE_UNAVAILABLE", // Turbine is currently unavailable
    "UNKNOWN_ERROR", // unknown error occurred
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
    public readonly details: any;
    public readonly inner: TurbineError[] | null;
    constructor(
        code: TurbineErrorCode,
        message: string,
        details: any = null,
        inner: TurbineError[] | null = null
    ) {
        super(message);

        this.code = code;
        this.message = message;
        this.details = details;
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
 * @param details Additional details to include in the error
 * @returns A TurbineError instance
 */
function errorPayloadToTurbineError(payload: ErrorResponsePayload, details: any = null): TurbineError {
    let innerErrors: TurbineError[] | null = null;
    if (payload.inner && payload.inner.length > 0) {
        innerErrors = payload.inner.map((innerPayload) => {
            // Log warning if nested errors have their own nested errors
            if (innerPayload.inner && innerPayload.inner.length > 0) {
                console.warn(
                    "Warning: More than one level of nested errors detected. Only parsing first level."
                );
            }
            return new TurbineError(innerPayload.code, innerPayload.message);
        });
    }

    return new TurbineError(payload.code, payload.message, details, innerErrors);
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

    // Try to parse the response into the expected error format
    const errorPayload: ErrorResponsePayload | null = parseErrorResponse(responseText);

    if (errorPayload) {
        return errorPayloadToTurbineError(errorPayload, responseText);
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
 * Casts to TurbineError if needed
 */
export function toTurbineError(error: unknown): TurbineError {
    if (error instanceof TurbineError) {
        return error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle user rejection errors
    if (errorMessage.toLowerCase().includes("user rejected")) {
        return new TurbineError("USER_REJECTION", "Rejected by the wallet. Please try again if you want to complete this operation.", errorMessage);
    }

    return new TurbineError("UNKNOWN_ERROR", errorMessage, error);
}
