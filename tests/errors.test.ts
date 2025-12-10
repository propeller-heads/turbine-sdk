import { describe, expect, jest, it } from "@jest/globals";
import {
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
        const error = new TurbineError("INPUT_VALIDATION_ERROR", "Invalid order parameters");

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(TurbineError);
        expect(error.code).toBe("INPUT_VALIDATION_ERROR");
        expect(error.message).toBe("Invalid order parameters");
        expect(error.name).toBe("TurbineError");
        expect(error.inner).toBeNull();
    });

    it("should create a TurbineError with nested errors", () => {
        const innerError1 = new TurbineError("VALIDATION_ERRORS", "Token address is invalid");
        const innerError2 = new TurbineError("VALIDATION_ERRORS", "Amount must be positive");
        const error = new TurbineError("INPUT_VALIDATION_ERROR", "Multiple validation errors occurred", null, [
            innerError1,
            innerError2,
        ]);

        expect(error.message).toBe("Multiple validation errors occurred");
        expect(error.inner).toHaveLength(2);
        expect(error.inner![0].code).toBe("VALIDATION_ERRORS");
        expect(error.inner![1].code).toBe("VALIDATION_ERRORS");
        expect(error.getTechnicalDetails()).toContain("INPUT_VALIDATION_ERROR");
        expect(error.getTechnicalDetails()).toContain("Nested errors");
    });
});


describe("unsuccessfulResponseToTurbineError", () => {
    it("should parse backend error format with code and message", async () => {
        const errorPayload = {
            code: "INPUT_VALIDATION_ERROR",
            message: "Invalid order parameters provided",
        };
        const response = new Response(JSON.stringify(errorPayload), {
            status: 400,
            statusText: "Bad Request",
        });

        const error = await unsuccessfulResponseToTurbineError(response);

        expect(error).toBeInstanceOf(TurbineError);
        expect(error.code).toBe("INPUT_VALIDATION_ERROR");
        expect(error.message).toBe("Invalid order parameters provided");
        expect(error.inner).toBeNull();
    });

    it("should parse error with nested errors", async () => {
        const errorPayload = {
            code: "VALIDATION_ERRORS",
            message: "Multiple validation errors occurred",
            inner: [
                {
                    code: "INPUT_VALIDATION_ERROR",
                    message: "Token address is invalid",
                },
                {
                    code: "INPUT_VALIDATION_ERROR",
                    message: "Amount must be positive",
                },
            ],
        };
        const response = new Response(JSON.stringify(errorPayload), {
            status: 400,
            statusText: "Bad Request",
        });

        const error = await unsuccessfulResponseToTurbineError(response);

        expect(error).toBeInstanceOf(TurbineError);
        expect(error.code).toBe("VALIDATION_ERRORS");
        expect(error.message).toBe("Multiple validation errors occurred");
        expect(error.inner).toHaveLength(2);
        expect(error.inner![0].code).toBe("INPUT_VALIDATION_ERROR");
        expect(error.inner![0].message).toBe("Token address is invalid");
        expect(error.inner![1].code).toBe("INPUT_VALIDATION_ERROR");
        expect(error.inner![1].message).toBe("Amount must be positive");
    });


    it("should fallback to INTERNAL_SERVER_ERROR for HTTP 500 with invalid error format", async () => {
        const response = new Response("Invalid JSON response", {
            status: 500,
            statusText: "Internal Server Error",
        });

        const error = await unsuccessfulResponseToTurbineError(response);

        expect(error).toBeInstanceOf(TurbineError);
        expect(error.code).toBe("INTERNAL_SERVER_ERROR");
        expect(error.message).toBe("Invalid JSON response");
    });

    it("should fallback to UNKNOWN_ERROR for non-500 status with invalid error format", async () => {
        const response = new Response("Invalid JSON response", {
            status: 400,
            statusText: "Bad Request",
        });

        const error = await unsuccessfulResponseToTurbineError(response);

        expect(error).toBeInstanceOf(TurbineError);
        expect(error.code).toBe("UNKNOWN_ERROR");
        expect(error.message).toBe("Invalid JSON response");
    });

    it("should fallback to UNKNOWN_ERROR for missing code field", async () => {
        const errorPayload = {
            message: "Error without code field",
        };
        const response = new Response(JSON.stringify(errorPayload), {
            status: 400,
            statusText: "Bad Request",
        });

        const error = await unsuccessfulResponseToTurbineError(response);

        expect(error).toBeInstanceOf(TurbineError);
        expect(error.code).toBe("UNKNOWN_ERROR");
        expect(error.message).toBe(JSON.stringify(errorPayload));
    });

    it("should normalize invalid error codes to UNKNOWN_ERROR", async () => {
        const errorPayload = {
            code: "INVALID_ERROR_CODE",
            message: "This error code is not recognized",
        };
        const response = new Response(JSON.stringify(errorPayload), {
            status: 400,
            statusText: "Bad Request",
        });

        const error = await unsuccessfulResponseToTurbineError(response);

        expect(error).toBeInstanceOf(TurbineError);
        expect(error.code).toBe("UNKNOWN_ERROR");
        expect(error.message).toBe("This error code is not recognized");
    });
});

