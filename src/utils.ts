import { TurbineError } from "./errorHandling";

/**
 * Constructs a URL by joining a base URL with an endpoint path.
 * Handles normalization and validation:
 * - Base URL is normalized to end with "/"
 * - Endpoint is normalized to not start with "/"
 * - URL is validated before being returned
 * - HTTPS is enforced (except for localhost/127.0.0.1)
 *
 * @param baseUrl - The base URL (e.g., "http://127.0.0.1:8080/api" or "https://api.example.com/v1")
 * @param endpoint - The endpoint path (e.g., "config", or "/config")
 * @returns The constructed URL string
 * @throws TurbineError if the URL is invalid or uses HTTP for non-localhost
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

    const url = new URL(normalizedEndpoint, normalizedBase);

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
