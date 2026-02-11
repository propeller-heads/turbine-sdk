/**
 * Wrapper around tough-cookie's CookieJar to provide Turbine-specific cookie handling.
 * Manages session cookies with proper security (expiration, Secure flag, domain restrictions).
 *
 * In Node.js: uses tough-cookie for manual cookie management (since Node's fetch
 * doesn't have a built-in cookie store).
 *
 * In the browser: all methods are no-ops. The browser handles cookies natively
 * via fetch with `credentials: "include"`.
 */

interface CookieJarLike {
    setCookie(cookie: string, url: string): Promise<unknown>;
    getCookieString(url: string, options?: Record<string, unknown>): Promise<string>;
    removeAllCookies(): Promise<void>;
}

export class TurbineCookieJar {
    private jar: CookieJarLike | null = null;

    constructor() {
        if (typeof window === "undefined") {
            try {
                // Dynamic require prevents bundlers from including tough-cookie
                // in browser builds. The variable indirection ensures bundlers
                // cannot statically analyze and bundle this dependency.
                const requireFn =
                    typeof module !== "undefined" &&
                    typeof module.require === "function"
                        ? module.require.bind(module)
                        : undefined;
                if (requireFn) {
                    const { CookieJar } = requireFn("tough-cookie");
                    this.jar = new CookieJar();
                }
            } catch {
                // tough-cookie not available — cookie management disabled
            }
        }
        // In browser environments, jar stays null — cookies are handled natively
    }

    /**
     * Store a cookie from a Set-Cookie header.
     * No-op in browser environments.
     * @param setCookieHeader The Set-Cookie header value
     * @param url The URL where the cookie was received
     */
    async setCookieFromHeader(setCookieHeader: string, url: string): Promise<void> {
        if (!this.jar) return;
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
     * Returns empty string in browser environments.
     * @param url The URL to get cookies for
     * @returns The Cookie header value (empty string if no cookies)
     */
    async getCookieHeader(url: string): Promise<string> {
        if (!this.jar) return "";
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
     * No-op in browser environments.
     */
    async clear(): Promise<void> {
        if (!this.jar) return;
        try {
            await this.jar.removeAllCookies();
        } catch (error) {
            console.debug("Failed to clear cookies:", error);
        }
    }
}