describe("TurbineClient Error Handling", () => {
    describe("addOrder", () => {
        it("should throw TurbineError with backend error format", async () => {
            const client = await createMockTurbineClient();

            const errorPayload = {
                code: "ORDER_ALREADY_EXISTS",
                message: "An order with this hash already exists",
            };
            const mockResponse = {
                ok: false,
                status: 409,
                statusText: "Conflict",
                text: async () => JSON.stringify(errorPayload),
                json: async () => errorPayload,
                headers: { get: () => null },
            } as unknown as Response;
            jest.spyOn(client as any, "ensureAuthenticated").mockResolvedValue(
                ORDER_INTENT.owner
            );
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                mockResponse
            );

            await expect(client.addOrder(ORDER_INTENT)).rejects.toThrow(TurbineError);

            await client.addOrder(ORDER_INTENT).catch((error) => {
                expect(error).toBeInstanceOf(TurbineError);
                expect(error.code).toBe("ORDER_ALREADY_EXISTS");
                expect(error.message).toBe("An order with this hash already exists");
            });
        });

        it("should throw TurbineError with validation errors and nested errors", async () => {
            const client = await createMockTurbineClient();

            const errorPayload = {
                code: "VALIDATION_ERRORS",
                message: "Multiple validation errors occurred",
                inner: [
                    {
                        code: "INPUT_VALIDATION_ERROR",
                        message: "Sell token address is invalid",
                    },
                    {
                        code: "INPUT_VALIDATION_ERROR",
                        message: "Buy amount must be greater than zero",
                    },
                ],
            };
            const mockResponse = {
                ok: false,
                status: 400,
                statusText: "Bad Request",
                text: async () => JSON.stringify(errorPayload),
                json: async () => errorPayload,
                headers: { get: () => null },
            } as unknown as Response;
            jest.spyOn(client as any, "ensureAuthenticated").mockResolvedValue(
                ORDER_INTENT.owner
            );
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                mockResponse
            );

            const error = await client.addOrder(ORDER_INTENT).catch((e) => e);

            expect(error).toBeInstanceOf(TurbineError);
            expect(error.code).toBe("VALIDATION_ERRORS");
            expect(error.message).toBe("Multiple validation errors occurred");
            expect(error.inner).toHaveLength(2);
            expect(error.inner![0].code).toBe("INPUT_VALIDATION_ERROR");
            expect(error.inner![1].code).toBe("INPUT_VALIDATION_ERROR");
        });

        it("should throw TurbineError in case of malformed API response", async () => {
            const client = await createMockTurbineClient();

            const mockResponse = {
                ok: false,
                status: 500,
                statusText: "Internal Server Error",
                text: async () => "happy chrysler",
                json: async () => "happy chrysler",
                headers: { get: () => null },
            } as unknown as Response;
            jest.spyOn(client as any, "ensureAuthenticated").mockResolvedValue(
                ORDER_INTENT.owner
            );
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                mockResponse
            );

            const error = await client.addOrder(ORDER_INTENT).catch((e) => e);

            expect(error).toBeInstanceOf(TurbineError);
            expect(error.code).toBe("INTERNAL_SERVER_ERROR");
            expect(error.message).toBe("happy chrysler");
        });
    });

    describe("addOrders", () => {
        it("should throw TurbineError with MAX_ORDERS_IN_PAYLOAD error", async () => {
            const client = await createMockTurbineClient();

            const errorPayload = {
                code: "MAX_ORDERS_IN_PAYLOAD",
                message: "The payload contains too many orders. Maximum allowed is 100",
            };
            const mockResponse = {
                ok: false,
                status: 400,
                statusText: "Bad Request",
                text: async () => JSON.stringify(errorPayload),
                json: async () => errorPayload,
                headers: { get: () => null },
            } as unknown as Response;
            jest.spyOn(client as any, "ensureAuthenticated").mockResolvedValue(
                ORDER_INTENT.owner
            );
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                mockResponse
            );

            await expect(client.addOrders([ORDER_INTENT])).rejects.toThrow(
                TurbineError
            );

            await client.addOrders([ORDER_INTENT]).catch((error) => {
                expect(error).toBeInstanceOf(TurbineError);
                expect(error.code).toBe("MAX_ORDERS_IN_PAYLOAD");
                expect(error.message).toBe("The payload contains too many orders. Maximum allowed is 100");
            });
        });

        it("should throw TurbineError in case of malformed API response", async () => {
            const client = await createMockTurbineClient();

            const mockResponse = {
                ok: false,
                status: 500,
                statusText: "Internal Server Error",
                text: async () => "happy chrysler",
                json: async () => "happy chrysler",
                headers: { get: () => null },
            } as unknown as Response;
            jest.spyOn(client as any, "ensureAuthenticated").mockResolvedValue(
                ORDER_INTENT.owner
            );
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                mockResponse
            );

            const error = await client.addOrders([ORDER_INTENT]).catch((e) => e);

            expect(error).toBeInstanceOf(TurbineError);
            expect(error.code).toBe("INTERNAL_SERVER_ERROR");
            expect(error.message).toBe("happy chrysler");
        });

        it("should throw TurbineError for empty array of orders", async () => {
            const client = await createMockTurbineClient();

            const mockResponse = {
                ok: true,
                status: 200,
                statusText: "OK",
                text: async () => JSON.stringify([]),
                json: async () => [],
                headers: { get: () => null },
            } as unknown as Response;
            jest.spyOn(client as any, "ensureAuthenticated").mockResolvedValue(
                ORDER_INTENT.owner
            );
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                mockResponse
            );

            await expect(client.addOrders([])).rejects.toThrow(TurbineError);

            await client.addOrders([]).catch((error) => {
                expect(error).toBeInstanceOf(TurbineError);
                expect(error.code).toBe("UNEXPECTED_ADD_ORDER_RESPONSE");
                expect(error.message).toBeTruthy();
            });
        });
    });

    describe("cancelOrder", () => {
        it("should throw TurbineError with ORDER_NOT_AVAILABLE error", async () => {
            const mockOrderHash =
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
            const client = await createMockTurbineClient();

            const errorPayload = {
                code: "ORDER_NOT_AVAILABLE",
                message: "The order you are trying to cancel does not exist or has already been cancelled",
            };
            const mockResponse = {
                ok: false,
                status: 404,
                statusText: "Not Found",
                text: async () => JSON.stringify(errorPayload),
                json: async () => errorPayload,
                headers: { get: () => null },
            } as unknown as Response;

            jest.spyOn(client as any, "ensureAuthenticated").mockResolvedValue(
                ORDER_INTENT.owner
            );
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                mockResponse
            );

            await expect(client.cancelOrder(mockOrderHash as Hex)).rejects.toThrow(
                TurbineError
            );

            await client.cancelOrder(mockOrderHash as Hex).catch((error) => {
                expect(error).toBeInstanceOf(TurbineError);
                expect(error.code).toBe("ORDER_NOT_AVAILABLE");
                expect(error.message).toBe("The order you are trying to cancel does not exist or has already been cancelled");
            });
        });

        it("should throw TurbineError in case of malformed API response", async () => {
            const mockOrderHash =
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
            const client = await createMockTurbineClient();

            const mockResponse = {
                ok: false,
                status: 500,
                statusText: "Internal Server Error",
                text: async () => "happy chrysler",
                json: async () => "happy chrysler",
                headers: { get: () => null },
            } as unknown as Response;

            jest.spyOn(client as any, "ensureAuthenticated").mockResolvedValue(
                ORDER_INTENT.owner
            );
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                mockResponse
            );

            const error = await client
                .cancelOrder(mockOrderHash as Hex)
                .catch((e) => e);

            expect(error).toBeInstanceOf(TurbineError);
            expect(error.code).toBe("INTERNAL_SERVER_ERROR");
            expect(error.message).toBe("happy chrysler");
        });

        it("should throw TurbineError when API returns non-ok response with backend error format", async () => {
            const mockOrderHash =
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
            const client = await createMockTurbineClient();

            const errorPayload = {
                code: "USER_NOT_AUTHORIZED",
                message: "You are not authorized to cancel this order",
            };
            const mockResponse = {
                ok: false,
                status: 403,
                statusText: "Forbidden",
                text: async () => JSON.stringify(errorPayload),
                json: async () => errorPayload,
                headers: { get: () => null },
            } as unknown as Response;

            jest.spyOn(client as any, "ensureAuthenticated").mockResolvedValue(
                ORDER_INTENT.owner
            );
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                mockResponse
            );

            await expect(client.cancelOrder(mockOrderHash as Hex)).rejects.toThrow(
                TurbineError
            );

            await client.cancelOrder(mockOrderHash as Hex).catch((error) => {
                expect(error).toBeInstanceOf(TurbineError);
                expect(error.code).toBe("USER_NOT_AUTHORIZED");
                expect(error.message).toBe("You are not authorized to cancel this order");
            });
        });
    });
});
