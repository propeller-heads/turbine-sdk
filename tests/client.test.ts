import { describe, expect, jest } from "@jest/globals";
import { convertSignature, TurbineClient } from "../src/turbineClient";
import { ACCOUNT, ORDER_INTENT, PUBLIC_CLIENT, WALLET_CLIENT } from "./constants";
import { OrderIntent } from "../src/models";
import { NULL_ADDRESS, USDC, USDT } from "../src/constants";
import { Hex } from "viem";

describe("TurbineClient", () => {
    describe("addOrder", () => {
        it("should call Turbine API and return order ID", async () => {
            const mockOrderId = "test-order-id-123";
            const client = new TurbineClient();

            // Mock the private callAddOrder method
            const mockResponse = new Response(
                JSON.stringify({ order_hash: mockOrderId })
            );
            // @ts-ignore - accessing private method for testing
            client.callAddOrder = jest.fn().mockResolvedValue(mockResponse);

            const orderId = await client.addOrder(
                ORDER_INTENT,
                WALLET_CLIENT,
                PUBLIC_CLIENT
            );

            expect(orderId).toBe(mockOrderId);
            // @ts-ignore - accessing private method for testing
            expect(client.callAddOrder).toHaveBeenCalledTimes(1);
        });

        it("should return informative error in case of unexpected API response in json", async () => {
            const client = new TurbineClient();

            // Mock the private callAddOrder method
            const mockResponse = new Response(
                JSON.stringify({ message: "something went wrong" })
            );
            // @ts-ignore - accessing private method for testing
            client.callAddOrder = jest.fn().mockResolvedValue(mockResponse);

            await expect(
                client.addOrder(ORDER_INTENT, WALLET_CLIENT, PUBLIC_CLIENT)
            ).rejects.toThrow(
                'Response missing required order_hash field: {"message":"something went wrong"}'
            );
        });

        it("should return informative error in case of malformed API response", async () => {
            const client = new TurbineClient();

            // Mock the private callAddOrder method
            const mockResponse = new Response("happy chrysler");
            // @ts-ignore - accessing private method for testing
            client.callAddOrder = jest.fn().mockResolvedValue(mockResponse);

            const error = await client
                .addOrder(ORDER_INTENT, WALLET_CLIENT, PUBLIC_CLIENT)
                .catch((e) => e);
            expect(error.message).toMatch(/Failed to parse response as JSON/);
        });
    });

    describe("addOrders", () => {
        it("should call Turbine API and return array of order IDs", async () => {
            const mockOrderIds = ["test-order-id-123", "test-order-id-456"];
            const client = new TurbineClient();

            // Mock the private callAddOrders method
            const mockResponse = new Response(
                JSON.stringify([
                    { order_hash: mockOrderIds[0] },
                    { order_hash: mockOrderIds[1] },
                ])
            );
            // @ts-ignore - accessing private method for testing
            client.callAddOrders = jest.fn().mockResolvedValue(mockResponse);

            const orderIds = await client.addOrders(
                [ORDER_INTENT, ORDER_INTENT],
                WALLET_CLIENT,
                PUBLIC_CLIENT
            );

            expect(orderIds).toEqual(mockOrderIds);
            // @ts-ignore - accessing private method for testing
            expect(client.callAddOrders).toHaveBeenCalledTimes(1);
        });

        it("should return informative error in case of unexpected API response in json", async () => {
            const client = new TurbineClient();

            // Mock the private callAddOrders method
            const mockResponse = new Response(
                JSON.stringify({ message: "something went wrong" })
            );
            // @ts-ignore - accessing private method for testing
            client.callAddOrders = jest.fn().mockResolvedValue(mockResponse);

            await expect(
                client.addOrders([ORDER_INTENT], WALLET_CLIENT, PUBLIC_CLIENT)
            ).rejects.toThrow(
                'Response missing required order hashes: {"message":"something went wrong"}'
            );
        });

        it("should return informative error in case of malformed API response", async () => {
            const client = new TurbineClient();

            // Mock the private callAddOrders method
            const mockResponse = new Response("happy chrysler");
            // @ts-ignore - accessing private method for testing
            client.callAddOrders = jest.fn().mockResolvedValue(mockResponse);

            const error = await client
                .addOrders([ORDER_INTENT], WALLET_CLIENT, PUBLIC_CLIENT)
                .catch((e) => e);
            expect(error.message).toMatch(/Failed to parse response as JSON/);
        });

        it("should handle empty array of orders", async () => {
            const client = new TurbineClient();

            // Mock the private callAddOrders method
            const mockResponse = new Response(JSON.stringify([]));
            // @ts-ignore - accessing private method for testing
            client.callAddOrders = jest.fn().mockResolvedValue(mockResponse);

            await expect(
                client.addOrders([], WALLET_CLIENT, PUBLIC_CLIENT)
            ).rejects.toThrow("Response missing required order hashes: []");
        });
    });

    it("should successfully sign an order intent", async () => {
        const turbineClient = new TurbineClient();
        // Define order here to avoid signature invalidation in case
        // we ever change the order defined in test constants.
        const orderIntent: OrderIntent = {
            owner: ACCOUNT.address,
            sellToken: USDC.address,
            buyToken: USDT.address,
            sellAmount: 1000n,
            minBuyAmount: 950n,
            midPriceDelta: 5,
            startTime: 1630000000n,
            endTime: 1630003600n,
            partialFill: true,
            callData: "0x",
            callDataTarget: NULL_ADDRESS,
            salt: "0xbc99a2cb0a86c1eb704c1b670ec4c59eae55ceaa8f1b0068f170d6d66d1301a1",
        } as const;

        const signature = await turbineClient["signIntent"](orderIntent, WALLET_CLIENT);
        const convertedSignature = convertSignature(signature);

        // Expected signature taken from Rust implementation of the same order
        const expectedSignature = convertSignature(
            "0x7a3fd8a46bdea8b744b4be06d2adc45c1067528793fcadf64bda69357b056a3f50b243dca7a1279a61c1e4724af9e943d65f5a0b60677210da70e4b7c68d20df1c" as Hex
        );
        expect(convertedSignature).toEqual(expectedSignature);
    });

    describe("removeOrder", () => {
        it("should call Turbine API and return success message", async () => {
            const mockOrderHash =
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
            const mockMessage = "Order successfully queued for removal";
            const client = new TurbineClient();

            // Mock the fetch response directly
            const mockResponse = new Response(
                JSON.stringify({
                    order_hash: mockOrderHash,
                    message: mockMessage,
                })
            );

            // Use jest.spyOn instead of directly replacing fetch
            jest.spyOn(global, "fetch").mockResolvedValue(mockResponse);

            const result = await client.removeOrder(
                mockOrderHash as Hex,
                WALLET_CLIENT
            );

            expect(result).toEqual({
                order_hash: mockOrderHash,
                message: mockMessage,
            });
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it("should return informative error in case of unexpected API response in json", async () => {
            const mockOrderHash =
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
            const client = new TurbineClient();

            // Mock the response
            const mockResponse = new Response(
                JSON.stringify({ error: "something went wrong" })
            );
            jest.spyOn(global, "fetch").mockResolvedValue(mockResponse);

            await expect(
                client.removeOrder(mockOrderHash as Hex, WALLET_CLIENT)
            ).rejects.toThrow(
                'Response missing required fields: {"error":"something went wrong"}'
            );
        });

        it("should return informative error in case of malformed API response", async () => {
            const mockOrderHash =
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
            const client = new TurbineClient();

            // Mock with invalid JSON
            const mockResponse = new Response("happy chrysler");
            jest.spyOn(global, "fetch").mockResolvedValue(mockResponse);

            const error = await client
                .removeOrder(mockOrderHash as Hex, WALLET_CLIENT)
                .catch((e) => e);
            expect(error.message).toMatch(/Failed to parse response as JSON/);
        });

        it("should throw error when API returns non-ok response", async () => {
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
                client.removeOrder(mockOrderHash as Hex, WALLET_CLIENT)
            ).rejects.toThrow("Failed to remove order: Not Found, Order not found");
        });
    });
});
