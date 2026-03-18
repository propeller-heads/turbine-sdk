import { Address, Hex, WalletClient, PublicClient } from 'viem';

interface TurbineConfig {
    turbineSettlerAddress: Address;
    lpHookAddress: Address;
    lpRouterAddress: Address;
    poolManagerAddress: Address;
    submitSettlements: boolean;
    siweDomain: string;
    siweUri: string;
}
declare class Token {
    address: Address;
    decimals: number;
    symbol: string;
    constructor(address: Address, decimals: number, symbol: string);
    /**
     * Converts a human-readable amount to on-chain atomic units (bigint).
     * Uses string input to preserve full precision without floating-point errors.
     *
     * @param amount - The amount as a string (e.g., "100.5" for 100.5 tokens)
     * @returns The amount in atomic units as a bigint
     *
     * @example
     * const usdc = new Token("0x...", 6, "USDC");
     * usdc.toOnchainAmount("100.5"); // Returns 100500000n
     */
    toOnchainAmount(amount: string): bigint;
    /**
     * Converts an on-chain amount (in atomic units) to a human-readable string.
     * Returns a string to preserve full precision without floating-point errors.
     *
     * @param amount - The amount in atomic units as a bigint
     * @returns The amount as a decimal string
     *
     * @example
     * const usdc = new Token("0x...", 6, "USDC");
     * usdc.fromOnchainAmount(100500000n); // Returns "100.5"
     */
    fromOnchainAmount(amount: bigint): string;
    equals(other: Token): boolean;
    toString(): string;
}
interface PermitDetails {
    token: Address;
    amount: bigint;
    expiration: number;
    nonce: number;
}
interface AllowanceTransferPermitSingle {
    details: PermitDetails;
    spender: Address;
    sigDeadline: bigint;
}
interface AllowanceTransferPermitBatch {
    details: PermitDetails[];
    spender: Address;
    sigDeadline: bigint;
}
interface PrimitiveSignature {
    r: bigint;
    s: bigint;
    yParity: boolean;
}
interface TokenPermissions {
    token: Address;
    amount: bigint;
}
/**
 * Mirror of Permit2's ISignatureTransfer.PermitTransferFrom (but used for EIP-712 signing with an
 * extra spender field in the typed data, not in this struct).
 */
interface SignatureTransferPermitTransferFrom {
    permitted: TokenPermissions;
    nonce: bigint;
    deadline: bigint;
}
/**
 * Mirror of Permit2's ISignatureTransfer.PermitBatchTransferFrom (but used for EIP-712 signing with an
 * extra spender field in the typed data, not in this struct).
 */
interface SignatureTransferPermitBatchTransferFrom {
    permitted: TokenPermissions[];
    nonce: bigint;
    deadline: bigint;
}
interface SignedSignatureTransfer {
    signature: PrimitiveSignature;
    permit: SignatureTransferPermitTransferFrom;
}
interface SignedBatchSignatureTransfer {
    signature: PrimitiveSignature;
    permit: SignatureTransferPermitBatchTransferFrom;
}
interface SignedSignatureTransferOnchain {
    signature: Hex;
    permit: SignatureTransferPermitTransferFrom;
}
interface SignedPermit {
    signature: PrimitiveSignature;
    permit: AllowanceTransferPermitSingle;
}
interface SignedPermitOnchain {
    signature: Hex;
    permit: AllowanceTransferPermitSingle;
}
interface SignedPermitBatch {
    signature: PrimitiveSignature;
    permit: AllowanceTransferPermitBatch;
}
/**
 * Full struct to be sent to Turbine API to submit an order
 */
interface AddOrder {
    order: OrderIntent;
    signedPermit: SignedPermit;
}
/**
 * Struct to be sent to Turbine API to submit a smart order, which doesn't require permit data
 */
interface AddSmartOrder {
    order: OrderIntent;
}
/**
 * A swap order created by a user.
 */
interface OrderIntent {
    /** Address of the swapper */
    owner: Address;
    /** Address of sell token */
    sellToken: Address;
    /** Address of buy token */
    buyToken: Address;
    /** Sell amount */
    sellAmount: bigint;
    /** Minimum buy amount, effectively defining limit price. */
    minBuyAmount: bigint;
    /**
     * Allowed deviation from the mid-price delta in basis points.
     * E.g. 1% (100 basis points) mid-price delta means that the trade will be executed
     * at a price at most 1% worse than mid-price.
     */
    midPriceDelta: number;
    /**
     * Unix timestamp since when the order is valid.
     * Note: only immediately valid orders are supported for now.
     */
    startTime: bigint;
    /** Unix timestamp until when the order is valid. */
    endTime: bigint;
    /** Flag allowing partial fills */
    partialFill: boolean;
    /** Optional call data for smart orders, allowing custom routing */
    callData: Hex;
    /** Address of the target contract for the calldata */
    callDataTarget: Address;
    /** Used to differentiate between orders with the same parameters */
    salt: Hex;
}
/**
 * Represents a liquidity addition with permit functionality.
 *
 * This struct encapsulates all necessary information needed to submit a new intent to add
 * liquidity to the system, including the intent, its signature, and the permit data for approvals.
 */
interface AddLiquidity {
    /** The intent to add liquidity */
    addLiquidity: AddLiquidityIntent;
    /** The Permit2 SignatureTransfer batch permit and signature for token0 and token1 */
    permitTokens: SignedBatchSignatureTransfer;
}
/**
 * A struct for the intent to add liquidity that user signs
 */
