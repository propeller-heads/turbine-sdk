/**
 * TurbineError class provides structured error handling for Turbine SDK.
 * It formats technical error messages into user-friendly versions while
 * preserving the original technical details for debugging.
 */
export class TurbineError extends Error {
    public readonly code: string;
    public readonly originalMessage: string;
    public readonly userMessage: string;

    constructor(code: string, originalMessage: string, userMessage: string) {
        // Pass the user-friendly message to the Error constructor
        super(userMessage);

        this.code = code;
        this.originalMessage = originalMessage;
        this.userMessage = userMessage;

        // Set the name to match the class name
        this.name = 'TurbineError';

        // Maintains proper stack trace for where our error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, TurbineError);
        }
    }

    /**
     * Returns the raw error with technical details for logging
     */
    public getTechnicalDetails(): string {
        return `[${this.code}] ${this.originalMessage}`;
    }
}

/**
 * Creates a TurbineError from an API response error
 * @param response The response object from the fetch API
 * @param responseText The response text body
 * @param code Optional error code to use (if not provided, will be determined from response status)
 * @param userMessage Optional user-friendly message (if not provided, will be determined from response status)
 */
export function unsuccessfulResponseToTurbineError(
    response: Response,
    responseText: string,
    code?: string,
    userMessage?: string
): TurbineError {
    // Parse the response text to extract error details if possible
    let errorDetails;
    try {
        const parsedError = JSON.parse(responseText);
        if (parsedError && parsedError.error) {
            errorDetails = parsedError.error;
        }
    } catch (e) {
        // If parsing fails, use the original response text
        errorDetails = responseText;
    }

    const originalMessage = `Failed to process request: ${response.status} ${response.statusText}, ${responseText}`;

    // If code and userMessage are provided, use those directly
    if (code && userMessage) {
        return new TurbineError(code, originalMessage, userMessage);
    }

    // Otherwise, determine code and message based on response status
    switch (response.status) {
        case 400:
            return new TurbineError(
                "API_BAD_REQUEST",
                originalMessage,
                "The request couldn't be processed. Please try again with different parameters."
            );
        case 401:
        case 403:
            return new TurbineError(
                "API_UNAUTHORIZED",
                originalMessage,
                "Authorization failed. Please check your credentials."
            );
        case 404:
            return new TurbineError(
                "API_NOT_FOUND",
                originalMessage,
                "The requested resource was not found."
            );
        case 500:
            return new TurbineError(
                "API_SERVER_ERROR",
                originalMessage,
                "Server error occurred. Our team has been notified. Please try again later."
            );
        default:
            if (response.status >= 500) {
                return new TurbineError(
                    "API_SERVER_ERROR",
                    originalMessage,
                    "Server error occurred. Please try again later."
                );
            } else {
                return new TurbineError(
                    "API_UNKNOWN_ERROR",
                    originalMessage,
                    "An error occurred while processing your request. Please try again."
                );
            }
    }
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
            errorMessage,
            "Failed to process the server response. Please try again later."
        );
    }

    // Handle missing field errors
    if (errorMessage.includes("Response missing required")) {
        if (errorMessage.includes("order_hash")) {
            return new TurbineError(
                "MISSING_ORDER_HASH",
                errorMessage,
                "Order was submitted but order confirmation is missing. Please check your orders to verify if it was processed."
            );
        } else if (errorMessage.includes("hash field")) {
            return new TurbineError(
                "MISSING_HASH",
                errorMessage,
                "Transaction was submitted but confirmation is missing. Please check your transactions to verify if it was processed."
            );
        } else {
            return new TurbineError(
                "MISSING_FIELD",
                errorMessage,
                "Transaction was submitted but some confirmation details are missing. Please check your orders/transactions to verify if it was processed."
            );
        }
    }

    // Handle user rejection errors
    if (errorMessage.includes("User rejected") || errorMessage.includes("user rejected")) {
        return new TurbineError(
            "USER_REJECTION",
            errorMessage,
            "Rejected by the wallet. Please try again if you want to complete this operation."
        );
    }

    // Default error
    return new TurbineError(
        "UNKNOWN_ERROR",
        errorMessage,
        "An unexpected error occurred. Please try again."
    );
}