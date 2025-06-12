import { Hex } from "viem";
import { AddLiquidityIntent, OrderIntent, RemoveLiquidityIntent } from "../src/models";
import { getRandomSalt, TurbineClient } from "../src/turbineClient";
import {
    ACCOUNT,
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

    it("should successfully get registered pools", async () => {
        const turbineClient = new TurbineClient();

        const pools = await withTurbineErrorHandling(() =>
            turbineClient.getPools(PUBLIC_CLIENT)
        );

        expect(pools).toBeDefined();
        expect(Array.isArray(pools)).toBe(true);
        expect(pools.length > 0).toBe(true);

        const pool = pools[0];
        expect(pool.metadata).toBeDefined();
        expect(pool.metadata.token0).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
        expect(pool.metadata.token1).toBe("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
        expect(pool.metadata.fee).toBe(3000);
        expect(pool.metadata.lpToken).toBe(
            "0x24746c26c7B83DDabBAF384E02C3Eb0E7b8cD307"
        );
        expect(pool.state).toBeDefined();
        expect(pool.stats).toBeDefined();
    });

    it("should successfully get user positions", async () => {
        const turbineClient = new TurbineClient();

        const positions = await withTurbineErrorHandling(() =>
            turbineClient.getUserPositions(ACCOUNT.address, PUBLIC_CLIENT)
        );

        expect(positions).toBeDefined();
        expect(Array.isArray(positions)).toBe(true);
    });
});