interface AddLiquidityIntent {
    /** The account providing the liquidity */
    owner: Address;
    /** token0 of the pool to which the liquidity is provided */
    token0: Address;
    /** token1 of the pool to which the liquidity is provided */
    token1: Address;
    /** fee of the pool to which the liquidity is provided, in BIPs (30=0.3%) */
    fee: number;
    /**
     * Amount of token0 to provide. Can be 0 for single-sided liquidity addition
     * (requires token1Amount > 0).
     */
    token0Amount: bigint;
    /**
     * Amount of token1 to provide. Can be 0 for single-sided liquidity addition
     * (requires token0Amount > 0).
     */
    token1Amount: bigint;
    /** Whether the user wants to provide exactly the specified amounts (and is willing to
     * pay a swap fee first) or would rather like to provide liquidity in current ratio of pool
     * reserves (in such case the specified token amounts are treated as maximum amounts). */
    exact: boolean;
    /** Arbitrary value differentiating intents whose other fields are the same */
    salt: Hex;
}
/**
 * Represents a liquidity removal with permit functionality.
 *
 * This struct encapsulates all necessary information needed to submit a new intent to remove
 * liquidity to the system, including the intent, its signature, and the permit data for approvals.
 */
interface RemoveLiquidity {
    /** The intent to remove liquidity */
    removeLiquidity: RemoveLiquidityIntent;
    /** The Permit2 SignatureTransfer permit and signature for the LP token */
    permitLpToken: SignedSignatureTransfer;
}
/**
 * A struct for the intent to remove liquidity that user signs
 */
interface RemoveLiquidityIntent {
    /** The account withdrawing the liquidity */
    owner: Address;
    /** token0 of the pool to which the liquidity is withdrawn */
    token0: Address;
    /** token1 of the pool to which the liquidity is withdrawing */
    token1: Address;
    /** fee of the pool to which the liquidity is withdrawing, in hundredths of basis point (3000=0.3%) */
    fee: number;
    /** Address of the LP token that the user wants to burn. */
    lpToken: Address;
    /** Quantity of LP tokens that the user wants to burn. */
    lpTokenAmount: bigint;
    /** Arbitrary value differentiating intents whose other fields are the same */
    salt: Hex;
}
/**
 * A struct for the intent to remove liquidity that user signs
 */
interface RemoveLiquidityIntentOnchain {
    /** The account withdrawing the liquidity */
    owner: Address;
    /** The identifier of the pool from which liquidity should be removed. */
    poolId: Hex;
    /** Amount of LP tokens to burn for withdrawal. */
    lpTokenAmount: bigint;
    /** Arbitrary user-provided salt to make the intent hash unique. */
    salt: Hex;
}
interface TurbinePool {
    metadata: {
        token0: Address;
        token1: Address;
        fee: number;
        lpToken: Address;
    };
    state: {
        reserve0: bigint;
        reserve1: bigint;
        liquidity: bigint;
    };
    stats: {
        weeklySellVolumeToken0: bigint;
        weeklySellVolumeToken1: bigint;
    };
}
interface UserPosition {
    poolMetadata: {
        token0: Address;
        token1: Address;
        fee: number;
        lpToken: Address;
    };
    userAddress: Address;
    lpTokenBalance: bigint;
}
/**
 * Represents the limit price of an order
 */
interface Price {
    numerator: bigint;
    denominator: bigint;
}
/**
 * Represents an order as returned by the order status endpoint
 */
interface OrderStatusOrder {
    hash: Hex;
    owner: Address;
    sellToken: Address;
    buyToken: Address;
    startTime: bigint;
    endTime: bigint;
    partialFill: boolean;
    salt: Hex;
    createdTimestamp: string;
    callData: Hex;
    callDataTarget: Address;
    sellAmount: bigint;
    executedSellAmount: bigint;
    midPriceDelta: number;
    limitPrice: Price;
}
/**
 * Represents a single, possibly partial, execution of an order
 */
interface OrderExecution {
    txHash: Hex;
    clearedAt: Date;
    soldAmount: bigint;
    boughtAmount: bigint;
    surplusBoughtAmount: bigint;
}
/**
 * Represents the status of an order
 */
interface OrderState {
    hash: Hex;
    status: string;
    execution: OrderExecution[];
    executedSellAmount: bigint;
    executedBuyAmount: bigint;
}
declare enum LiquidityIntentStatus {
    Pending = "Pending",
    Invalid = "Invalid",
    Expired = "Expired",
    Executed = "Executed",
    PendingCancellation = "PendingCancellation",
    Canceled = "Canceled"
}
/**
 * Represents the state of a liquidity intent
 */
interface LiquidityIntentState {
    hash: Hex;
    status: LiquidityIntentStatus;
}
interface OrderSettledAmount {
    hash: Hex;
    executedSellAmount: bigint;
}
/**
 * Payload for cancelling an order
 */
interface CancelOrderPayload {
    orderHash: Hex;
}
/**
 * Payload for getting order statuses
 */
interface GetOrderStatesPayload {
    orderHashes: Hex[];
}
/**
 * PoolKey
 */
