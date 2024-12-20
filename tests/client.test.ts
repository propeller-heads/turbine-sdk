import { describe, expect, jest, test } from "@jest/globals";
import { TurbineClient } from "../src/turbineClient";
import { ORDER_INTENT, WALLET_CLIENT } from "./constants";

describe("TurbineClient", () => {
    describe("addOrder", () => {
        it("should call Turbine API and return order ID", async () => {
            const mockOrderId = "test-order-id-123";
            const client = new TurbineClient();

            // Mock the private callAddOrder method
            const mockResponse = new Response(
                JSON.stringify({ order_id: mockOrderId })
            );
            // @ts-ignore - accessing private method for testing
            client.callAddOrder = jest.fn().mockResolvedValue(mockResponse);

            const orderId = await client.addOrder(ORDER_INTENT, WALLET_CLIENT);

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

            await expect(client.addOrder(ORDER_INTENT, WALLET_CLIENT)).rejects.toThrow(
                'Response missing required order_id field: {"message":"something went wrong"}'
            );
        });

        it("should return informative error in case of malformed API response", async () => {
            const client = new TurbineClient();

            // Mock the private callAddOrder method
            const mockResponse = new Response("happy chrysler");
            // @ts-ignore - accessing private method for testing
            client.callAddOrder = jest.fn().mockResolvedValue(mockResponse);

            const error = await client
                .addOrder(ORDER_INTENT, WALLET_CLIENT)
                .catch((e) => e);
            expect(error.message).toMatch(/Failed to parse response as JSON/);
            expect(error.message).toMatch(/happy chrysler/);
        });
    });
});
