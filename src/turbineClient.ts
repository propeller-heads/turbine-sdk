import { Address, getAddress, Hex, PublicClient, WalletClient } from "viem";
import { createSiweMessage } from "viem/siwe";
import { balanceOfABI, turbineHookABI } from "./abi";
import { TURBINE_API_URL } from "./config";
import { NULL_ADDRESS } from "./constants";
import { toTurbineError, TurbineError } from "./errorHandling";
import {
    AddLiquidity,
    AddLiquidityIntent,
    AddOrder,
    AddSmartOrder,
    CancelOrderPayload,
    GetOrderStatesPayload,
    LiquidityIntentState,
    LiquidityIntentStatus,
    OrderIntent,
    OrderSettledAmount,
    OrderState,
    PrimitiveSignature,
    RemoveLiquidity,
    RemoveLiquidityIntent,
    TurbineConfig,
    TurbinePool,
    UserPosition,
} from "./models";
import { getBatchSignedAllowance, getSignedAllowance } from "./permit2";

export class TurbineClient {
    public turbineApiUrl: string;
    public walletClient: WalletClient;
    public publicClient: PublicClient;
    public config: TurbineConfig;
    private sessionId?: string;
    private authenticationInProgress: boolean = false;

    private constructor(
        walletClient: WalletClient,
        publicClient: PublicClient,
        turbineApiUrl: string,
        config: TurbineConfig
    ) {
        this.walletClient = walletClient;
        this.publicClient = publicClient;
        this.turbineApiUrl = turbineApiUrl;
        this.config = config;
    }

    /**
     * Creates a new TurbineClient instance with configuration fetched from the API
     * @param walletClient The wallet client for signing transactions
     * @param publicClient The public client for reading blockchain data
     * @param turbineApiUrl Optional API URL (defaults to TURBINE_API_URL)
     * @returns Promise that resolves to a configured TurbineClient instance
     */
    static async create(
        walletClient: WalletClient,
        publicClient: PublicClient,
        turbineApiUrl?: string
    ): Promise<TurbineClient> {
        const apiUrl = turbineApiUrl || TURBINE_API_URL;

        // Check status first
        await checkStatus(apiUrl);

        // Fetch config
        const config = await fetchConfig(apiUrl);

        return new TurbineClient(walletClient, publicClient, apiUrl, config);
    }

    /* PRIVATE HELPER METHODS */

    /**
     * Extracts and stores session ID from fetch response headers
     */
    private extractAndStoreCookies(response: Response): void {
        // Only extract cookies in Node.js environment
        if (typeof window !== "undefined") {
            return;
        }

        const setCookieHeaders = response.headers.get("set-cookie");
        if (setCookieHeaders) {
            // Parse multiple cookies if present
            const cookies = setCookieHeaders
                .split(",")
                .map((cookie) => cookie.trim().split(";")[0]);

            for (const cookie of cookies) {
                if (cookie.startsWith("id=")) {
                    this.sessionId = cookie.substring(3);
                    break;
                }
            }
        }
    }

    /**
     * Creates headers with stored session ID
     */
    private createHeaders(additionalHeaders: Record<string, string> = {}): HeadersInit {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...additionalHeaders,
        };

        if (typeof window === "undefined" && this.sessionId) {
            headers["Cookie"] = `id=${this.sessionId}`;
        }

