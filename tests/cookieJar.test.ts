import { describe, expect, it } from "@jest/globals";
import { TurbineCookieJar } from "../src/cookieJar";

describe("TurbineCookieJar", () => {
    it("should create a new CookieJar instance", () => {
        const jar = new TurbineCookieJar();
        expect(jar).toBeDefined();
    });

    it("should store cookies from set-cookie header", async () => {
        const jar = new TurbineCookieJar();
        const url = "https://api.turbine.com/api/nonce";
        const setCookieHeader = "id=session123; Path=/; HttpOnly; Secure; SameSite=Lax";

        await jar.setCookieFromHeader(setCookieHeader, url);
        const cookieHeader = await jar.getCookieHeader(url);

        expect(cookieHeader).toContain("id=session123");
    });

    it("should not send cookies for HTTP when marked Secure", async () => {
        const jar = new TurbineCookieJar();
        const httpsUrl = "https://api.turbine.com/api/nonce";
        const httpUrl = "http://api.turbine.com/api/nonce";
        const setCookieHeader = "id=session123; Path=/; HttpOnly; Secure; SameSite=Lax";

        await jar.setCookieFromHeader(setCookieHeader, httpsUrl);
        const httpCookieHeader = await jar.getCookieHeader(httpUrl);

        expect(httpCookieHeader).toBe("");
    });

    it("should respect cookie expiration", async () => {
        const jar = new TurbineCookieJar();
        const url = "https://api.turbine.com/api/nonce";
        const pastDate = new Date(Date.now() - 1000).toUTCString();
        const setCookieHeader = `id=expired123; Path=/; Expires=${pastDate}`;

        await jar.setCookieFromHeader(setCookieHeader, url);
        const cookieHeader = await jar.getCookieHeader(url);

        expect(cookieHeader).toBe("");
    });

    it("should respect domain restrictions", async () => {
        const jar = new TurbineCookieJar();
        const url1 = "https://api.turbine.com/api/nonce";
        const url2 = "https://evil.com/api/nonce";
        const setCookieHeader = "id=session123; Path=/; Domain=api.turbine.com";

        await jar.setCookieFromHeader(setCookieHeader, url1);
        const cookieHeader1 = await jar.getCookieHeader(url1);
        const cookieHeader2 = await jar.getCookieHeader(url2);

        expect(cookieHeader1).toContain("id=session123");
        expect(cookieHeader2).toBe("");
    });

    it("should handle multiple cookies", async () => {
        const jar = new TurbineCookieJar();
        const url = "https://api.turbine.com/api/nonce";

        await jar.setCookieFromHeader("id=session123; Path=/", url);
        await jar.setCookieFromHeader("token=abc456; Path=/", url);

        const cookieHeader = await jar.getCookieHeader(url);

        expect(cookieHeader).toContain("id=session123");
        expect(cookieHeader).toContain("token=abc456");
    });

    it("should clear all cookies", async () => {
        const jar = new TurbineCookieJar();
        const url = "https://api.turbine.com/api/nonce";

        await jar.setCookieFromHeader("id=session123; Path=/", url);
        await jar.clear();

        const cookieHeader = await jar.getCookieHeader(url);
        expect(cookieHeader).toBe("");
    });

    it("should handle HttpOnly cookies correctly", async () => {
        const jar = new TurbineCookieJar();
        const url = "https://api.turbine.com/api/nonce";

        // HttpOnly cookies should be stored and sent in HTTP requests
        // (HttpOnly prevents JavaScript access, but CookieJar should still handle them)
        const setCookieHeader = "id=session123; Path=/; HttpOnly; Secure";

        await jar.setCookieFromHeader(setCookieHeader, url);
        const cookieHeader = await jar.getCookieHeader(url);

        // Should still be sent in requests (HttpOnly doesn't block HTTP requests)
        expect(cookieHeader).toContain("id=session123");
    });

    it("should not send cookies with all security attributes over HTTP", async () => {
        const jar = new TurbineCookieJar();
        const httpsUrl = "https://api.turbine.com/api/nonce";
        const httpUrl = "http://api.turbine.com/api/nonce";

        // Cookie with ALL security attributes
        const setCookieHeader =
            "id=session123; Path=/; Secure; HttpOnly; SameSite=Strict";

        await jar.setCookieFromHeader(setCookieHeader, httpsUrl);

        // Should work over HTTPS
        const httpsHeader = await jar.getCookieHeader(httpsUrl);
        expect(httpsHeader).toContain("id=session123");

        // Should NOT work over HTTP (Secure flag)
        const httpHeader = await jar.getCookieHeader(httpUrl);
        expect(httpHeader).toBe("");
    });

    it("should reject expired cookies even with other security attributes", async () => {
        const jar = new TurbineCookieJar();
        const url = "https://api.turbine.com/api/nonce";

        // Expired cookie with security attributes should still be rejected
        const pastDate = new Date(Date.now() - 1000).toUTCString();
        const setCookieHeader = `id=session123; Path=/; Expires=${pastDate}; Secure; HttpOnly; SameSite=Strict`;

        await jar.setCookieFromHeader(setCookieHeader, url);
        const cookieHeader = await jar.getCookieHeader(url);

        // Should not send expired cookie regardless of other attributes
        expect(cookieHeader).toBe("");
    });

    it("should enforce domain restrictions even with security attributes", async () => {
        const jar = new TurbineCookieJar();
        const turbineUrl = "https://api.turbine.com/api/nonce";
        const evilUrl = "https://evil.com/api/nonce";

        // Cookie with domain restriction and security attributes
        const setCookieHeader =
            "id=session123; Path=/; Domain=api.turbine.com; Secure; HttpOnly; SameSite=Strict";

        await jar.setCookieFromHeader(setCookieHeader, turbineUrl);

        // Should work for correct domain
        const turbineHeader = await jar.getCookieHeader(turbineUrl);
        expect(turbineHeader).toContain("id=session123");

        // Should NOT work for different domain
        const evilHeader = await jar.getCookieHeader(evilUrl);
        expect(evilHeader).toBe("");
    });
});
