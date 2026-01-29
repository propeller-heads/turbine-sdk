import { describe, expect, test } from "@jest/globals";
import { buildApiUrl } from "../src/utils";
import { TurbineError } from "../src/errorHandling";

describe("buildApiUrl", () => {
    describe("Both normalizations together", () => {
        test("base without slash + endpoint with slash", () => {
            const result = buildApiUrl("http://127.0.0.1:8080/api", "/config");
            expect(result).toBe("http://127.0.0.1:8080/api/config");
        });

        test("base with slash + endpoint without slash", () => {
            const result = buildApiUrl("http://127.0.0.1:8080/api/", "config");
            expect(result).toBe("http://127.0.0.1:8080/api/config");
        });

        test("base with slash + endpoint with slash", () => {
            const result = buildApiUrl("http://127.0.0.1:8080/api/", "/config");
            expect(result).toBe("http://127.0.0.1:8080/api/config");
        });

        test("base without slash + endpoint without slash", () => {
            const result = buildApiUrl("http://127.0.0.1:8080/api", "config");
            expect(result).toBe("http://127.0.0.1:8080/api/config");
        });
    });

    describe("Why normalization is necessary", () => {
        test("demonstrates URL constructor behavior with leading slash", () => {
            // Raw URL constructor with leading slash loses the path
            const baseUrl = "http://127.0.0.1:8080/api/";
            const wrongUrl = new URL("/config", baseUrl).toString();
            expect(wrongUrl).toBe("http://127.0.0.1:8080/config"); // Lost /api!

            // buildApiUrl strips the leading slash to preserve the path
            const correctUrl = buildApiUrl("http://127.0.0.1:8080/api/", "/config");
            expect(correctUrl).toBe("http://127.0.0.1:8080/api/config"); // Preserves /api
        });

        test("demonstrates URL constructor behavior with endpoint without slash", () => {
            // URL constructor works correctly when endpoint doesn't start with /
            const baseUrl = "http://127.0.0.1:8080/api/";
            const correctUrl = new URL("config", baseUrl).toString();
            expect(correctUrl).toBe("http://127.0.0.1:8080/api/config");

            // buildApiUrl produces the same result
            const result = buildApiUrl("http://127.0.0.1:8080/api/", "config");
            expect(result).toBe("http://127.0.0.1:8080/api/config");
        });
    });

    describe("Error handling", () => {
        test("throws TurbineError for invalid base URL", () => {
            expect(() => buildApiUrl("not-a-url", "config")).toThrow(TurbineError);
        });

        test("throws TurbineError for relative path as base URL", () => {
            expect(() => buildApiUrl("/relative/path", "config")).toThrow(TurbineError);
        });

        test("error message includes both base and endpoint", () => {
            try {
                buildApiUrl("invalid-url", "config");
                fail("Should have thrown an error");
            } catch (error) {
                expect(error).toBeInstanceOf(TurbineError);
                if (error instanceof TurbineError) {
                    expect(error.message).toContain("invalid-url");
                    expect(error.message).toContain("config");
                }
            }
        });
    });

    describe("HTTPS enforcement", () => {
        test("allows HTTPS URLs", () => {
            const result = buildApiUrl("https://api.example.com/v1", "config");
            expect(result).toBe("https://api.example.com/v1/config");
        });

        test("allows HTTP for localhost", () => {
            const result = buildApiUrl("http://localhost:8080/api", "config");
            expect(result).toBe("http://localhost:8080/api/config");
        });

        test("allows HTTP for 127.0.0.1", () => {
            const result = buildApiUrl("http://127.0.0.1:8080/api", "config");
            expect(result).toBe("http://127.0.0.1:8080/api/config");
        });

        test("allows HTTP for ::1 (IPv6 localhost)", () => {
            const result = buildApiUrl("http://[::1]:8080/api", "config");
            expect(result).toBe("http://[::1]:8080/api/config");
        });

        test("rejects HTTP for non-localhost URLs", () => {
            expect(() => buildApiUrl("http://api.example.com/v1", "config")).toThrow(
                TurbineError
            );
        });

        test("error message explains HTTPS requirement", () => {
            try {
                buildApiUrl("http://api.example.com/v1", "config");
                fail("Should have thrown an error");
            } catch (error) {
                expect(error).toBeInstanceOf(TurbineError);
                if (error instanceof TurbineError) {
                    expect(error.message).toContain("HTTPS required");
                    expect(error.message).toContain("http://api.example.com");
                }
            }
        });

        test("rejects HTTP for IP addresses other than localhost", () => {
            expect(() => buildApiUrl("http://192.168.1.1:8080/api", "config")).toThrow(
                TurbineError
            );
        });
    });
});