interface PoolKey {
    /** Lower-address token of the pair (must be lexicographically < token1) */
    currency0: Address;
    /** Higher-address token of the pair */
    currency1: Address;
    /** Pool LP fee in hundredths of a bip (uint24 onchain) */
    fee: number;
    /** Tick spacing used for liquidity positions (int24 onchain) */
    tickSpacing: number;
    /** Address of the hooks contract (Turbine Hook) */
    hooks: Address;
}

declare class TurbineClient {
    turbineApiUrl: string;
    walletClient: WalletClient;
    publicClient: PublicClient;
    config: TurbineConfig;
    private cookieJar;
    private authenticationInProgress;
    private constructor();
    /**
     * Creates a new TurbineClient instance with configuration fetched from the API
     * @param walletClient The wallet client for signing transactions
     * @param publicClient The public client for reading blockchain data
     * @param turbineApiUrl Optional API URL (defaults to TURBINE_API_URL)
     * @returns Promise that resolves to a configured TurbineClient instance
     */
    static create(walletClient: WalletClient, publicClient: PublicClient, turbineApiUrl?: string): Promise<TurbineClient>;
    /** Fee precision constant matching the backend (1_000_000) */
    static readonly POOL_FEE_PRECISION = 1000000n;
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
    static estimateInitialLpTokens(token0Amount: bigint, token1Amount: bigint, initialLpScale: bigint, minimumLiquidity: bigint): bigint;
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
    static estimateLpTokens(token0Amount: bigint, token1Amount: bigint, reserve0: bigint, reserve1: bigint, lpSupply: bigint, initialLpScale: bigint, minimumLiquidity: bigint, exact?: boolean, fee?: number): {
        lpTokens: bigint;
        actualToken0: bigint;
        actualToken1: bigint;
    };
    /**
     * Calculate LP tokens for proportional mode (exact: false).
     * Adjusts provided amounts to match the pool's reserve ratio.
     */
    private static calculateProportionalLiquidity;
    /**
     * Calculate LP tokens for exact mode (exact: true).
     * Uses all provided amounts and applies a virtual swap fee for imbalance.
     */
    private static calculateExactLiquidity;
    /**
     * Get the MINIMUM_LIQUIDITY constant from the TurbineHook contract.
     * This is the amount of LP tokens burned to address(0) on the first pool mint.
     * @returns A Promise that resolves to the minimum liquidity value
     */
    getMinimumLiquidity(): Promise<bigint>;
    /**
     * Get the INITIAL_LP_SCALE constant from the TurbineHook contract.
     * This is the scaling factor used for initial LP token calculation.
     * @returns A Promise that resolves to the initial LP scale value
     */
    getInitialLpScale(): Promise<bigint>;
    /**
     * Get both liquidity constants from the TurbineHook contract in a single call.
     * @returns A Promise that resolves to an object with minimumLiquidity and initialLpScale
     */
    getLiquidityConstants(): Promise<{
        minimumLiquidity: bigint;
        initialLpScale: bigint;
    }>;
    /**
     * Extracts and stores cookies from fetch response headers using CookieJar.
     * No-op in browser environments (cookie jar methods are no-ops there).
     */
    private extractAndStoreCookies;
    /**
     * Creates headers with cookies from CookieJar.
     * In browser environments, getCookieHeader returns "" (no-op), so no Cookie header is added
     * — the browser handles cookies natively via fetch credentials.
     */
    private createHeaders;
    /**
     * Reads response body with size limit to prevent memory exhaustion attacks.
     * Streams the response chunk-by-chunk, checking size BEFORE accumulating each chunk.
     *
     * @param response - The fetch Response object
     * @param maxSize - Maximum allowed size in bytes (default: 10 MB)
     * @returns Response with validated body
     * @throws TurbineError if response exceeds size limit
     */
    private validateResponseSize;
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
    private fetchWithCookies;
    private createPoolKey;
    /**
     * Add an order to the Turbine API.
     * @param intent An `OrderIntent` object containing the details of the trade to be executed
     * @returns A Promise that resolves to a string containing the submitted order hash.
     */
    addOrder(intent: OrderIntent): Promise<string>;
    /**
     * Add an array of orders to the Turbine API.
     * @param intents An array of `OrderIntent` objects containing the details of the trades to be executed
     * @returns A Promise that resolves to an array of strings containing the submitted order hashes.
     */
    addOrders(intents: OrderIntent[]): Promise<string[]>;
    /**
     * Add a liquidity addition intent to the Turbine API.
     * @param intent The intent to add liquidity
     * @returns A Promise that resolves to a string containing the submitted intent hash.
     */
    addLiquidity(intent: AddLiquidityIntent): Promise<string>;
    /**
     * Add a liquidity removal intent to the Turbine API.
     * @param intent The intent to remove liquidity
     * @returns A Promise that resolves to a string containing the submitted intent hash.
     */
    removeLiquidity(intent: RemoveLiquidityIntent): Promise<string>;
    /**
     * Cancel an order from the Turbine API.
     * @param orderHash The hash of the order to cancel
     * @returns A Promise that resolves to the response message from the API.
     */
    cancelOrder(orderHash: Hex): Promise<{
        orderHash: string;
    }>;
    /**
     * Get the status of multiple orders by their hashes.
     * @param orderHashes An array of order hashes to check
     * @returns A Promise that resolves to an array of `OrderState` objects.
     */
    getOrderStates(orderHashes: Hex[]): Promise<OrderState[]>;
    /**
     * Get the state of multiple liquidity intents by their hashes.
     * @param intentHashes An array of liquidity intent hashes to check
     * @returns A Promise that resolves to an array of liquidity intent state objects.
     */
    getLiquidityIntents(intentHashes: Hex[]): Promise<LiquidityIntentState[]>;
    /**
     * Add liquidity using pre-signed permit data.
     * This method is used when permit data has already been created via createAddLiquidityData()
     * and the pool has been created. It submits the liquidity intent to Turbine without requiring
     * additional Permit2 signatures.
     *
     * @param payload The AddLiquidity payload containing the intent and pre-signed permit data
     * @returns A Promise that resolves to a string containing the submitted intent hash.
     */
    addLiquidityWithSignedPermit(payload: AddLiquidity): Promise<string>;
    /**
     * Submit a liquidity removal intent directly on-chain.
     * This method creates the onchain intent data and permit, then submits it to the TurbineLiquidityRouter contract.
     * @param intent The intent to remove liquidity
     * @returns A Promise that resolves to the transaction hash and intent hash of the submitted intent
     */
    submitRemoveLiquidityIntentOnchain(intent: RemoveLiquidityIntent): Promise<{
        txHash: string;
        intentHash: Hex;
    }>;
    /**
     * Submit a remove liquidity intent directly to the TurbineLiquidityRouter contract on-chain.
     * This method simulates the contract call, writes the transaction, and waits for confirmation.
     * @param intent The onchain remove liquidity intent containing owner, poolId, lpTokenAmount, and salt
     * @param permit The signed Permit2 permit allowing the router to spend LP tokens
     * @returns A Promise that resolves to the transaction hash
     * @throws {TurbineError} If the transaction fails or is reverted
     */
    submitRemoveLiquidityTransaction(intent: RemoveLiquidityIntentOnchain, permit: SignedSignatureTransferOnchain): Promise<string>;
    /**
     * Execute pending remove liquidity intents on-chain.
     * This method calls the executePendingIntents function on the TurbineLiquidityRouter contract
     * to process and execute previously submitted remove liquidity intents.
     * @param hashes An array of intent hashes to execute
     * @returns A Promise that resolves when the transaction is confirmed
     * @throws {TurbineError} If the transaction fails or is reverted
     */
    executePendingRemoveLiquidityIntentsOnchain(hashes: Hex[]): Promise<void>;
    /**
     * Flush expired remove liquidity intents from the TurbineLiquidityRouter contract.
     * This method calls the flushExpiredIntents function to remove all intents that have passed their expiration time.
     * @returns A Promise that resolves when the transaction is confirmed
     * @throws {TurbineError} If the transaction fails or is reverted
     */
    flushExpiredRemoveLiquidityIntentsOnchain(): Promise<void>;
    /**
     * Get the pool ID for a given token pair and fee.
     * Calls the computePoolId view function from the TurbineHook contract.
     * @param token0 The first token address
     * @param token1 The second token address
     * @param fee The pool fee in hundredths of basis point
     * @returns A Promise that resolves to the pool ID as a Hex string
     */
    getPoolId(token0: Address, token1: Address, fee: number): Promise<Hex>;
    /**
     * Compute the hash of a remove liquidity intent.
     * This matches the hash computation in the TurbineLiquidityRouter contract:
     * keccak256(abi.encode(intent))
     * @param intent The onchain remove liquidity intent
     * @returns The intent hash as a Hex string
     */
    computeRemoveLiquidityIntentHash(intent: RemoveLiquidityIntentOnchain): Hex;
    /**
     * Create a new liquidity pool on-chain.
     * Initializes a new pool with the specified token pair and fee using the PoolManager contract.
     * @param token0 The first token address
     * @param token1 The second token address
     * @param fee The pool fee in hundredths of basis point
     * @returns A Promise that resolves to the transaction hash of the pool creation
     * @throws {TurbineError} If the pool already exists or the transaction fails
     */
    createPool(token0: Address, token1: Address, fee: number): Promise<string>;
    /**
     * Get the settled amounts for multiple orders.
     * Retrieves order states and extracts the executed sell amounts for each order.
     * @param orderHashes An array of order hashes to check
     * @returns A Promise that resolves to an array of OrderSettledAmount objects containing order hash and executed sell amount
     */
    getSettledAmounts(orderHashes: Hex[]): Promise<OrderSettledAmount[]>;
    /**
     * Get the fee for a prospective order.
     * @param intent The intent for which to get the fee
     * @returns A Promise that resolves to a bigint containing the fee expressed in absolute amount of the buy token.
     */
    getOrderFee(intent: OrderIntent): Promise<bigint>;
    /**
     * Get all registered pools from the Turbine Hook contract.
     * @returns A Promise that resolves to an array of TurbinePool objects
     */
    getPools(): Promise<TurbinePool[]>;
    /**
     * Get user positions for all registered pools.
     * Returns positions where the user has a non-zero LP token balance.
     * @returns A Promise that resolves to an array of UserPosition objects
     */
    getUserPositions(): Promise<UserPosition[]>;
    /**
     * Check if the Turbine service is available.
     * @returns A Promise that resolves to true if the service is available, or throws an error if unavailable
     */
    checkStatus(): Promise<boolean>;
    /**
     * Get the current configuration
     * @returns The TurbineConfig
     */
    getConfig(): TurbineConfig;
    /**
     * Create add order data with Permit2 signature for non-smart orders.
     * Smart orders skip permit data as they handle their own token transfers.
     * @param intent The order intent to create data for
     * @returns A Promise that resolves to AddOrder or AddSmartOrder payload
     */
    private createAddOrderData;
    /**
     * Create add liquidity data with Permit2 signatures for both tokens.
     * Converts fee to hundredths of basis points and creates batch permit signatures.
     * @param intent The liquidity addition intent
     * @returns A Promise that resolves to AddLiquidity payload with signed permits
     */
    createAddLiquidityData(intent: AddLiquidityIntent): Promise<AddLiquidity>;
    /**
     * Create remove liquidity data with Permit2 signature for LP token.
     * Converts fee to hundredths of basis points and creates permit signature.
     * @param intent The liquidity removal intent
     * @returns A Promise that resolves to RemoveLiquidity payload with signed permit
     */
    private createRemoveLiquidityData;
    /**
     * Create remove liquidity data for onchain submission.
     * Computes the pool ID and creates the onchain intent format with Permit2 signature.
     * @param intent The liquidity removal intent
     * @returns A Promise that resolves to an object containing the onchain intent and signed permit
     */
    private createRemoveLiquidityDataOnchain;
    /**
     * Check if an order intent is a smart order.
     * Smart orders have a non-zero callDataTarget and non-empty callData.
     * @param intent The order intent to check
     * @returns true if the order is a smart order, false otherwise
     */
    private is_smart_order;
    /**
     * Authenticate with the Turbine API using a wallet client.
     * First calls /nonce to get nonce, then calls /verify with the signed message.
     */
    authenticate(): Promise<void>;
    /**
     * Get the current authentication status for the authenticated user.
     * @returns A Promise that resolves to the authentication status
     */
    getAuthStatus(): Promise<{
        authenticated: boolean;
        address?: string;
    }>;
    /**
     * Logout and clear the current session.
     */
    logout(): Promise<void>;
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
    ensureAuthenticated(): Promise<Address>;
    /**
     * Calls the Turbine API endpoint with the given payload.
     * @param payload The payload to send to the endpoint
     * @param endpoint The endpoint to call. One of "add_order", "add_orders", "add_liquidity", "remove_liquidity", "cancel_order", "order_statuses"
     * @returns A Promise that resolves to a fetch response
     */
    protected callApiEndpoint(payload: AddOrder | AddSmartOrder | (AddOrder | AddSmartOrder)[] | AddLiquidity | RemoveLiquidity | CancelOrderPayload | GetOrderStatesPayload, endpoint: string): Promise<Response>;
    /**
     * Parse an order status from the API response format to our TypeScript interface.
     * Converts snake_case to camelCase and string numbers to BigInts.
     * @param orderState The raw order status from the API
     * @returns The parsed OrderState object
     */
    private parseOrderState;
    /**
     * Convert viem signature hex string to structured format expected by Turbine API
     */
    private parseSignature;
    private getBlockTimestamp;
}
/**
 * Get the registered pools from the Turbine Hook contract.
 * @param publicClient The public client used for blockchain interactions
 * @param hookAddress The address of the Turbine Hook contract
 * @returns A Promise that resolves to an array of `TurbinePool` objects.
 */
