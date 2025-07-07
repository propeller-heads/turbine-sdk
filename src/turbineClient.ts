import { Account, Address, getAddress, Hex, PublicClient, WalletClient } from "viem";
import {
    addLiquidityIntentABI,
    orderIntentABI,
    removeLiquidityIntentABI,
    settledAmountsABI,
    turbineHookABI,
} from "./abi";
import {
    MOCKED_TURBINE_POOL,
    TURBINE_API_URL,
    TURBINE_DOMAIN,
    TURBINE_HOOK_CONTRACT,
    TURBINE_LIQUIDITY_ROUTER_CONTRACT,
    TURBINE_SETTLER_CONTRACT,
} from "./config";
import { NULL_ADDRESS } from "./constants";
import {
    toTurbineError,
    TurbineError,
    unsuccessfulResponseToTurbineError,
} from "./errorHandling";
import {
    AddLiquidity,
    AddLiquidityIntent,
    AddOrder,
    AddSmartOrder,
    OrderIntent,
    OrderStatus,
    PrimitiveSignature,
    RemoveLiquidity,
    RemoveLiquidityIntent,
    TurbinePool,
    UserPosition,
} from "./models";
import { getSignedAllowance } from "./permit2";

export class TurbineClient {
    public turbineApiUrl: string;
    public settlerContract: Address;
    public turbineLiquidityRouterContract: Address;

    constructor(
        turbineApiUrl?: string,
        settlerContract?: Address,
        turbineLiquidityRouterContract?: Address
    ) {
        this.turbineApiUrl = turbineApiUrl || TURBINE_API_URL;
        this.settlerContract = settlerContract || TURBINE_SETTLER_CONTRACT;
        this.turbineLiquidityRouterContract =
            turbineLiquidityRouterContract || TURBINE_LIQUIDITY_ROUTER_CONTRACT;
    }

    /* PUBLIC METHODS */

    /**
     * Add an order to the Turbine API.
     * @param intent An `OrderIntent` object containing the details of the trade to be executed
     * @param walletClient The wallet client used for signing the order intent
     * @param publicClient The public client used for blockchain interactions and permit2 allowance
     * @returns A Promise that resolves to a string containing the submitted order hash.
     */
    async addOrder(
        intent: OrderIntent,
        walletClient: WalletClient,
        publicClient: PublicClient
    ): Promise<string> {
        try {
            const payload = await this.createAddOrderData(
                intent,
                walletClient,
                publicClient
            );
            const response = await this.callApiEndpoint(payload, "add_order");
            const responseText = await response.text();

            if (!response.ok) {
                throw unsuccessfulResponseToTurbineError(response, responseText);
            }

            let responseJson;
            try {
                responseJson = JSON.parse(responseText);
            } catch (e) {
                throw new TurbineError(
                    "PARSE_ERROR",
                    `Failed to parse response as JSON: ${e}`,
                    "Failed to process the server response. Please try again later."
                );
            }

            if (!responseJson || !responseJson["orderHash"]) {
                throw new TurbineError(
                    "MISSING_ORDER_HASH",
                    `Response missing required orderHash field: ${JSON.stringify(responseJson)}`,
                    "Order was submitted but confirmation is missing. Please check your orders to verify if it was processed."
                );
            }

            return responseJson["orderHash"];
        } catch (error) {
            throw toTurbineError(error);
        }
    }

