import { Hex } from "viem";
import { AddLiquidityIntent, OrderIntent, RemoveLiquidityIntent } from "../src/models";
import {
    getRandomSalt,
    TurbineClient,
    getPools,
    getSettledAmounts,
    getUserPositions,
    checkStatus,
} from "../src/turbineClient";
import {
    ACCOUNT,
    ADD_LIQUIDITY_INTENT,
    ORDER_INTENT,
    WALLET_CLIENT,
    PUBLIC_CLIENT,
    REMOVE_LIQUIDITY_INTENT,
} from "./constants";
import { withTurbineErrorHandling } from "./utils";

describe("Integration test", () => {
    describe("Authentication Flow", () => {
        it("should successfully authenticate with /nonce and /verify endpoints", async () => {
            const turbineClient = new TurbineClient(WALLET_CLIENT, PUBLIC_CLIENT);

            // Test the complete authentication flow
            await withTurbineErrorHandling(async () => {
                await turbineClient.authenticate();
            });

            // If we reach here without error, authentication was successful
            expect(true).toBe(true);
        });

        it("should return authentication status with /me endpoint", async () => {
            const turbineClient = new TurbineClient(WALLET_CLIENT, PUBLIC_CLIENT);

            // First authenticate
            await withTurbineErrorHandling(async () => {
                await turbineClient.authenticate();
            });

            // Test the /me endpoint
            const authStatus = await withTurbineErrorHandling(async () => {
                return await turbineClient.getAuthStatus();
            });

            expect(authStatus.authenticated).toBe(true);
            expect(authStatus.address?.toLowerCase()).toBe(
                ACCOUNT.address.toLowerCase()
            );
        });

        it("should handle logout properly", async () => {
            const turbineClient = new TurbineClient(WALLET_CLIENT, PUBLIC_CLIENT);

            // First authenticate
            await withTurbineErrorHandling(async () => {
                await turbineClient.authenticate();
            });

            // Verify we're authenticated
            const authStatusBefore = await withTurbineErrorHandling(async () => {
                return await turbineClient.getAuthStatus();
            });
            expect(authStatusBefore.authenticated).toBe(true);

            // Logout
            await withTurbineErrorHandling(async () => {
                await turbineClient.logout();
            });

            // Verify we're no longer authenticated
            const authStatusAfter = await withTurbineErrorHandling(async () => {
                return await turbineClient.getAuthStatus();
            });
            expect(authStatusAfter.authenticated).toBe(false);
        });
    });

    it("should successfully submit an order", async () => {
        const turbineClient = new TurbineClient(WALLET_CLIENT, PUBLIC_CLIENT);

        const intent: OrderIntent = {
            ...ORDER_INTENT,
            salt: getRandomSalt(),
        };

        const result = await withTurbineErrorHandling(() =>
            turbineClient.addOrder(intent)
        );

        expect(result).toBeDefined();
    });

    it("should successfully submit an order array", async () => {
        const turbineClient = new TurbineClient(WALLET_CLIENT, PUBLIC_CLIENT);

        const intents: OrderIntent[] = Array.from({ length: 5 }, () => ({
            ...ORDER_INTENT,
            salt: getRandomSalt(),
        }));

        const result = await withTurbineErrorHandling(() =>
            turbineClient.addOrders(intents)
        );

        result.forEach((response) => {
            expect(response).toBeDefined();
        });
    });

    it("should successfully submit an add liquidity intent", async () => {
        const turbineClient = new TurbineClient(WALLET_CLIENT, PUBLIC_CLIENT);

        const intent: AddLiquidityIntent = {
            ...ADD_LIQUIDITY_INTENT,
            salt: getRandomSalt(),
        };

        const result = await withTurbineErrorHandling(() =>
            turbineClient.addLiquidity(intent)
        );

        expect(result).toBeDefined();
    });

    it("should successfully submit a remove liquidity intent", async () => {
        const turbineClient = new TurbineClient(WALLET_CLIENT, PUBLIC_CLIENT);

        const intent: RemoveLiquidityIntent = {
            ...REMOVE_LIQUIDITY_INTENT,
            salt: getRandomSalt(),
        };

        const result = await withTurbineErrorHandling(() =>
            turbineClient.removeLiquidity(intent)
        );

        expect(result).toBeDefined();
    });

    it("should successfully cancel an order", async () => {
        const turbineClient = new TurbineClient(WALLET_CLIENT, PUBLIC_CLIENT);

        // First create an order to cancel
        const intent: OrderIntent = {
            ...ORDER_INTENT,
            salt: getRandomSalt(),
        };

        const orderHash = await withTurbineErrorHandling(() =>
            turbineClient.addOrder(intent)
        );

        // Now cancel the order
        const result = await withTurbineErrorHandling(() =>
            turbineClient.cancelOrder(orderHash as Hex)
        );

        expect(result).toBeDefined();
        expect(result.orderHash).toBe(orderHash);
    });

    it("should successfully get registered pools (client method)", async () => {
        const turbineClient = new TurbineClient(WALLET_CLIENT, PUBLIC_CLIENT);

        const pools = await withTurbineErrorHandling(() => turbineClient.getPools());

        expect(pools).toBeDefined();
        expect(Array.isArray(pools)).toBe(true);
        expect(pools.length > 0).toBe(true);

        const pool = pools[0];
        expect(pool.metadata).toBeDefined();
        expect(pool.metadata.token0).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
        expect(pool.metadata.token1).toBe("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
        expect(pool.metadata.fee).toBe(30);
        expect(pool.metadata.lpToken).toBe(
            "0x24746c26c7B83DDabBAF384E02C3Eb0E7b8cD307"
        );
        expect(pool.state).toBeDefined();
        expect(pool.stats).toBeDefined();
    });

    it("should successfully get registered pools (standalone function)", async () => {
        const pools = await withTurbineErrorHandling(() => getPools(PUBLIC_CLIENT));

        expect(pools).toBeDefined();
        expect(Array.isArray(pools)).toBe(true);
        expect(pools.length > 0).toBe(true);

        const pool = pools[0];
        expect(pool.metadata).toBeDefined();
        expect(pool.metadata.token0).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
        expect(pool.metadata.token1).toBe("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
        expect(pool.metadata.fee).toBe(30);
        expect(pool.metadata.lpToken).toBe(
            "0x24746c26c7B83DDabBAF384E02C3Eb0E7b8cD307"
        );
        expect(pool.state).toBeDefined();
        expect(pool.stats).toBeDefined();
    });

    it("should successfully get user positions (client method)", async () => {
        const turbineClient = new TurbineClient(WALLET_CLIENT, PUBLIC_CLIENT);

        const positions = await withTurbineErrorHandling(() =>
            turbineClient.getUserPositions()
        );

        expect(positions).toBeDefined();
        expect(Array.isArray(positions)).toBe(true);
    });

    it("should successfully get user positions (standalone function)", async () => {
        const positions = await withTurbineErrorHandling(() =>
            getUserPositions(ACCOUNT.address, PUBLIC_CLIENT)
        );

        expect(positions).toBeDefined();
        expect(Array.isArray(positions)).toBe(true);
    });

    it("should successfully get order statuses", async () => {
        const turbineClient = new TurbineClient(WALLET_CLIENT, PUBLIC_CLIENT);

        // First create an order to get its status
        const intent: OrderIntent = {
            ...ORDER_INTENT,
            salt: getRandomSalt(),
        };

        const orderHash = await withTurbineErrorHandling(() =>
            turbineClient.addOrder(intent)
        );

        // Now get the order status
        const result = await withTurbineErrorHandling(() =>
            turbineClient.getOrderStatuses([orderHash as Hex])
        );

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(1);
        expect(result[0].hash).toBe(orderHash);
    });

    it("should successfully get settled amounts (standalone function)", async () => {
        const turbineClient = new TurbineClient(WALLET_CLIENT, PUBLIC_CLIENT);

        // First create an order to get its settled amount
        const intent: OrderIntent = {
            ...ORDER_INTENT,
            salt: getRandomSalt(),
        };

        const orderHash = await withTurbineErrorHandling(() =>
            turbineClient.addOrder(intent)
        );

        // Now get the settled amount using the standalone function
        const result = await withTurbineErrorHandling(() =>
            getSettledAmounts(PUBLIC_CLIENT, turbineClient.settlerContract, [
                orderHash as string,
            ])
        );

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(1);
        expect(typeof result[0]).toBe("bigint");
    });

    it("should successfully check status (standalone function)", async () => {
        const turbineClient = new TurbineClient(WALLET_CLIENT, PUBLIC_CLIENT);

        const result = await withTurbineErrorHandling(() =>
            checkStatus(turbineClient.turbineApiUrl)
        );

        expect(result).toBe(true);
    });
});