declare function getPools(publicClient: PublicClient, hookAddress: Address): Promise<TurbinePool[]>;
/**
 * Get user positions for all registered pools.
 * @param userAddress The address of the user to get positions for
 * @param publicClient The public client used for blockchain interactions
 * @param hookAddress The address of the Turbine Hook contract
 * @returns A Promise that resolves to an array of `UserPosition` objects.
 */
declare function getUserPositions(userAddress: Address, publicClient: PublicClient, hookAddress: Address): Promise<UserPosition[]>;
/**
 * Fetch configuration from the Turbine API endpoint.
 * @param turbineApiUrl The base URL of the Turbine API
 * @returns A Promise that resolves to the TurbineConfig
 */
declare function fetchConfig(turbineApiUrl: string): Promise<TurbineConfig>;
/**
 * Check if the Turbine service is available by querying the /status endpoint.
 * @param turbineApiUrl The base URL of the Turbine API
 * @returns A Promise that resolves to true if the service is available, or throws an error if unavailable.
 */
declare function checkStatus(turbineApiUrl: string): Promise<boolean>;
declare function getRandomSalt(): Hex;
declare function convertSignature(sig: Hex): PrimitiveSignature;

/**
 * All possible Turbine error codes
 * Includes both backend error codes and SDK-specific error codes
 */