    /**
     * Add an array of orders to the Turbine API.
     * @param intents An array of `OrderIntent` objects containing the details of the trades to be executed
     * @param walletClient The wallet client used for signing the order intents
     * @param publicClient The public client used for blockchain interactions and permit2 allowances
     * @returns A Promise that resolves to an array of strings containing the submitted order hashes.
     */
    async addOrders(
        intents: OrderIntent[],
        walletClient: WalletClient,
        publicClient: PublicClient
    ): Promise<string[]> {
        try {
            const payloads = await Promise.all(
                intents.map((intent) =>
                    this.createAddOrderData(intent, walletClient, publicClient)
                )
            );
            const response = await this.callApiEndpoint(payloads, "add_orders");
            const responseText = await response.text();

            if (!response.ok) {
                throw unsuccessfulResponseToTurbineError(response, responseText);
            }

            let responseJson;
            try {
                responseJson = JSON.parse(responseText);
            } catch (e) {
                throw new TurbineError(
                    "PARSE_ERROR",
                    `Failed to parse response as JSON: ${e}`,
                    "Failed to process the server response. Please try again later."
                );
            }

            if (!responseJson || !responseJson.length) {
                throw new TurbineError(
                    "MISSING_ORDER_HASHES",
                    `Response missing required order hashes: ${JSON.stringify(responseJson)}`,
                    "Orders were submitted but confirmations are missing. Please check your orders to verify if they were processed."
                );
            }

            return responseJson.map((order: any) => order.orderHash);
        } catch (error) {
            throw toTurbineError(error);
        }
    }

    /**
     * Add a liquidity addition intent to the Turbine API.
     * @param intent The intent to add liquidity
     * @param walletClient The wallet client used for signing the intent
     * @param publicClient The public client used for blockchain interactions and permit2 allowances
     * @returns A Promise that resolves to a string containing the submitted intent hash.
     */
    async addLiquidity(
        intent: AddLiquidityIntent,
        walletClient: WalletClient,
        publicClient: PublicClient
    ): Promise<string> {
        try {
            const payload = await this.createAddLiquidityData(
                intent,
                walletClient,
                publicClient
            );
            const response = await this.callApiEndpoint(payload, "add_liquidity");
            const responseText = await response.text();

            if (!response.ok) {
                throw unsuccessfulResponseToTurbineError(response, responseText);
            }

            let responseJson;
            try {
                responseJson = JSON.parse(responseText);
            } catch (e) {
                throw new TurbineError(
                    "PARSE_ERROR",
                    `Failed to parse response as JSON: ${e}`,
                    "Failed to process the server response. Please try again later."
                );
            }

            if (!responseJson || !responseJson["intentHash"]) {
                throw new TurbineError(
                    "MISSING_INTENT_HASH",
                    `Response missing required hash field: ${JSON.stringify(responseJson)}`,
                    "Liquidity addition was submitted but confirmation is missing. Please check your transactions to verify if it was processed."
                );
            }

            return responseJson["intentHash"];
        } catch (error) {
            throw toTurbineError(error);
        }
    }

    /**
     * Add a liquidity removal intent to the Turbine API.
     * @param intent The intent to remove liquidity
     * @param walletClient The wallet client used for signing the intent
     * @param publicClient The public client used for blockchain interactions and permit2 allowances
     * @returns A Promise that resolves to a string containing the submitted intent hash.
     */
    async removeLiquidity(
        intent: RemoveLiquidityIntent,
        walletClient: WalletClient,
        publicClient: PublicClient
    ): Promise<string> {
        try {
            const payload = await this.createRemoveLiquidityData(
                intent,
                walletClient,
                publicClient
            );
            const response = await this.callApiEndpoint(payload, "remove_liquidity");
            const responseText = await response.text();

            if (!response.ok) {
                throw unsuccessfulResponseToTurbineError(response, responseText);
            }

            let responseJson;
            try {
                responseJson = JSON.parse(responseText);
            } catch (e) {
                throw new TurbineError(
                    "PARSE_ERROR",
                    `Failed to parse response as JSON: ${e}`,
                    "Failed to process the server response. Please try again later."
                );
            }

            if (!responseJson || !responseJson["intentHash"]) {
                throw new TurbineError(
                    "MISSING_INTENT_HASH",
                    `Response missing required hash field: ${JSON.stringify(responseJson)}`,
                    "Liquidity removal was submitted but confirmation is missing. Please check your transactions to verify if it was processed."
                );
            }

            return responseJson["intentHash"];
        } catch (error) {
            throw toTurbineError(error);
        }
    }

