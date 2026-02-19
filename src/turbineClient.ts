import {
    Address,
    BaseError,
    bytesToHex,
    ContractFunctionRevertedError,
    encodeAbiParameters,
    getAddress,
    Hex,
    keccak256,
    PublicClient,
    WalletClient,
    withCache,
} from "viem";
import { createSiweMessage } from "viem/siwe";
import {
    balanceOfABI,
    turbineHookABI,
    poolManagerABI,
    turbineLiquidityRouterABI,
} from "./abi";
import { TURBINE_API_URL } from "./config";
import { TurbineCookieJar } from "./cookieJar";
import { NULL_ADDRESS, SQRT_PRICE_IDENTITY } from "./constants";
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
    SignedSignatureTransferOnchain,
    TurbineConfig,
    TurbinePool,
    UserPosition,
} from "./models";
import { getSignedAllowance } from "./permit2";
import {
    getSignedBatchSignatureTransfer,
    getSignedSignatureTransfer,
} from "./permit2SignatureTransfer";
import { buildApiUrl } from "./utils";
import * as validate from "./validation";

export class TurbineClient {
    public turbineApiUrl: string;
    public walletClient: WalletClient;
    public publicClient: PublicClient;
    public config: TurbineConfig;
    private cookieJar: TurbineCookieJar;
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
        this.cookieJar = new TurbineCookieJar();
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

    /** Fee precision constant matching the backend (1_000_000) */
    static readonly POOL_FEE_PRECISION = 1_000_000n;

    /**
     * Estimate LP tokens for initial pool mint (empty pool).
     * First mint burns minimumLiquidity to address(0).
     *
     * @param token0Amount - Amount of token0 to provide
     * @param token1Amount - Amount of token1 to provide
     * @param initialLpScale - Scaling factor for initial LP calculation (fetch via getInitialLpScale())
     * @param minimumLiquidity - Minimum liquidity burned on first mint (fetch via getMinimumLiquidity())
     * @returns LP tokens the user will receive (after minimumLiquidity burn)
     */
    static estimateInitialLpTokens(
        token0Amount: bigint,
        token1Amount: bigint,
        initialLpScale: bigint,
        minimumLiquidity: bigint
    ): bigint {
        const totalLiquidity = (token0Amount + token1Amount) * initialLpScale;
        if (totalLiquidity <= minimumLiquidity) {
            return 0n;
        }
        return totalLiquidity - minimumLiquidity;
    }

    /**
     * Estimate LP tokens for adding liquidity to a pool.
     * Handles initial mints, proportional mode, and exact mode.
     *
     * @param token0Amount - Amount of token0 to provide
     * @param token1Amount - Amount of token1 to provide
     * @param reserve0 - Current pool reserve of token0
     * @param reserve1 - Current pool reserve of token1
     * @param lpSupply - Current total LP token supply
     * @param initialLpScale - Scaling factor for initial LP calculation (fetch via getInitialLpScale())
     * @param minimumLiquidity - Minimum liquidity burned on first mint (fetch via getMinimumLiquidity())
     * @param exact - Whether to use exact mode (true) or proportional mode (false)
     * @param fee - Pool fee in hundredths of basis points (e.g., 3000 for 0.3%), required for exact mode
     * @returns Object with estimated LP tokens and actual token amounts used
     */
    static estimateLpTokens(
        token0Amount: bigint,
        token1Amount: bigint,
        reserve0: bigint,
        reserve1: bigint,
        lpSupply: bigint,
        initialLpScale: bigint,
        minimumLiquidity: bigint,
        exact: boolean = false,
        fee: number = 0
    ): { lpTokens: bigint; actualToken0: bigint; actualToken1: bigint } {
        // Initial mint case
        if (lpSupply === 0n) {
            const lpTokens = TurbineClient.estimateInitialLpTokens(
                token0Amount,
                token1Amount,
                initialLpScale,
                minimumLiquidity
            );
            return { lpTokens, actualToken0: token0Amount, actualToken1: token1Amount };
        }

        // Check if ratios are equal: token0Amount * reserve1 == reserve0 * token1Amount
        const ratiosEqual = token0Amount * reserve1 === reserve0 * token1Amount;

        if (ratiosEqual) {
            // When ratios match exactly, use direct calculation
            const lpTokens =
                reserve1 > 0n
                    ? (lpSupply * token1Amount) / reserve1
                    : (lpSupply * token0Amount) / reserve0;
            return { lpTokens, actualToken0: token0Amount, actualToken1: token1Amount };
        }

        // Determine if provided ratio is less than reserves ratio
        // provided_ratio < reserves_ratio means: token0Amount/token1Amount < reserve0/reserve1
        // which is: token0Amount * reserve1 < reserve0 * token1Amount
        const providedRatioLess = token0Amount * reserve1 < reserve0 * token1Amount;

        if (exact) {
            return TurbineClient.calculateExactLiquidity(
                token0Amount,
                token1Amount,
                reserve0,
                reserve1,
                lpSupply,
                fee,
                providedRatioLess
            );
        } else {
            return TurbineClient.calculateProportionalLiquidity(
                token0Amount,
                token1Amount,
                reserve0,
                reserve1,
                lpSupply,
                providedRatioLess
            );
        }
    }

