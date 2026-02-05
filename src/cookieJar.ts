import { CookieJar } from "tough-cookie";

/**
 * Wrapper around tough-cookie's CookieJar to provide Turbine-specific cookie handling.
 * Manages session cookies with proper security (expiration, Secure flag, domain restrictions).
 */
export class TurbineCookieJar {
    private jar: CookieJar;

    constructor() {
        this.jar = new CookieJar();
    }

    /**
     * Store a cookie from a Set-Cookie header.
     * @param setCookieHeader The Set-Cookie header value
     * @param url The URL where the cookie was received
     */
    async setCookieFromHeader(setCookieHeader: string, url: string): Promise<void> {
        try {
            await this.jar.setCookie(setCookieHeader, url);
        } catch (error) {
            // Silently ignore invalid cookies (matches browser behavior)
            console.debug("Failed to set cookie:", error);
        }
    }

    /**
     * Get the Cookie header value for a given URL.
     * Respects all cookie security attributes (Secure, HttpOnly, Domain, Path, Expires, SameSite).
     * @param url The URL to get cookies for
     * @returns The Cookie header value (empty string if no cookies)
     */
    async getCookieHeader(url: string): Promise<string> {
        try {
            // Pass current time to ensure expired cookies are filtered out
            const cookieString = await this.jar.getCookieString(url, { expire: true });
            return cookieString;
        } catch (error) {
            console.debug("Failed to get cookies:", error);
            return "";
        }
    }

    /**
     * Clear all cookies from the jar.
     */
    async clear(): Promise<void> {
        try {
            await this.jar.removeAllCookies();
        } catch (error) {
            console.debug("Failed to clear cookies:", error);
        }
    }
}