    /**
     * Cancel an order from the Turbine API.
     * @param orderHash The hash of the order to cancel
     * @param walletClient The wallet client used for signing the cancellation request
     * @returns A Promise that resolves to the response message from the API.
     */
    async cancelOrder(
        orderHash: Hex,
        walletClient: WalletClient
    ): Promise<{ orderHash: string; message: string }> {
        try {
            // Sign the order hash to prove ownership
            const signature = await walletClient.signMessage({
                message: { raw: orderHash },
                account: walletClient.account!,
            });

            const payload = {
                orderHash: orderHash,
                signature: convertSignature(signature),
            };

            const response = await fetch(`${this.turbineApiUrl}/cancel_order`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload, bigIntReplacer),
            });

            const responseText = await response.text();

            if (!response.ok) {
                throw unsuccessfulResponseToTurbineError(response, responseText);
            }

            let responseJson;
            try {
                responseJson = JSON.parse(responseText);
            } catch (e) {
                throw new TurbineError(
                    "PARSE_ERROR",
                    `Failed to parse response as JSON: ${e}`,
                    "Failed to process the server response. Please try again later."
                );
            }

            if (!responseJson || !responseJson.orderHash) {
                throw new TurbineError(
                    "MISSING_FIELD",
                    `Response missing required fields: ${JSON.stringify(responseJson)}`,
                    "Order cancellation was submitted but confirmation is missing. Please check your orders to verify if it was processed."
                );
            }