declare const TURBINE_ERROR_CODES: readonly ["INTERNAL_ERROR", "TEE_ERROR", "INPUT_VALIDATION_ERROR", "ORDERBOOK_CAPACITY_ERROR", "USER_ORDER_LIMIT_REACHED", "MAX_ORDERS_IN_PAYLOAD", "VALIDATION_ERRORS", "ORDER_ALREADY_EXISTS", "DUPLICATED_ORDER", "USER_NOT_AUTHORIZED", "ALREADY_AUTHENTICATED", "NO_NONCE_GENERATED", "AUTHENTICATED_WITH_NONCE", "VERIFICATION_FAILED", "ORDER_NOT_AVAILABLE", "MID_PRICE_NOT_FOUND", "SDK_ERROR", "UNEXPECTED_CANCELLATION_RESPONSE", "UNEXPECTED_ADD_ORDER_RESPONSE", "UNEXPECTED_REMOVE_LIQUIDITY_RESPONSE", "UNEXPECTED_ADD_LIQUIDITY_RESPONSE", "USER_REJECTION", "AUTHENTICATION_FAILED", "AUTHENTICATION_ERROR", "UNAUTHORIZED", "INVALID_RESPONSE", "INTERNAL_SERVER_ERROR", "REMOVE_LIQUIDITY_INTENT_ONCHAIN_FAILED", "EXECUTE_PENDING_REMOVE_LIQUIDITY_INTENTS_FAILED", "FLUSH_EXPIRED_REMOVE_LIQUIDITY_INTENTS_FAILED", "POOL_ALREADY_INITIALIZED", "POOL_CREATION_FAILED", "CONFIG_FETCH_FAILED", "SERVICE_UNAVAILABLE", "ZERO_LIQUIDITY", "UNKNOWN_ERROR"];
/**
 * Union type for all possible Turbine error codes
 */
