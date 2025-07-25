import { describe, expect, jest } from "@jest/globals";
import { getAddress, Hex } from "viem";
import { NULL_ADDRESS, USDC, USDT, WBTC, WETH } from "../src/constants";
import { OrderIntent } from "../src/models";
import { convertSignature, TurbineClient } from "../src/turbineClient";
import {
    ACCOUNT,
    ADD_LIQUIDITY_INTENT,
    ORDER_INTENT,
    PUBLIC_CLIENT,
    REMOVE_LIQUIDITY_INTENT,
    WALLET_CLIENT,
} from "./constants";
import { withTurbineErrorHandling } from "./utils";

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

            // Mock the contract call to return test data
            const mockContractData = [
                {
                    poolId: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                    token0: USDC.address,
                    token1: WETH.address,
                    fee: 30,
                    lpToken: "0x24746c26c7B83DDabBAF384E02C3Eb0E7b8cD307",
                    reserve0: USDC.toOnchainAmount(1_000_000),
                    reserve1: WETH.toOnchainAmount(500),
                    liquidity: BigInt("1000000000000000000000"),
                },
                {
                    poolId: "0x2345678901bcdef12345678901bcdef12345678901bcdef12345678901bcdef1",
                    token0: USDC.address,
                    token1: WETH.address,
                    fee: 50,
                    lpToken: "0x1234567890123456789012345678901234567890",
                    reserve0: USDC.toOnchainAmount(2_000_000),
                    reserve1: WETH.toOnchainAmount(1_000),
                    liquidity: BigInt("2000000000000000000000"),
                },
                {
                    poolId: "0x3456789012cdef123456789012cdef123456789012cdef123456789012cdef12",
                    token0: USDC.address,
                    token1: WBTC.address,
                    fee: 10,
                    lpToken: "0x9876543210987654321098765432109876543210",
                    reserve0: USDC.toOnchainAmount(1_000_000),
                    reserve1: WBTC.toOnchainAmount(10),
                    liquidity: BigInt("500000000000000000000"),
                },
            ];

            // Mock the readContract method using jest.spyOn
            const mockReadContract = jest
                .spyOn(PUBLIC_CLIENT, "readContract")
                .mockResolvedValue(mockContractData as any);

            const pools = await withTurbineErrorHandling(() =>
                client.getPools(PUBLIC_CLIENT)
            );

            // Restore the mock
            mockReadContract.mockRestore();

            expect(pools).toHaveLength(3);
            expect(pools[0].metadata.token0).toEqual(mockContractData[0].token0);
            expect(pools[0].metadata.token1).toEqual(mockContractData[0].token1);
            expect(pools[0].metadata.fee).toEqual(mockContractData[0].fee / 100);
            expect(pools[0].metadata.lpToken).toEqual(mockContractData[0].lpToken);
            expect(pools[0].state.reserve0).toEqual(mockContractData[0].reserve0);
            expect(pools[0].state.reserve1).toEqual(mockContractData[0].reserve1);
            expect(pools[0].state.liquidity).toEqual(mockContractData[0].liquidity);
            expect(pools[0].stats.weeklySellVolumeToken0).toEqual(0n);
            expect(pools[0].stats.weeklySellVolumeToken1).toEqual(0n);
        });
    });

    describe("getUserPositions", () => {
        it("should return user positions with mocked data", async () => {
            const client = new TurbineClient();
            const testUserAddress = "0xC78c504B91598E6ca72059C4Ea4d2dE8f3e77E38";

            // Mock the contract call for getPools to return test data
            const mockPoolsData = [
                {
                    poolId: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                    token0: USDC.address,
                    token1: WETH.address,
                    fee: 3000,
                    lpToken: "0x24746c26c7B83DDabBAF384E02C3Eb0E7b8cD307",
                    reserve0: USDC.toOnchainAmount(1_000_000),
                    reserve1: WETH.toOnchainAmount(500),
                    liquidity: BigInt("1000000000000000000000"),
                },
                {
                    poolId: "0x2345678901bcdef12345678901bcdef12345678901bcdef12345678901bcdef1",
                    token0: USDC.address,
                    token1: WBTC.address,
                    fee: 50,
                    lpToken: "0x1234567890123456789012345678901234567890",
                    reserve0: USDC.toOnchainAmount(2_000_000),
                    reserve1: WBTC.toOnchainAmount(10),
                    liquidity: BigInt("2000000000000000000000"),
                },
            ];

            // Mock multicall results - user has balance in first pool but not second
            const mockMulticallResults = [
                {
                    status: "success" as const,
                    result: BigInt("100000000000000000000"), // 1 LP token
                },
                {
                    status: "success" as const,
                    result: BigInt("0"), // 0 LP tokens
                },
            ];

            // Mock the readContract method for getPools
            const mockReadContract = jest
                .spyOn(PUBLIC_CLIENT, "readContract")
                .mockResolvedValue(mockPoolsData as any);

            // Mock the multicall method for balance checks
            const mockMulticall = jest
                .spyOn(PUBLIC_CLIENT, "multicall")
                .mockResolvedValue(mockMulticallResults as any);

            const positions = await withTurbineErrorHandling(() =>
                client.getUserPositions(testUserAddress, PUBLIC_CLIENT)
            );

            // Restore the mocks
            mockReadContract.mockRestore();
            mockMulticall.mockRestore();

            // Should only return positions where balance > 0
            expect(positions).toHaveLength(1);
            expect(positions[0].poolMetadata.token0).toEqual(mockPoolsData[0].token0);
            expect(positions[0].poolMetadata.token1).toEqual(mockPoolsData[0].token1);
            expect(positions[0].poolMetadata.fee).toEqual(mockPoolsData[0].fee / 100);
            expect(positions[0].poolMetadata.lpToken).toEqual(mockPoolsData[0].lpToken);
            expect(positions[0].userAddress).toEqual(getAddress(testUserAddress));
            expect(positions[0].lpTokenBalance).toEqual(mockMulticallResults[0].result);
        });

        it("should handle multicall failures gracefully", async () => {
            const client = new TurbineClient();
            const testUserAddress = "0x1234567890123456789012345678901234567890";

            // Mock the contract call for getPools to return test data
            const mockPoolsData = [
                {
                    poolId: "0x1111111111abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                    token0: USDC.address,
                    token1: WETH.address,
                    fee: 3000,
                    lpToken: "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa",
                    reserve0: USDC.toOnchainAmount(1_000_000),
                    reserve1: WETH.toOnchainAmount(500),
                    liquidity: BigInt("1000000000000000000000"),
                },
                {
                    poolId: "0x2222222222abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                    token0: USDC.address,
                    token1: WETH.address,
                    fee: 4000,
                    lpToken: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
                    reserve0: USDC.toOnchainAmount(1_000_000),
                    reserve1: WETH.toOnchainAmount(500),
                    liquidity: BigInt("1000000000000000000000"),
                },
            ];

            // Mock multicall results with failure
            const mockMulticallResults = [
                {
                    status: "failure" as const,
                    error: new Error("Contract call failed"),
                },
                {
                    status: "success" as const,
                    result: BigInt("100000000000000000000"), // 1 LP token
                },
            ];

            // Mock the readContract method for getPools
            const mockReadContract = jest
                .spyOn(PUBLIC_CLIENT, "readContract")
                .mockResolvedValue(mockPoolsData as any);

            // Mock the multicall method for balance checks
            const mockMulticall = jest
                .spyOn(PUBLIC_CLIENT, "multicall")
                .mockResolvedValue(mockMulticallResults as any);

            const positions = await withTurbineErrorHandling(() =>
                client.getUserPositions(testUserAddress, PUBLIC_CLIENT)
            );

            // Restore the mocks
            mockReadContract.mockRestore();
            mockMulticall.mockRestore();

            // Should gracefully handle multicall failures and return positions with liquidity
            expect(positions).toHaveLength(1);
            expect(positions[0].poolMetadata.token0).toEqual(mockPoolsData[1].token0);
            expect(positions[0].poolMetadata.token1).toEqual(mockPoolsData[1].token1);
            expect(positions[0].poolMetadata.fee).toEqual(mockPoolsData[1].fee / 100);
            expect(positions[0].poolMetadata.lpToken).toEqual(mockPoolsData[1].lpToken);
            expect(positions[0].lpTokenBalance).toEqual(mockMulticallResults[1].result);
        });
    });

    describe("getSettledAmounts", () => {
        it("should return filled amounts for multiple orders", async () => {
            const client = new TurbineClient();
            const mockOrderHashes = [
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                "0x2345678901bcdef12345678901bcdef12345678901bcdef12345678901bcdef1",
                "0x3456789012cdef123456789012cdef123456789012cdef123456789012cdef12",
            ];
            const mockFilledAmounts = [
                BigInt("1000000000000000000"), // 1 token
                BigInt("500000000000000000"), // 0.5 token
                BigInt("0"), // 0 token
            ] as const;

            // Mock the readContract method
            const mockReadContract = jest
                .spyOn(PUBLIC_CLIENT, "readContract")
                .mockResolvedValue(mockFilledAmounts);

            const filledAmounts = await withTurbineErrorHandling(() =>
                client.getSettledAmounts(mockOrderHashes, PUBLIC_CLIENT)
            );

            expect(filledAmounts).toEqual(mockFilledAmounts);
            expect(mockReadContract).toHaveBeenCalledWith({
                address: client.settlerContract,
                abi: expect.any(Array),
                functionName: "getSettledAmounts",
                args: [mockOrderHashes],
            });

            // Restore the mock
            mockReadContract.mockRestore();
        });
    });

    describe("checkStatus", () => {
        it("should return true when Turbine service is available (status 200)", async () => {
            const client = new TurbineClient();
            const mockResponse = new Response("OK", { status: 200 });

            // Mock the fetch call
            jest.spyOn(global, "fetch").mockResolvedValue(mockResponse);

            const result = await withTurbineErrorHandling(() => client.checkStatus());

            expect(result).toBe(true);
            expect(global.fetch).toHaveBeenCalledWith(
                `${client.turbineApiUrl}/status`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            // Restore the mock
            jest.restoreAllMocks();
        });

        it("should throw TurbineError when service returns non-200 status", async () => {
            const client = new TurbineClient();
            const mockResponse = new Response("Service Unavailable", { status: 503 });

            // Mock the fetch call
            jest.spyOn(global, "fetch").mockResolvedValue(mockResponse);

            await expect(client.checkStatus()).rejects.toThrow(
                "Turbine is currently unavailable. Try again later."
            );

            expect(global.fetch).toHaveBeenCalledWith(
                `${client.turbineApiUrl}/status`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            // Restore the mock
            jest.restoreAllMocks();
        });

        it("should throw TurbineError when service returns 404 status", async () => {
            const client = new TurbineClient();
            const mockResponse = new Response("Not Found", { status: 404 });

            // Mock the fetch call
            jest.spyOn(global, "fetch").mockResolvedValue(mockResponse);

            await expect(client.checkStatus()).rejects.toThrow(
                "Turbine is currently unavailable. Try again later."
            );

            // Restore the mock
            jest.restoreAllMocks();
        });

        it("should throw TurbineError when service returns 500 status", async () => {
            const client = new TurbineClient();
            const mockResponse = new Response("Internal Server Error", { status: 500 });

            // Mock the fetch call
            jest.spyOn(global, "fetch").mockResolvedValue(mockResponse);

            await expect(client.checkStatus()).rejects.toThrow(
                "Turbine is currently unavailable. Try again later."
            );

            // Restore the mock
            jest.restoreAllMocks();
        });

        it("should throw TurbineError when network request fails", async () => {
            const client = new TurbineClient();
            const networkError = new Error("Network error");

            // Mock the fetch call to throw an error
            jest.spyOn(global, "fetch").mockRejectedValue(networkError);

            await expect(client.checkStatus()).rejects.toThrow(
                "Turbine is currently unavailable. Try again later."
            );

            // Restore the mock
            jest.restoreAllMocks();
        });

        it("should use custom turbineApiUrl when provided", async () => {
            const customApiUrl = "https://custom-turbine-api.example.com";
            const client = new TurbineClient(customApiUrl);
            const mockResponse = new Response("OK", { status: 200 });

            // Mock the fetch call
            jest.spyOn(global, "fetch").mockResolvedValue(mockResponse);

            const result = await withTurbineErrorHandling(() => client.checkStatus());

            expect(result).toBe(true);
            expect(global.fetch).toHaveBeenCalledWith(`${customApiUrl}/status`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            // Restore the mock
            jest.restoreAllMocks();
        });
    });

    describe("getOrderStatuses", () => {
        it("should call Turbine API and return order statuses", async () => {
            const mockOrderStatuses = [
                {
                    hash: "0xdf41611e3a8931e1aa13c7a26367ff38e4cefafd2d1cf92492b0128c956a80ce",
                    order: {
                        hash: "0xdf41611e3a8931e1aa13c7a26367ff38e4cefafd2d1cf92492b0128c956a80ce",
                        owner: "0x9719df0e4151581b9d59801b8f236fdf3f510d9b",
                        sell_token: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                        buy_token: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
                        start_time: "1751642853",
                        end_time: "1751643153",
                        partial_fill: true,
                        salt: "0x45091d251dda08eb0211bdefbcbb04cdce1c863c4afd3875b2997ab539ddbf16",
                        created_timestamp: "2025-07-04T15:27:33.894719321",
                        calldata: "0x",
                        calldata_target: "0x0000000000000000000000000000000000000000",
                        sell_amount: "50000000",
                        executed_sell_amount: "0",
                        mid_price_delta: "2500",
                        limit_price: {
                            numerator: "300000000",
                            denominator: "1",
                        },
                    },
                    state: "Invalid",
                    execution: [
                        {
                            batch_id: "123",
                            cleared_at: "1751642853",
                            sold_amount: "1000000",
                            bought_amount: "950000",
                        },
                    ],
                    executed_sell_amount: "1000000",
                    executed_buy_amount: "950000",
                },
            ];

            const client = new TurbineClient();

            const mockResponse = new Response(JSON.stringify(mockOrderStatuses), {
                status: 200,
            });
            jest.spyOn(global, "fetch").mockResolvedValue(mockResponse);

            const orderHashes: Hex[] = [
                "0xdf41611e3a8931e1aa13c7a26367ff38e4cefafd2d1cf92492b0128c956a80ce",
            ];

            const result = await withTurbineErrorHandling(() =>
                client.getOrderStatuses(orderHashes)
            );

            expect(result).toHaveLength(1);
            expect(result[0].hash).toBe(
                "0xdf41611e3a8931e1aa13c7a26367ff38e4cefafd2d1cf92492b0128c956a80ce"
            );
            expect(result[0].state).toBe("Invalid");
            expect(result[0].order.owner).toBe(
                getAddress("0x9719df0e4151581b9d59801b8f236fdf3f510d9b")
            );
            expect(result[0].order.sellAmount).toBe(BigInt("50000000"));
            expect(result[0].order.limitPrice.numerator).toBe(BigInt("300000000"));
            expect(result[0].executedSellAmount).toBe(BigInt("1000000"));
            expect(result[0].execution).toHaveLength(1);
            expect(result[0].execution[0].batchId).toBe(123);
            expect(result[0].execution[0].clearedAt).toBe(1751642853);
            expect(result[0].execution[0].soldAmount).toBe(BigInt("1000000"));
            expect(result[0].execution[0].boughtAmount).toBe(BigInt("950000"));

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining("/order_statuses"),
                expect.objectContaining({
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: expect.stringContaining(JSON.stringify(orderHashes)),
                })
            );
        });
    });
});
