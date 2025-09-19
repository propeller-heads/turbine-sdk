import { describe, expect, jest, it } from "@jest/globals";
import {
    toTurbineError,
    TurbineError,
    unsuccessfulResponseToTurbineError,
} from "../src/errorHandling";
import { TurbineClient } from "../src/turbineClient";
import {
    ORDER_INTENT,
    WALLET_CLIENT,
    PUBLIC_CLIENT,
    createMockTurbineClient,
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
            'Original technical message with JSON: {"error":"Invalid order"}',
            "Your order couldn't be processed"
        );

        expect(error.message).toBe("Your order couldn't be processed");
        expect(error.getTechnicalDetails()).toContain("TEST_CODE");
        expect(error.getTechnicalDetails()).toContain("Original technical message");
    });
});

describe("toTurbineError", () => {
    it("should pass through TurbineError instances", () => {
        const original = new TurbineError("TEST", "Original", "User");
        const result = toTurbineError(original);

        expect(result).toBe(original);
    });

    it("should convert parse errors to appropriate TurbineError", () => {
        const parseError = new Error("Failed to parse response as JSON: SyntaxError");
        const result = toTurbineError(parseError);

        expect(result).toBeInstanceOf(TurbineError);
        expect(result.code).toBe("PARSE_ERROR");
        expect(result.originalMessage).toBe(
            "Failed to parse response as JSON: SyntaxError"
        );
        expect(result.message).toContain("Failed to process the server response");
    });

    it("should convert missing field errors to appropriate TurbineError", () => {
        const missingFieldError = new Error(
            "Response missing required orderHash field: {}"
        );
        const result = toTurbineError(missingFieldError);

        expect(result).toBeInstanceOf(TurbineError);
        expect(result.code).toBe("MISSING_FIELD");
        expect(result.originalMessage).toBe(
            "Response missing required orderHash field: {}"
        );
        expect(result.message).toContain("Transaction was submitted but");
    });

    it("should convert user rejection errors to appropriate TurbineError", () => {
        const rejectionError = new Error("User rejected the request");
        const result = toTurbineError(rejectionError);

        expect(result).toBeInstanceOf(TurbineError);
        expect(result.code).toBe("USER_REJECTION");
        expect(result.message).toContain("Rejected by the wallet");
    });

    it("should convert unknown errors to default TurbineError", () => {
        const unknownError = new Error("Some unexpected error");
        const result = toTurbineError(unknownError);

        expect(result).toBeInstanceOf(TurbineError);
        expect(result.code).toBe("UNKNOWN_ERROR");
        expect(result.message).toContain("unexpected error occurred");
    });
});

describe("unsuccessfulResponseToTurbineError", () => {
    it("should create appropriate error for bad request", () => {
        const response = {
            ok: false,
            status: 400,
            statusText: "Bad Request",
        } as Response;

        const responseText = JSON.stringify({ error: "Some bad request error" });
        const error = unsuccessfulResponseToTurbineError(response, responseText);

        expect(error).toBeInstanceOf(TurbineError);
        expect(error.code).toBe("API_BAD_REQUEST");
        expect(error.message).toContain("The request couldn't be processed");
    });

    it("should create appropriate error for server errors", () => {
        const response = {
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
        } as Response;

        const responseText = JSON.stringify({ error: "Server processing error" });
        const error = unsuccessfulResponseToTurbineError(response, responseText);

        expect(error).toBeInstanceOf(TurbineError);
        expect(error.code).toBe("API_SERVER_ERROR");
        expect(error.message).toContain("Server error occurred");
    });

    it("should respect custom code and message when provided", () => {
        const response = {
            ok: false,
            status: 400,
            statusText: "Bad Request",
        } as Response;

        const responseText = JSON.stringify({ error: "Insufficient balance" });
        const error = unsuccessfulResponseToTurbineError(
            response,
            responseText,
            "CUSTOM_ERROR_CODE",
            "Custom error message"
        );

        expect(error).toBeInstanceOf(TurbineError);
        expect(error.code).toBe("CUSTOM_ERROR_CODE");
        expect(error.message).toBe("Custom error message");
    });
});

