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
                    reserve0: USDC.toOnchainAmount("1000000"),
                    reserve1: WETH.toOnchainAmount("500"),
                    liquidity: BigInt("1000000000000000000000"),
                },
                {
                    poolId: "0x2345678901bcdef12345678901bcdef12345678901bcdef12345678901bcdef1",
                    token0: USDC.address,
                    token1: WETH.address,
                    fee: 50,
                    lpToken: "0x1234567890123456789012345678901234567890",
                    reserve0: USDC.toOnchainAmount("2000000"),
                    reserve1: WETH.toOnchainAmount("1000"),
                    liquidity: BigInt("2000000000000000000000"),
                },
                {
                    poolId: "0x3456789012cdef123456789012cdef123456789012cdef123456789012cdef12",
                    token0: USDC.address,
                    token1: WBTC.address,
                    fee: 10,
                    lpToken: "0x9876543210987654321098765432109876543210",
                    reserve0: USDC.toOnchainAmount("1000000"),
                    reserve1: WBTC.toOnchainAmount("10"),
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

            // The third pool (USDC/WBTC) is filtered out because WBTC is not
            // in MOCK_TURBINE_CONFIG.tokens.
            expect(pools).toHaveLength(2);
            expect(pools[0].metadata.token0).toEqual(mockContractData[0].token0);
            expect(pools[0].metadata.token1).toEqual(mockContractData[0].token1);
            expect(pools[0].metadata.fee).toEqual(mockContractData[0].fee);
            expect(pools[0].metadata.lpToken).toEqual(mockContractData[0].lpToken);
            expect(pools[0].state.reserve0).toEqual(mockContractData[0].reserve0);
            expect(pools[0].state.reserve1).toEqual(mockContractData[0].reserve1);
            expect(pools[0].state.liquidity).toEqual(mockContractData[0].liquidity);
            expect(pools[0].stats.weeklySellVolumeToken0).toEqual(0n);
            expect(pools[0].stats.weeklySellVolumeToken1).toEqual(0n);
            for (const pool of pools) {
                expect(pool.metadata.token1).not.toEqual(WBTC.address);
            }
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
                    reserve0: USDC.toOnchainAmount("1000000"),
                    reserve1: WETH.toOnchainAmount("500"),
                    liquidity: BigInt("1000000000000000000000"),
                },
                {
                    poolId: "0x2345678901bcdef12345678901bcdef12345678901bcdef12345678901bcdef1",
                    token0: USDC.address,
                    token1: WETH.address,
                    fee: 50,
                    lpToken: "0x1234567890123456789012345678901234567890",
                    reserve0: USDC.toOnchainAmount("2000000"),
                    reserve1: WETH.toOnchainAmount("1000"),
                    liquidity: BigInt("2000000000000000000000"),
                },
                {
                    poolId: "0x3456789012cdef123456789012cdef123456789012cdef123456789012cdef12",
                    token0: USDC.address,
                    token1: WBTC.address,
                    fee: 10,
                    lpToken: "0x9876543210987654321098765432109876543210",
                    reserve0: USDC.toOnchainAmount("1000000"),
                    reserve1: WBTC.toOnchainAmount("10"),
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
                    reserve0: USDC.toOnchainAmount("1000000"),
                    reserve1: WETH.toOnchainAmount("500"),
                    liquidity: BigInt("1000000000000000000000"),
                },
                {
                    poolId: "0x2345678901bcdef12345678901bcdef12345678901bcdef12345678901bcdef1",
                    token0: USDC.address,
                    token1: WBTC.address,
                    fee: 50,
                    lpToken: "0x1234567890123456789012345678901234567890",
                    reserve0: USDC.toOnchainAmount("2000000"),
                    reserve1: WBTC.toOnchainAmount("10"),
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
                    reserve0: USDC.toOnchainAmount("1000000"),
                    reserve1: WETH.toOnchainAmount("500"),
                    liquidity: BigInt("1000000000000000000000"),
                },
                {
                    poolId: "0x2345678901bcdef12345678901bcdef12345678901bcdef12345678901bcdef1",
                    token0: USDC.address,
                    token1: WBTC.address,
                    fee: 50,
                    lpToken: "0x1234567890123456789012345678901234567890",
                    reserve0: USDC.toOnchainAmount("2000000"),
                    reserve1: WBTC.toOnchainAmount("10"),
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
                    reserve0: USDC.toOnchainAmount("1000000"),
                    reserve1: WETH.toOnchainAmount("500"),
                    liquidity: BigInt("1000000000000000000000"),
                },
                {
                    poolId: "0x2222222222abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                    token0: USDC.address,
                    token1: WETH.address,
                    fee: 4000,
                    lpToken: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
                    reserve0: USDC.toOnchainAmount("1000000"),
                    reserve1: WETH.toOnchainAmount("500"),
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
                            txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
                            blockNumber: "23882001",
                            soldAmount: "1000000",
                            boughtAmount: "950000",
                            surplusBuyAmount: "10",
                        },
                        {
                            txHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
                            blockNumber: "23882281",
                            soldAmount: "2000000",
                            boughtAmount: "1900000",
                            surplusBuyAmount: "11",
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

        it("should parse orderDetails when included in the response", async () => {
            const mockOrderStates = [
                {
                    hash: "0xdf41611e3a8931e1aa13c7a26367ff38e4cefafd2d1cf92492b0128c956a80ce",
                    status: "Active",
                    execution: [],
                    orderDetails: {
                        sellToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                        buyToken: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                        sellAmount: "1000000",
                        limitPrice: {
                            numerator: "1",
                            denominator: "3500",
                        },
                        startTime: "1713264000",
                        endTime: "1713350400",
                        createdTimestamp: "2026-04-16T12:00:00",
                    },
                },
            ];

            const client = await createMockTurbineClient();
            mockAuthentication(client, ACCOUNT.address);
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                new Response(JSON.stringify(mockOrderStates), {
                    status: 200,
                    statusText: "OK",
                })
            );

            const result = await client.getOrderStates([
                "0xdf41611e3a8931e1aa13c7a26367ff38e4cefafd2d1cf92492b0128c956a80ce",
            ]);

            expect(result).toHaveLength(1);
            const details = result[0].orderDetails;
            expect(details).toBeDefined();
            expect(details!.sellToken).toBe(
                "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
            );
            expect(details!.buyToken).toBe(
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
            );
            expect(details!.sellAmount).toBe(1000000n);
            expect(details!.limitPrice.numerator).toBe(1n);
            expect(details!.limitPrice.denominator).toBe(3500n);
            expect(details!.startTime).toBe(1713264000n);
            expect(details!.endTime).toBe(1713350400n);
            expect(details!.createdTimestamp).toEqual(new Date("2026-04-16T12:00:00Z"));
        });

        it("should leave orderDetails undefined when absent from response", async () => {
            const mockOrderStates = [
                {
                    hash: "0xdf41611e3a8931e1aa13c7a26367ff38e4cefafd2d1cf92492b0128c956a80ce",
                    status: "Active",
                    execution: [],
                },
            ];

            const client = await createMockTurbineClient();
            mockAuthentication(client, ACCOUNT.address);
            jest.spyOn(client as any, "callApiEndpoint").mockResolvedValue(
                new Response(JSON.stringify(mockOrderStates), {
                    status: 200,
                    statusText: "OK",
                })
            );

            const result = await client.getOrderStates([
                "0xdf41611e3a8931e1aa13c7a26367ff38e4cefafd2d1cf92492b0128c956a80ce",
            ]);

            expect(result).toHaveLength(1);
            expect(result[0].orderDetails).toBeUndefined();
        });
    });

    describe("getOrders", () => {
        const HASH_A =
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        const HASH_B =
            "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
        const SELL_TOKEN = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
        const BUY_TOKEN = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

        function makeOrder(hash: string, status: string, ts: string) {
            return {
                hash,
                status,
                execution: [],
                orderDetails: {
                    sellToken: SELL_TOKEN,
                    buyToken: BUY_TOKEN,
                    sellAmount: "1000000",
                    limitPrice: { numerator: "1", denominator: "3500" },
                    startTime: "1713264000",
                    endTime: "1713350400",
                    createdTimestamp: ts,
                },
            };
        }

        function mockResponse(payload: any, init: ResponseInit = { status: 200 }) {
            return new Response(JSON.stringify(payload), init);
        }

        function getEndpoint(spy: any): string {
            return spy.mock.calls[0][0] as string;
        }

        it("returns parsed orders with cursor and hasMore", async () => {
            const client = await createMockTurbineClient();
            mockAuthentication(client, ACCOUNT.address);

            const fetchSpy = jest
                .spyOn(client as any, "fetchWithCookies")
                .mockResolvedValue(
                    mockResponse({
                        orders: [makeOrder(HASH_A, "Active", "2026-04-16T12:00:00")],
                        cursor: "abc123",
                        hasMore: true,
                    })
                );

            const result = await client.getOrders();

            expect(getEndpoint(fetchSpy)).toBe("orders");
            expect(result.orders).toHaveLength(1);
            expect(result.orders[0].hash).toBe(HASH_A);
            expect(result.orders[0].status).toBe("Active");
            expect(result.orders[0].orderDetails!.sellAmount).toBe(1000000n);
            expect(result.orders[0].orderDetails!.createdTimestamp).toEqual(
                new Date("2026-04-16T12:00:00Z")
            );
            expect(result.cursor).toBe("abc123");
            expect(result.hasMore).toBe(true);
        });

        it("encodes hash filter as repeated query keys", async () => {
            const client = await createMockTurbineClient();
            mockAuthentication(client, ACCOUNT.address);

            const fetchSpy = jest
                .spyOn(client as any, "fetchWithCookies")
                .mockResolvedValue(
                    mockResponse({
                        orders: [
                            makeOrder(HASH_A, "Active", "2026-04-16T12:00:00"),
                            makeOrder(HASH_B, "Filled", "2026-04-15T12:00:00"),
                        ],
                        cursor: null,
                        hasMore: false,
                    })
                );

            const result = await client.getOrders({ hashes: [HASH_A, HASH_B] });

            const endpoint = getEndpoint(fetchSpy);
            expect(endpoint).toMatch(/^orders\?/);
            expect(endpoint).toContain(`hash=${HASH_A}`);
            expect(endpoint).toContain(`hash=${HASH_B}`);
            expect(result.orders).toHaveLength(2);
            expect(result.cursor).toBeNull();
            expect(result.hasMore).toBe(false);
        });

        it("encodes status filter as comma-separated value", async () => {
            const client = await createMockTurbineClient();
            mockAuthentication(client, ACCOUNT.address);

            const fetchSpy = jest
                .spyOn(client as any, "fetchWithCookies")
                .mockResolvedValue(
                    mockResponse({ orders: [], cursor: null, hasMore: false })
                );

            await client.getOrders({ statuses: ["Active", "Filled"] });

            const endpoint = getEndpoint(fetchSpy);
            const params = new URLSearchParams(endpoint.split("?")[1]);
            expect(params.get("status")).toBe("Active,Filled");
        });

        it("encodes cursor and limit", async () => {
            const client = await createMockTurbineClient();
            mockAuthentication(client, ACCOUNT.address);

            const fetchSpy = jest
                .spyOn(client as any, "fetchWithCookies")
                .mockResolvedValue(
                    mockResponse({ orders: [], cursor: null, hasMore: false })
                );

            await client.getOrders({ cursor: "xyz", limit: 25 });

            const endpoint = getEndpoint(fetchSpy);
            expect(endpoint).toContain("cursor=xyz");
            expect(endpoint).toContain("limit=25");
        });

        it("rejects more than 30 hashes without calling the API", async () => {
            const client = await createMockTurbineClient();
            mockAuthentication(client, ACCOUNT.address);

            const fetchSpy = jest.spyOn(client as any, "fetchWithCookies");

            const tooManyHashes = Array.from(
                { length: 31 },
                (_, i) => ("0x" + i.toString(16).padStart(64, "0")) as Hex
            );

            await expect(
                withTurbineErrorHandling(() =>
                    client.getOrders({ hashes: tooManyHashes })
                )
            ).rejects.toMatchObject({ code: "TOO_MANY_HASHES" });
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it("rejects limit above 200 without calling the API", async () => {
            const client = await createMockTurbineClient();
            mockAuthentication(client, ACCOUNT.address);

            const fetchSpy = jest.spyOn(client as any, "fetchWithCookies");

            await expect(
                withTurbineErrorHandling(() => client.getOrders({ limit: 201 }))
            ).rejects.toMatchObject({ code: "LIMIT_TOO_HIGH" });
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it("maps server INVALID_CURSOR errors to TurbineError", async () => {
            const client = await createMockTurbineClient();
            mockAuthentication(client, ACCOUNT.address);

            jest.spyOn(client as any, "fetchWithCookies").mockResolvedValue(
                new Response(
                    JSON.stringify({
                        code: "INVALID_CURSOR",
                        message: "Cursor cannot be decoded",
                    }),
                    { status: 400, statusText: "Bad Request" }
                )
            );

            await expect(
                withTurbineErrorHandling(() =>
                    client.getOrders({ cursor: "not-valid" })
                )
            ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
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
            const mockIntentId =
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcde0";
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
            const mockIntentId =
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcde1";
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
                code: "INPUT_VALIDATION_ERROR",
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

            expect(mockFetchWithCookies).toHaveBeenCalledWith("logout", {
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

    describe("validateResponseSize", () => {
        it("should reject response with Content-Length exceeding limit", async () => {
            const client = await createMockTurbineClient();
            const maxSize = 100; // 100 bytes

            // Create mock response with Content-Length header exceeding limit
            const mockResponse = new Response("OK", {
                status: 200,
                headers: new Headers({
                    "content-length": "200", // Exceeds 100 byte limit
                }),
            });

            await expect(
                (client as any).validateResponseSize(mockResponse, maxSize)
            ).rejects.toMatchObject({
                code: "SDK_ERROR",
                message: expect.stringContaining(
                    "Response size (200 bytes) exceeds maximum allowed size (100 bytes)"
                ),
            });
        });

        it("should accept response with Content-Length within limit", async () => {
            const client = await createMockTurbineClient();
            const maxSize = 200; // 200 bytes

            const body = "small response";
            const mockResponse = new Response(body, {
                status: 200,
                headers: new Headers({
                    "content-length": body.length.toString(),
                }),
            });

            const validatedResponse = await (client as any).validateResponseSize(
                mockResponse,
                maxSize
            );

            expect(validatedResponse).toBeDefined();
            const text = await validatedResponse.text();
            expect(text).toBe(body);
        });

        it("should reject single chunk exceeding limit", async () => {
            const client = await createMockTurbineClient();
            const maxSize = 100; // 100 bytes

            // Create a large chunk (exceeds maxSize in a single chunk)
            const largeChunk = new Uint8Array(150); // 150 bytes in one chunk
            largeChunk.fill(65); // Fill with 'A'

            // Create a ReadableStream that emits one large chunk
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(largeChunk);
                    controller.close();
                },
            });

            const mockResponse = new Response(stream, {
                status: 200,
                headers: new Headers(),
            });

            await expect(
                (client as any).validateResponseSize(mockResponse, maxSize)
            ).rejects.toMatchObject({
                code: "SDK_ERROR",
                message: expect.stringContaining(
                    "Single response chunk (150 bytes) exceeds maximum size (100 bytes)"
                ),
            });
        });

        it("should reject accumulated chunks exceeding limit", async () => {
            const client = await createMockTurbineClient();
            const maxSize = 100; // 100 bytes

            // Create multiple small chunks that together exceed the limit
            const chunk1 = new Uint8Array(60); // 60 bytes
            const chunk2 = new Uint8Array(50); // 50 bytes
            // Total: 110 bytes (exceeds 100 byte limit)

            chunk1.fill(65); // Fill with 'A'
            chunk2.fill(66); // Fill with 'B'

            // Create a ReadableStream that emits multiple chunks
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(chunk1);
                    controller.enqueue(chunk2);
                    controller.close();
                },
            });

            const mockResponse = new Response(stream, {
                status: 200,
                headers: new Headers(),
            });

            await expect(
                (client as any).validateResponseSize(mockResponse, maxSize)
            ).rejects.toMatchObject({
                code: "SDK_ERROR",
                message: expect.stringContaining(
                    "Response size exceeds maximum allowed size (100 bytes)"
                ),
            });
        });

        it("should accept valid response with multiple chunks within limit", async () => {
            const client = await createMockTurbineClient();
            const maxSize = 200; // 200 bytes

            // Create multiple small chunks within the limit
            const chunk1 = new Uint8Array(50); // 50 bytes
            const chunk2 = new Uint8Array(50); // 50 bytes
            // Total: 100 bytes (within 200 byte limit)

            chunk1.fill(65); // Fill with 'A'
            chunk2.fill(66); // Fill with 'B'

            // Create a ReadableStream that emits multiple chunks
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(chunk1);
                    controller.enqueue(chunk2);
                    controller.close();
                },
            });

            const mockResponse = new Response(stream, {
                status: 200,
                headers: new Headers(),
            });

            const validatedResponse = await (client as any).validateResponseSize(
                mockResponse,
                maxSize
            );

            expect(validatedResponse).toBeDefined();
            const arrayBuffer = await validatedResponse.arrayBuffer();
            expect(arrayBuffer.byteLength).toBe(100);
        });

        it("should handle response with no body", async () => {
            const client = await createMockTurbineClient();
            const maxSize = 100;

            // Create response with null body
            const mockResponse = new Response(null, {
                status: 204, // No Content
                headers: new Headers(),
            });

            const validatedResponse = await (client as any).validateResponseSize(
                mockResponse,
                maxSize
            );

            expect(validatedResponse).toBeDefined();
            expect(validatedResponse.body).toBeNull();
        });
    });

    describe("Cookie handling with CookieJar", () => {
        it("should use CookieJar instead of manual sessionId", async () => {
            const client = await createMockTurbineClient();

            // Verify cookieJar exists and sessionId is removed
            expect((client as any).cookieJar).toBeDefined();
            expect((client as any).sessionId).toBeUndefined();
        });

        it("should not send cookies over HTTP when marked Secure", async () => {
            const client = await createMockTurbineClient();

            // Mock a Set-Cookie with Secure flag
            const mockResponse = new Response("OK", {
                status: 200,
                headers: new Headers({
                    "set-cookie": "id=session123; Path=/; Secure; HttpOnly",
                }),
            });

            // Simulate receiving cookie from HTTPS endpoint
            await (client as any).extractAndStoreCookies(
                mockResponse,
                "https://api.turbine.com/nonce"
            );

            // Verify cookie is NOT sent over HTTP
            const httpHeaders = await (client as any).createHeaders(
                {},
                "http://api.turbine.com/verify"
            );
            expect(httpHeaders["Cookie"]).toBeUndefined();

            // Verify cookie IS sent over HTTPS
            const httpsHeaders = await (client as any).createHeaders(
                {},
                "https://api.turbine.com/verify"
            );
            expect(httpsHeaders["Cookie"]).toContain("id=session123");
        });

        it("should respect cookie expiration dates", async () => {
            const client = await createMockTurbineClient();

            // Mock an expired cookie (1 second in the past)
            const pastDate = new Date(Date.now() - 10000).toUTCString();
            const mockResponse = new Response("OK", {
                status: 200,
                headers: new Headers({
                    "set-cookie": `id=expired123; Path=/; Expires=${pastDate}; Domain=api.turbine.com`,
                }),
            });

            await (client as any).extractAndStoreCookies(
                mockResponse,
                "https://api.turbine.com/nonce"
            );

            // Wait a brief moment to ensure cookie is recognized as expired
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Verify expired cookie is not sent
            const headers = await (client as any).createHeaders(
                {},
                "https://api.turbine.com/verify"
            );
            expect(headers["Cookie"]).toBeUndefined();
        });

        it("should respect domain restrictions", async () => {
            const client = await createMockTurbineClient();

            // Mock a domain-restricted cookie
            const mockResponse = new Response("OK", {
                status: 200,
                headers: new Headers({
                    "set-cookie": "id=session123; Path=/; Domain=api.turbine.com",
                }),
            });

            await (client as any).extractAndStoreCookies(
                mockResponse,
                "https://api.turbine.com/nonce"
            );

            // Verify cookie is NOT sent to different domain
            const evilHeaders = await (client as any).createHeaders(
                {},
                "https://evil.com/steal"
            );
            expect(evilHeaders["Cookie"]).toBeUndefined();

            // Verify cookie IS sent to correct domain
            const validHeaders = await (client as any).createHeaders(
                {},
                "https://api.turbine.com/verify"
            );
            expect(validHeaders["Cookie"]).toContain("id=session123");
        });

        it("should clear cookies on logout", async () => {
            const client = await createMockTurbineClient();

            // Store a cookie
            const mockResponse = new Response("OK", {
                status: 200,
                headers: new Headers({
                    "set-cookie": "id=session123; Path=/",
                }),
            });

            await (client as any).extractAndStoreCookies(
                mockResponse,
                "https://api.turbine.com/nonce"
            );

            // Mock logout endpoint
            const mockFetchWithCookies = jest
                .spyOn(client as any, "fetchWithCookies")
                .mockResolvedValue(new Response("", { status: 200 }));

            await client.logout();

            // Verify cookies are cleared
            const headers = await (client as any).createHeaders(
                {},
                "https://api.turbine.com/verify"
            );
            expect(headers["Cookie"]).toBeUndefined();

            mockFetchWithCookies.mockRestore();
        });
    });

    describe("fetchWithCookies response body handling", () => {
        it("should return a response with readable body after size validation", async () => {
            const client = await createMockTurbineClient();

            // Create a response body that will go through validateResponseSize
            const responseBody = JSON.stringify({ test: "data", value: 123 });

            // Mock global fetch to return a response
            const mockFetch = jest.spyOn(global, "fetch").mockResolvedValue(
                new Response(responseBody, {
                    status: 200,
                    statusText: "OK",
                    headers: new Headers({
                        "content-type": "application/json",
                    }),
                })
            );

            // Call fetchWithCookies which internally calls validateResponseSize
            const response = await (client as any).fetchWithCookies("test_endpoint", {
                method: "GET",
            });

            // This would fail if validateResponseSize consumed the body and didn't return the new Response with a fresh body
            const data = await response.json();

            expect(data).toEqual({ test: "data", value: 123 });
            expect(response.ok).toBe(true);

            mockFetch.mockRestore();
        });
    });
});
