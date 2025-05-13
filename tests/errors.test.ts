import { describe, expect, jest, it } from "@jest/globals";
import { handleError, TurbineError, createApiError } from "../src/errorHandling";
import { TurbineClient } from "../src/turbineClient";
import {
    ORDER_INTENT,
    PUBLIC_CLIENT,
    WALLET_CLIENT,
} from "./constants";
import { Hex } from "viem";

describe("TurbineError", () => {
    it("should create a TurbineError with all properties", () => {
        const error = new TurbineError(
            "TEST_CODE",
            "Original technical message",
            "User-friendly message"
        );

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(TurbineError);
        expect(error.code).toBe("TEST_CODE");
        expect(error.originalMessage).toBe("Original technical message");
        expect(error.userMessage).toBe("User-friendly message");
        expect(error.message).toBe("User-friendly message"); // Error.message should be user-friendly
        expect(error.name).toBe("TurbineError");
    });

    it("should preserve technical details while providing user-friendly message", () => {
        const error = new TurbineError(
            "TEST_CODE",
            "Original technical message with JSON: {\"error\":\"Invalid order\"}",
            "Your order couldn't be processed"
        );

        expect(error.message).toBe("Your order couldn't be processed");
        expect(error.getTechnicalDetails()).toContain("TEST_CODE");
        expect(error.getTechnicalDetails()).toContain("Original technical message");
    });
});

describe("handleError", () => {
    it("should pass through TurbineError instances", () => {
        const original = new TurbineError("TEST", "Original", "User");
        const result = handleError(original);

        expect(result).toBe(original);
    });

    it("should convert parse errors to appropriate TurbineError", () => {
        const parseError = new Error("Failed to parse response as JSON: SyntaxError");
        const result = handleError(parseError);

        expect(result).toBeInstanceOf(TurbineError);
        expect(result.code).toBe("PARSE_ERROR");
        expect(result.originalMessage).toBe("Failed to parse response as JSON: SyntaxError");
        expect(result.message).toContain("Failed to process the server response");
    });

    it("should convert missing field errors to appropriate TurbineError", () => {
        const missingFieldError = new Error("Response missing required order_hash field: {}");
        const result = handleError(missingFieldError);

        expect(result).toBeInstanceOf(TurbineError);
        expect(result.code).toBe("MISSING_ORDER_HASH");
        expect(result.originalMessage).toBe("Response missing required order_hash field: {}");
        expect(result.message).toContain("Order was submitted but");
    });

    it("should convert user rejection errors to appropriate TurbineError", () => {
        const rejectionError = new Error("User rejected the request");
        const result = handleError(rejectionError);

        expect(result).toBeInstanceOf(TurbineError);
        expect(result.code).toBe("USER_REJECTION");
        expect(result.message).toContain("Rejected by the wallet");
    });

    it("should convert unknown errors to default TurbineError", () => {
        const unknownError = new Error("Some unexpected error");
        const result = handleError(unknownError);

        expect(result).toBeInstanceOf(TurbineError);
        expect(result.code).toBe("UNKNOWN_ERROR");
        expect(result.message).toContain("unexpected error occurred");
    });
});

describe("createApiError", () => {
    it("should create appropriate error for invalid order format", () => {
        const response = {
            ok: false,
            status: 400,
            statusText: "Bad Request"
        } as Response;

        const responseText = JSON.stringify({ error: "Invalid order format" });
        const error = createApiError(response, responseText);

        expect(error).toBeInstanceOf(TurbineError);
        expect(error.code).toBe("API_INVALID_FORMAT");
        expect(error.message).toContain("Order format is invalid");
    });

    it("should create appropriate error for insufficient balance", () => {
        const response = {
            ok: false,
            status: 400,
            statusText: "Bad Request"
        } as Response;

        const responseText = JSON.stringify({ error: "Insufficient balance for this operation" });
        const error = createApiError(response, responseText);

        expect(error).toBeInstanceOf(TurbineError);
        expect(error.code).toBe("API_INSUFFICIENT_BALANCE");
        expect(error.message).toContain("Insufficient balance");
    });

    it("should create appropriate error for slippage tolerance exceeded", () => {
        const response = {
            ok: false,
            status: 400,
            statusText: "Bad Request"
        } as Response;

        const responseText = JSON.stringify({ error: "Slippage tolerance exceeded" });
        const error = createApiError(response, responseText);

        expect(error).toBeInstanceOf(TurbineError);
        expect(error.code).toBe("API_SLIPPAGE_EXCEEDED");
        expect(error.message).toContain("Slippage tolerance exceeded");
    });

    it("should create appropriate error for server errors", () => {
        const response = {
            ok: false,
            status: 500,
            statusText: "Internal Server Error"
        } as Response;

        const responseText = JSON.stringify({ error: "Server processing error" });
        const error = createApiError(response, responseText);

        expect(error).toBeInstanceOf(TurbineError);
        expect(error.code).toBe("API_SERVER_ERROR");
        expect(error.message).toContain("Server error occurred");
    });
});

