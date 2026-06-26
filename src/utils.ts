import { TurbineError } from "./errorHandling";

export const MAX_RESPONSE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Constructs a URL by joining a base URL with an endpoint path.
 * Handles normalization and validation:
 * - Base URL is normalized to end with "/"
 * - Endpoint is normalized to not start with "/"
 * - URL is validated before being returned
 * - The resolved URL must stay within the configured base origin and path
 *   (traversal, absolute, and protocol-relative endpoints are rejected)
 * - HTTPS is enforced (except for localhost/127.0.0.1)
 *
 * @param baseUrl - The base URL (e.g., "http://127.0.0.1:8080/api" or "https://api.example.com/v1")
 * @param endpoint - The endpoint path (e.g., "config", or "/config")
 * @returns The constructed URL string
 * @throws TurbineError if the URL is invalid, escapes the base, or uses HTTP for non-localhost
 */
export function buildApiUrl(baseUrl: string, endpoint: string): string {
    const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    const normalizedEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;

    if (!URL.canParse(normalizedEndpoint, normalizedBase)) {
        throw new TurbineError(
            "SDK_ERROR",
            `Failed to construct URL from base "${baseUrl}" and endpoint "${endpoint}": ${normalizedEndpoint}${normalizedBase}`
        );
    }

    const base = new URL(normalizedBase);
    const url = new URL(normalizedEndpoint, normalizedBase);

    // Ensure the endpoint resolves within the configured API base. This rejects
    // absolute URLs ("https://attacker"), protocol-relative URLs ("//attacker"),
    // and path traversal ("../admin") that would otherwise escape the base.
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
        throw new TurbineError(
            "SDK_ERROR",
            `Endpoint "${endpoint}" resolved outside the configured API base "${baseUrl}": ${url.toString()}`
        );
    }

    // Enforce HTTPS except for localhost/127.0.0.1 (for development)
    if (
        url.protocol === "http:" &&
        url.hostname !== "localhost" &&
        url.hostname !== "127.0.0.1" &&
        url.hostname !== "[::1]"
    ) {
        throw new TurbineError(
            "SDK_ERROR",
            `HTTPS required for non-localhost URLs. Attempted to use: ${url.toString()}`
        );
    }

    return url.toString();
}

/**
 * Reads response body with size limit to prevent memory exhaustion attacks.
 * Streams the response chunk-by-chunk, checking size BEFORE accumulating each chunk.
 *
 * @param response - The fetch Response object
 * @param maxSize - Maximum allowed size in bytes (default: 10 MB)
 * @returns Response with validated body
 * @throws TurbineError if response exceeds size limit
 */
export async function validateResponseSize(
    response: Response,
    maxSize: number = MAX_RESPONSE_SIZE_BYTES
): Promise<Response> {
    const contentLength = response.headers.get("content-length");

    // Early optimization: check Content-Length header if present
    // Note: This is not relied upon for security as headers can be missing or incorrect
    if (contentLength) {
        const size = parseInt(contentLength, 10);
        if (size > maxSize) {
            throw new TurbineError(
                "SDK_ERROR",
                `Response size (${size} bytes) exceeds maximum allowed size (${maxSize} bytes)`
            );
        }
    }

    // Stream and validate response body chunk-by-chunk
    if (!response.body) {
        return response;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // SECURITY: Check individual chunk size FIRST
            // Runtime-provided chunks could be arbitrarily large, and we must not
            // accumulate them into memory if they exceed our safety threshold
            if (value.length > maxSize) {
                await reader.cancel();
                throw new TurbineError(
                    "SDK_ERROR",
                    `Single response chunk (${value.length} bytes) exceeds maximum size (${maxSize} bytes)`
                );
            }

            // Check total accumulated size BEFORE adding this chunk
            if (totalSize + value.length > maxSize) {
                await reader.cancel();
                throw new TurbineError(
                    "SDK_ERROR",
                    `Response size exceeds maximum allowed size (${maxSize} bytes)`
                );
            }

            chunks.push(value);
            totalSize += value.length;
        }
    } finally {
        reader.releaseLock();
    }

    // Create a new Response from the validated chunks
    const blob = new Blob(chunks);
    return new Response(blob, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
    });
}
