import { describe, expect, test } from "@jest/globals";
import { buildApiUrl, validateResponseSize } from "../src/utils";
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

    describe("Base containment enforcement", () => {
        const base = "https://api.turbine.example/api";

        test("rejects path traversal that escapes the base path", () => {
            expect(() => buildApiUrl(base, "../admin")).toThrow(TurbineError);
        });

        test("rejects absolute URL endpoints (cross-origin)", () => {
            expect(() => buildApiUrl(base, "https://attacker.example/collect")).toThrow(
                TurbineError
            );
        });

        test("rejects protocol-relative endpoints", () => {
            expect(() => buildApiUrl(base, "///attacker.example/collect")).toThrow(
                TurbineError
            );
        });

        test("rejects sibling paths sharing a prefix of the base", () => {
            // "/apifoo" must not satisfy containment of base path "/api/"
            expect(() => buildApiUrl(base, "../apifoo")).toThrow(TurbineError);
        });

        test("error message names the offending endpoint", () => {
            try {
                buildApiUrl(base, "https://attacker.example/collect");
                fail("Should have thrown an error");
            } catch (error) {
                expect(error).toBeInstanceOf(TurbineError);
                if (error instanceof TurbineError) {
                    expect(error.message).toContain("outside the configured API base");
                }
            }
        });

        test("allows legitimate endpoints within the base", () => {
            expect(buildApiUrl(base, "config")).toBe(
                "https://api.turbine.example/api/config"
            );
            expect(buildApiUrl(base, "/config")).toBe(
                "https://api.turbine.example/api/config"
            );
            expect(buildApiUrl(base, "orders?hash=a,b")).toBe(
                "https://api.turbine.example/api/orders?hash=a,b"
            );
        });
    });
});

describe("validateResponseSize", () => {
    test("should reject response with Content-Length exceeding limit", async () => {
        const maxSize = 100; // 100 bytes

        // Create mock response with Content-Length header exceeding limit
        const mockResponse = new Response("OK", {
            status: 200,
            headers: new Headers({
                "content-length": "200", // Exceeds 100 byte limit
            }),
        });

        await expect(validateResponseSize(mockResponse, maxSize)).rejects.toMatchObject(
            {
                code: "SDK_ERROR",
                message: expect.stringContaining(
                    "Response size (200 bytes) exceeds maximum allowed size (100 bytes)"
                ),
            }
        );
    });

    test("should accept response with Content-Length within limit", async () => {
        const maxSize = 200; // 200 bytes

        const body = "small response";
        const mockResponse = new Response(body, {
            status: 200,
            headers: new Headers({
                "content-length": body.length.toString(),
            }),
        });

        const validatedResponse = await validateResponseSize(mockResponse, maxSize);

        expect(validatedResponse).toBeDefined();
        const text = await validatedResponse.text();
        expect(text).toBe(body);
    });

    test("should reject single chunk exceeding limit", async () => {
        const maxSize = 100; // 100 bytes

        // Create a large chunk (exceeds maxSize in a single chunk)
        const largeChunk = new Uint8Array(150); // 150 bytes in one chunk
        largeChunk.fill(65); // Fill with 'A'

        // Create a ReadableStream that emits one large chunk
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(largeChunk);
                controller.close();
            },
        });

        const mockResponse = new Response(stream, {
            status: 200,
            headers: new Headers(),
        });

        await expect(validateResponseSize(mockResponse, maxSize)).rejects.toMatchObject(
            {
                code: "SDK_ERROR",
                message: expect.stringContaining(
                    "Single response chunk (150 bytes) exceeds maximum size (100 bytes)"
                ),
            }
        );
    });

    test("should reject accumulated chunks exceeding limit", async () => {
        const maxSize = 100; // 100 bytes

        // Create multiple small chunks that together exceed the limit
        const chunk1 = new Uint8Array(60); // 60 bytes
        const chunk2 = new Uint8Array(50); // 50 bytes
        // Total: 110 bytes (exceeds 100 byte limit)

        chunk1.fill(65); // Fill with 'A'
        chunk2.fill(66); // Fill with 'B'

        // Create a ReadableStream that emits multiple chunks
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(chunk1);
                controller.enqueue(chunk2);
                controller.close();
            },
        });

        const mockResponse = new Response(stream, {
            status: 200,
            headers: new Headers(),
        });

        await expect(validateResponseSize(mockResponse, maxSize)).rejects.toMatchObject(
            {
                code: "SDK_ERROR",
                message: expect.stringContaining(
                    "Response size exceeds maximum allowed size (100 bytes)"
                ),
            }
        );
    });

    test("should accept valid response with multiple chunks within limit", async () => {
        const maxSize = 200; // 200 bytes

        // Create multiple small chunks within the limit
        const chunk1 = new Uint8Array(50); // 50 bytes
        const chunk2 = new Uint8Array(50); // 50 bytes
        // Total: 100 bytes (within 200 byte limit)

        chunk1.fill(65); // Fill with 'A'
        chunk2.fill(66); // Fill with 'B'

        // Create a ReadableStream that emits multiple chunks
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(chunk1);
                controller.enqueue(chunk2);
                controller.close();
            },
        });

        const mockResponse = new Response(stream, {
            status: 200,
            headers: new Headers(),
        });

        const validatedResponse = await validateResponseSize(mockResponse, maxSize);

        expect(validatedResponse).toBeDefined();
        const arrayBuffer = await validatedResponse.arrayBuffer();
        expect(arrayBuffer.byteLength).toBe(100);
    });

    test("should handle response with no body", async () => {
        const maxSize = 100;

        // Create response with null body
        const mockResponse = new Response(null, {
            status: 204, // No Content
            headers: new Headers(),
        });

        const validatedResponse = await validateResponseSize(mockResponse, maxSize);

        expect(validatedResponse).toBeDefined();
        expect(validatedResponse.body).toBeNull();
    });
});
