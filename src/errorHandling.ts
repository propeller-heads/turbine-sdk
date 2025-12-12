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
    "MID_PRICE_NOT_FOUND", // Turbine couldn't determine mid-price necessary to perform the operation
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
 * TurbineError class provides structured error handling for Turbine SDK.
 *
 * @param code - The error code; one of the TURBINE_ERROR_CODES. They match the error codes returned by the Turbine API.
 * @param message - A human-readable error message. It is typically the same as the message returned by the Turbine API.
 * @param details - Optional technical details about the error; e.g. the response body from the server. It is provided
 * by the SDK for debugging purposes. May contain the original response body, or any other details that are useful
 * for debugging.
 * @param inner - Optional inner errors if the main error wraps multiple errors. Only one level of nesting is supported.
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

export function isTurbineError(error: unknown): error is TurbineError {
    return (
        error instanceof Error &&
        "code" in error &&
        typeof (error as any).code === "string" &&
        "message" in error &&
        typeof (error as any).message === "string" &&
        error.name === "TurbineError"
    );
}

function isValidTurbineErrorPayload(item: any): boolean {
    return (
        item &&
        typeof item === "object" &&
        typeof item.code === "string" &&
        typeof item.message === "string"
    );
}

/**
 * Parses an error response from the API into a TurbineError
 *
 * @param responseText The response text body
 * @returns TurbineError
 * @throws Error if the response is not a valid TurbineError
 */
function parseErrorResponse(responseText: string): TurbineError {
    const parsed = JSON.parse(responseText);

    if (isValidTurbineErrorPayload(parsed)) {
        let code = parsed.code;
        let message = parsed.message;
        let inner = null;
        let details = null;

        if (!TURBINE_ERROR_CODES.includes(parsed.code)) {
            code = "UNKNOWN_ERROR";
            details = { originalCode: parsed.code };
        }

        if (parsed.inner && Array.isArray(parsed.inner)) {
            inner = parsed.inner
                .map((item: any) => {
                    if (isValidTurbineErrorPayload(item)) {
                        let innerCode = item.code;
                        let innerMessage = item.message;
                        let innerDetails = null;
                        if (!TURBINE_ERROR_CODES.includes(item.code)) {
                            innerCode = "UNKNOWN_ERROR";
                            innerDetails = { originalCode: item.code };
                        }
                        // Only one level of nesting is supported. We don't attempt to parse inner errors of inner errors.
                        return new TurbineError(innerCode, innerMessage, innerDetails);
                    } else {
                        return null;
                    }
                })
                .filter((item: TurbineError | null) => item !== null);
        }

        return new TurbineError(code, message, details, inner);
    }

    throw new Error("Invalid error response format");
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
    try {
        return parseErrorResponse(responseText);
    } catch (error) {
        return new TurbineError(
            response.status === 500 ? "INTERNAL_SERVER_ERROR" : "UNKNOWN_ERROR",
            responseText ||
                "An error occurred while processing your request. Please try again."
        );
    }
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
        return new TurbineError(
            "USER_REJECTION",
            "Rejected by the wallet. Please try again if you want to complete this operation.",
            errorMessage
        );
    }

    return new TurbineError("UNKNOWN_ERROR", errorMessage, error);
}