describe("TurbineClient Error Handling", () => {
    describe("addOrder", () => {
        it("should throw TurbineError in case of unexpected API response in json", async () => {
            const client = new TurbineClient();

            const mockResponse = new Response(
                JSON.stringify({ message: "something went wrong" })
            );
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                mockResponse
            );

            await expect(
                client.addOrder(ORDER_INTENT, WALLET_CLIENT, PUBLIC_CLIENT)
            ).rejects.toThrow(TurbineError);

            await client
                .addOrder(ORDER_INTENT, WALLET_CLIENT, PUBLIC_CLIENT)
                .catch((error) => {
                    expect(error).toBeInstanceOf(TurbineError);
                    expect(error.code).toBeTruthy();
                    expect(error.originalMessage).toBeTruthy();
                    expect(error.message).toBeTruthy(); // user-friendly message
                });
        });

        it("should throw TurbineError in case of malformed API response", async () => {
            const client = new TurbineClient();

            const mockResponse = new Response("happy chrysler");
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                mockResponse
            );

            const error = await client
                .addOrder(ORDER_INTENT, WALLET_CLIENT, PUBLIC_CLIENT)
                .catch((e) => e);

            expect(error).toBeInstanceOf(TurbineError);
            expect(error.code).toBeTruthy();
            expect(error.originalMessage).toBeTruthy();
            expect(error.message).toBeTruthy();
        });
    });

    describe("addOrders", () => {
        it("should throw TurbineError in case of unexpected API response in json", async () => {
            const client = new TurbineClient();

            const mockResponse = new Response(
                JSON.stringify({ message: "something went wrong" })
            );
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                mockResponse
            );

            await expect(
                client.addOrders([ORDER_INTENT], WALLET_CLIENT, PUBLIC_CLIENT)
            ).rejects.toThrow(TurbineError);

            await client
                .addOrders([ORDER_INTENT], WALLET_CLIENT, PUBLIC_CLIENT)
                .catch((error) => {
                    expect(error).toBeInstanceOf(TurbineError);
                    expect(error.code).toBeTruthy();
                    expect(error.originalMessage).toBeTruthy();
                    expect(error.message).toBeTruthy();
                });
        });

        it("should throw TurbineError in case of malformed API response", async () => {
            const client = new TurbineClient();

            const mockResponse = new Response("happy chrysler");
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                mockResponse
            );

            const error = await client
                .addOrders([ORDER_INTENT], WALLET_CLIENT, PUBLIC_CLIENT)
                .catch((e) => e);

            expect(error).toBeInstanceOf(TurbineError);
            expect(error.code).toBeTruthy();
            expect(error.originalMessage).toBeTruthy();
            expect(error.message).toBeTruthy();
        });

        it("should throw TurbineError for empty array of orders", async () => {
            const client = new TurbineClient();

            const mockResponse = new Response(JSON.stringify([]));
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                mockResponse
            );

            await expect(
                client.addOrders([], WALLET_CLIENT, PUBLIC_CLIENT)
            ).rejects.toThrow(TurbineError);

            await client.addOrders([], WALLET_CLIENT, PUBLIC_CLIENT)
                .catch((error) => {
                    expect(error).toBeInstanceOf(TurbineError);
                    expect(error.code).toBeTruthy();
                    expect(error.originalMessage).toBeTruthy();
                    expect(error.message).toBeTruthy();
                });
        });
    });

    describe("cancelOrder", () => {
        it("should throw TurbineError in case of unexpected API response in json", async () => {
            const mockOrderHash =
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
            const client = new TurbineClient();

            // Mock the response
            const mockResponse = new Response(
                JSON.stringify({ error: "something went wrong" })
            );
            jest.spyOn(global, "fetch").mockResolvedValue(mockResponse);

            await expect(
                client.cancelOrder(mockOrderHash as Hex, WALLET_CLIENT)
            ).rejects.toThrow(TurbineError);

            await client.cancelOrder(mockOrderHash as Hex, WALLET_CLIENT)
                .catch((error) => {
                    expect(error).toBeInstanceOf(TurbineError);
                    expect(error.code).toBeTruthy();
                    expect(error.originalMessage).toBeTruthy();
                    expect(error.message).toBeTruthy();
                });
        });

        it("should throw TurbineError in case of malformed API response", async () => {
            const mockOrderHash =
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
            const client = new TurbineClient();

            // Mock with invalid JSON
            const mockResponse = new Response("happy chrysler");
            jest.spyOn(global, "fetch").mockResolvedValue(mockResponse);

            const error = await client
                .cancelOrder(mockOrderHash as Hex, WALLET_CLIENT)
                .catch((e) => e);

            expect(error).toBeInstanceOf(TurbineError);
            expect(error.code).toBeTruthy();
            expect(error.originalMessage).toBeTruthy();
            expect(error.message).toBeTruthy();
        });

        it("should throw TurbineError when API returns non-ok response", async () => {
            const mockOrderHash =
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
            const client = new TurbineClient();

            // Mock a failed response
            const mockResponse = new Response("Order not found", {
                status: 404,
                statusText: "Not Found",
            });
            jest.spyOn(global, "fetch").mockResolvedValue(mockResponse);

            await expect(
                client.cancelOrder(mockOrderHash as Hex, WALLET_CLIENT)
            ).rejects.toThrow(TurbineError);

            await client.cancelOrder(mockOrderHash as Hex, WALLET_CLIENT)
                .catch((error) => {
                    expect(error).toBeInstanceOf(TurbineError);
                    expect(error.code).toBeTruthy();
                    expect(error.originalMessage).toBeTruthy();
                    expect(error.message).toBeTruthy();
                });
        });
    });
});