        return headers;
    }

    /**
     * Makes a fetch request with automatic cookie handling
     * In browsers: relies on credentials: "include" for automatic cookie handling
     * In Node.js: manually manages cookies via extractAndStoreCookies
     */
    private async fetchWithCookies(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<Response> {
        const url = `${this.turbineApiUrl}${endpoint}`;
        const headers = this.createHeaders(options.headers as Record<string, string>);

        const response = await fetch(url, {
            ...options,
            headers,
            credentials: "include",
        });

        // Only extract cookies in Node.js environment
        if (typeof window === "undefined") {
            this.extractAndStoreCookies(response);
        }

        return response;
    }

    /* PUBLIC METHODS */

    /* AUTHENTICATED METHODS */

    /**
     * Add an order to the Turbine API.
     * @param intent An `OrderIntent` object containing the details of the trade to be executed
     * @returns A Promise that resolves to a string containing the submitted order hash.
     */
    async addOrder(intent: OrderIntent): Promise<string> {
        const address = await this.ensureAuthenticated();
        if (getAddress(address) !== getAddress(intent.owner)) {
            throw new TurbineError(
                "UNAUTHORIZED",
                "User not authorized to add order",
                "Please authenticate with your wallet before making requests."
            );
        }

        try {
            const payload = await this.createAddOrderData(intent);
            const response = await this.callApiEndpoint(payload, "add_order");

            if (response.status < 200 || response.status >= 300) {
                throw new TurbineError(
                    "API_ERROR",
                    `API returned status ${response.status}: ${response.statusText}`,
                    "Failed to submit order. Please try again later."
                );
            }

            const responseJson = await response.json();

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
     * @returns A Promise that resolves to an array of strings containing the submitted order hashes.
     */
    async addOrders(intents: OrderIntent[]): Promise<string[]> {
        const address = await this.ensureAuthenticated();
        if (
            intents.some((intent) => getAddress(intent.owner) !== getAddress(address))
        ) {
            throw new TurbineError(
                "UNAUTHORIZED",
                "User not authorized to add orders",
                "Please authenticate with your wallet before making requests."
            );
        }

        try {
            const payloads = await Promise.all(
                intents.map((intent) => this.createAddOrderData(intent))
            );
            const response = await this.callApiEndpoint(payloads, "add_orders");

            if (response.status < 200 || response.status >= 300) {
                throw new TurbineError(
                    "API_ERROR",
                    `API returned status ${response.status}: ${response.statusText}`,
                    "Failed to submit orders. Please try again later."
                );
            }

            const responseJson = await response.json();

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
     * @returns A Promise that resolves to a string containing the submitted intent hash.
     */
    async addLiquidity(intent: AddLiquidityIntent): Promise<string> {
        const address = await this.ensureAuthenticated();
        if (getAddress(intent.owner) !== getAddress(address)) {
            throw new TurbineError(
                "UNAUTHORIZED",
                "User not authorized to add liquidity",
                "Please authenticate with your wallet before making requests."
            );
        }

        try {
            const payload = await this.createAddLiquidityData(intent);
            const response = await this.callApiEndpoint(payload, "add_liquidity");

            if (response.status < 200 || response.status >= 300) {
                throw new TurbineError(
                    "API_ERROR",
                    `API returned status ${response.status}: ${response.statusText}`,
                    "Failed to submit liquidity addition. Please try again later."
                );
            }

            const responseJson = await response.json();

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
     * @returns A Promise that resolves to a string containing the submitted intent hash.
     */
    async removeLiquidity(intent: RemoveLiquidityIntent): Promise<string> {
        const address = await this.ensureAuthenticated();
        if (getAddress(intent.owner) !== getAddress(address)) {
            throw new TurbineError(
                "UNAUTHORIZED",
                "User not authorized to remove liquidity",
                "Please authenticate with your wallet before making requests."
            );
        }

        try {
            const payload = await this.createRemoveLiquidityData(intent);
            const response = await this.callApiEndpoint(payload, "remove_liquidity");

            if (response.status < 200 || response.status >= 300) {
                throw new TurbineError(
                    "API_ERROR",
                    `API returned status ${response.status}: ${response.statusText}`,
                    "Failed to submit liquidity removal. Please try again later."
                );
            }

            const responseJson = await response.json();

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
     * @returns A Promise that resolves to the response message from the API.
     */
    async cancelOrder(orderHash: Hex): Promise<{ orderHash: string; message: string }> {
        await this.ensureAuthenticated();

        try {
            const payload: CancelOrderPayload = {
                orderHash: orderHash,
            };

            const response = await this.callApiEndpoint(payload, "cancel_order");

            if (response.status < 200 || response.status >= 300) {
                throw new TurbineError(
                    "API_ERROR",
                    `API returned status ${response.status}: ${response.statusText}`,
                    "Failed to cancel order. Please try again later."
                );
            }

            const responseJson = await response.json();

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
     * Get the status of multiple orders by their hashes.
     * @param orderHashes An array of order hashes to check
     * @returns A Promise that resolves to an array of `OrderState` objects.
     */
    async getOrderStates(orderHashes: Hex[]): Promise<OrderState[]> {
        await this.ensureAuthenticated();

        try {
            const payload: GetOrderStatesPayload = {
                orderHashes: orderHashes,
            };

            const response = await this.callApiEndpoint(payload, "order_states");

            if (response.status < 200 || response.status >= 300) {
                throw new TurbineError(
                    "API_ERROR",
                    `API returned status ${response.status}: ${response.statusText}`,
                    "Failed to get order statuses. Please try again later."
                );
            }

            const responseJson = await response.json();

            if (!Array.isArray(responseJson)) {
                throw new TurbineError(
                    "INVALID_RESPONSE",
                    `Expected array response but got: ${JSON.stringify(responseJson)}`,
                    "Received unexpected response format from server. Please try again later."
                );
            }

            return responseJson.map((orderStatus: any) =>
                this.parseOrderState(orderStatus)
            );
        } catch (error) {
            throw toTurbineError(error);
        }
    }

    /**
     * Get the status of multiple liquidity intents by their hashes.
     * @param intentHashes An array of liquidity intent hashes to check
     * @returns A Promise that resolves to an array of liquidity intent status objects.
     */
    async getLiquidityIntents(intentHashes: Hex[]): Promise<LiquidityIntentStatus[]> {
        await this.ensureAuthenticated();

        try {
            const response = await this.fetchWithCookies("/liquidity_intent_statuses", {
                method: "GET",
                body: JSON.stringify({ intentHashes }),
            });

            if (response.status < 200 || response.status >= 300) {
                throw new TurbineError(
                    "API_ERROR",
                    `API returned status ${response.status}: ${response.statusText}`,
                    "Failed to get liquidity intent statuses. Please try again later."
                );
            }

            const responseJson = await response.json();

            if (!Array.isArray(responseJson)) {
                throw new TurbineError(
                    "INVALID_RESPONSE",
                    `Expected array response but got: ${JSON.stringify(responseJson)}`,
                    "Received unexpected response format from server. Please try again later."
                );
            }

            return responseJson.map((status: any) => {
                const stateKey = status.state as keyof typeof LiquidityIntentState;
                return {
                    hash: status.hash,
                    state: LiquidityIntentState[stateKey],
                } as LiquidityIntentStatus;
            });
        } catch (error) {
            throw toTurbineError(error);
        }
    }

    async getSettledAmounts(orderHashes: Hex[]): Promise<OrderSettledAmount[]> {
        let statuses = await this.getOrderStates(orderHashes);
        return statuses.map((status) => ({
            hash: status.hash,
            executedSellAmount: status.executedSellAmount,
        }));
    }

    /* UNAUTHENTICATED METHODS */

    /**
     * Get the fee for a prospective order.
     * @param intent The intent for which to get the fee
     * @returns A Promise that resolves to a bigint containing the fee expressed in absolute amount of the sell token.
     */
    async getOrderFee(intent: OrderIntent): Promise<bigint> {
        try {
            const response = await this.fetchWithCookies("/order_fees", {
                method: "POST",
                body: JSON.stringify(intent, bigIntReplacer),
            });

            if (response.status < 200 || response.status >= 300) {
                throw new TurbineError(
                    "API_ERROR",
                    `API returned status ${response.status}: ${response.statusText}`,
                    "Failed to get order fee. Please try again later."
                );
            }

            const feeJson = await response.json();

            if (typeof feeJson !== "string") {
                throw new TurbineError(
                    "INVALID_RESPONSE",
                    `Unexpected fee response: ${JSON.stringify(feeJson)}`,
                    "Received unexpected response format from server. Please try again later."
                );
            }

            return BigInt(feeJson);
        } catch (error) {
            throw toTurbineError(error);
        }
    }

    async getPools(): Promise<TurbinePool[]> {
        return await getPools(this.publicClient, this.config.lpHookAddress);
    }

    async getUserPositions(): Promise<UserPosition[]> {
        const address = await this.walletClient.getAddresses();
        return await getUserPositions(
            address[0],
            this.publicClient,
            this.config.lpHookAddress
        );
    }

    async checkStatus(): Promise<boolean> {
        return await checkStatus(this.turbineApiUrl);
    }

    /**
     * Get the current configuration
     * @returns The TurbineConfig
     */
    getConfig(): TurbineConfig {
        return this.config;
    }

    /* PRIVATE METHODS */

    private async createAddOrderData(
        intent: OrderIntent
    ): Promise<AddOrder | AddSmartOrder> {
        // Skip permit data for smart orders
        if (this.is_smart_order(intent)) {
            return {
                order: intent,
            };
        }

        let { permit, permitSignature } = await getSignedAllowance({
            token: intent.sellToken,
            walletClient: this.walletClient,
            publicClient: this.publicClient,
            deadline: Number(intent.endTime),
            spender: this.config.turbineSettlerAddress,
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
        intent: AddLiquidityIntent
    ): Promise<AddLiquidity> {
        intent = {
            ...intent,
            fee: intent.fee * 100, // Turbine expects fee in hundredths of basis points
        };

        let deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 minutes from now
        let { permit: permit, permitSignature: permitSignature } =
            await getBatchSignedAllowance({
                tokens: [intent.token0, intent.token1],
                walletClient: this.walletClient,
                publicClient: this.publicClient,
                amounts: [intent.maxToken0, intent.maxToken1],
                deadline: Number(deadline),
                spender: this.config.lpRouterAddress,
            });
        return {
            addLiquidity: intent,
            permitTokens: {
                signature: convertSignature(permitSignature),
                permit: permit,
            },
        };
    }

    private async createRemoveLiquidityData(
        intent: RemoveLiquidityIntent
    ): Promise<RemoveLiquidity> {
        intent = {
            ...intent,
            fee: intent.fee * 100, // Turbine expects fee in hundredths of basis points
        };

        let deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 minutes from now
        let { permit: permit, permitSignature: permitSignature } =
            await getSignedAllowance({
                token: intent.lpToken,
                walletClient: this.walletClient,
                publicClient: this.publicClient,
                amount: intent.lpTokenAmount,
                deadline: Number(deadline),
                spender: this.config.lpRouterAddress,
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

    /**
     * Authenticate with the Turbine API using a wallet client.
     * First calls /nonce to get nonce, then calls /verify with the signed message.
     */
    async authenticate(): Promise<void> {
        const chainId = await this.walletClient.getChainId();
        const addresses = await this.walletClient.getAddresses();
        const address = addresses[0];
        const config = this.getConfig();

        try {
            // Get nonce - session cookies handled automatically
            const nonceResponse = await this.fetchWithCookies("/nonce", {
                method: "POST",
            });
            const nonce: string = await nonceResponse.json();

            // Create and sign SIWE message with the received nonce
            const message = createSiweMessage({
                address: address,
                chainId: chainId,
                domain: config.siweDomain,
                statement: "Sign in to Turbine with your Ethereum wallet",
                nonce,
                uri: config.siweUri,
                version: "1",
            });

            const signature = await this.walletClient.signMessage({
                message: message,
                account: this.walletClient.account!,
            });

            // Convert signature to structured format expected by Turbine API
            const structuredSignature = this.parseSignature(signature);

            // Verify with signed message - session cookies handled automatically
            const verifyResponse = await this.fetchWithCookies("/verify", {
                method: "POST",
                body: JSON.stringify({
                    message,
                    signature: structuredSignature,
                }),
            });

            if (!verifyResponse.ok) {
                const responseText = await verifyResponse.text();
                const errorMessage = `Verify endpoint failed: ${verifyResponse.status} ${verifyResponse.statusText} - ${responseText}`;
                throw new Error(errorMessage);
            }
        } catch (error: any) {
            throw toTurbineError(error);
        }
    }

    /**
     * Get the current authentication status for the authenticated user.
     * @returns A Promise that resolves to the authentication status
     */
    async getAuthStatus(): Promise<{ authenticated: boolean; address?: string }> {
        try {
            const response = await this.fetchWithCookies("/me");
            return await response.json();
        } catch (error) {
            return { authenticated: false };
        }
    }

    /**
     * Logout and clear the current session.
     */
    async logout(): Promise<void> {
        try {
            await this.fetchWithCookies("/logout", { method: "POST" });
        } catch (error) {
            // Server handles session cleanup, so we don't need to do anything locally
            throw toTurbineError(error);
        }
    }

    /**
     * Ensures that the user is authenticated with the Turbine API.
     *
     * This method checks the current authentication status by making a request to the `/me` endpoint.
     * If the user is not authenticated, it automatically attempts to authenticate them.
     * If authentication is successful, it returns the authenticated user's address.
     *
     * @throws {TurbineError} If authentication fails or if there is an error checking authentication status.
     * @returns {Promise<Address>} The authenticated user's address.
     */
    private async ensureAuthenticated(): Promise<Address> {
        // If authentication is already in progress, wait for it
        if (this.authenticationInProgress) {
            // Poll until authentication completes with 5 minute timeout
            const startTime = Date.now();
            const timeout = 300000; // 5 minutes

            while (this.authenticationInProgress && Date.now() - startTime < timeout) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            // If we timed out, reset the flag and proceed with authentication
            if (this.authenticationInProgress) {
                this.authenticationInProgress = false;
            }

            // Re-check auth status after waiting
            const response = await this.fetchWithCookies("/me");
            if (response.ok) {
                const authStatus = await response.json();
                if (authStatus.authenticated && authStatus.address) {
                    return authStatus.address;
                }
            }
        }

        this.authenticationInProgress = true;

        try {
            const response = await this.fetchWithCookies("/me");

            if (response.ok) {
                const authStatus = await response.json();
                if (authStatus.authenticated && authStatus.address) {
                    return authStatus.address;
                }
            }

            await this.authenticate();

            const retryResponse = await this.fetchWithCookies("/me");
            if (!retryResponse.ok) {
                throw new TurbineError(
                    "AUTHENTICATION_FAILED",
                    `Authentication check failed with status ${retryResponse.status}`,
                    "Unable to authenticate with your wallet. Please try again."
                );
            }
            const retryAuthStatus = await retryResponse.json();

            if (!retryAuthStatus.authenticated || !retryAuthStatus.address) {
                throw new TurbineError(
                    "AUTHENTICATION_FAILED",
                    "Authentication failed after authentication attempt",
                    "Unable to authenticate with your wallet. Please try again."
                );
            }

            return retryAuthStatus.address;
        } catch (error: any) {
            if (error instanceof TurbineError) {
                throw error;
            }

            // If it's already a detailed authentication error, preserve it
            if (error.message && error.message.includes("Authentication failed:")) {
                throw error;
            }

            throw new TurbineError(
                "AUTHENTICATION_ERROR",
                `Failed to ensure authentication: ${error.message}`,
                "Unable to authenticate with your wallet. Please try again."
            );
        } finally {
            this.authenticationInProgress = false;
        }
    }

    /**
     * Calls the Turbine API endpoint with the given payload.
     * @param payload The payload to send to the endpoint
     * @param endpoint The endpoint to call. One of "add_order", "add_orders", "add_liquidity", "remove_liquidity", "cancel_order", "order_statuses"
     * @returns A Promise that resolves to a fetch response
     */
    protected async callApiEndpoint(
        payload:
            | AddOrder
            | AddSmartOrder
            | (AddOrder | AddSmartOrder)[]
            | AddLiquidity
            | RemoveLiquidity
            | CancelOrderPayload
            | GetOrderStatesPayload,
        endpoint: string
    ) {
        return await this.fetchWithCookies(`/${endpoint}`, {
            method: "POST",
            body: JSON.stringify(payload, bigIntReplacer),
        });
    }

    /**
     * Parse an order status from the API response format to our TypeScript interface.
     * Converts snake_case to camelCase and string numbers to BigInts.
     * @param orderState The raw order status from the API
     * @returns The parsed OrderState object
     */
    private parseOrderState(orderState: any): OrderState {
        return {
            hash: orderState.hash,
            status: orderState.status,
            execution: orderState.execution.map((exec: any) => ({
                batchId: Number(exec.batch_id),
                txHash: exec.tx_hash,
                clearedAt: new Date(exec.cleared_at * 1000),
                soldAmount: BigInt(exec.sold_amount),
                boughtAmount: BigInt(exec.bought_amount),
            })),
            executedSellAmount: BigInt(orderState.executed_sell_amount),
            executedBuyAmount: BigInt(orderState.executed_buy_amount),
        } as OrderState;
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

/**
 * Get the registered pools from the Turbine Hook contract.
 * @param publicClient The public client used for blockchain interactions
 * @param hookAddress The address of the Turbine Hook contract
 * @returns A Promise that resolves to an array of `TurbinePool` objects.
 */
export async function getPools(
    publicClient: PublicClient,
    hookAddress: Address
): Promise<TurbinePool[]> {
    try {
        const numberOfPools = await publicClient.readContract({
            address: hookAddress,
            abi: turbineHookABI,
            functionName: "getNumberOfRegisteredPools",
        });

        // Fetch pools in batches of up to 1000 at a time
        const BATCH_SIZE = 1000n;
        const poolsData: any[] = [];
        for (let start = 0n; start < numberOfPools; start += BATCH_SIZE) {
            const end = start + BATCH_SIZE > numberOfPools ? numberOfPools : start + BATCH_SIZE;
            const batch = await publicClient.readContract({
                address: hookAddress,
                abi: turbineHookABI,
                functionName: "getRegisteredPoolsSlice",
                args: [start, end],
            });
            poolsData.push(...batch);
        }

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
 * Get user positions for all registered pools.
 * @param userAddress The address of the user to get positions for
 * @param publicClient The public client used for blockchain interactions
 * @param hookAddress The address of the Turbine Hook contract
 * @returns A Promise that resolves to an array of `UserPosition` objects.
 */
export async function getUserPositions(
    userAddress: Address,
    publicClient: PublicClient,
    hookAddress: Address
): Promise<UserPosition[]> {
    try {
        const pools = await getPools(publicClient, hookAddress);
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
 * @param turbineApiUrl The base URL of the Turbine API
 * @returns A Promise that resolves to true if the service is available, or throws an error if unavailable.
 */
/**
 * Fetch configuration from the Turbine API endpoint.
 * @param turbineApiUrl The base URL of the Turbine API
 * @returns A Promise that resolves to the TurbineConfig
 */
export async function fetchConfig(turbineApiUrl: string): Promise<TurbineConfig> {
    try {
        const response = await fetch(`${turbineApiUrl}/config`);
        if (!response.ok) {
            console.log(response);
            throw new TurbineError(
                "CONFIG_FETCH_FAILED",
                `Config fetch failed with status ${response.status}: ${response.statusText}`,
                "Unable to fetch configuration. Please try again later."
            );
        }
        return await response.json();
    } catch (error: any) {
        if (error instanceof TurbineError) {
            throw error;
        }
        console.log(error);
        throw new TurbineError(
            "CONFIG_FETCH_FAILED",
            `Failed to fetch config: ${error.message}`,
            "Unable to fetch configuration. Please try again later."
        );
    }
}

/**
 * Check if the Turbine service is available by querying the /status endpoint.
 * @param turbineApiUrl The base URL of the Turbine API
 * @returns A Promise that resolves to true if the service is available, or throws an error if unavailable.
 */
export async function checkStatus(turbineApiUrl: string): Promise<boolean> {
    try {
        const response = await fetch(`${turbineApiUrl}/status`);
        if (!response.ok) {
            throw new TurbineError(
                "SERVICE_UNAVAILABLE",
                `Service returned status ${response.status}: ${response.statusText}`,
                "Turbine is currently unavailable. Try again later."
            );
        }
        return true;
    } catch (error: any) {
        if (error instanceof TurbineError) {
            throw error;
        }
        throw new TurbineError(
            "SERVICE_UNAVAILABLE",
            `Failed to connect to Turbine service: ${error.message}`,
            "Turbine is currently unavailable. Try again later."
        );
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
function bigIntReplacer(_key: string, value: any): any {
    if (typeof value === "bigint") {
        return `0x${value.toString(16)}`;
    }
    return value;
}
