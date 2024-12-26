import { describe, expect, jest } from "@jest/globals";
import { convertSignature, TurbineClient } from "../src/turbineClient";
import { ACCOUNT, ORDER_INTENT, WALLET_CLIENT } from "./constants";
import { OrderIntent, PrimitiveSignature } from "../src/models";
import { NULL_ADDRESS, USDC, USDT } from "../src/constants";

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
        // The values below are taken from Rust implementation
        const expected: PrimitiveSignature = {
            r: BigInt(
                "0xb4584666ee9c235f6f86cb6196ed9b0b2005c803252f6a3c2cf7ee970bca543b"
            ),
            s: BigInt(
                "0x0f5b2f34a280c43653405b040b9642cf680894a95ca579373f3e359728261183"
            ),
            yParity: "0x1",
        };
        expect(convertedSignature).toEqual(expected);
    });
});