    /**
     * Calculate LP tokens for proportional mode (exact: false).
     * Adjusts provided amounts to match the pool's reserve ratio.
     */
    private static calculateProportionalLiquidity(
        token0Amount: bigint,
        token1Amount: bigint,
        reserve0: bigint,
        reserve1: bigint,
        lpSupply: bigint,
        providedRatioLess: boolean
    ): { lpTokens: bigint; actualToken0: bigint; actualToken1: bigint } {
        let actualToken0: bigint;
        let actualToken1: bigint;
        let lpTokens: bigint;

        if (providedRatioLess) {
            // User has relatively more token1, use all of token0
            actualToken0 = token0Amount;
            actualToken1 = (token0Amount * reserve1) / reserve0;
            lpTokens =
                reserve1 > 0n
                    ? (lpSupply * actualToken1) / reserve1
                    : (lpSupply * actualToken0) / reserve0;
        } else {
            // User has relatively more token0, use all of token1
            actualToken1 = token1Amount;
            actualToken0 = (token1Amount * reserve0) / reserve1;
            lpTokens =
                reserve1 > 0n
                    ? (lpSupply * actualToken1) / reserve1
                    : (lpSupply * actualToken0) / reserve0;
        }

        return { lpTokens, actualToken0, actualToken1 };
    }

    /**
     * Calculate LP tokens for exact mode (exact: true).
     * Uses all provided amounts and applies a virtual swap fee for imbalance.
     */
    private static calculateExactLiquidity(
        token0Amount: bigint,
        token1Amount: bigint,
        reserve0: bigint,
        reserve1: bigint,
        lpSupply: bigint,
        fee: number,
        providedRatioLess: boolean
    ): { lpTokens: bigint; actualToken0: bigint; actualToken1: bigint } {
        const feeBigInt = BigInt(fee);
        const feeComplement = TurbineClient.POOL_FEE_PRECISION - feeBigInt;

        // Reserve ratio is reserve1/reserve0 (token1 per token0)
        // We represent it as numerator=reserve1, denominator=reserve0
        let effectivePriceNum: bigint;
        let effectivePriceDen: bigint;

        if (providedRatioLess) {
            // effective_price = reserve_ratio * fee_factor
            effectivePriceNum = reserve1 * feeComplement;
            effectivePriceDen = reserve0 * TurbineClient.POOL_FEE_PRECISION;
        } else {
            // effective_price = reserve_ratio / fee_factor
            effectivePriceNum = reserve1 * TurbineClient.POOL_FEE_PRECISION;
            effectivePriceDen = reserve0 * feeComplement;
        }

        // Value calculation:
        // liq_inc = lp_supply * (effective_price_num * token1 + token0 * effective_price_den)
        //                      / (effective_price_num * reserve1 + reserve0 * effective_price_den)
        const addedValue =
            effectivePriceNum * token1Amount + token0Amount * effectivePriceDen;
        const poolValue = effectivePriceNum * reserve1 + reserve0 * effectivePriceDen;

        const lpTokens = (lpSupply * addedValue) / poolValue;

        return { lpTokens, actualToken0: token0Amount, actualToken1: token1Amount };
    }

    /**
     * Get the MINIMUM_LIQUIDITY constant from the TurbineHook contract.
     * This is the amount of LP tokens burned to address(0) on the first pool mint.
     * @returns A Promise that resolves to the minimum liquidity value
     */
    async getMinimumLiquidity(): Promise<bigint> {
        const minimumLiquidity = await this.publicClient.readContract({
            address: this.config.lpHookAddress,
            abi: turbineHookABI,
            functionName: "MINIMUM_LIQUIDITY",
        });
        return minimumLiquidity as bigint;
    }