type TurbineErrorCode = (typeof TURBINE_ERROR_CODES)[number];
/**
 * TurbineError class provides structured error handling for Turbine SDK.
 *
 * @param code - The error code; one of the TURBINE_ERROR_CODES. They match the error codes returned by the Turbine API.
 * @param message - A human-readable error message. It is typically the same as the message returned by the Turbine API.
 * @param details - Optional technical details about the error; e.g. the response body from the server. It is provided
 * by the SDK for debugging purposes. May contain the original response body, or any other details that are useful
 * for debugging.
 * @param inner - Optional inner errors if the main error wraps multiple errors. Only one level of nesting is supported.
 */
declare class TurbineError extends Error {
    readonly code: TurbineErrorCode;
    readonly message: string;
    readonly details: any;
    readonly inner: TurbineError[] | null;
    constructor(code: TurbineErrorCode, message: string, details?: any, inner?: TurbineError[] | null);
    /**
     * Returns the raw error with technical details for logging
     */
    getTechnicalDetails(): string;
}
declare function isTurbineError(error: unknown): error is TurbineError;
/**
 * Creates a TurbineError from an API response error
 * @param response The response object from the fetch API
 * @returns A TurbineError instance
 */
declare function unsuccessfulResponseToTurbineError(response: Response): Promise<TurbineError>;
/**
 * Casts to TurbineError if needed
 */
declare function toTurbineError(error: unknown): TurbineError;

declare const CHAIN_ID = 1;
declare const TURBINE_API_URL: string;

/**
 * Validation utilities for Turbine SDK
 *
 * This module provides input validation to prevent CWE-20 (Improper Input Validation).
 * All validators throw TurbineError with INPUT_VALIDATION_ERROR code for invalid inputs.
 *
 * Validation occurs at multiple layers:
 * - Script layer: Validate CLI inputs
 * - SDK public methods: Validate function parameters
 * - Internal layer: Validate before API calls
 * - Response layer: Validate API responses
 */

declare const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
/**
 * Validates an OrderIntent object
 * Performs comprehensive validation of all fields
 *
 * @param intent - The order intent to validate
 * @returns The validated order intent
 * @throws TurbineError if validation fails
 */
declare function validateOrderIntent(intent: unknown): OrderIntent;
/**
 * Validates an AddLiquidityIntent object
 *
 * @param intent - The add liquidity intent to validate
 * @returns The validated intent
 * @throws TurbineError if validation fails
 */
declare function validateAddLiquidityIntent(intent: unknown): AddLiquidityIntent;
/**
 * Validates a RemoveLiquidityIntent object
 *
 * @param intent - The remove liquidity intent to validate
 * @returns The validated intent
 * @throws TurbineError if validation fails
 */
declare function validateRemoveLiquidityIntent(intent: unknown): RemoveLiquidityIntent;
/**
 * Validates a RemoveLiquidityIntentOnchain object
 *
 * @param intent - The intent to validate
 * @throws TurbineError if validation fails
 */
declare function validateRemoveLiquidityIntentOnchain(intent: unknown): void;

declare const USDC: Token;
declare const USDT: Token;
declare const DAI: Token;
declare const UNI: Token;
declare const WETH: Token;
declare const WEETH: Token;
declare const PEPE: Token;
declare const WBTC: Token;
declare const ADDR2TOKEN: Map<Address, Token>;
declare const SQRT_PRICE_IDENTITY = 79228162514264337593543950336n;

declare function getNonce(owner: Address, token: Address, spender: Address, client: PublicClient): Promise<number>;
/**
 * Generate permit object for a token and sign it.
 * @param token The token to approve
 * @param walletClient User wallet client that will be used to sign
 * @param publicClient An instance of PublicClient to use for getting
 * the Permit2 nonce.
 * @param deadline When allowance and signature expire. By default
 * will be set to order's endTime.
 * @param amount The amount of tokens to approve. By default will be set to maxUint160.
 * @param spender The address of allowed token spender.
 */
