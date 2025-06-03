import { describe, expect, jest } from "@jest/globals";
import { convertSignature, TurbineClient } from "../src/turbineClient";
import { MOCKED_TURBINE_POOL } from "../src/config";
import {
    ACCOUNT,
    ADD_LIQUIDITY_INTENT,
    ORDER_INTENT,
    PUBLIC_CLIENT,
    REMOVE_LIQUIDITY_INTENT,
    WALLET_CLIENT,
} from "./constants";
import { withTurbineErrorHandling } from "./utils";
import { OrderIntent } from "../src/models";
import { NULL_ADDRESS, USDC, USDT } from "../src/constants";
import { Hex } from "viem";

describe("TurbineClient", () => {
    describe("addOrder", () => {
        it("should call Turbine API and return order ID", async () => {
            const mockOrderId = "test-order-id-123";
            const client = new TurbineClient();

            const mockResponse = new Response(
                JSON.stringify({ orderHash: mockOrderId })
            );
            const mockCallAPI = jest
                .spyOn(client as any, "callApiEndpoint")
                .mockResolvedValue(mockResponse);

            const orderId = await withTurbineErrorHandling(() =>
                client.addOrder(ORDER_INTENT, WALLET_CLIENT, PUBLIC_CLIENT)
            );

            expect(orderId).toBe(mockOrderId);
            expect(mockCallAPI).toHaveBeenCalledTimes(1);
        });
    });

    describe("addOrders", () => {
        it("should call Turbine API and return array of order IDs", async () => {
            const mockOrderIds = ["test-order-id-123", "test-order-id-456"];
            const client = new TurbineClient();

            const mockResponse = new Response(
                JSON.stringify([
                    { orderHash: mockOrderIds[0] },
                    { orderHash: mockOrderIds[1] },
                ])
            );
            const mockCallAPI = jest
                .spyOn(client as any, "callApiEndpoint")
                .mockResolvedValue(mockResponse);

            const orderIds = await withTurbineErrorHandling(() =>
                client.addOrders(
                    [ORDER_INTENT, ORDER_INTENT],
                    WALLET_CLIENT,
                    PUBLIC_CLIENT
                )
            );

            expect(orderIds).toEqual(mockOrderIds);
            expect(mockCallAPI).toHaveBeenCalledTimes(1);
        });
    });

    describe("addLiquidity", () => {
        it("should call Turbine API and return intent ID", async () => {
            const mockIntentId = "test-intent-id-123";
            const client = new TurbineClient();

            const mockResponse = new Response(
                JSON.stringify({ intentHash: mockIntentId })
            );
            const mockCallAPI = jest
                .spyOn(client as any, "callApiEndpoint")
                .mockResolvedValue(mockResponse);

            const liquidityId = await withTurbineErrorHandling(() =>
                client.addLiquidity(ADD_LIQUIDITY_INTENT, WALLET_CLIENT, PUBLIC_CLIENT)
            );

            expect(liquidityId).toBe(mockIntentId);
            expect(mockCallAPI).toHaveBeenCalledTimes(1);
        });
    });

    describe("removeLiquidity", () => {
        it("should call Turbine API and return intent ID", async () => {
            const mockIntentId = "test-intent-id-123";
            const client = new TurbineClient();

            const mockResponse = new Response(
                JSON.stringify({ intentHash: mockIntentId })
            );
            const mockCallAPI = jest
                .spyOn(client as any, "callApiEndpoint")
                .mockResolvedValue(mockResponse);

            const liquidityId = await withTurbineErrorHandling(() =>
                client.removeLiquidity(
                    REMOVE_LIQUIDITY_INTENT,
                    WALLET_CLIENT,
                    PUBLIC_CLIENT
                )
            );

            expect(liquidityId).toBe(mockIntentId);
            expect(mockCallAPI).toHaveBeenCalledTimes(1);
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

        const signature = await withTurbineErrorHandling(() =>
            turbineClient["signIntent"](orderIntent, WALLET_CLIENT)
        );
        const convertedSignature = convertSignature(signature);

        // Expected signature taken from Rust implementation of the same order. See test_order_intent_signature in turbine repo.
        const expectedSignature = convertSignature(
            "0x9a9bcfc4c3d3333207941c6e4d318f8cea91f834a8445b3e409976d6918729350196292c4bbeab2eeb7134824163f2bef582e5b7ab610aabb5a67c410cab13c41c" as Hex
        );
        expect(convertedSignature).toEqual(expectedSignature);
    });

    describe("cancelOrder", () => {
        it("should call Turbine API and return success message", async () => {
            const mockOrderHash =
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
            const client = new TurbineClient();

            // Mock the fetch response directly
            const mockResponse = new Response(
                JSON.stringify({
                    orderHash: mockOrderHash,
                })
            );

            // Use jest.spyOn instead of directly replacing fetch
            jest.spyOn(global, "fetch").mockResolvedValue(mockResponse);

            const result = await withTurbineErrorHandling(() =>
                client.cancelOrder(mockOrderHash as Hex, WALLET_CLIENT)
            );

            expect(result).toEqual({
                orderHash: mockOrderHash,
            });
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe("getPools", () => {
        it("should return mocked turbine pool", async () => {
            const client = new TurbineClient();

            const pools = await withTurbineErrorHandling(() => client.getPools());

            expect(pools).toHaveLength(1);
            expect(pools[0]).toEqual(MOCKED_TURBINE_POOL);
        });
    });
});
