import {
    Address,
    BaseError,
    ContractFunctionRevertedError,
    encodeAbiParameters,
    getAddress,
    Hex,
    keccak256,
    PublicClient,
    WalletClient,
} from "viem";
import { createSiweMessage } from "viem/siwe";
import {
    balanceOfABI,
    turbineHookABI,
    poolManagerABI,
    turbineLiquidityRouterABI,
} from "./abi";
import { TURBINE_API_URL } from "./config";
import { NULL_ADDRESS, SQRT_PRICE_IDENTITY } from "./constants";
import { toTurbineError, TurbineError } from "./errorHandling";
import {
    AddLiquidity,
    AddLiquidityIntent,
    AddOrder,
    AddSmartOrder,
    CancelOrderPayload,
    GetOrderStatesPayload,
    LiquidityIntentStatus,
    LiquidityIntentState,
    OrderIntent,
    OrderSettledAmount,
    OrderState,
    PoolKey,
    PrimitiveSignature,
    RemoveLiquidity,
    RemoveLiquidityIntent,
    RemoveLiquidityIntentOnchain,
    SignedPermitOnchain,
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

    private createPoolKey(token0: Address, token1: Address, fee: number): PoolKey {
        const [currency0, currency1] =
            token0 < token1 ? [token0, token1] : [token1, token0];
        return {
            currency0,
            currency1,
            fee,
            tickSpacing: 1,
            hooks: this.config.lpHookAddress,
        };
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
        try {
            const payload = await this.createAddLiquidityData(intent);
            return await this.addLiquidityWithSignedPermit(payload);
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

            return responseJson.map((orderState: any) =>
                this.parseOrderState(orderState)
            );
        } catch (error) {
            throw toTurbineError(error);
        }
    }

    /**
     * Get the state of multiple liquidity intents by their hashes.
     * @param intentHashes An array of liquidity intent hashes to check
     * @returns A Promise that resolves to an array of liquidity intent state objects.
     */
    async getLiquidityIntents(intentHashes: Hex[]): Promise<LiquidityIntentState[]> {
        await this.ensureAuthenticated();

        try {
            const response = await this.fetchWithCookies("/liquidity_intent_states", {
                method: "POST",
                body: JSON.stringify({ intentHashes }),
            });

            if (response.status < 200 || response.status >= 300) {
                throw new TurbineError(
                    "API_ERROR",
                    `API returned status ${response.status}: ${response.statusText}`,
                    "Failed to get liquidity intent states. Please try again later."
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

            return responseJson.map((state: any) => {
                const statusKey = state.status as keyof typeof LiquidityIntentStatus;
                return {
                    hash: state.hash,
                    status: LiquidityIntentStatus[statusKey],
                } as LiquidityIntentState;
            });
        } catch (error) {
            throw toTurbineError(error);
        }
    }

    /**
     * Add liquidity using pre-signed permit data.
     * This method is used when permit data has already been created via createAddLiquidityData()
     * and the pool has been created. It submits the liquidity intent to Turbine without requiring
     * additional Permit2 signatures.
     *
     * @param payload The AddLiquidity payload containing the intent and pre-signed permit data
     * @returns A Promise that resolves to a string containing the submitted intent hash.
     */
    async addLiquidityWithSignedPermit(payload: AddLiquidity): Promise<string> {
        const address = await this.ensureAuthenticated();

        // Validate that the owner in the payload matches the authenticated address
        if (getAddress(payload.addLiquidity.owner) !== getAddress(address)) {
            throw new TurbineError(
                "UNAUTHORIZED",
                "User not authorized to add liquidity",
                "Please authenticate with your wallet before making requests."
            );
        }

        try {
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

    /* UNAUTHENTICATED METHODS */

    /**
     * Submit a liquidity removal intent directly on-chain.
     * This method creates the onchain intent data and permit, then submits it to the TurbineLiquidityRouter contract.
     * @param intent The intent to remove liquidity
     * @returns A Promise that resolves to the transaction hash and intent hash of the submitted intent
     */
    async submitRemoveLiquidityIntentOnchain(
        intent: RemoveLiquidityIntent
    ): Promise<{ txHash: string; intentHash: Hex }> {
        try {
            const data = await this.createRemoveLiquidityDataOnchain(intent);
            const txHash = await this.submitRemoveLiquidityTransaction(
                data.intent,
                data.permit
            );

            // Compute the intent hash (matches keccak256(abi.encode(intent)) in the contract)
            const intentHash = this.computeRemoveLiquidityIntentHash({
                owner: intent.owner,
                poolId: data.intent.poolId,
                lpTokenAmount: intent.lpTokenAmount,
                salt: intent.salt,
            });
            return { txHash, intentHash };
        } catch (error) {
            throw toTurbineError(error);
        }
    }

    /**
     * Submit a remove liquidity intent directly to the TurbineLiquidityRouter contract on-chain.
     * This method simulates the contract call, writes the transaction, and waits for confirmation.
     * @param intent The onchain remove liquidity intent containing owner, poolId, lpTokenAmount, and salt
     * @param permit The signed Permit2 permit allowing the router to spend LP tokens
     * @returns A Promise that resolves to the transaction hash
     * @throws {TurbineError} If the transaction fails or is reverted
     */
    async submitRemoveLiquidityTransaction(
        intent: RemoveLiquidityIntentOnchain,
        permit: SignedPermitOnchain
    ): Promise<string> {
        const { request } = await this.publicClient.simulateContract({
            address: this.config.lpRouterAddress,
            abi: turbineLiquidityRouterABI,
            functionName: "submitRemoveLiquidityIntent",
            args: [
                {
                    owner: intent.owner,
                    poolId: intent.poolId,
                    lpTokenAmount: intent.lpTokenAmount,
                    salt: intent.salt,
                },
                {
                    signature: permit.signature,
                    permit: {
                        details: {
                            token: permit.permit.details.token,
                            amount: permit.permit.details.amount,
                            expiration: permit.permit.details.expiration,
                            nonce: permit.permit.details.nonce,
                        },
                        spender: permit.permit.spender,
                        sigDeadline: permit.permit.sigDeadline,
                    },
                },
            ],
            account: this.walletClient.account!,
            chain: this.publicClient.chain!,
        });
        const txHash = await this.walletClient.writeContract(request);
        const receipt = await this.publicClient.waitForTransactionReceipt({
            hash: txHash,
        });
        if (receipt.status !== "success") {
            throw new TurbineError(
                "REMOVE_LIQUIDITY_INTENT_ONCHAIN_FAILED",
                "Remove liquidity intent onchain transaction failed",
                "The remove liquidity intent onchain transaction was reverted. Please try again."
            );
        }

        return txHash;
    }

    /**
     * Execute pending remove liquidity intents on-chain.
     * This method calls the executePendingIntents function on the TurbineLiquidityRouter contract
     * to process and execute previously submitted remove liquidity intents.
     * @param hashes An array of intent hashes to execute
     * @returns A Promise that resolves when the transaction is confirmed
     * @throws {TurbineError} If the transaction fails or is reverted
     */
    async executePendingRemoveLiquidityIntentsOnchain(hashes: Hex[]): Promise<void> {
        const { request } = await this.publicClient.simulateContract({
            address: this.config.lpRouterAddress,
            abi: turbineLiquidityRouterABI,
            functionName: "executePendingIntents",
            args: [hashes],
            account: this.walletClient.account!,
            chain: this.publicClient.chain!,
        });
        const txHash = await this.walletClient.writeContract(request);
        const receipt = await this.publicClient.waitForTransactionReceipt({
            hash: txHash,
        });
        if (receipt.status !== "success") {
            throw new TurbineError(
                "EXECUTE_PENDING_REMOVE_LIQUIDITY_INTENTS_FAILED",
                "Execute pending remove liquidity intents transaction failed",
                "The execute pending remove liquidity intents transaction was reverted. Please try again."
            );
        }
    }

    /**
     * Flush expired remove liquidity intents from the TurbineLiquidityRouter contract.
     * This method calls the flushExpiredIntents function to remove all intents that have passed their expiration time.
     * @returns A Promise that resolves when the transaction is confirmed
     * @throws {TurbineError} If the transaction fails or is reverted
     */
    async flushExpiredRemoveLiquidityIntentsOnchain(): Promise<void> {
        const { request } = await this.publicClient.simulateContract({
            address: this.config.lpRouterAddress,
            abi: turbineLiquidityRouterABI,
            functionName: "flushExpiredIntents",
            args: [],
            account: this.walletClient.account!,
            chain: this.publicClient.chain!,
        });
        const txHash = await this.walletClient.writeContract(request);
        const receipt = await this.publicClient.waitForTransactionReceipt({
            hash: txHash,
        });
        if (receipt.status !== "success") {
            throw new TurbineError(
                "FLUSH_EXPIRED_REMOVE_LIQUIDITY_INTENTS_FAILED",
                "Flush expired remove liquidity intents transaction failed",
                "The flush expired remove liquidity intents transaction was reverted. Please try again."
            );
        }
    }

    /**
     * Get the pool ID for a given token pair and fee.
     * Calls the computePoolId view function from the TurbineHook contract.
     * @param token0 The first token address
     * @param token1 The second token address
     * @param fee The pool fee in basis points
     * @returns A Promise that resolves to the pool ID as a Hex string
     */
    async getPoolId(token0: Address, token1: Address, fee: number): Promise<Hex> {
        // Call computePoolId view function from TurbineHook contract
        const { request } = await this.publicClient.simulateContract({
            address: this.config.lpHookAddress,
            abi: turbineHookABI,
            functionName: "computePoolId",
            args: [token0, token1, fee],
            account: this.walletClient.account!,
            chain: this.publicClient.chain!,
        });
        const poolId = await this.publicClient.readContract(request);
        return poolId as Hex;
    }

    /**
     * Compute the hash of a remove liquidity intent.
     * This matches the hash computation in the TurbineLiquidityRouter contract:
     * keccak256(abi.encode(intent))
     * @param intent The onchain remove liquidity intent
     * @returns The intent hash as a Hex string
     */
    computeRemoveLiquidityIntentHash(intent: RemoveLiquidityIntentOnchain): Hex {
        const encoded = encodeAbiParameters(
            [
                { name: "owner", type: "address" },
                { name: "poolId", type: "bytes32" },
                { name: "lpTokenAmount", type: "uint256" },
                { name: "salt", type: "bytes32" },
            ],
            [intent.owner, intent.poolId, intent.lpTokenAmount, intent.salt]
        );
        return keccak256(encoded);
    }

    /**
     * Create a new liquidity pool on-chain.
     * Initializes a new pool with the specified token pair and fee using the PoolManager contract.
     * @param token0 The first token address
     * @param token1 The second token address
     * @param fee The pool fee in basis points
     * @returns A Promise that resolves to the transaction hash of the pool creation
     * @throws {TurbineError} If the pool already exists or the transaction fails
     */
    async createPool(token0: Address, token1: Address, fee: number): Promise<string> {
        try {
            const poolKey = this.createPoolKey(token0, token1, fee);

            const { request } = await this.publicClient.simulateContract({
                address: this.config.poolManagerAddress,
                abi: poolManagerABI,
                functionName: "initialize",
                args: [
                    {
                        currency0: poolKey.currency0,
                        currency1: poolKey.currency1,
                        fee: poolKey.fee,
                        tickSpacing: poolKey.tickSpacing,
                        hooks: poolKey.hooks,
                    },
                    SQRT_PRICE_IDENTITY,
                ],
                account: this.walletClient.account!,
                chain: this.publicClient.chain!,
            });

            const txHash = await this.walletClient.writeContract(request);

            const receipt = await this.publicClient.waitForTransactionReceipt({
                hash: txHash,
            });
            if (receipt.status !== "success") {
                throw new TurbineError(
                    "POOL_CREATION_FAILED",
                    "Pool creation transaction failed",
                    "The pool creation transaction was reverted. Please try again."
                );
            }

            return txHash;
        } catch (err) {
            if (err instanceof BaseError) {
                const revertError = err.walk(
                    (err) => err instanceof ContractFunctionRevertedError
                );
                // 0xb3e8301e is the selector of PoolAlreadyRegistered error from Hook contract.
                // PoolManager returns it wrapped in WrappedError, which itself has a different selector.
                if (
                    revertError instanceof ContractFunctionRevertedError &&
                    revertError.raw?.includes("b3e8301e")
                ) {
                    throw new TurbineError(
                        "POOL_ALREADY_INITIALIZED",
                        "Pool already initialized.",
                        "The pool is already initialized. Please try creating a different pool."
                    );
                }
            }
            throw toTurbineError(err);
        }
    }

    /**
     * Get the settled amounts for multiple orders.
     * Retrieves order states and extracts the executed sell amounts for each order.
     * @param orderHashes An array of order hashes to check
     * @returns A Promise that resolves to an array of OrderSettledAmount objects containing order hash and executed sell amount
     */
    async getSettledAmounts(orderHashes: Hex[]): Promise<OrderSettledAmount[]> {
        let statuses = await this.getOrderStates(orderHashes);
        return statuses.map((status) => ({
            hash: status.hash,
            executedSellAmount: status.executedSellAmount,
        }));
    }

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

    /**
     * Get all registered pools from the Turbine Hook contract.
     * @returns A Promise that resolves to an array of TurbinePool objects
     */
    async getPools(): Promise<TurbinePool[]> {
        return await getPools(this.publicClient, this.config.lpHookAddress);
    }

    /**
     * Get user positions for all registered pools.
     * Returns positions where the user has a non-zero LP token balance.
     * @returns A Promise that resolves to an array of UserPosition objects
     */
    async getUserPositions(): Promise<UserPosition[]> {
        const address = await this.walletClient.getAddresses();
        return await getUserPositions(
            address[0],
            this.publicClient,
            this.config.lpHookAddress
        );
    }

    /**
     * Check if the Turbine service is available.
     * @returns A Promise that resolves to true if the service is available, or throws an error if unavailable
     */
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

    /**
     * Create add order data with Permit2 signature for non-smart orders.
     * Smart orders skip permit data as they handle their own token transfers.
     * @param intent The order intent to create data for
     * @returns A Promise that resolves to AddOrder or AddSmartOrder payload
     */
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

    /**
     * Create add liquidity data with Permit2 signatures for both tokens.
     * Converts fee to hundredths of basis points and creates batch permit signatures.
     * @param intent The liquidity addition intent
     * @returns A Promise that resolves to AddLiquidity payload with signed permits
     */
    async createAddLiquidityData(intent: AddLiquidityIntent): Promise<AddLiquidity> {
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
                amounts: [intent.token0Amount, intent.token1Amount],
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

    /**
     * Create remove liquidity data with Permit2 signature for LP token.
     * Converts fee to hundredths of basis points and creates permit signature.
     * @param intent The liquidity removal intent
     * @returns A Promise that resolves to RemoveLiquidity payload with signed permit
     */
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

    /**
     * Create remove liquidity data for onchain submission.
     * Computes the pool ID and creates the onchain intent format with Permit2 signature.
     * @param intent The liquidity removal intent
     * @returns A Promise that resolves to an object containing the onchain intent and signed permit
     */
    private async createRemoveLiquidityDataOnchain(
        intent: RemoveLiquidityIntent
    ): Promise<{ intent: RemoveLiquidityIntentOnchain; permit: SignedPermitOnchain }> {
        const poolId = await this.getPoolId(intent.token0, intent.token1, intent.fee);
        const removeLiquidityIntentOnchain: RemoveLiquidityIntentOnchain = {
            owner: intent.owner,
            poolId: poolId,
            lpTokenAmount: intent.lpTokenAmount,
            salt: intent.salt,
        };
        let deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 3); // 3 hours from now
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
            intent: removeLiquidityIntentOnchain,
            permit: {
                signature: permitSignature,
                permit: permit,
            },
        };
    }

    /**
     * Check if an order intent is a smart order.
     * Smart orders have a non-zero callDataTarget and non-empty callData.
     * @param intent The order intent to check
     * @returns true if the order is a smart order, false otherwise
     */
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
    public async ensureAuthenticated(): Promise<Address> {
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
            const end =
                start + BATCH_SIZE > numberOfPools ? numberOfPools : start + BATCH_SIZE;
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