declare function getSignedAllowance({ token, walletClient, publicClient, deadline, amount, // infinite approval
spender, }: {
    token: Address;
    walletClient: WalletClient;
    publicClient: PublicClient;
    deadline: number;
    amount?: bigint;
    spender: Address;
}): Promise<getSignedAllowanceReturnType>;
type getSignedAllowanceReturnType = {
    permit: AllowanceTransferPermitSingle;
    permitSignature: Hex;
};
/**
 * Generate permit object for a pair of tokens and sign it.
 * @param tokens The tokens to approve
 * @param walletClient User wallet client that will be used to sign
 * @param publicClient An instance of PublicClient to use for getting
 * the Permit2 nonce.
 * @param deadline When allowance and signature expire. By default
 * will be set to order's endTime.
 * @param amounts The amounts of tokens to approve. By default will be set to maxUint160.
 * @param spender The address of allowed token spender.
 */
declare function getBatchSignedAllowance({ tokens, walletClient, publicClient, deadline, amounts, // infinite approval
spender, }: {
    tokens: [Address, Address];
    walletClient: WalletClient;
    publicClient: PublicClient;
    deadline: number;
    amounts?: [bigint, bigint];
    spender: Address;
}): Promise<getBatchSignedAllowanceReturnType>;
type getBatchSignedAllowanceReturnType = {
    permit: AllowanceTransferPermitBatch;
    permitSignature: Hex;
};
/**
 * Get Permit2 signature for order. Supports both single and batch permits.
 * We do some type conversions because `AllowanceTransfer.getPermitData` returns
 * data suited for `ethers` wallet, while we're using `viem` wallet.
 */
declare function getSignature(permit: AllowanceTransferPermitSingle | AllowanceTransferPermitBatch, wallet: WalletClient, permitType?: "PermitSingle" | "PermitBatch"): Promise<Hex>;

/**
 * Picks an unused unordered nonce from Permit2's bitmap for the given owner.
 * Generates a random nonce first, then checks if it's unused. If used, generates a new random nonce and retries up to 100 times.
 *
 * Permit2 uses unordered nonces with a bitmap layout:
 * - wordPos = nonce >> 8
 * - bitPos  = nonce & 0xff
 */
declare function getRandomNonce(publicClient: PublicClient, owner: Address): Promise<bigint>;
type GetSignedSignatureTransferReturnType = {
    permit: SignatureTransferPermitTransferFrom;
    permitSignature: Hex;
};
declare function getSignedSignatureTransfer({ token, amount, walletClient, publicClient, deadline, spender, nonce: providedNonce, }: {
    token: Address;
    amount: bigint;
    walletClient: WalletClient;
    publicClient: PublicClient;
    deadline: bigint;
    spender: Address;
    nonce?: bigint;
}): Promise<GetSignedSignatureTransferReturnType>;
type GetSignedBatchSignatureTransferReturnType = {
    permit: SignatureTransferPermitBatchTransferFrom;
    permitSignature: Hex;
};
declare function getSignedBatchSignatureTransfer({ tokens, amounts, walletClient, publicClient, deadline, spender, nonce: providedNonce, }: {
    tokens: Address[];
    amounts: bigint[];
    walletClient: WalletClient;
    publicClient: PublicClient;
    deadline: bigint;
    spender: Address;
    nonce?: bigint;
}): Promise<GetSignedBatchSignatureTransferReturnType>;

