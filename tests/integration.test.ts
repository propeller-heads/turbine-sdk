import { Hex } from "viem";
import { AddLiquidityIntent, OrderIntent, RemoveLiquidityIntent } from "../src/models";
import { getRandomSalt, TurbineClient } from "../src/turbineClient";
import {
    ADD_LIQUIDITY_INTENT,
    ORDER_INTENT,
    PUBLIC_CLIENT,
    REMOVE_LIQUIDITY_INTENT,
    WALLET_CLIENT,
} from "./constants";
import { withTurbineErrorHandling } from "./utils";

describe("Integration test", () => {
    it("should successfully submit an order", async () => {
        const turbineClient = new TurbineClient();

        const intent: OrderIntent = {
            ...ORDER_INTENT,
            salt: getRandomSalt(),
        };

        const result = await withTurbineErrorHandling(() =>
            turbineClient.addOrder(intent, WALLET_CLIENT, PUBLIC_CLIENT)
        );

        expect(result).toBeDefined();
    });

    it("should successfully submit an order array", async () => {
        const turbineClient = new TurbineClient();

        const intents: OrderIntent[] = Array.from({ length: 5 }, () => ({
            ...ORDER_INTENT,
            salt: getRandomSalt(),
        }));

        const result = await withTurbineErrorHandling(() =>
            turbineClient.addOrders(intents, WALLET_CLIENT, PUBLIC_CLIENT)
        );

        result.forEach((response) => {
            expect(response).toBeDefined();
        });
    });

    it("should successfully submit an add liquidity intent", async () => {
        const turbineClient = new TurbineClient();

        const intent: AddLiquidityIntent = {
            ...ADD_LIQUIDITY_INTENT,
            salt: getRandomSalt(),
        };

        const result = await withTurbineErrorHandling(() =>
            turbineClient.addLiquidity(intent, WALLET_CLIENT, PUBLIC_CLIENT)
        );

        expect(result).toBeDefined();
    });

    it("should successfully submit a remove liquidity intent", async () => {
        const turbineClient = new TurbineClient();

        const intent: RemoveLiquidityIntent = {
            ...REMOVE_LIQUIDITY_INTENT,
            salt: getRandomSalt(),
        };

        const result = await withTurbineErrorHandling(() =>
            turbineClient.removeLiquidity(intent, WALLET_CLIENT, PUBLIC_CLIENT)
        );

        expect(result).toBeDefined();
    });

    it("should successfully cancel an order", async () => {
        const turbineClient = new TurbineClient();

        // First create an order to cancel
        const intent: OrderIntent = {
            ...ORDER_INTENT,
            salt: getRandomSalt(),
        };

        const orderHash = await withTurbineErrorHandling(() =>
            turbineClient.addOrder(intent, WALLET_CLIENT, PUBLIC_CLIENT)
        );

        // Now cancel the order
        const result = await withTurbineErrorHandling(() =>
            turbineClient.cancelOrder(orderHash as Hex, WALLET_CLIENT)
        );

        expect(result).toBeDefined();
        expect(result.orderHash).toBe(orderHash);
    });
});