    /**
     * Get the INITIAL_LP_SCALE constant from the TurbineHook contract.
     * This is the scaling factor used for initial LP token calculation.
     * @returns A Promise that resolves to the initial LP scale value
     */
    async getInitialLpScale(): Promise<bigint> {
        const initialLpScale = await this.publicClient.readContract({
            address: this.config.lpHookAddress,
            abi: turbineHookABI,
            functionName: "INITIAL_LP_SCALE",
        });
        return initialLpScale as bigint;
    }

    /**
     * Get both liquidity constants from the TurbineHook contract in a single call.
     * @returns A Promise that resolves to an object with minimumLiquidity and initialLpScale
     */
    async getLiquidityConstants(): Promise<{
        minimumLiquidity: bigint;
        initialLpScale: bigint;
    }> {
        const [minimumLiquidity, initialLpScale] = await Promise.all([
            this.getMinimumLiquidity(),
            this.getInitialLpScale(),
        ]);
        return { minimumLiquidity, initialLpScale };
    }

    /* PRIVATE HELPER METHODS */

    /**
     * Extracts and stores cookies from fetch response headers using CookieJar.
     * No-op in browser environments (cookie jar methods are no-ops there).
     */
    private async extractAndStoreCookies(
        response: Response,
        url: string
    ): Promise<void> {
        // Use getSetCookie() for proper parsing of multiple Set-Cookie headers
        // This avoids issues with comma-separated values in Expires dates
        const setCookieHeaders = response.headers.getSetCookie
            ? response.headers.getSetCookie()
            : [];

        for (const cookie of setCookieHeaders) {
            await this.cookieJar.setCookieFromHeader(cookie, url);
        }
    }