declare const turbineLiquidityRouterABI: readonly [{
    readonly type: "function";
    readonly name: "submitRemoveLiquidityIntent";
    readonly inputs: readonly [{
        readonly name: "intent";
        readonly type: "tuple";
        readonly internalType: "struct RemoveLiquidityIntent";
        readonly components: readonly [{
            readonly name: "owner";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "poolId";
            readonly type: "bytes32";
            readonly internalType: "PoolId";
        }, {
            readonly name: "lpTokenAmount";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "salt";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }];
    }, {
        readonly name: "signatureTransferParams";
        readonly type: "tuple";
        readonly internalType: "struct SignatureTransferParams";
        readonly components: readonly [{
            readonly name: "permit";
            readonly type: "tuple";
            readonly internalType: "struct ISignatureTransfer.PermitTransferFrom";
            readonly components: readonly [{
                readonly name: "permitted";
                readonly type: "tuple";
                readonly internalType: "struct ISignatureTransfer.TokenPermissions";
                readonly components: readonly [{
                    readonly name: "token";
                    readonly type: "address";
                    readonly internalType: "address";
                }, {
                    readonly name: "amount";
                    readonly type: "uint256";
                    readonly internalType: "uint256";
                }];
            }, {
                readonly name: "nonce";
                readonly type: "uint256";
                readonly internalType: "uint256";
            }, {
                readonly name: "deadline";
                readonly type: "uint256";
                readonly internalType: "uint256";
            }];
        }, {
            readonly name: "signature";
            readonly type: "bytes";
            readonly internalType: "bytes";
        }];
    }];
    readonly outputs: readonly [{
        readonly name: "intentHash";
        readonly type: "bytes32";
        readonly internalType: "RemoveLiquidityIntentHash";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly inputs: readonly [{
        readonly internalType: "RemoveLiquidityIntentHash[]";
        readonly name: "hashes";
        readonly type: "bytes32[]";
    }];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
    readonly name: "executePendingIntents";
}, {
    readonly type: "function";
    readonly name: "flushExpiredIntents";
    readonly inputs: readonly [];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}];
declare const turbineHookABI: readonly [{
    readonly type: "function";
    readonly name: "MINIMUM_LIQUIDITY";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "INITIAL_LP_SCALE";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getNumberOfRegisteredPools";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "computePoolId";
    readonly inputs: readonly [{
        readonly name: "currency0";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "currency1";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "fee";
        readonly type: "uint24";
        readonly internalType: "uint24";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly stateMutability: "pure";
}, {
    readonly type: "function";
    readonly name: "getRegisteredPoolsSlice";
    readonly inputs: readonly [{
        readonly name: "startIndex";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "endIndex";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "poolsInfo";
        readonly type: "tuple[]";
        readonly internalType: "struct TurbineHook.PoolInfo[]";
        readonly components: readonly [{
            readonly name: "poolId";
            readonly type: "bytes32";
            readonly internalType: "bytes32";
        }, {
            readonly name: "token0";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "token1";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "fee";
            readonly type: "uint24";
            readonly internalType: "uint24";
        }, {
            readonly name: "lpToken";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "reserve0";
            readonly type: "uint128";
            readonly internalType: "uint128";
        }, {
            readonly name: "reserve1";
            readonly type: "uint128";
            readonly internalType: "uint128";
        }, {
            readonly name: "liquidity";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
    }];
    readonly stateMutability: "view";
}];
declare const balanceOfABI: readonly [{
    readonly constant: true;
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
    }];
    readonly name: "balanceOf";
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}];
declare const poolManagerABI: readonly [{
    readonly inputs: readonly [{
        readonly components: readonly [{
            readonly name: "currency0";
            readonly type: "address";
        }, {
            readonly name: "currency1";
            readonly type: "address";
        }, {
            readonly name: "fee";
            readonly type: "uint24";
        }, {
            readonly name: "tickSpacing";
            readonly type: "int24";
        }, {
            readonly name: "hooks";
            readonly type: "address";
        }];
        readonly name: "key";
        readonly type: "tuple";
    }, {
        readonly name: "sqrtPriceX96";
        readonly type: "uint160";
    }];
    readonly name: "initialize";
    readonly outputs: readonly [{
        readonly name: "tick";
        readonly type: "int24";
    }];
    readonly stateMutability: "nonpayable";
    readonly type: "function";
}];
declare const orderSettledABI: {
    readonly anonymous: false;
    readonly inputs: readonly [{
        readonly indexed: true;
        readonly name: "owner";
        readonly type: "address";
    }, {
        readonly indexed: true;
        readonly name: "orderHash";
        readonly type: "bytes32";
    }, {
        readonly indexed: false;
        readonly name: "receiveAmount";
        readonly type: "uint256";
    }, {
        readonly indexed: false;
        readonly name: "sendAmount";
        readonly type: "uint256";
    }];
    readonly name: "OrderSettled";
    readonly type: "event";
};

/**
 * Constructs a URL by joining a base URL with an endpoint path.
 * Handles normalization and validation:
 * - Base URL is normalized to end with "/"
 * - Endpoint is normalized to not start with "/"
 * - URL is validated before being returned
 * - HTTPS is enforced (except for localhost/127.0.0.1)
 *
 * @param baseUrl - The base URL (e.g., "http://127.0.0.1:8080/api" or "https://api.example.com/v1")
 * @param endpoint - The endpoint path (e.g., "config", or "/config")
 * @returns The constructed URL string
 * @throws TurbineError if the URL is invalid or uses HTTP for non-localhost
 */
declare function buildApiUrl(baseUrl: string, endpoint: string): string;

export { ADDR2TOKEN, type AddLiquidity, type AddLiquidityIntent, type AddOrder, type AddSmartOrder, type AllowanceTransferPermitBatch, type AllowanceTransferPermitSingle, CHAIN_ID, type CancelOrderPayload, DAI, type GetOrderStatesPayload, type GetSignedBatchSignatureTransferReturnType, type GetSignedSignatureTransferReturnType, type LiquidityIntentState, LiquidityIntentStatus, NULL_ADDRESS, type OrderExecution, type OrderIntent, type OrderSettledAmount, type OrderState, type OrderStatusOrder, PEPE, type PermitDetails, type PoolKey, type Price, type PrimitiveSignature, type RemoveLiquidity, type RemoveLiquidityIntent, type RemoveLiquidityIntentOnchain, SQRT_PRICE_IDENTITY, type SignatureTransferPermitBatchTransferFrom, type SignatureTransferPermitTransferFrom, type SignedBatchSignatureTransfer, type SignedPermit, type SignedPermitBatch, type SignedPermitOnchain, type SignedSignatureTransfer, type SignedSignatureTransferOnchain, TURBINE_API_URL, Token, type TokenPermissions, TurbineClient, type TurbineConfig, TurbineError, type TurbineErrorCode, type TurbinePool, UNI, USDC, USDT, type UserPosition, WBTC, WEETH, WETH, balanceOfABI, buildApiUrl, checkStatus, convertSignature, fetchConfig, getBatchSignedAllowance, type getBatchSignedAllowanceReturnType, getNonce, getPools, getRandomNonce, getRandomSalt, getSignature, getSignedAllowance, type getSignedAllowanceReturnType, getSignedBatchSignatureTransfer, getSignedSignatureTransfer, getUserPositions, isTurbineError, orderSettledABI, poolManagerABI, toTurbineError, turbineHookABI, turbineLiquidityRouterABI, unsuccessfulResponseToTurbineError, validateAddLiquidityIntent, validateOrderIntent, validateRemoveLiquidityIntent, validateRemoveLiquidityIntentOnchain };
