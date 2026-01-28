import { describe, expect, jest } from "@jest/globals";
import { Address, getAddress, Hex } from "viem";
import { USDC, WBTC, WETH } from "../src/constants";
import {
    checkStatus,
    getPools,
    getUserPositions,
    TurbineClient,
} from "../src/turbineClient";
import {
    ACCOUNT,
    ADD_LIQUIDITY_INTENT,
    createMockTurbineClient,
    MOCK_TURBINE_CONFIG,
    ORDER_INTENT,
    PUBLIC_CLIENT,
    REMOVE_LIQUIDITY_INTENT,
} from "./constants";
import { withTurbineErrorHandling } from "./utils";
import { LiquidityIntentStatus } from "../src/models";
import { turbineHookABI } from "../src/abi";

// Helper function to mock authentication
function mockAuthentication(client: TurbineClient, address: Address) {
    // Mock the ensureAuthenticated method to return the address without making HTTP calls
    jest.spyOn(client as any, "ensureAuthenticated").mockResolvedValue(address);
}

describe("TurbineClient", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("addOrder", () => {
        it("should call Turbine API and return order ID", async () => {
            const mockOrderId =
                "0x1111111111111111111111111111111111111111111111111111111111111111";
            const client = await createMockTurbineClient();

            // Mock authentication
            mockAuthentication(client, ACCOUNT.address);

            const mockCallAPI = jest
                .spyOn(client as any, "callApiEndpoint")
                .mockResolvedValue(
                    new Response(JSON.stringify({ orderHash: mockOrderId }), {
                        status: 200,
                        statusText: "OK",
                    })
                );

            const orderId = await withTurbineErrorHandling(() =>
                client.addOrder(ORDER_INTENT)
            );

            expect(orderId).toBe(mockOrderId);
            expect(mockCallAPI).toHaveBeenCalledTimes(1);
        });
    });

    describe("addOrders", () => {
        it("should call Turbine API and return array of order IDs", async () => {
            const mockOrderIds = [
                "0x1111111111111111111111111111111111111111111111111111111111111111",
                "0x2222222222222222222222222222222222222222222222222222222222222222",
            ];
            const client = await createMockTurbineClient();

            // Mock authentication
            mockAuthentication(client, ACCOUNT.address);

            const mockCallAPI = jest
                .spyOn(client as any, "callApiEndpoint")
                .mockResolvedValue(
                    new Response(
                        JSON.stringify([
                            { orderHash: mockOrderIds[0] },
                            { orderHash: mockOrderIds[1] },
                        ]),
                        {
                            status: 200,
                            statusText: "OK",
                        }
                    )
                );

            const orderIds = await withTurbineErrorHandling(() =>
                client.addOrders([ORDER_INTENT, ORDER_INTENT])
            );

            expect(orderIds).toEqual(mockOrderIds);
            expect(mockCallAPI).toHaveBeenCalledTimes(1);
        });
    });

    describe("addLiquidity", () => {
        it("should call Turbine API and return intent ID", async () => {
            const mockIntentId =
                "0x3333333333333333333333333333333333333333333333333333333333333333";
            const client = await createMockTurbineClient();

            // Mock authentication
            mockAuthentication(client, ACCOUNT.address);

            const mockCallAPI = jest
                .spyOn(client as any, "callApiEndpoint")
                .mockResolvedValue(
                    new Response(JSON.stringify({ intentHash: mockIntentId }), {
                        status: 200,
                        statusText: "OK",
                    })
                );

            const liquidityId = await withTurbineErrorHandling(() =>
                client.addLiquidity(ADD_LIQUIDITY_INTENT)
            );

            expect(liquidityId).toBe(mockIntentId);
            expect(mockCallAPI).toHaveBeenCalledTimes(1);
        });
    });

    describe("removeLiquidity", () => {
        it("should call Turbine API and return intent ID", async () => {
            const mockIntentId = "test-intent-id-123";
            const client = await createMockTurbineClient();

            // Mock authentication
            mockAuthentication(client, ACCOUNT.address);

            const mockCallAPI = jest
                .spyOn(client as any, "callApiEndpoint")
                .mockResolvedValue(
                    new Response(JSON.stringify({ intentHash: mockIntentId }), {
                        status: 200,
                        statusText: "OK",
                    })
                );

            const liquidityId = await withTurbineErrorHandling(() =>
                client.removeLiquidity(REMOVE_LIQUIDITY_INTENT)
            );

            expect(liquidityId).toBe(mockIntentId);
            expect(mockCallAPI).toHaveBeenCalledTimes(1);
        });
    });

    describe("cancelOrder", () => {
        it("should call Turbine API and return success message", async () => {
            const mockOrderHash =
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
            const client = await createMockTurbineClient();

            // Mock authentication
            mockAuthentication(client, ACCOUNT.address);

            // Mock the callApiEndpoint method
            const mockCallAPI = jest
                .spyOn(client as any, "callApiEndpoint")
                .mockResolvedValue(
                    new Response(
                        JSON.stringify({
                            orderHash: mockOrderHash,
                            message: "Order cancelled successfully",
                        }),
                        {
                            status: 200,
                            statusText: "OK",
                        }
                    )
                );

            const result = await withTurbineErrorHandling(() =>
                client.cancelOrder(mockOrderHash as Hex)
            );

            expect(result).toEqual({
                orderHash: mockOrderHash,
                message: "Order cancelled successfully",
            });
            expect(mockCallAPI).toHaveBeenCalledTimes(1);
        });
    });

    describe("getPools", () => {
        it("should return mocked turbine pool (client method)", async () => {
            const client = await createMockTurbineClient();

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
                .spyOn(client.publicClient, "readContract")
                .mockResolvedValueOnce(BigInt(3))
                .mockResolvedValueOnce(mockContractData as any);

            const pools = await withTurbineErrorHandling(() => client.getPools());

            expect(mockReadContract).toHaveBeenNthCalledWith(1, {
                address: MOCK_TURBINE_CONFIG.lpHookAddress,
                abi: turbineHookABI,
                functionName: "getNumberOfRegisteredPools",
            });
            expect(mockReadContract).toHaveBeenNthCalledWith(2, {
                address: MOCK_TURBINE_CONFIG.lpHookAddress,
                abi: turbineHookABI,
                functionName: "getRegisteredPoolsSlice",
                args: [0n, 3n],
            });
            expect(mockReadContract).toHaveBeenCalledTimes(2);
            // Restore the mock
            mockReadContract.mockRestore();

            expect(pools).toHaveLength(3);
            expect(pools[0].metadata.token0).toEqual(mockContractData[0].token0);
            expect(pools[0].metadata.token1).toEqual(mockContractData[0].token1);
            expect(pools[0].metadata.fee).toEqual(mockContractData[0].fee);
            expect(pools[0].metadata.lpToken).toEqual(mockContractData[0].lpToken);
            expect(pools[0].state.reserve0).toEqual(mockContractData[0].reserve0);
            expect(pools[0].state.reserve1).toEqual(mockContractData[0].reserve1);
            expect(pools[0].state.liquidity).toEqual(mockContractData[0].liquidity);
            expect(pools[0].stats.weeklySellVolumeToken0).toEqual(0n);
            expect(pools[0].stats.weeklySellVolumeToken1).toEqual(0n);
        });

        it("should return mocked turbine pool (standalone function)", async () => {
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
                .mockResolvedValueOnce(BigInt(3))
                .mockResolvedValueOnce(mockContractData as any);

            const pools = await withTurbineErrorHandling(() =>
                getPools(PUBLIC_CLIENT, MOCK_TURBINE_CONFIG.lpHookAddress)
            );

            // Restore the mock
            mockReadContract.mockRestore();

            expect(pools).toHaveLength(3);
            expect(pools[0].metadata.token0).toEqual(mockContractData[0].token0);
            expect(pools[0].metadata.token1).toEqual(mockContractData[0].token1);
            expect(pools[0].metadata.fee).toEqual(mockContractData[0].fee);
            expect(pools[0].metadata.lpToken).toEqual(mockContractData[0].lpToken);
            expect(pools[0].state.reserve0).toEqual(mockContractData[0].reserve0);
            expect(pools[0].state.reserve1).toEqual(mockContractData[0].reserve1);
            expect(pools[0].state.liquidity).toEqual(mockContractData[0].liquidity);
            expect(pools[0].stats.weeklySellVolumeToken0).toEqual(0n);
            expect(pools[0].stats.weeklySellVolumeToken1).toEqual(0n);
        });
    });

    describe("getUserPositions", () => {
        it("should return user positions with mocked data (client method)", async () => {
            const client = await createMockTurbineClient();
            const testUserAddress = ACCOUNT.address;

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
                .spyOn(client.publicClient, "readContract")
                .mockResolvedValueOnce(BigInt(2))
                .mockResolvedValueOnce(mockPoolsData as any);

            // Mock the multicall method for balance checks
            const mockMulticall = jest
                .spyOn(client.publicClient, "multicall")
                .mockResolvedValue(mockMulticallResults as any);

            const positions = await withTurbineErrorHandling(() =>
                client.getUserPositions()
            );

            // Restore the mocks
            mockReadContract.mockRestore();
            mockMulticall.mockRestore();

            // Should only return positions where balance > 0
            expect(positions).toHaveLength(1);
            expect(positions[0].poolMetadata.token0).toEqual(mockPoolsData[0].token0);
            expect(positions[0].poolMetadata.token1).toEqual(mockPoolsData[0].token1);
            expect(positions[0].poolMetadata.fee).toEqual(mockPoolsData[0].fee);
            expect(positions[0].poolMetadata.lpToken).toEqual(mockPoolsData[0].lpToken);
            expect(positions[0].userAddress).toEqual(getAddress(testUserAddress));
            expect(positions[0].lpTokenBalance).toEqual(mockMulticallResults[0].result);
        });

        it("should return user positions with mocked data (standalone function)", async () => {
            const testUserAddress = ACCOUNT.address;

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
                .mockResolvedValueOnce(BigInt(2))
                .mockResolvedValueOnce(mockPoolsData as any);

            // Mock the multicall method for balance checks
            const mockMulticall = jest
                .spyOn(PUBLIC_CLIENT, "multicall")
                .mockResolvedValue(mockMulticallResults as any);

            const positions = await withTurbineErrorHandling(() =>
                getUserPositions(
                    testUserAddress as Address,
                    PUBLIC_CLIENT,
                    MOCK_TURBINE_CONFIG.lpHookAddress
                )
            );

            // Restore the mocks
            mockReadContract.mockRestore();
            mockMulticall.mockRestore();

            // Should only return positions where balance > 0
            expect(positions).toHaveLength(1);
            expect(positions[0].poolMetadata.token0).toEqual(mockPoolsData[0].token0);
            expect(positions[0].poolMetadata.token1).toEqual(mockPoolsData[0].token1);
            expect(positions[0].poolMetadata.fee).toEqual(mockPoolsData[0].fee);
            expect(positions[0].poolMetadata.lpToken).toEqual(mockPoolsData[0].lpToken);
            expect(positions[0].userAddress).toEqual(getAddress(testUserAddress));
            expect(positions[0].lpTokenBalance).toEqual(mockMulticallResults[0].result);
        });

        it("should handle multicall failures gracefully", async () => {
            const client = await createMockTurbineClient();

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
                .spyOn(client.publicClient, "readContract")
                .mockResolvedValueOnce(BigInt(2))
                .mockResolvedValueOnce(mockPoolsData as any);

            // Mock the multicall method for balance checks
            const mockMulticall = jest
                .spyOn(client.publicClient, "multicall")
                .mockResolvedValue(mockMulticallResults as any);

            const positions = await withTurbineErrorHandling(() =>
                client.getUserPositions()
            );

            // Restore the mocks
            mockReadContract.mockRestore();
            mockMulticall.mockRestore();

            // Should gracefully handle multicall failures and return positions with liquidity
            expect(positions).toHaveLength(1);
            expect(positions[0].poolMetadata.token0).toEqual(mockPoolsData[1].token0);
            expect(positions[0].poolMetadata.token1).toEqual(mockPoolsData[1].token1);
            expect(positions[0].poolMetadata.fee).toEqual(mockPoolsData[1].fee);
            expect(positions[0].poolMetadata.lpToken).toEqual(mockPoolsData[1].lpToken);
            expect(positions[0].lpTokenBalance).toEqual(mockMulticallResults[1].result);
        });
    });

    describe("getSettledAmounts", () => {
        it("should return filled amounts for multiple orders (client method)", async () => {
            const client = await createMockTurbineClient();
            const mockOrderHashes = [
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                "0x2345678901bcdef12345678901bcdef12345678901bcdef12345678901bcdef1",
                "0x3456789012cdef123456789012cdef123456789012cdef123456789012cdef12",
            ] as Hex[];

            // Mock order statuses with different executed sell amounts
            const mockOrderStates = [
                {
                    hash: mockOrderHashes[0],
                    order: { executedSellAmount: BigInt("1000000") },
                    state: "Filled",
                    execution: [],
                    executedSellAmount: BigInt("1000000000000000000"), // 1 token (0.6 + 0.4)
                    executedBuyAmount: BigInt("950000"),
                },
                {
                    hash: mockOrderHashes[1],
                    order: { executedSellAmount: BigInt("500000") },
                    state: "PartiallyFilled",
                    execution: [],
                    executedSellAmount: BigInt("500000000000000000"), // 0.5 token
                    executedBuyAmount: BigInt("475000"),
                },
                {
                    hash: mockOrderHashes[2],
                    order: { executedSellAmount: BigInt("0") },
                    state: "Open",
                    execution: [],
                    executedSellAmount: BigInt("0"), // 0 token
                    executedBuyAmount: BigInt("0"),
                },
            ];

            const expectedAmounts = [
                {
                    hash: mockOrderHashes[0],
                    executedSellAmount: BigInt("1000000000000000000"), // 1 token (0.6 + 0.4)
                },
                {
                    hash: mockOrderHashes[1],
                    executedSellAmount: BigInt("500000000000000000"), // 0.5 token
                },
                {
                    hash: mockOrderHashes[2],
                    executedSellAmount: BigInt("0"), // 0 token
                },
            ];

            // Mock authentication
            mockAuthentication(client, ACCOUNT.address);

            // Mock the getOrderStates method
            const mockGetOrderStatuses = jest
                .spyOn(client, "getOrderStates")
                .mockResolvedValue(mockOrderStates as any);

            const filledAmounts = await withTurbineErrorHandling(() =>
                client.getSettledAmounts(mockOrderHashes)
            );

            expect(filledAmounts).toEqual(expectedAmounts);
            expect(mockGetOrderStatuses).toHaveBeenCalledWith(mockOrderHashes);

            // Restore the mocks
            mockGetOrderStatuses.mockRestore();
        });
    });

    describe("getOrderFee", () => {
        it("should call Turbine API and return fee as bigint", async () => {
            const client = await createMockTurbineClient();

            // Spy on internal fetchWithCookies used by getOrderFee
            const mockFetchWithCookies = jest
                .spyOn(client as any, "fetchWithCookies")
                .mockResolvedValue(
                    new Response(JSON.stringify("0x38d7ea4c68000"), {
                        status: 200,
                        statusText: "OK",
                    })
                );

            const fee = await withTurbineErrorHandling(() =>
                client.getOrderFee(ORDER_INTENT)
            );

            expect(fee).toBe(BigInt("0x38d7ea4c68000"));
            expect(mockFetchWithCookies).toHaveBeenCalledWith(
                "order_fees",
                expect.objectContaining({ method: "POST" })
            );

            // Restore the mock
            mockFetchWithCookies.mockRestore();
        });
    });

    describe("checkStatus", () => {
        it("should return true when Turbine service is available (status 200) - client method", async () => {
            const client = await createMockTurbineClient();

            // Mock fetch
            const mockFetch = jest.spyOn(global, "fetch").mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers(),
                json: async () => "OK",
                text: async () => "OK",
            } as Response);

            const result = await withTurbineErrorHandling(() => client.checkStatus());

            expect(result).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/status"));

            // Restore the mock
            jest.restoreAllMocks();
        });

        it("should return true when Turbine service is available (status 200) - standalone function", async () => {
            const client = await createMockTurbineClient();
            const turbineApiUrl = client.turbineApiUrl;

            // Mock fetch
            const mockFetch = jest.spyOn(global, "fetch").mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers(),
                json: async () => "OK",
                text: async () => "OK",
            } as Response);

            const result = await withTurbineErrorHandling(() =>
                checkStatus(turbineApiUrl)
            );

            expect(result).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith(`${turbineApiUrl}/status`);

            // Restore the mock
            jest.restoreAllMocks();
        });

        it("should throw TurbineError when service returns non-200 status", async () => {
            const client = await createMockTurbineClient();

            // Mock fetch to throw an error
            const mockFetch = jest
                .spyOn(global, "fetch")
                .mockRejectedValue(new Error("Network error"));

            await expect(client.checkStatus()).rejects.toThrow(
                "Turbine is currently unavailable. Try again later."
            );

            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/status"));

            // Restore the mock
            jest.restoreAllMocks();
        });

        it("should throw TurbineError when service returns 404 status", async () => {
            const client = await createMockTurbineClient();

            // Mock fetch to return 404
            jest.spyOn(global, "fetch").mockResolvedValue({
                ok: false,
                status: 404,
                statusText: "Not Found",
                headers: new Headers(),
                json: async () => ({ error: "Not Found" }),
                text: async () => "Not Found",
            } as Response);

            await expect(client.checkStatus()).rejects.toThrow(
                "Turbine is currently unavailable. Try again later."
            );

            // Restore the mock
            jest.restoreAllMocks();
        });

        it("should throw TurbineError when service returns 500 status", async () => {
            const client = await createMockTurbineClient();

            // Mock fetch to return 500
            jest.spyOn(global, "fetch").mockResolvedValue({
                ok: false,
                status: 500,
                statusText: "Internal Server Error",
                headers: new Headers(),
                json: async () => ({ error: "Internal Server Error" }),
                text: async () => "Internal Server Error",
            } as Response);

            await expect(client.checkStatus()).rejects.toThrow(
                "Turbine is currently unavailable. Try again later."
            );

            // Restore the mock
            jest.restoreAllMocks();
        });

        it("should throw TurbineError when network request fails", async () => {
            const client = await createMockTurbineClient();
            const networkError = new Error("Network error");

            // Mock fetch to throw a network error
            jest.spyOn(global, "fetch").mockRejectedValue(networkError);

            await expect(client.checkStatus()).rejects.toThrow(
                "Turbine is currently unavailable. Try again later."
            );

            // Restore the mock
            jest.restoreAllMocks();
        });

        it("should use custom turbineApiUrl when provided", async () => {
            const customApiUrl = "https://custom-turbine-api.example.com";
            const client = await createMockTurbineClient(customApiUrl);

            // Mock fetch
            const mockFetch = jest.spyOn(global, "fetch").mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Headers(),
                json: async () => "OK",
                text: async () => "OK",
            } as Response);

            const result = await withTurbineErrorHandling(() => client.checkStatus());

            expect(result).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith(`${customApiUrl}/status`);

            // Restore the mock
            jest.restoreAllMocks();
        });
    });

    describe("getOrderStates", () => {
        it("should call Turbine API and return order statuses", async () => {
            const mockOrderStates = [
                {
                    hash: "0xdf41611e3a8931e1aa13c7a26367ff38e4cefafd2d1cf92492b0128c956a80ce",
                    status: "Invalid",
                    execution: [
                        {
                            tx_hash:
                                "0x1111111111111111111111111111111111111111111111111111111111111111",
                            block_number: "23882001",
                            sold_amount: "1000000",
                            bought_amount: "950000",
                            surplus_buy_amount: "10",
                        },
                        {
                            tx_hash:
                                "0x2222222222222222222222222222222222222222222222222222222222222222",
                            block_number: "23882281",
                            sold_amount: "2000000",
                            bought_amount: "1900000",
                            surplus_buy_amount: "11",
                        },
                    ],
                },
            ];

            const client = await createMockTurbineClient();

            // Mock authentication
            mockAuthentication(client, ACCOUNT.address);

            // Mock the callApiEndpoint method
            const mockCallAPI = jest
                .spyOn(client as any, "callApiEndpoint")
                .mockResolvedValue(
                    new Response(JSON.stringify(mockOrderStates), {
                        status: 200,
                        statusText: "OK",
                    })
                );

            const orderHashes: Hex[] = [
                "0xdf41611e3a8931e1aa13c7a26367ff38e4cefafd2d1cf92492b0128c956a80ce",
            ];

            // const result = await withTurbineErrorHandling(() =>
            const result = await client.getOrderStates(orderHashes);
            // );

            expect(result).toHaveLength(1);
            expect(result[0].hash).toBe(
                "0xdf41611e3a8931e1aa13c7a26367ff38e4cefafd2d1cf92492b0128c956a80ce"
            );
            expect(result[0].status).toBe("Invalid");
            expect(result[0].executedSellAmount).toBe(BigInt("3000000"));
            expect(result[0].executedBuyAmount).toBe(BigInt("2850000"));
            expect(result[0].execution).toHaveLength(2);
            expect(result[0].execution[0].txHash).toBe(
                "0x1111111111111111111111111111111111111111111111111111111111111111"
            );
            expect(result[0].execution[0].clearedAt).toEqual(
                new Date(1764148979 * 1000)
            );
            expect(result[0].execution[0].soldAmount).toBe(BigInt("1000000"));
            expect(result[0].execution[0].boughtAmount).toBe(BigInt("950000"));
            expect(result[0].execution[1].txHash).toBe(
                "0x2222222222222222222222222222222222222222222222222222222222222222"
            );
            expect(result[0].execution[1].clearedAt).toEqual(
                new Date(1764152387 * 1000)
            );
            expect(result[0].execution[1].soldAmount).toBe(BigInt("2000000"));
            expect(result[0].execution[1].boughtAmount).toBe(BigInt("1900000"));
            expect(mockCallAPI).toHaveBeenCalledWith(
                { orderHashes: orderHashes },
                "order_states"
            );
        });
    });

    describe("getLiquidityIntents", () => {
        it("should call Turbine API and return liquidity intent states", async () => {
            const mockStates = [
                {
                    hash: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                    status: "Pending",
                },
            ];

            const client = await createMockTurbineClient();

            // Mock authentication
            mockAuthentication(client, ACCOUNT.address);

            // Spy on internal fetchWithCookies used by getLiquidityIntents
            const mockFetchWithCookies = jest
                .spyOn(client as any, "fetchWithCookies")
                .mockResolvedValue(
                    new Response(JSON.stringify(mockStates), {
                        status: 200,
                        statusText: "OK",
                    })
                );

            const intentHashes: Hex[] = [
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            ];

            const result = await withTurbineErrorHandling(() =>
                client.getLiquidityIntents(intentHashes)
            );

            expect(result).toHaveLength(1);
            expect(result[0].hash).toBe(
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd"
            );
            expect(result[0].status).toBe(LiquidityIntentStatus.Pending);
        });
    });

    describe("liquidity validation", () => {
        it("should reject addLiquidity with both amounts zero", async () => {
            const client = await createMockTurbineClient();

            const intent = {
                ...ADD_LIQUIDITY_INTENT,
                token0Amount: 0n,
                token1Amount: 0n,
            };

            await expect(client.addLiquidity(intent)).rejects.toMatchObject({
                code: "ZERO_LIQUIDITY",
            });
        });

        it("should accept single-sided liquidity (token0 only)", async () => {
            const mockIntentId = "test-intent-id-single-sided-0";
            const client = await createMockTurbineClient();

            // Mock authentication
            mockAuthentication(client, ACCOUNT.address);

            const mockCallAPI = jest
                .spyOn(client as any, "callApiEndpoint")
                .mockResolvedValue(
                    new Response(JSON.stringify({ intentHash: mockIntentId }), {
                        status: 200,
                        statusText: "OK",
                    })
                );

            const intent = {
                ...ADD_LIQUIDITY_INTENT,
                token0Amount: 1000000n,
                token1Amount: 0n,
            };

            const liquidityId = await withTurbineErrorHandling(() =>
                client.addLiquidity(intent)
            );

            expect(liquidityId).toBe(mockIntentId);
            expect(mockCallAPI).toHaveBeenCalledTimes(1);
        });

        it("should accept single-sided liquidity (token1 only)", async () => {
            const mockIntentId = "test-intent-id-single-sided-1";
            const client = await createMockTurbineClient();

            // Mock authentication
            mockAuthentication(client, ACCOUNT.address);

            const mockCallAPI = jest
                .spyOn(client as any, "callApiEndpoint")
                .mockResolvedValue(
                    new Response(JSON.stringify({ intentHash: mockIntentId }), {
                        status: 200,
                        statusText: "OK",
                    })
                );

            const intent = {
                ...ADD_LIQUIDITY_INTENT,
                token0Amount: 0n,
                token1Amount: 1000000n,
            };

            const liquidityId = await withTurbineErrorHandling(() =>
                client.addLiquidity(intent)
            );

            expect(liquidityId).toBe(mockIntentId);
            expect(mockCallAPI).toHaveBeenCalledTimes(1);
        });

        it("should reject removeLiquidity with zero LP amount", async () => {
            const client = await createMockTurbineClient();

            const intent = {
                ...REMOVE_LIQUIDITY_INTENT,
                lpTokenAmount: 0n,
            };

            await expect(client.removeLiquidity(intent)).rejects.toMatchObject({
                code: "ZERO_LIQUIDITY",
            });
        });
    });

    describe("LP estimation", () => {
        // Test constants matching typical contract values
        const INITIAL_LP_SCALE = 1_000_000_000_000n; // 10^12
        const MINIMUM_LIQUIDITY = 100_000n; // 10^5
        const POOL_FEE = 3000; // 0.3% fee in hundredths of basis points

        it("should estimate initial LP tokens correctly", () => {
            // (1e18 + 1e18) * 1e12 - 1e5 = 2e30 - 1e5
            const lp = TurbineClient.estimateInitialLpTokens(
                1000000000000000000n,
                1000000000000000000n,
                INITIAL_LP_SCALE,
                MINIMUM_LIQUIDITY
            );
            expect(lp).toBe(2000000000000000000000000000000n - 100000n);
        });

        it("should return 0 if initial mint results in zero total liquidity", () => {
            const lp = TurbineClient.estimateInitialLpTokens(
                0n,
                0n,
                INITIAL_LP_SCALE,
                MINIMUM_LIQUIDITY
            );
            expect(lp).toBe(0n);
        });

        it("should handle single-sided initial mint", () => {
            // 1e18 * 1e12 - 1e5 = 1e30 - 1e5
            const lp = TurbineClient.estimateInitialLpTokens(
                1000000000000000000n,
                0n,
                INITIAL_LP_SCALE,
                MINIMUM_LIQUIDITY
            );
            expect(lp).toBe(1000000000000000000000000000000n - 100000n);
        });

        it("should estimate LP tokens for subsequent mints with equal ratios", () => {
            // Adding 100 token0 and 200 token1 to a pool with 1000 token0, 2000 token1, and 500 LP
            // Ratios are equal (100/200 = 1000/2000), so direct calculation: 500 * 200 / 2000 = 50
            const result = TurbineClient.estimateLpTokens(
                100n,
                200n,
                1000n,
                2000n,
                500n,
                INITIAL_LP_SCALE,
                MINIMUM_LIQUIDITY
            );
            expect(result.lpTokens).toBe(50n);
            expect(result.actualToken0).toBe(100n);
            expect(result.actualToken1).toBe(200n);
        });

        it("should use initial formula when lpSupply is 0", () => {
            const result = TurbineClient.estimateLpTokens(
                1000000000000000000n,
                1000000000000000000n,
                0n,
                0n,
                0n,
                INITIAL_LP_SCALE,
                MINIMUM_LIQUIDITY
            );
            expect(result.lpTokens).toBe(2000000000000000000000000000000n - 100000n);
        });

        it("should handle proportional mode with mismatched ratios", () => {
            // Adding 100 token0 and 100 token1 to a pool with 1000 token0, 2000 token1, and 500 LP
            // User has relatively more token0 (100/100=1 vs 1000/2000=0.5)
            // Proportional mode: use all of token1, adjust token0
            // actualToken0 = 100 * 1000 / 2000 = 50
            // lpTokens = 500 * 100 / 2000 = 25
            const result = TurbineClient.estimateLpTokens(
                100n,
                100n,
                1000n,
                2000n,
                500n,
                INITIAL_LP_SCALE,
                MINIMUM_LIQUIDITY,
                false // proportional mode
            );
            expect(result.lpTokens).toBe(25n);
            expect(result.actualToken0).toBe(50n);
            expect(result.actualToken1).toBe(100n);
        });

        it("should handle exact mode with fee calculation", () => {
            // Adding 100 token0 and 100 token1 to a pool with 1000 token0, 2000 token1, and 500 LP
            // User has relatively more token0 (providedRatioLess = false)
            // Fee complement = 1_000_000 - 3000 = 997_000
            // effectivePriceNum = reserve1 * POOL_FEE_PRECISION = 2000 * 1_000_000 = 2_000_000_000
            // effectivePriceDen = reserve0 * feeComplement = 1000 * 997_000 = 997_000_000
            // addedValue = 2_000_000_000 * 100 + 100 * 997_000_000 = 200_000_000_000 + 99_700_000_000 = 299_700_000_000
            // poolValue = 2_000_000_000 * 2000 + 1000 * 997_000_000 = 4_000_000_000_000 + 997_000_000_000 = 4_997_000_000_000
            // lpTokens = 500 * 299_700_000_000 / 4_997_000_000_000 = 29 (integer division)
            const result = TurbineClient.estimateLpTokens(
                100n,
                100n,
                1000n,
                2000n,
                500n,
                INITIAL_LP_SCALE,
                MINIMUM_LIQUIDITY,
                true, // exact mode
                POOL_FEE
            );
            expect(result.lpTokens).toBe(29n);
            expect(result.actualToken0).toBe(100n);
            expect(result.actualToken1).toBe(100n);
        });

        it("should return zero LP for single-sided in proportional mode", () => {
            // Adding 100 token0 and 0 token1 to a pool with 1000 token0, 2000 token1, and 500 LP
            // In proportional mode, single-sided additions cannot be made to a balanced pool
            // because you must provide both tokens in the pool's ratio.
            // providedRatioLess = 100 * 2000 < 1000 * 0 = false (user has more token0)
            // actualToken1 = 0, actualToken0 = 0 * 1000 / 2000 = 0
            // lpTokens = 0
            const result = TurbineClient.estimateLpTokens(
                100n,
                0n,
                1000n,
                2000n,
                500n,
                INITIAL_LP_SCALE,
                MINIMUM_LIQUIDITY,
                false // proportional mode
            );
            expect(result.lpTokens).toBe(0n);
            expect(result.actualToken0).toBe(0n);
            expect(result.actualToken1).toBe(0n);
        });

        it("should handle single-sided subsequent mint in exact mode", () => {
            // Adding 100 token0 and 0 token1 to a pool with 1000 token0, 2000 token1, and 500 LP
            // providedRatioLess = 100 * 2000 < 1000 * 0 = false (user has more token0)
            // effectivePriceNum = reserve1 * POOL_FEE_PRECISION = 2000 * 1_000_000 = 2_000_000_000
            // effectivePriceDen = reserve0 * feeComplement = 1000 * 997_000 = 997_000_000
            // addedValue = 2_000_000_000 * 0 + 100 * 997_000_000 = 99_700_000_000
            // poolValue = 2_000_000_000 * 2000 + 1000 * 997_000_000 = 4_997_000_000_000
            // lpTokens = 500 * 99_700_000_000 / 4_997_000_000_000 = 9 (integer division)
            const result = TurbineClient.estimateLpTokens(
                100n,
                0n,
                1000n,
                2000n,
                500n,
                INITIAL_LP_SCALE,
                MINIMUM_LIQUIDITY,
                true, // exact mode
                POOL_FEE
            );
            expect(result.lpTokens).toBe(9n);
            expect(result.actualToken0).toBe(100n);
            expect(result.actualToken1).toBe(0n);
        });

        it("should fetch liquidity constants from contract", async () => {
            const client = await createMockTurbineClient();

            // Mock the readContract method for liquidity constants
            const mockReadContract = jest
                .spyOn(client.publicClient, "readContract")
                .mockResolvedValueOnce(MINIMUM_LIQUIDITY)
                .mockResolvedValueOnce(INITIAL_LP_SCALE);

            const constants = await client.getLiquidityConstants();

            expect(constants.minimumLiquidity).toBe(MINIMUM_LIQUIDITY);
            expect(constants.initialLpScale).toBe(INITIAL_LP_SCALE);

            mockReadContract.mockRestore();
        });
    });

    describe("getConfig", () => {
        it("should return the TurbineConfig", async () => {
            const client = await createMockTurbineClient();
            const config = client.getConfig();

            expect(config).toEqual(MOCK_TURBINE_CONFIG);
            expect(config.turbineSettlerAddress).toBeDefined();
            expect(config.lpHookAddress).toBeDefined();
            expect(config.lpRouterAddress).toBeDefined();
            expect(config.poolManagerAddress).toBeDefined();
        });
    });

    describe("computeRemoveLiquidityIntentHash", () => {
        it("should compute the correct hash for a remove liquidity intent", async () => {
            const client = await createMockTurbineClient();
            const intent = {
                owner: ACCOUNT.address,
                poolId: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex,
                lpTokenAmount: BigInt("1000000000000000000"),
                salt: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Hex,
            };

            const hash = client.computeRemoveLiquidityIntentHash(intent);

            // Hash should be a valid 32-byte hex string
            expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
        });
    });

    describe("getAuthStatus", () => {
        it("should return authenticated status when user is authenticated", async () => {
            const client = await createMockTurbineClient();

            // Mock fetchWithCookies to return authenticated response
            const mockFetchWithCookies = jest
                .spyOn(client as any, "fetchWithCookies")
                .mockResolvedValue(
                    new Response(
                        JSON.stringify({
                            authenticated: true,
                            address: ACCOUNT.address,
                        }),
                        {
                            status: 200,
                            statusText: "OK",
                        }
                    )
                );

            const result = await withTurbineErrorHandling(() => client.getAuthStatus());

            expect(result.authenticated).toBe(true);
            expect(result.address).toBe(ACCOUNT.address);

            mockFetchWithCookies.mockRestore();
        });

        it("should return unauthenticated status when user is not authenticated", async () => {
            const client = await createMockTurbineClient();

            // Mock fetchWithCookies to return unauthenticated response
            const mockFetchWithCookies = jest
                .spyOn(client as any, "fetchWithCookies")
                .mockResolvedValue(
                    new Response(
                        JSON.stringify({
                            authenticated: false,
                        }),
                        {
                            status: 200,
                            statusText: "OK",
                        }
                    )
                );

            const result = await withTurbineErrorHandling(() => client.getAuthStatus());

            expect(result.authenticated).toBe(false);
            expect(result.address).toBeUndefined();

            mockFetchWithCookies.mockRestore();
        });
    });

    describe("logout", () => {
        it("should call logout endpoint", async () => {
            const client = await createMockTurbineClient();

            // Mock fetchWithCookies
            const mockFetchWithCookies = jest
                .spyOn(client as any, "fetchWithCookies")
                .mockResolvedValue(
                    new Response("", {
                        status: 200,
                        statusText: "OK",
                    })
                );

            await withTurbineErrorHandling(() => client.logout());

            expect(mockFetchWithCookies).toHaveBeenCalledWith("/logout", {
                method: "POST",
            });

            mockFetchWithCookies.mockRestore();
        });
    });

    describe("getPoolId", () => {
        it("should compute pool ID from contract", async () => {
            const client = await createMockTurbineClient();
            const mockPoolId =
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex;

            // Mock simulateContract and readContract
            const mockSimulateContract = jest
                .spyOn(client.publicClient, "simulateContract")
                .mockResolvedValue({
                    request: {} as any,
                    result: mockPoolId,
                } as any);

            const mockReadContract = jest
                .spyOn(client.publicClient, "readContract")
                .mockResolvedValue(mockPoolId);

            const poolId = await withTurbineErrorHandling(() =>
                client.getPoolId(USDC.address, WETH.address, 3000)
            );

            expect(poolId).toBe(mockPoolId);

            mockSimulateContract.mockRestore();
            mockReadContract.mockRestore();
        });
    });

    describe("createPool", () => {
        it("should create a pool and return transaction hash", async () => {
            const client = await createMockTurbineClient();
            const mockTxHash =
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Hex;

            // Mock simulateContract, writeContract, and waitForTransactionReceipt
            const mockSimulateContract = jest
                .spyOn(client.publicClient, "simulateContract")
                .mockResolvedValue({
                    request: {} as any,
                    result: undefined,
                } as any);

            const mockWriteContract = jest
                .spyOn(client.walletClient, "writeContract")
                .mockResolvedValue(mockTxHash);

            const mockWaitForTransactionReceipt = jest
                .spyOn(client.publicClient, "waitForTransactionReceipt")
                .mockResolvedValue({
                    status: "success",
                } as any);

            const txHash = await withTurbineErrorHandling(() =>
                client.createPool(USDC.address, WETH.address, 3000)
            );

            expect(txHash).toBe(mockTxHash);

            mockSimulateContract.mockRestore();
            mockWriteContract.mockRestore();
            mockWaitForTransactionReceipt.mockRestore();
        });
    });

    describe("parseSignature", () => {
        it("should parse a valid signature with v=27", async () => {
            const client = await createMockTurbineClient();
            const validSignature =
                "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" +
                "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" +
                "1b"; // v=27

            const result = (client as any).parseSignature(validSignature);

            expect(result.r).toBe(
                "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            );
            expect(result.s).toBe(
                "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            );
            expect(result.yParity).toBe("0x0"); // v=27 -> yParity=0
            expect(result.v).toBe("0x1b");
        });

        it("should parse a valid signature with v=28", async () => {
            const client = await createMockTurbineClient();
            const validSignature =
                "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" +
                "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" +
                "1c"; // v=28

            const result = (client as any).parseSignature(validSignature);

            expect(result.r).toBe(
                "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            );
            expect(result.s).toBe(
                "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            );
            expect(result.yParity).toBe("0x1"); // v=28 -> yParity=1
            expect(result.v).toBe("0x1c");
        });

        it("should throw TurbineError for signature that is too short", async () => {
            const client = await createMockTurbineClient();
            const invalidSignature = "0x" + "a".repeat(100); // Too short

            expect(() => {
                (client as any).parseSignature(invalidSignature);
            }).toThrow("signature must be a 65-byte signature");
        });

        it("should throw TurbineError for signature that is too long", async () => {
            const client = await createMockTurbineClient();
            const invalidSignature = "0x" + "a".repeat(150); // Too long

            expect(() => {
                (client as any).parseSignature(invalidSignature);
            }).toThrow("signature must be a 65-byte signature");
        });

        it("should throw TurbineError for signature with invalid v value", async () => {
            const client = await createMockTurbineClient();
            const invalidSignature = "0x" + "a".repeat(128) + "1a"; // v=26 (invalid)

            expect(() => {
                (client as any).parseSignature(invalidSignature);
            }).toThrow("signature has invalid v value");
        });

        it("should throw TurbineError for signature with invalid hex characters", async () => {
            const client = await createMockTurbineClient();
            const invalidSignature = "0x" + "z".repeat(130); // Invalid hex

            expect(() => {
                (client as any).parseSignature(invalidSignature);
            }).toThrow("signature is not a valid hex string");
        });

        it("should throw TurbineError for signature without 0x prefix", async () => {
            const client = await createMockTurbineClient();
            const invalidSignature = "a".repeat(130); // Missing 0x prefix

            expect(() => {
                (client as any).parseSignature(invalidSignature);
            }).toThrow("signature is not a valid hex string");
        });
    });
});