    /**
     * Creates headers with cookies from CookieJar.
     * In browser environments, getCookieHeader returns "" (no-op), so no Cookie header is added
     * — the browser handles cookies natively via fetch credentials.
     */
    private async createHeaders(
        additionalHeaders: Record<string, string> = {},
        url: string
    ): Promise<HeadersInit> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...additionalHeaders,
        };

        const cookieHeader = await this.cookieJar.getCookieHeader(url);
        if (cookieHeader) {
            headers["Cookie"] = cookieHeader;
        }

        return headers;
    }

    /**
     * Reads response body with size limit to prevent memory exhaustion attacks.
     * Streams the response chunk-by-chunk, checking size BEFORE accumulating each chunk.
     *
     * @param response - The fetch Response object
     * @param maxSize - Maximum allowed size in bytes (default: 10 MB)
     * @returns Response with validated body
     * @throws TurbineError if response exceeds size limit
     */
    private async validateResponseSize(
        response: Response,
        maxSize: number = 10 * 1024 * 1024 // 10 MB
    ): Promise<Response> {
        const contentLength = response.headers.get("content-length");

        // Early optimization: check Content-Length header if present
        // Note: This is not relied upon for security as headers can be missing or incorrect
        if (contentLength) {
            const size = parseInt(contentLength, 10);
            if (size > maxSize) {
                throw new TurbineError(
                    "SDK_ERROR",
                    `Response size (${size} bytes) exceeds maximum allowed size (${maxSize} bytes)`
                );
            }
        }

        // Stream and validate response body chunk-by-chunk
        if (!response.body) {
            return response;
        }

        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let totalSize = 0;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // SECURITY: Check individual chunk size FIRST
                // Runtime-provided chunks could be arbitrarily large, and we must not
                // accumulate them into memory if they exceed our safety threshold
                if (value.length > maxSize) {
                    await reader.cancel();
                    throw new TurbineError(
                        "SDK_ERROR",
                        `Single response chunk (${value.length} bytes) exceeds maximum size (${maxSize} bytes)`
                    );
                }

                // Check total accumulated size BEFORE adding this chunk
                if (totalSize + value.length > maxSize) {
                    await reader.cancel();
                    throw new TurbineError(
                        "SDK_ERROR",
                        `Response size exceeds maximum allowed size (${maxSize} bytes)`
                    );
                }

                chunks.push(value);
                totalSize += value.length;
            }
        } finally {
            reader.releaseLock();
        }

        // Create a new Response from the validated chunks
        const blob = new Blob(chunks);
        return new Response(blob, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });
    }

    /**
     * Makes a fetch request with automatic cookie handling and security controls
     * In browsers: relies on credentials: "include" for automatic cookie handling
     * In Node.js: manually manages cookies via CookieJar
     *
     * Security features:
     * - HTTPS enforcement (via buildApiUrl, except localhost)
     * - 10 second request timeout
     * - Redirects disabled (returns error on redirect)
     * - Response body size limited to 10 MB
     */
    private async fetchWithCookies(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<Response> {
        const url = buildApiUrl(this.turbineApiUrl, endpoint);
        const headers = await this.createHeaders(
            options.headers as Record<string, string>,
            url
        );

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        try {
            let response = await fetch(url, {
                ...options,
                headers,
                credentials: "include",
                signal: controller.signal,
                redirect: "error", // Disable redirects - will throw on 3xx responses
            });

            // Validate response size before processing
            response = await this.validateResponseSize(response);

            await this.extractAndStoreCookies(response, url);

            return response;
        } catch (error: any) {
            // Convert AbortError to more descriptive TurbineError
            if (error.name === "AbortError") {
                throw new TurbineError(
                    "SDK_ERROR",
                    "Request timed out after 10 seconds"
                );
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
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
        intent = validate.validateOrderIntent(intent);

        const address = await this.ensureAuthenticated();
        if (getAddress(address) !== getAddress(intent.owner)) {
            throw new TurbineError(
                "UNAUTHORIZED",
                "Authenticated user does not match order owner."
            );
        }

        try {
            const payload = await this.createAddOrderData(intent);
            const response = await this.callApiEndpoint(payload, "add_order");

            if (!response.ok) {
                throw await unsuccessfulResponseToTurbineError(response);
            }

            const responseJson = await response.json();

            // Validate response
            validate.validateObject(responseJson, "addOrder response");
            if (!("orderHash" in responseJson)) {
                throw new TurbineError(
                    "UNEXPECTED_ADD_ORDER_RESPONSE",
                    "Order was submitted but confirmation is missing. Please check your orders to verify if it was processed.",
                    responseJson
                );
            }

            const orderHash = validate.validateHash(
                responseJson["orderHash"],
                "addOrder response.orderHash"
            );
            return orderHash;
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
        // Validate array is non-empty and validate each intent
        intents = validate.validateNonEmptyArray(
            intents,
            "addOrders intents",
            (intent, _) => validate.validateOrderIntent(intent)
        );

        const address = await this.ensureAuthenticated();
        if (
            intents.some((intent) => getAddress(intent.owner) !== getAddress(address))
        ) {
            throw new TurbineError(
                "UNAUTHORIZED",
                "Authenticated user does not match some of the orders' owner."
            );
        }

        try {
            const payloads = await Promise.all(
                intents.map((intent) => this.createAddOrderData(intent))
            );
            const response = await this.callApiEndpoint(payloads, "add_orders");

            if (!response.ok) {
                throw await unsuccessfulResponseToTurbineError(response);
            }

            const responseJson = await response.json();

            // Validate response is a non-empty array
            if (!Array.isArray(responseJson) || responseJson.length === 0) {
                throw new TurbineError(
                    "UNEXPECTED_ADD_ORDER_RESPONSE",
                    "Orders were submitted but confirmations are missing. Please check your orders to verify if they were processed.",
                    responseJson
                );
            }

            // Validate each order hash in the response
            return responseJson.map((order: any, index: number) => {
                validate.validateObject(order, `addOrders response.orders[${index}]`);
                return validate.validateHash(
                    order.orderHash,
                    `addOrders response.orders[${index}].orderHash`
                );
            });
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
        intent = validate.validateAddLiquidityIntent(intent);

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
        intent = validate.validateRemoveLiquidityIntent(intent);

        const address = await this.ensureAuthenticated();
        if (getAddress(intent.owner) !== getAddress(address)) {
            throw new TurbineError(
                "UNAUTHORIZED",
                "Authenticated user does not match the intent owner."
            );
        }

        try {
            const payload = await this.createRemoveLiquidityData(intent);
            const response = await this.callApiEndpoint(payload, "remove_liquidity");

            if (!response.ok) {
                throw await unsuccessfulResponseToTurbineError(response);
            }

            const responseJson = await response.json();

            if (!responseJson || !responseJson["intentHash"]) {
                throw new TurbineError(
                    "UNEXPECTED_REMOVE_LIQUIDITY_RESPONSE",
                    "Liquidity removal was submitted but confirmation is missing. Please check your transactions to verify if it was processed.",
                    responseJson
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
    async cancelOrder(orderHash: Hex): Promise<{ orderHash: string }> {
        orderHash = validate.validateHash(orderHash, "orderHash");

        await this.ensureAuthenticated();

        try {
            const payload: CancelOrderPayload = {
                orderHash: orderHash,
            };

            const response = await this.callApiEndpoint(payload, "cancel_order");

            if (!response.ok) {
                throw await unsuccessfulResponseToTurbineError(response);
            }

            const responseJson = await response.json();

            validate.validateObject(responseJson, "cancelOrder response");
            if (!responseJson || !responseJson.orderHash) {
                throw new TurbineError(
                    "UNEXPECTED_CANCELLATION_RESPONSE",
                    "Order cancellation was submitted but confirmation is missing. Please check your orders to verify if it was processed.",
                    responseJson
                );
            }

            const responseOrderHash = validate.validateHash(
                responseJson.orderHash,
                "cancelOrder response.orderHash"
            );

            return { orderHash: responseOrderHash };
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
        orderHashes = validate.validateNonEmptyArray(
            orderHashes,
            "getOrderStates orderHashes",
            (hash, index) =>
                validate.validateHash(hash, `getOrderStates orderHashes[${index}]`)
        );

        await this.ensureAuthenticated();

        try {
            const payload: GetOrderStatesPayload = {
                orderHashes: orderHashes,
            };

            const response = await this.callApiEndpoint(payload, "order_states");

            if (!response.ok) {
                throw await unsuccessfulResponseToTurbineError(response);
            }

            const responseJson = await response.json();

            if (!Array.isArray(responseJson)) {
                throw new TurbineError(
                    "INVALID_RESPONSE",
                    "Received unexpected response format from server. Please try again later.",
                    responseJson
                );
            }

            // Validate each order state response structure before parsing
            validate.validateArray(responseJson, "orderStates", (orderState) => {
                validate.validateOrderStateResponse(orderState);
            });

            const orderStatesPromises = responseJson.map((orderState: any) =>
                this.parseOrderState(orderState)
            );
            const orderStates = await Promise.all(orderStatesPromises);
            return orderStates;
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
        const orderHashes = validate.validateNonEmptyArray(
            intentHashes,
            "getLiquidityIntents intentHashes",
            (hash, index) => validate.validateHash(hash, `intentHashes[${index}]`)
        );
        await this.ensureAuthenticated();

        try {
            const response = await this.fetchWithCookies("liquidity_intent_states", {
                method: "POST",
                body: JSON.stringify({ intentHashes: orderHashes }),
            });

            if (!response.ok) {
                throw await unsuccessfulResponseToTurbineError(response);
            }

            const responseJson = await response.json();

            // Validate each liquidity intent state response before parsing
            validate.validateArray(responseJson, "liquidityIntentStates", (state) => {
                validate.validateLiquidityIntentStateResponse(state);
            });

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
        validate.validateAddLiquidityPayload(payload);
        const address = await this.ensureAuthenticated();

        // Validate that the owner in the payload matches the authenticated address
        if (getAddress(payload.addLiquidity.owner) !== getAddress(address)) {
            throw new TurbineError(
                "UNAUTHORIZED",
                "Authenticated user does not match the intent owner."
            );
        }

        try {
            const response = await this.callApiEndpoint(payload, "add_liquidity");

            if (!response.ok) {
                throw await unsuccessfulResponseToTurbineError(response);
            }

            const responseJson = await response.json();

            if (!responseJson || !responseJson["intentHash"]) {
                throw new TurbineError(
                    "UNEXPECTED_ADD_LIQUIDITY_RESPONSE",
                    "Liquidity addition was submitted but confirmation is missing. Please check your transactions to verify if it was processed.",
                    responseJson
                );
            }

            return validate.validateHash(
                responseJson["intentHash"],
                "addLiquidity response.intentHash"
            );
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
        validate.validateRemoveLiquidityIntent(intent);

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

            validate.validateHash(txHash, "txHash");
            validate.validateHash(intentHash, "intentHash");

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
        permit: SignedSignatureTransferOnchain
    ): Promise<string> {
        validate.validateRemoveLiquidityIntentOnchain(intent);
        validate.validateSignedSignatureTransferOnchain(permit);

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
                        permitted: {
                            token: permit.permit.permitted.token,
                            amount: permit.permit.permitted.amount,
                        },
                        nonce: permit.permit.nonce,
                        deadline: permit.permit.deadline,
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
                "The remove liquidity intent onchain transaction was reverted. Please try again.",
                receipt
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
        const orderHashes = validate.validateNonEmptyArray(
            hashes,
            "executePendingRemoveLiquidityIntentsOnchain hashes",
            (hash, index) => validate.validateHash(hash, `hashes[${index}]`)
        );

        const { request } = await this.publicClient.simulateContract({
            address: this.config.lpRouterAddress,
            abi: turbineLiquidityRouterABI,
            functionName: "executePendingIntents",
            args: [orderHashes],
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
                "The execute pending remove liquidity intents transaction was reverted. Please try again.",
                receipt
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
                "The flush expired remove liquidity intents transaction was reverted. Please try again.",
                receipt
            );
        }
    }

    /**
     * Get the pool ID for a given token pair and fee.
     * Calls the computePoolId view function from the TurbineHook contract.
     * @param token0 The first token address
     * @param token1 The second token address
     * @param fee The pool fee in hundredths of basis point
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

        validate.validateHash(poolId, "poolId");

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
        validate.validateRemoveLiquidityIntentOnchain(intent);

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
     * @param fee The pool fee in hundredths of basis point
     * @returns A Promise that resolves to the transaction hash of the pool creation
     * @throws {TurbineError} If the pool already exists or the transaction fails
     */
    async createPool(token0: Address, token1: Address, fee: number): Promise<string> {
        const validatedToken0 = validate.validateAddress(token0, "token0");
        const validatedToken1 = validate.validateAddress(token1, "token1");
        const validatedFee = validate.validateFee(fee, "fee");

        validate.validateTokenPair(validatedToken0, validatedToken1);

        try {
            const poolKey = this.createPoolKey(
                validatedToken0,
                validatedToken1,
                validatedFee
            );

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
                    "The pool creation transaction failed. Please try again.",
                    receipt
                );
            }

            return validate.validateHash(txHash, "txHash");
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
                        "The pool is already initialized. Please try creating a different pool.",
                        revertError
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
        orderHashes = validate.validateNonEmptyArray(
            orderHashes,
            "getSettledAmounts orderHashes",
            (hash, index) => validate.validateHash(hash, `orderHashes[${index}]`)
        );

        let states = await this.getOrderStates(orderHashes);
        return states.map((state) => ({
            hash: validate.validateHash(state.hash, "state.hash"),
            executedSellAmount: validate.validateBigInt(
                state.executedSellAmount,
                "state.executedSellAmount"
            ),
        }));
    }

    /**
     * Get the fee for a prospective order.
     * @param intent The intent for which to get the fee
     * @returns A Promise that resolves to a bigint containing the fee expressed in absolute amount of the buy token.
     */
    async getOrderFee(intent: OrderIntent): Promise<bigint> {
        intent = validate.validateOrderIntent(intent);

        try {
            const response = await this.fetchWithCookies("order_fees", {
                method: "POST",
                body: JSON.stringify(intent, bigIntReplacer),
            });

            if (!response.ok) {
                throw await unsuccessfulResponseToTurbineError(response);
            }

            const feeJson = await response.json();
            validate.validateString(feeJson, "feeJson");
            return validate.validateBigIntConvertible(feeJson, "feeJson");
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
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 minutes from now
        const { permit, permitSignature } = await getSignedBatchSignatureTransfer({
            tokens: [intent.token0, intent.token1],
            amounts: [intent.token0Amount, intent.token1Amount],
            walletClient: this.walletClient,
            publicClient: this.publicClient,
            deadline,
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
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 minutes from now
        const { permit, permitSignature } = await getSignedSignatureTransfer({
            token: intent.lpToken,
            amount: intent.lpTokenAmount,
            walletClient: this.walletClient,
            publicClient: this.publicClient,
            deadline,
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
    ): Promise<{
        intent: RemoveLiquidityIntentOnchain;
        permit: SignedSignatureTransferOnchain;
    }> {
        const poolId = await this.getPoolId(intent.token0, intent.token1, intent.fee);
        const removeLiquidityIntentOnchain: RemoveLiquidityIntentOnchain = {
            owner: intent.owner,
            poolId: poolId,
            lpTokenAmount: intent.lpTokenAmount,
            salt: intent.salt,
        };
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 3); // 3 hours from now
        const { permit, permitSignature } = await getSignedSignatureTransfer({
            token: intent.lpToken,
            amount: intent.lpTokenAmount,
            walletClient: this.walletClient,
            publicClient: this.publicClient,
            deadline,
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
            const nonceResponse = await this.fetchWithCookies("nonce", {
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
            const verifyResponse = await this.fetchWithCookies("verify", {
                method: "POST",
                body: JSON.stringify({
                    message,
                    signature: structuredSignature,
                }),
            });

            if (!verifyResponse.ok) {
                throw await unsuccessfulResponseToTurbineError(verifyResponse);
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
            const response = await this.fetchWithCookies("me");
            if (!response.ok) {
                return { authenticated: false };
            }
            const data = await response.json();

            validate.validateObject(data, "authStatus response");
            validate.validateBoolean(data.authenticated, "authenticated");

            if (data.authenticated) {
                if (!("address" in data)) {
                    throw new TurbineError(
                        "INVALID_RESPONSE",
                        "authStatus response missing address field when authenticated is true",
                        data
                    );
                }
                validate.validateAddress(data.address, "address");
            }

            return {
                authenticated: data.authenticated,
                address: data.address,
            };
        } catch (error) {
            console.error(error);
            return { authenticated: false };
        }
    }

    /**
     * Logout and clear the current session.
     */
    async logout(): Promise<void> {
        try {
            await this.fetchWithCookies("logout", { method: "POST" });
            // Clear all cookies from jar
            await this.cookieJar.clear();
        } catch (error) {
            // Still clear cookies even if server request fails
            await this.cookieJar.clear();
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
        // Fetch current wallet address once at the start
        const [currentAddress] = await this.walletClient.getAddresses();
        const walletAddress = getAddress(currentAddress);

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
            const response = await this.fetchWithCookies("me");
            if (response.ok) {
                const authStatus = await response.json();
                if (authStatus.authenticated && authStatus.address) {
                    const sessionAddress = getAddress(authStatus.address);

                    if (sessionAddress === walletAddress) {
                        return authStatus.address;
                    }
                    // If wallet changed, fall through to re-authenticate
                }
            }
        }

        this.authenticationInProgress = true;

        try {
            const response = await this.fetchWithCookies("me");

            if (response.ok) {
                const authStatus = await response.json();
                if (authStatus.authenticated && authStatus.address) {
                    const sessionAddress = getAddress(authStatus.address);

                    if (sessionAddress !== walletAddress) {
                        // Wallet changed - logout old session and re-authenticate
                        console.warn(
                            `Wallet address changed from ${sessionAddress} to ${walletAddress}. ` +
                                `Logging out old session and re-authenticating.`
                        );
                        await this.logout();
                        // Fall through to authenticate with new wallet
                    } else {
                        return authStatus.address;
                    }
                }
            }

            await this.authenticate();

            const retryResponse = await this.fetchWithCookies("/me");
            if (!retryResponse.ok) {
                throw await unsuccessfulResponseToTurbineError(retryResponse);
            }
            const retryAuthStatus = await retryResponse.json();

            if (!retryAuthStatus.authenticated || !retryAuthStatus.address) {
                throw new TurbineError(
                    "AUTHENTICATION_FAILED",
                    "Unable to authenticate with your wallet. Please try again.",
                    retryAuthStatus
                );
            }

            return retryAuthStatus.address;
        } catch (error: any) {
            if (error instanceof TurbineError) {
                throw error;
            }

            // If it's already a detailed authentication error, preserve it
            if (error.message && error.message.includes("Authentication failed:")) {
                throw new TurbineError("AUTHENTICATION_ERROR", error.message);
            }

            throw new TurbineError(
                "AUTHENTICATION_ERROR",
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
        return await this.fetchWithCookies(endpoint, {
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
    private async parseOrderState(orderState: any): Promise<OrderState> {
        const executionsPromises = orderState.execution.map(async (exec: any) => ({
            txHash: exec.tx_hash,
            clearedAt: new Date(
                (await this.getBlockTimestamp(Number(exec.block_number))) * 1000
            ),
            soldAmount: BigInt(exec.sold_amount),
            boughtAmount: BigInt(exec.bought_amount),
            surplusBoughtAmount: BigInt(exec.surplus_buy_amount),
        }));
        const executions = await Promise.all(executionsPromises);
        return {
            hash: orderState.hash,
            status: orderState.status,
            execution: executions,
            executedSellAmount: executions.reduce(
                (acc, exec) => acc + exec.soldAmount,
                0n
            ),
            executedBuyAmount: executions.reduce(
                (acc, exec) => acc + exec.boughtAmount,
                0n
            ),
        } as OrderState;
    }

    /**
     * Convert viem signature hex string to structured format expected by Turbine API
     */
    private parseSignature(signature: Hex): any {
        // Validate signature format (0x + 130 hex chars = 65 bytes)
        validate.validateSignatureHex(signature, "signature");

        // Convert to bytes and parse components
        const sigBytes = validate.hexToSignature(signature);
        const { r, s, v } = validate.parseSignatureBytes(sigBytes);

        // Convert components to hex format expected by API
        const rHex = bytesToHex(r);
        const sHex = bytesToHex(s);

        // Convert v (27/28) to yParity (0/1)
        const yParity = v === 28 ? "0x1" : "0x0";

        return {
            r: rHex,
            s: sHex,
            yParity: yParity,
            v: `0x${v.toString(16)}`,
        };
    }

    private async getBlockTimestamp(blockNumber: number): Promise<number> {
        return await withCache(
            () =>
                this.publicClient
                    .getBlock({ blockNumber: BigInt(blockNumber) })
                    .then((block) => Number(block.timestamp)),
            {
                cacheKey: `blockTimestamp.${this.publicClient.uid}.${blockNumber}`,
                cacheTime: Number.POSITIVE_INFINITY,
            }
        );
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

        validate.validateBigInt(numberOfPools, "numberOfPools");

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

        // Validate each pool data before mapping
        poolsData.forEach((poolData, index) => {
            validate.validatePoolData(poolData, index);
        });

        return poolsData.map(
            (poolData: any) =>
                ({
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
                }) as TurbinePool
        );
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

            // Validate balance result structure
            try {
                validate.validateBalanceResult(balanceResult, `balanceResults[${i}]`);
            } catch (error) {
                // Log warning for invalid balance result but continue processing
                console.warn(
                    `Invalid balance result for LP token ${pool.metadata.lpToken}: ${error instanceof Error ? error.message : "Unknown error"}`
                );
                continue;
            }

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
 * Fetch configuration from the Turbine API endpoint.
 * @param turbineApiUrl The base URL of the Turbine API
 * @returns A Promise that resolves to the TurbineConfig
 */
export async function fetchConfig(turbineApiUrl: string): Promise<TurbineConfig> {
    try {
        const response = await fetch(buildApiUrl(turbineApiUrl, "config"));
        if (!response.ok) {
            throw await unsuccessfulResponseToTurbineError(response);
        }
        const config = await response.json();

        validate.validateTurbineConfig(config);

        return config;
    } catch (error: any) {
        console.log(error);
        throw new TurbineError(
            "CONFIG_FETCH_FAILED",
            "Unable to fetch configuration. Please try again later.",
            error
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
        const response = await fetch(buildApiUrl(turbineApiUrl, "status"));
        if (!response.ok) {
            throw await unsuccessfulResponseToTurbineError(response);
        }
        return true;
    } catch (error: any) {
        throw new TurbineError(
            "SERVICE_UNAVAILABLE",
            "Turbine is currently unavailable. Try again later.",
            error
        );
    }
}

// Returns random bytes32 as a hex string
export function getRandomSalt(): Hex {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    return bytesToHex(randomBytes);
}

export function convertSignature(sig: Hex): PrimitiveSignature {
    const validatedSig = validate.validateSignatureHex(sig, "signature");

    // Convert hex signature to bytes and extract components
    const sigBytes = validate.hexToSignature(validatedSig);
    return validate.signatureToComponents(sigBytes);
}

/** Helps serializing BigInts into JSON */
function bigIntReplacer(_key: string, value: any): any {
    if (typeof value === "bigint") {
        return `0x${value.toString(16)}`;
    }
    return value;
}
