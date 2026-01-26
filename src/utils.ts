import { TurbineError } from "./errorHandling";

/**
 * Constructs a URL by joining a base URL with an endpoint path.
 * Handles normalization and validation:
 * - Base URL is normalized to end with "/"
 * - Endpoint is normalized to not start with "/"
 * - URL is validated before being returned
 *
 * @param baseUrl - The base URL (e.g., "http://127.0.0.1:8080/api" or "http://127.0.0.1:8080/api/")
 * @param endpoint - The endpoint path (e.g., "config", or "/config")
 * @returns The constructed URL string
 * @throws TurbineError if the URL is invalid
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

    return new URL(normalizedEndpoint, normalizedBase).toString();
}