describe("TurbineClient Error Handling", () => {
    describe("addOrder", () => {
        it("should throw TurbineError in case of unexpected API response in json", async () => {
            const client = await createMockTurbineClient();

            const mockResponse = new Response(
                JSON.stringify({ message: "something went wrong" })
            );
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                mockResponse
            );

            await expect(client.addOrder(ORDER_INTENT)).rejects.toThrow(TurbineError);

            await client.addOrder(ORDER_INTENT).catch((error) => {
                expect(error).toBeInstanceOf(TurbineError);
                expect(error.code).toBeTruthy();
                expect(error.originalMessage).toBeTruthy();
                expect(error.message).toBeTruthy(); // user-friendly message
            });
        });

        it("should throw TurbineError in case of malformed API response", async () => {
            const client = await createMockTurbineClient();

            const mockResponse = new Response("happy chrysler");
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                mockResponse
            );

            const error = await client.addOrder(ORDER_INTENT).catch((e) => e);

            expect(error).toBeInstanceOf(TurbineError);
            expect(error.code).toBeTruthy();
            expect(error.originalMessage).toBeTruthy();
            expect(error.message).toBeTruthy();
        });
    });

    describe("addOrders", () => {
        it("should throw TurbineError in case of unexpected API response in json", async () => {
            const client = await createMockTurbineClient();

            const mockResponse = new Response(
                JSON.stringify({ message: "something went wrong" })
            );
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                mockResponse
            );

            await expect(client.addOrders([ORDER_INTENT])).rejects.toThrow(
                TurbineError
            );

            await client.addOrders([ORDER_INTENT]).catch((error) => {
                expect(error).toBeInstanceOf(TurbineError);
                expect(error.code).toBeTruthy();
                expect(error.originalMessage).toBeTruthy();
                expect(error.message).toBeTruthy();
            });
        });

        it("should throw TurbineError in case of malformed API response", async () => {
            const client = await createMockTurbineClient();

            const mockResponse = new Response("happy chrysler");
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                mockResponse
            );

            const error = await client.addOrders([ORDER_INTENT]).catch((e) => e);

            expect(error).toBeInstanceOf(TurbineError);
            expect(error.code).toBeTruthy();
            expect(error.originalMessage).toBeTruthy();
            expect(error.message).toBeTruthy();
        });

        it("should throw TurbineError for empty array of orders", async () => {
            const client = await createMockTurbineClient();

            const mockResponse = new Response(JSON.stringify([]));
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                mockResponse
            );

            await expect(client.addOrders([])).rejects.toThrow(TurbineError);

            await client.addOrders([]).catch((error) => {
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
            const client = await createMockTurbineClient();

            // Mock the response
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: "OK",
                text: async () => JSON.stringify({ error: "something went wrong" }),
                json: async () => ({ error: "something went wrong" }),
                headers: { get: () => null },
            } as unknown as Response;

            // Mock the callApiEndpoint method
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                mockResponse
            );

            await expect(client.cancelOrder(mockOrderHash as Hex)).rejects.toThrow(
                TurbineError
            );

            await client.cancelOrder(mockOrderHash as Hex).catch((error) => {
                expect(error).toBeInstanceOf(TurbineError);
                expect(error.code).toBeTruthy();
                expect(error.originalMessage).toBeTruthy();
                expect(error.message).toBeTruthy();
            });
        });

        it("should throw TurbineError in case of malformed API response", async () => {
            const mockOrderHash =
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
            const client = await createMockTurbineClient();

            // Mock with invalid JSON
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: "OK",
                text: async () => "happy chrysler",
                json: async () => "happy chrysler",
                headers: { get: () => null },
            } as unknown as Response;

            // Mock the callApiEndpoint method
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                mockResponse
            );

            const error = await client
                .cancelOrder(mockOrderHash as Hex)
                .catch((e) => e);

            expect(error).toBeInstanceOf(TurbineError);
            expect(error.code).toBeTruthy();
            expect(error.originalMessage).toBeTruthy();
            expect(error.message).toBeTruthy();
        });

        it("should throw TurbineError when API returns non-ok response", async () => {
            const mockOrderHash =
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
            const client = await createMockTurbineClient();

            // Mock a failed response
            const mockResponse = {
                ok: false,
                status: 404,
                statusText: "Not Found",
                text: async () => "Order not found",
                json: async () => "Order not found",
                headers: { get: () => null },
            } as unknown as Response;

            // Mock the callApiEndpoint method
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                mockResponse
            );

            await expect(client.cancelOrder(mockOrderHash as Hex)).rejects.toThrow(
                TurbineError
            );

            await client.cancelOrder(mockOrderHash as Hex).catch((error) => {
                expect(error).toBeInstanceOf(TurbineError);
                expect(error.code).toBeTruthy();
                expect(error.originalMessage).toBeTruthy();
                expect(error.message).toBeTruthy();
            });
        });
    });
});
