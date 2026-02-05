import { Hex } from "viem";
import { AddLiquidityIntent, OrderIntent, RemoveLiquidityIntent } from "../src/models";
import {
    getRandomSalt,
    TurbineClient,
    getPools,
    getUserPositions,
    checkStatus,
    fetchConfig,
} from "../src/turbineClient";
import {
    ACCOUNT,
    ADD_LIQUIDITY_INTENT,
    ORDER_INTENT,
    WALLET_CLIENT,
    PUBLIC_CLIENT,
    REMOVE_LIQUIDITY_INTENT,
} from "./constants";
import { TURBINE_API_URL } from "../src/config";
import { withTurbineErrorHandling } from "./utils";

describe("Integration test", () => {
    describe("Authentication Flow", () => {
        it("should successfully authenticate with /nonce and /verify endpoints", async () => {
            const turbineClient = await TurbineClient.create(
                WALLET_CLIENT,
                PUBLIC_CLIENT
            );

            // Test the complete authentication flow
            await withTurbineErrorHandling(async () => {
                await turbineClient.authenticate();
            });

            // If we reach here without error, authentication was successful
            expect(true).toBe(true);
        });

        it("should return authentication status with /me endpoint", async () => {
            const turbineClient = await TurbineClient.create(
                WALLET_CLIENT,
                PUBLIC_CLIENT
            );

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
            const turbineClient = await TurbineClient.create(
                WALLET_CLIENT,
                PUBLIC_CLIENT
            );

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
        const turbineClient = await TurbineClient.create(WALLET_CLIENT, PUBLIC_CLIENT);

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
        const turbineClient = await TurbineClient.create(WALLET_CLIENT, PUBLIC_CLIENT);

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
        const turbineClient = await TurbineClient.create(WALLET_CLIENT, PUBLIC_CLIENT);

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
        const turbineClient = await TurbineClient.create(WALLET_CLIENT, PUBLIC_CLIENT);

        const pool = await withTurbineErrorHandling(() => turbineClient.getPools());
        const lpToken = pool[0].metadata.lpToken;

        const intent: RemoveLiquidityIntent = {
            ...REMOVE_LIQUIDITY_INTENT,
            lpToken: lpToken,
            salt: getRandomSalt(),
        };

        const result = await withTurbineErrorHandling(() =>
            turbineClient.removeLiquidity(intent)
        );

        expect(result).toBeDefined();
    });

    it("should successfully cancel an order", async () => {
        const turbineClient = await TurbineClient.create(WALLET_CLIENT, PUBLIC_CLIENT);

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
        const turbineClient = await TurbineClient.create(WALLET_CLIENT, PUBLIC_CLIENT);

        const pools = await withTurbineErrorHandling(() => turbineClient.getPools());

        expect(pools).toBeDefined();
        expect(Array.isArray(pools)).toBe(true);
        expect(pools.length > 0).toBe(true);

        const pool = pools[0];
        expect(pool.metadata).toBeDefined();
        expect(pool.metadata.token0).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
        expect(pool.metadata.token1).toBe("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
        expect(pool.metadata.fee).toBe(3000);
        expect(pool.metadata.lpToken).toBeDefined();
        expect(pool.state).toBeDefined();
        expect(pool.stats).toBeDefined();
    });

    it("should successfully get registered pools (standalone function)", async () => {
        const config = await fetchConfig(TURBINE_API_URL);
        const pools = await withTurbineErrorHandling(() =>
            getPools(PUBLIC_CLIENT, config.lpHookAddress)
        );

        expect(pools).toBeDefined();
        expect(Array.isArray(pools)).toBe(true);
        expect(pools.length > 0).toBe(true);

        const pool = pools[0];
        expect(pool.metadata).toBeDefined();
        expect(pool.metadata.token0).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
        expect(pool.metadata.token1).toBe("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
        expect(pool.metadata.fee).toBe(3000);
        expect(pool.metadata.lpToken).toBeDefined();
        expect(pool.state).toBeDefined();
        expect(pool.stats).toBeDefined();
    });

    it("should successfully get user positions (client method)", async () => {
        const turbineClient = await TurbineClient.create(WALLET_CLIENT, PUBLIC_CLIENT);

        const positions = await withTurbineErrorHandling(() =>
            turbineClient.getUserPositions()
        );

        expect(positions).toBeDefined();
        expect(Array.isArray(positions)).toBe(true);
    });

    it("should successfully get user positions (standalone function)", async () => {
        const config = await fetchConfig(TURBINE_API_URL);
        const positions = await withTurbineErrorHandling(() =>
            getUserPositions(ACCOUNT.address, PUBLIC_CLIENT, config.lpHookAddress)
        );

        expect(positions).toBeDefined();
        expect(Array.isArray(positions)).toBe(true);
    });

    it("should successfully get order statuses", async () => {
        const turbineClient = await TurbineClient.create(WALLET_CLIENT, PUBLIC_CLIENT);

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
            turbineClient.getOrderStates([orderHash as Hex])
        );

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(1);
        expect(result[0].hash).toBe(orderHash);
    });

    it("should successfully get settled amounts", async () => {
        const turbineClient = await TurbineClient.create(WALLET_CLIENT, PUBLIC_CLIENT);

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
            turbineClient.getSettledAmounts([orderHash as Hex])
        );

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(1);
        expect(result[0]).toEqual({
            hash: orderHash,
            executedSellAmount: BigInt("0"),
        });
    });

    it("should successfully get order fee", async () => {
        const turbineClient = await TurbineClient.create(WALLET_CLIENT, PUBLIC_CLIENT);

        const intent: OrderIntent = {
            ...ORDER_INTENT,
            salt: getRandomSalt(),
        };

        const fee = await withTurbineErrorHandling(() =>
            turbineClient.getOrderFee(intent)
        );

        expect(typeof fee).toBe("bigint");
    });

    it("should successfully check status (standalone function)", async () => {
        const turbineClient = await TurbineClient.create(WALLET_CLIENT, PUBLIC_CLIENT);

        const result = await withTurbineErrorHandling(() =>
            checkStatus(turbineClient.turbineApiUrl)
        );

        expect(result).toBe(true);
    });

    it("should add liquidity with pre-signed permit", async () => {
        const client = await TurbineClient.create(WALLET_CLIENT, PUBLIC_CLIENT);

        const pools = await client.getPools();
        const pool = pools[0];

        const intent: AddLiquidityIntent = {
            owner: ACCOUNT.address,
            token0: pool.metadata.token0,
            token1: pool.metadata.token1,
            fee: pool.metadata.fee,
            token0Amount: 10000000n, // 10 USDC
            token1Amount: 4000000000000000n, // 0.004 WETH
            exact: true,
            salt: getRandomSalt(),
        };

        // Create payload with signed permits
        const payload = await client.createAddLiquidityData(intent);

        const result = await withTurbineErrorHandling(() =>
            client.addLiquidityWithSignedPermit(payload)
        );

        expect(result).toBeDefined();
        expect(result).toMatch(/^0x[0-9a-f]{64}$/);
    });

    describe("Cookie security integration", () => {
        it("should handle Set-Cookie headers with security attributes", async () => {
            const client = await TurbineClient.create(WALLET_CLIENT, PUBLIC_CLIENT);

            try {
                // Authenticate (should receive secure cookies)
                await client.ensureAuthenticated();

                // Verify cookies are stored (internal check)
                const cookieJar = (client as any).cookieJar;
                expect(cookieJar).toBeDefined();

                // Make authenticated request to verify cookies work
                const authStatus = await client.getAuthStatus();
                expect(authStatus.authenticated).toBe(true);

                // Logout and verify cookies are cleared
                await client.logout();

                const authStatusAfter = await client.getAuthStatus();
                expect(authStatusAfter.authenticated).toBe(false);
            } catch (error) {
                console.error("Cookie security integration test failed:", error);
                throw error;
            }
        });
    });
});