            return responseJson;
        } catch (error) {
            throw toTurbineError(error);
        }
    }

    /**
     * Get the registered pools from the Turbine Hook contract.
     * @param publicClient The public client used for blockchain interactions
     * @returns A Promise that resolves to an array of `TurbinePool` objects.
     */
    async getPools(publicClient: PublicClient): Promise<TurbinePool[]> {
        try {
            const poolsData = await publicClient.readContract({
                address: TURBINE_HOOK_CONTRACT,
                abi: turbineHookABI,
                functionName: "getRegisteredPools",
            });

            return poolsData.map((poolData: any) => ({
                metadata: {
                    token0: getAddress(poolData.token0),
                    token1: getAddress(poolData.token1),
                    fee: poolData.fee,
                    lpToken: getAddress(poolData.lpToken),
                },
                state: {
                    reserve0: BigInt(poolData.reserve0),
                    reserve1: BigInt(poolData.reserve1),
                    liquidity: BigInt(poolData.liquidity),
                },
                stats: {
                    // Note: Weekly volume data is not available from the contract
                    // Setting to 0 for now - this could be fetched from a subgraph. See TRB-464 https://propeller-heads.atlassian.net/browse/TRB-464
                    weeklySellVolumeToken0: 0n,
                    weeklySellVolumeToken1: 0n,
                },
            }));
        } catch (error) {
            throw toTurbineError(error);
        }
    }

    /**
     * Get the currently settled amounts for multiple orders by their hashes.
     * @param orderIds An array of order hashes to check
     * @param publicClient The public client used for blockchain interactions
     * @returns A Promise that resolves to an array of filled amounts
     */
    async getSettledAmounts(
        orderIds: string[],
        publicClient: PublicClient
    ): Promise<readonly bigint[]> {
        try {
            return await publicClient.readContract({
                address: this.settlerContract,
                abi: settledAmountsABI,
                functionName: "getSettledAmounts",
                args: [orderIds as Hex[]],
            });
        } catch (error) {
            throw toTurbineError(error);
        }
    }

    /**
     * Get user positions for all registered pools.
     * @param userAddress The address of the user to get positions for
     * @param publicClient The public client used for blockchain interactions
     * @returns A Promise that resolves to an array of `UserPosition` objects.
     */
    async getUserPositions(
        userAddress: Address,
        publicClient: PublicClient
    ): Promise<UserPosition[]> {
        // Return mocked positions for now
        // TODO: Remove this and uncomment the real implementation once we have users with positions
        return [
            {
                poolMetadata: MOCKED_TURBINE_POOL.metadata,
                userAddress: getAddress("0xC78c504B91598E6ca72059C4Ea4d2dE8f3e77E38"),
                lpTokenBalance: 100000000000000000000n,
            },
        ];

        // try {
        //     const pools = await this.getPools(publicClient);
        //     if (pools.length === 0) {
        //         return [];
        //     }

        //     // Execute all balance checks in a single multicall
        //     const multicallContracts = pools.map((pool) => ({
        //         address: pool.metadata.lpToken,
        //         abi: balanceOfABI,
        //         functionName: "balanceOf" as const,
        //         args: [userAddress],
        //     }));
        //     const balanceResults = await publicClient.multicall({
        //         contracts: multicallContracts,
        //     });

        //     // Process results and create user positions
        //     const userPositions: UserPosition[] = [];
        //     for (let i = 0; i < pools.length; i++) {
        //         const pool = pools[i];
        //         const balanceResult = balanceResults[i];

        //         if (balanceResult.status === "success" && balanceResult.result > 0n) {
        //             userPositions.push({
        //                 poolMetadata: pool.metadata,
        //                 userAddress: getAddress(userAddress),
        //                 lpTokenBalance: balanceResult.result as bigint,
        //             });
        //         } else if (balanceResult.status === "failure") {
        //             // Log warning for failed balance check but continue processing other pools
        //             console.warn(
        //                 `Failed to get balance for LP token ${pool.metadata.lpToken}: ${balanceResult.error?.message || "Unknown error"}`
        //             );
        //         }
        //     }

        //     return userPositions;
        // } catch (error) {
        //     throw toTurbineError(error);
        // }
    }

    /**
     * Check if the Turbine service is available by querying the /status endpoint.
     * @returns A Promise that resolves to true if the service is available, or throws an error if unavailable.
     */
    async checkStatus(): Promise<boolean> {
        try {
            const response = await fetch(`${this.turbineApiUrl}/status`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (response.status !== 200) {
                throw new TurbineError(
                    "SERVICE_UNAVAILABLE",
                    `Turbine service returned status ${response.status}`,
                    "Turbine is currently unavailable. Try again later."
                );
            }

            return true;
        } catch (error) {
            if (error instanceof TurbineError) {
                throw error;
            }
            throw new TurbineError(
                "SERVICE_UNAVAILABLE",
                `Failed to connect to Turbine service: ${error}`,
                "Turbine is currently unavailable. Try again later."
            );
        }
    }

    /**
     * Get the status of multiple orders by their hashes.
     * @param orderHashes An array of order hashes to check
     * @returns A Promise that resolves to an array of `OrderStatus` objects.
     */
    async getOrderStatuses(orderHashes: Hex[]): Promise<OrderStatus[]> {
        try {
            const payload = {
                orderHashes: orderHashes,
                signature: {
                    // TODO: Actually sign the order hashes
                    r: "55294974102241709596244973337260302767685863956303318224048979012101391870527",
                    s: "36499995030038813128181899076504281506224746154994857975949401945262063952095",
                    yParity: true,
                },
            };

            const response = await fetch(`${this.turbineApiUrl}/order_statuses`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const responseText = await response.text();

            if (!response.ok) {
                throw unsuccessfulResponseToTurbineError(response, responseText);
            }

            let responseJson;
            try {
                responseJson = JSON.parse(responseText);
            } catch (e) {
                throw new TurbineError(
                    "PARSE_ERROR",
                    `Failed to parse response as JSON: ${e}`,
                    "Failed to process the server response. Please try again later."
                );
            }

            if (!Array.isArray(responseJson)) {
                throw new TurbineError(
                    "INVALID_RESPONSE",
                    `Expected array response but got: ${JSON.stringify(responseJson)}`,
                    "Received unexpected response format from server. Please try again later."
                );
            }

            return responseJson.map((orderStatus: any) =>
                this.parseOrderStatus(orderStatus)
            );
        } catch (error) {
            throw toTurbineError(error);
        }
    }

    /* PRIVATE METHODS */

    private async createAddOrderData(
        intent: OrderIntent,
        walletClient: WalletClient,
        publicClient: PublicClient
    ): Promise<AddOrder | AddSmartOrder> {
        let intentSignature = await this.signIntent(intent, walletClient);

        // Skip permit data for smart orders
        if (this.is_smart_order(intent)) {
            return {
                order: intent,
                orderSignature: convertSignature(intentSignature),
            };
        }

        let { permit, permitSignature } = await getSignedAllowance({
            token: intent.sellToken,
            walletClient,
            publicClient,
            deadline: Number(intent.endTime),
            spender: this.settlerContract,
        });
        return {
            order: intent,
            orderSignature: convertSignature(intentSignature),
            signedPermit: {
                signature: convertSignature(permitSignature),
                permit: permit,
            },
        };
    }

    private async createAddLiquidityData(
        intent: AddLiquidityIntent,
        walletClient: WalletClient,
        publicClient: PublicClient
    ): Promise<AddLiquidity> {
        let intentSignature = await this.signIntent(intent, walletClient);

        // At least one block time + speedbump (16 seconds) and at most two blocks time (24 seconds)
        let deadline = BigInt(Math.floor(Date.now() / 1000) + 20); // 20 seconds from now
        let { permit: permit0, permitSignature: permitSignature0 } =
            await getSignedAllowance({
                token: intent.token0,
                walletClient,
                publicClient,
                amount: BigInt(intent.maxToken0),
                deadline: Number(deadline),
                spender: this.turbineLiquidityRouterContract,
            });
        let { permit: permit1, permitSignature: permitSignature1 } =
            await getSignedAllowance({
                token: intent.token1,
                walletClient,
                publicClient,
                amount: BigInt(intent.maxToken1),
                deadline: Number(deadline),
                spender: this.turbineLiquidityRouterContract,
            });
        return {
            signedIntent: {
                intent: intent,
                signature: convertSignature(intentSignature),
            },
            permitToken0: {
                signature: convertSignature(permitSignature0),
                permit: permit0,
            },
            permitToken1: {
                signature: convertSignature(permitSignature1),
                permit: permit1,
            },
        };
    }

    private async createRemoveLiquidityData(
        intent: RemoveLiquidityIntent,
        walletClient: WalletClient,
        publicClient: PublicClient
    ): Promise<RemoveLiquidity> {
        let intentSignature = await this.signIntent(intent, walletClient);

        let deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 minutes from now
        let { permit: permit, permitSignature: permitSignature } =
            await getSignedAllowance({
                token: intent.lpToken,
                walletClient,
                publicClient,
                amount: BigInt(intent.lpTokenAmount),
                deadline: Number(deadline),
            });
        return {
            signedIntent: {
                intent: intent,
                signature: convertSignature(intentSignature),
            },
            permitLpToken: {
                signature: convertSignature(permitSignature),
                permit: permit,
            },
        };
    }

    private is_smart_order(intent: OrderIntent): Boolean {
        return intent.callDataTarget != NULL_ADDRESS && intent.callData != "0x";
    }

    private getTurbineDomain() {
        return {
            ...TURBINE_DOMAIN,
            verifyingContract: this.settlerContract,
        };
    }

    private getIntentTypedData(
        intent: OrderIntent | AddLiquidityIntent | RemoveLiquidityIntent
    ) {
        let typedData: {
            domain: {
                verifyingContract: Address;
                name: string;
                version: string;
                chainId: number;
                salt: Hex;
            };
            types: any;
            primaryType: string;
            message: Record<string, unknown>;
        } = {
            domain: this.getTurbineDomain(),
            types: {},
            primaryType: "",
            message: intent as unknown as Record<string, unknown>,
        };

        if (this.isOrderIntent(intent)) {
            typedData.types["OrderIntent"] = orderIntentABI.components;
            typedData.primaryType = "OrderIntent";
        } else if (this.isAddLiquidityIntent(intent)) {
            typedData.types["AddLiquidityIntent"] = addLiquidityIntentABI.components;
            typedData.primaryType = "AddLiquidityIntent";
        } else if (this.isRemoveLiquidityIntent(intent)) {
            typedData.types["RemoveLiquidityIntent"] =
                removeLiquidityIntentABI.components;
            typedData.primaryType = "RemoveLiquidityIntent";
        }

        return typedData;
    }

    /**
     * Signs the intent using the wallet client.
     * @param intent The order intent, add liquidity intent, or remove liquidity intent to sign
     * @param client The wallet client used for signing
     * @param account Optional account to use for signing. If not provided, the default account of the client is used.
     * @returns A Promise that resolves to a hex string containing the signed intent.
     */
    private async signIntent(
        intent: OrderIntent | AddLiquidityIntent | RemoveLiquidityIntent,
        client: WalletClient,
        account?: Account | Hex
    ): Promise<Hex> {
        let typedData = this.getIntentTypedData(intent);
        return await client.signTypedData({
            ...typedData,
            account: account ?? client.account!,
        });
    }

    /**
     * Calls the Turbine API endpoint with the given payload.
     * @param payload The payload to send to the endpoint
     * @param endpoint The endpoint to call. One of "add_order", "add_orders", "add_liquidity", "remove_liquidity"
     * @returns A Promise that resolves to the response from the endpoint
     */
    protected async callApiEndpoint(
        payload:
            | AddOrder
            | AddSmartOrder
            | (AddOrder | AddSmartOrder)[]
            | AddLiquidity
            | RemoveLiquidity,
        endpoint: string
    ) {
        const body = JSON.stringify(payload, bigIntReplacer);

        const response = await fetch(`${this.turbineApiUrl}/${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body,
        });
        return response;
    }

    private isOrderIntent(intent: any): intent is OrderIntent {
        return "sellToken" in intent && "buyToken" in intent;
    }

    private isAddLiquidityIntent(intent: any): intent is AddLiquidityIntent {
        return "token0" in intent && "token1" in intent && "maxToken0" in intent;
    }

    private isRemoveLiquidityIntent(intent: any): intent is RemoveLiquidityIntent {
        return "token0" in intent && "token1" in intent && "lpToken" in intent;
    }

    /**
     * Parse an order status from the API response format to our TypeScript interface.
     * Converts snake_case to camelCase and string numbers to BigInts.
     * @param orderStatus The raw order status from the API
     * @returns The parsed OrderStatus object
     */
    private parseOrderStatus(orderStatus: any): OrderStatus {
        return {
            hash: orderStatus.hash,
            order: {
                hash: orderStatus.order.hash,
                owner: getAddress(orderStatus.order.owner),
                sellToken: getAddress(orderStatus.order.sell_token),
                buyToken: getAddress(orderStatus.order.buy_token),
                startTime: BigInt(orderStatus.order.start_time),
                endTime: BigInt(orderStatus.order.end_time),
                partialFill: orderStatus.order.partial_fill,
                salt: orderStatus.order.salt,
                createdTimestamp: orderStatus.order.created_timestamp,
                callData: orderStatus.order.calldata,
                callDataTarget: getAddress(orderStatus.order.calldata_target),
                sellAmount: BigInt(orderStatus.order.sell_amount),
                executedSellAmount: BigInt(orderStatus.order.executed_sell_amount),
                midPriceDelta: Number(orderStatus.order.mid_price_delta),
                limitPrice: {
                    numerator: BigInt(orderStatus.order.limit_price.numerator),
                    denominator: BigInt(orderStatus.order.limit_price.denominator),
                },
            },
            state: orderStatus.state,
            execution: orderStatus.execution.map((exec: any) => ({
                batchId: Number(exec.batch_id),
                clearedAt: Number(exec.cleared_at),
                soldAmount: BigInt(exec.sold_amount),
                boughtAmount: BigInt(exec.bought_amount),
            })),
            executedSellAmount: BigInt(orderStatus.executed_sell_amount),
            executedBuyAmount: BigInt(orderStatus.executed_buy_amount),
        };
    }
}

// Returns random bytes32 as a hex string
export function getRandomSalt(): Hex {
    const randomBytes = new Array(32)
        .fill(0)
        .map(() => Math.floor(Math.random() * 256));
    return `0x${randomBytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function convertSignature(sig: Hex): PrimitiveSignature {
    return {
        r: BigInt(`0x${sig.slice(2, 66)}`),
        s: BigInt(`0x${sig.slice(66, 130)}`),
        yParity: parseInt(sig.slice(130, 132), 16) - 27 === 1, // Convert v (27/28) to y_parity (false/true)
    };
}

/** Helps serializing BigInts into JSON */
function bigIntReplacer(key: string, value: any): any {
    if (typeof value === "bigint") {
        return `0x${value.toString(16)}`;
    }
    return value;
}
