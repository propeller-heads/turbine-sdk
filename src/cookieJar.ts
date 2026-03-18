/**
 * Wrapper around tough-cookie's CookieJar to provide Turbine-specific cookie handling.
 *
 * In Node.js: uses tough-cookie for manual cookie management (since Node's fetch
 * doesn't have a built-in cookie store). tough-cookie is loaded via dynamic import()
 * so bundlers can tree-shake it out of browser builds.
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
    private initPromise: Promise<void> | null = null;

    private async init(): Promise<void> {
        if (typeof window !== "undefined") return;
        try {
            const { CookieJar } = await import("tough-cookie");
            this.jar = new CookieJar();
        } catch {
            // tough-cookie not available — cookie management disabled
        }
    }

    private ensureInit(): Promise<void> {
        if (!this.initPromise) {
            this.initPromise = this.init();
        }
        return this.initPromise;
    }

    async setCookieFromHeader(setCookieHeader: string, url: string): Promise<void> {
        await this.ensureInit();
        if (!this.jar) return;
        try {
            await this.jar.setCookie(setCookieHeader, url);
        } catch (error) {
            console.debug("Failed to set cookie:", error);
        }
    }

    async getCookieHeader(url: string): Promise<string> {
        await this.ensureInit();
        if (!this.jar) return "";
        try {
            const cookieString = await this.jar.getCookieString(url, { expire: true });
            return cookieString;
        } catch (error) {
            console.debug("Failed to get cookies:", error);
            return "";
        }
    }

    async clear(): Promise<void> {
        await this.ensureInit();
        if (!this.jar) return;
        try {
            await this.jar.removeAllCookies();
        } catch (error) {
            console.debug("Failed to clear cookies:", error);
        }
    }
}
