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
            const mockOrderId = "test-order-id-123";
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
            const mockOrderIds = ["test-order-id-123", "test-order-id-456"];
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
                    new Response(JSON.stringify({ orderHash: mockOrderHash }), {
                        status: 200,
                        statusText: "OK",
                    })
                );

            const result = await withTurbineErrorHandling(() =>
                client.cancelOrder(mockOrderHash as Hex)
            );

            expect(result).toEqual({
                orderHash: mockOrderHash,
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
            expect(pools[0].metadata.fee).toEqual(mockContractData[0].fee / 100);
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
            expect(positions[0].poolMetadata.fee).toEqual(mockPoolsData[0].fee / 100);
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
            expect(positions[0].poolMetadata.fee).toEqual(mockPoolsData[0].fee / 100);
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
            expect(positions[0].poolMetadata.fee).toEqual(mockPoolsData[1].fee / 100);
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
                "/order_fees",
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

            const result = await withTurbineErrorHandling(() =>
                client.getOrderStates(orderHashes)
            );

            expect(result).toHaveLength(1);
            expect(result[0].hash).toBe(
                "0xdf41611e3a8931e1aa13c7a26367ff38e4cefafd2d1cf92492b0128c956a80ce"
            );
            expect(result[0].status).toBe("Invalid");
            expect(result[0].executedSellAmount).toBe(BigInt("1000000"));
            expect(result[0].execution).toHaveLength(1);
            expect(result[0].execution[0].batchId).toBe(123);
            expect(result[0].execution[0].clearedAt).toEqual(
                new Date(1751642853 * 1000)
            );
            expect(result[0].execution[0].soldAmount).toBe(BigInt("1000000"));
            expect(result[0].execution[0].boughtAmount).toBe(BigInt("950000"));

            expect(mockCallAPI).toHaveBeenCalledWith(
                { orderHashes: orderHashes },
                "order_states"
            );
        });
    });

    describe("getLiquidityIntents", () => {
        it("should call Turbine API and return liquidity intent statuses", async () => {
            const mockStatuses = [
                {
                    hash: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                    state: "Pending",
                },
            ];

            const client = await createMockTurbineClient();

            // Mock authentication
            mockAuthentication(client, ACCOUNT.address);

            // Spy on internal fetchWithCookies used by getLiquidityIntents
            const mockFetchWithCookies = jest
                .spyOn(client as any, "fetchWithCookies")
                .mockResolvedValue(
                    new Response(JSON.stringify(mockStatuses), {
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
});
