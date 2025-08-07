import { Account, Address, getAddress, Hex, PublicClient, WalletClient } from "viem";
import { createSiweMessage } from "viem/siwe";
import {
    addLiquidityIntentABI,
    balanceOfABI,
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
    CancelOrderPayload,
    GetOrderStatusesPayload,
    OrderIntent,
    OrderStatus,
    PrimitiveSignature,
    RemoveLiquidity,
    RemoveLiquidityIntent,
    TurbinePool,
    UserPosition,
} from "./models";
import { getSignedAllowance } from "./permit2";

interface TypedData {
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
}

export class TurbineClient {
    public turbineApiUrl: string;
    public settlerContract: Address;
    public turbineLiquidityRouterContract: Address;
    private sessionCookies: Map<Address, string> = new Map();

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
        this.requireAuthentication(walletClient.account!.address, "submitting orders");

        try {
            const payload = await this.createAddOrderData(
                intent,
                walletClient,
                publicClient
            );
            const response = await this.callApiEndpoint(
                payload,
                "add_order",
                walletClient.account!.address
            );
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
        this.requireAuthentication(walletClient.account!.address, "submitting orders");

        try {
            const payloads = await Promise.all(
                intents.map((intent) =>
                    this.createAddOrderData(intent, walletClient, publicClient)
                )
            );
            const response = await this.callApiEndpoint(
                payloads,
                "add_orders",
                walletClient.account!.address
            );
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
        this.requireAuthentication(walletClient.account!.address, "adding liquidity");

        try {
            const payload = await this.createAddLiquidityData(
                intent,
                walletClient,
                publicClient
            );
            const response = await this.callApiEndpoint(
                payload,
                "add_liquidity",
                walletClient.account!.address
            );
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
        this.requireAuthentication(walletClient.account!.address, "removing liquidity");

        try {
            const payload = await this.createRemoveLiquidityData(
                intent,
                walletClient,
                publicClient
            );
            const response = await this.callApiEndpoint(
                payload,
                "remove_liquidity",
                walletClient.account!.address
            );
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
        this.requireAuthentication(walletClient.account!.address, "cancelling orders");

        try {
            const payload: CancelOrderPayload = {
                orderHash: orderHash,
            };

            const response = await this.callApiEndpoint(
                payload,
                "cancel_order",
                walletClient.account!.address
            );
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
                    fee: poolData.fee / 100, // original fee is in hundredths of basis points
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
        try {
            const pools = await this.getPools(publicClient);
            if (pools.length === 0) {
                return [];
            }

            // Execute all balance checks in a single multicall
            const multicallContracts = pools.map((pool) => ({
                address: pool.metadata.lpToken,
                abi: balanceOfABI,
                functionName: "balanceOf" as const,
                args: [userAddress],
            }));
            const balanceResults = await publicClient.multicall({
                contracts: multicallContracts,
            });

            // Process results and create user positions
            const userPositions: UserPosition[] = [];
            for (let i = 0; i < pools.length; i++) {
                const pool = pools[i];
                const balanceResult = balanceResults[i];

                if (balanceResult.status === "success" && balanceResult.result > 0n) {
                    console.debug(
                        `Found position for lp token ${pool.metadata.lpToken} with balance ${balanceResult.result}`
                    );
                    userPositions.push({
                        poolMetadata: pool.metadata,
                        userAddress: getAddress(userAddress),
                        lpTokenBalance: balanceResult.result as bigint,
                    });
                } else if (balanceResult.status === "failure") {
                    // Log warning for failed balance check but continue processing other pools
                    console.warn(
                        `Failed to get balance for LP token ${pool.metadata.lpToken}: ${balanceResult.error?.message || "Unknown error"}`
                    );
                }
            }

            return userPositions;
        } catch (error) {
            throw toTurbineError(error);
        }
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
     * @param address The address to use for authentication
     * @returns A Promise that resolves to an array of `OrderStatus` objects.
     */
    async getOrderStatuses(
        orderHashes: Hex[],
        address: Address
    ): Promise<OrderStatus[]> {
        this.requireAuthentication(address, "querying order statuses");

        try {
            const payload: GetOrderStatusesPayload = {
                orderHashes: orderHashes,
            };

            const response = await this.callApiEndpoint(
                payload,
                "order_statuses",
                address
            );
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

    private isBrowser(): boolean {
        try {
            return (
                typeof window !== "undefined" && typeof window.document !== "undefined"
            );
        } catch (e) {
            return false;
        }
    }

    private async createAddOrderData(
        intent: OrderIntent,
        walletClient: WalletClient,
        publicClient: PublicClient
    ): Promise<AddOrder | AddSmartOrder> {
        // Skip permit data for smart orders
        if (this.is_smart_order(intent)) {
            return {
                order: intent,
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
        intent = {
            ...intent,
            fee: intent.fee * 100, // Turbine expects fee in hundredths of basis points
        };

        let deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 minutes from now
        let { permit: permit0, permitSignature: permitSignature0 } =
            await getSignedAllowance({
                token: intent.token0,
                walletClient,
                publicClient,
                amount: intent.maxToken0,
                deadline: Number(deadline),
                spender: this.turbineLiquidityRouterContract,
            });
        let { permit: permit1, permitSignature: permitSignature1 } =
            await getSignedAllowance({
                token: intent.token1,
                walletClient,
                publicClient,
                amount: intent.maxToken1,
                deadline: Number(deadline),
                spender: this.turbineLiquidityRouterContract,
            });
        return {
            addLiquidity: intent,
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
        intent = {
            ...intent,
            fee: intent.fee * 100, // Turbine expects fee in hundredths of basis points
        };

        let deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 minutes from now
        let { permit: permit, permitSignature: permitSignature } =
            await getSignedAllowance({
                token: intent.lpToken,
                walletClient,
                publicClient,
                amount: intent.lpTokenAmount,
                deadline: Number(deadline),
                spender: this.turbineLiquidityRouterContract,
            });
        return {
            removeLiquidity: intent,
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

    private getOrderHashTypedData(orderHash: Hex): TypedData {
        return {
            domain: this.getTurbineDomain(),
            types: {
                OrderHash: [{ name: "order_hash", type: "bytes32" }],
            },
            primaryType: "OrderHash",
            message: {
                order_hash: orderHash,
            },
        };
    }

    private getIntentTypedData(
        intent: OrderIntent | AddLiquidityIntent | RemoveLiquidityIntent
    ) {
        let typedData: TypedData = {
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
     * Authenticate with the Turbine API using a wallet client.
     * First calls /nonce to get nonce and session ID, then calls /verify with the signed message.
     * @param client The wallet client to use for signing
     * @param account Optional account to use for signing. If not provided, the default account of the client is used.
     * @param domain Optional domain to use in the SIWE message (defaults to swap.propellerheads.xyz)
     */
    async authenticate(
        client: WalletClient,
        account?: Account,
        domain?: string
    ): Promise<void> {
        try {
            // Call /nonce endpoint to get nonce and initial session ID
            const nonceResponse = await fetch(`${this.turbineApiUrl}/nonce`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: this.isBrowser() ? "include" : undefined,
            });

            if (!nonceResponse.ok) {
                const errorText = await nonceResponse.text();
                throw new TurbineError(
                    "NONCE_REQUEST_FAILED",
                    `Failed to get nonce: ${errorText}`,
                    "Failed to initialize authentication with the Turbine API. Please try again."
                );
            }

            // The API returns the nonce as a JSON string directly
            const nonce: string = (await nonceResponse.json()) as string;

            // Extract session ID from nonce response headers (only in non-browser environments)
            let initialSessionCookie = "";
            if (!this.isBrowser()) {
                const initialSetCookieHeader = nonceResponse.headers.get("set-cookie");
                if (initialSetCookieHeader) {
                    initialSessionCookie =
                        this.parseCookieHeader(initialSetCookieHeader);
                }
            }

            // Create and sign SIWE message with the received nonce
            const message = createSiweMessage({
                address: account?.address ?? client.account!.address,
                chainId: client.chain!.id,
                domain: domain || "dev-swap.propellerheads.xyz",
                statement: "Sign in with Ethereum to submit orders to Turbine",
                nonce,
                uri: this.turbineApiUrl,
                version: "1",
            });

            const signature = await client.signMessage({
                message: message,
                account: account ?? client.account!,
            });

            // Convert signature to structured format expected by Turbine API
            const structuredSignature = this.parseSignature(signature);

            // Call /verify endpoint with the signed message and initial session ID
            const verifyHeaders: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (!this.isBrowser() && initialSessionCookie) {
                verifyHeaders["Cookie"] = initialSessionCookie;
            }

            const verifyResponse = await fetch(`${this.turbineApiUrl}/verify`, {
                method: "POST",
                headers: verifyHeaders,
                body: JSON.stringify({ message, signature: structuredSignature }),
                credentials: this.isBrowser() ? "include" : undefined,
            });

            if (!verifyResponse.ok) {
                const errorText = await verifyResponse.text();
                throw new TurbineError(
                    "AUTHENTICATION_FAILED",
                    `Authentication failed: ${errorText}`,
                    "Failed to authenticate with the Turbine API. Please try again."
                );
            }

            // Extract the new cycled session ID from verify response and store by address (only in non-browser environments)
            if (!this.isBrowser()) {
                const verifySetCookieHeader = verifyResponse.headers.get("set-cookie");
                if (verifySetCookieHeader) {
                    const sessionCookie = this.parseCookieHeader(verifySetCookieHeader);
                    this.sessionCookies.set(
                        account?.address ?? client.account!.address,
                        sessionCookie
                    );
                }
            }
        } catch (error) {
            throw toTurbineError(error);
        }
    }

    /**
     * Get the current authentication status for a specific address.
     * @param address The address to check authentication status for
     * @returns A Promise that resolves to the authentication status
     */
    async getAuthStatus(
        address: Address
    ): Promise<{ authenticated: boolean; address?: string }> {
        try {
            const headers: Record<string, string> = {};
            if (!this.isBrowser()) {
                const sessionCookie = this.getSessionCookie(address);
                if (sessionCookie) {
                    headers["Cookie"] = sessionCookie;
                }
            }

            const response = await fetch(`${this.turbineApiUrl}/me`, {
                method: "GET",
                headers,
                credentials: this.isBrowser() ? "include" : undefined,
            });

            if (response.ok) {
                return (await response.json()) as {
                    authenticated: boolean;
                    address?: string;
                };
            }
            return { authenticated: false };
        } catch (error) {
            return { authenticated: false };
        }
    }

    /**
     * Logout and clear the session for a specific address.
     * @param address The address to logout
     */
    async logout(address: Address): Promise<void> {
        try {
            const headers: Record<string, string> = {};
            if (!this.isBrowser()) {
                const sessionCookie = this.getSessionCookie(address);
                if (sessionCookie) {
                    headers["Cookie"] = sessionCookie;
                }
            }

            await fetch(`${this.turbineApiUrl}/logout`, {
                method: "POST",
                headers,
                credentials: this.isBrowser() ? "include" : undefined,
            });

            this.sessionCookies.delete(address);
        } catch (error) {
            // Clear session even if logout request fails
            this.sessionCookies.delete(address);
            throw toTurbineError(error);
        }
    }

    /**
     * Logout all sessions and clear all stored session cookies.
     */
    async logoutAll(): Promise<void> {
        const addresses = Array.from(this.sessionCookies.keys());
        await Promise.all(addresses.map((address) => this.logout(address)));
    }

    private parseCookieHeader(setCookieHeader: string): string {
        const match = setCookieHeader.match(/id=([^;]+)/);
        return match ? `id=${match[1]}` : "";
    }

    private requireAuthentication(address: Address, action: string): void {
        if (!this.sessionCookies.has(address)) {
            throw new TurbineError(
                "AUTHENTICATION_REQUIRED",
                `Must authenticate address ${address} before ${action}`,
                `Please authenticate with your wallet before ${action}.`
            );
        }
    }

    private getSessionCookie(address: Address): string | undefined {
        return this.sessionCookies.get(address);
    }

    /**
     * Calls the Turbine API endpoint with the given payload.
     * @param payload The payload to send to the endpoint
     * @param endpoint The endpoint to call. One of "add_order", "add_orders", "add_liquidity", "remove_liquidity", "cancel_order", "order_statuses"
     * @param address The address to use for session authentication
     * @returns A Promise that resolves to the response from the endpoint
     */
    protected async callApiEndpoint(
        payload:
            | AddOrder
            | AddSmartOrder
            | (AddOrder | AddSmartOrder)[]
            | AddLiquidity
            | RemoveLiquidity
            | CancelOrderPayload
            | GetOrderStatusesPayload,
        endpoint: string,
        address: Address
    ) {
        const body = JSON.stringify(payload, bigIntReplacer);

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (!this.isBrowser()) {
            const sessionCookie = this.getSessionCookie(address);
            if (sessionCookie) {
                headers["Cookie"] = sessionCookie;
            }
        }

        const response = await fetch(`${this.turbineApiUrl}/${endpoint}`, {
            method: "POST",
            headers,
            body,
            credentials: this.isBrowser() ? "include" : undefined,
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
                txHash: exec.tx_hash,
                clearedAt: new Date(exec.cleared_at * 1000),
                soldAmount: BigInt(exec.sold_amount),
                boughtAmount: BigInt(exec.bought_amount),
            })),
            executedSellAmount: BigInt(orderStatus.executed_sell_amount),
            executedBuyAmount: BigInt(orderStatus.executed_buy_amount),
        } as OrderStatus;
    }

    /**
     * Convert viem signature hex string to structured format expected by Turbine API
     */
    private parseSignature(signature: Hex): any {
        // Parse the 65-byte signature: 32 bytes r + 32 bytes s + 1 byte v
        const r = signature.slice(0, 66); // 0x + 32 bytes
        const s = `0x${signature.slice(66, 130)}`; // 32 bytes
        const v = parseInt(signature.slice(130, 132), 16); // 1 byte

        // Convert v (27/28) to yParity (0/1)
        const yParity = v === 28 ? "0x1" : "0x0";

        return {
            r: r,
            s: s,
            yParity: yParity,
            v: `0x${v.toString(16)}`,
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
