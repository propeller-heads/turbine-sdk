import { Address, getAddress, Hex, parseUnits, formatUnits } from "viem";
import { validateAddress } from "./validationPrimitives";

export type TurbineTokenClass = "Regular" | "Stable" | "Meme";

export interface TurbineToken {
    address: Address;
    symbol: string;
    decimals: number;
    class: TurbineTokenClass;
}

export interface TurbineConfig {
    /**
     * The Turbine backend version, e.g. "0.135.0".
     */
    version: string;
    turbineSettlerAddress: Address;
    lpHookAddress: Address;
    lpRouterAddress: Address;
    poolManagerAddress: Address;
    submitSettlements: boolean;
    siweDomain: string;
    siweUri: string;
    tokens: TurbineToken[];
    /**
     * Minimum trade size in native USDC atomic units (6 decimals), e.g.
     * 10000000n = 10 USDC. Optional: absent when talking to an API version
     * that predates this field.
     */
    minTradeSizeUsdc?: bigint;
}

export class Token {
    public address: Address;
    public decimals: number;
    public symbol: string;

    constructor(address: Address, decimals: number, symbol: string) {
        // Validate address format
        const validatedAddress = validateAddress(address, "address");

        // Normalize to EIP-55 checksum encoding (checksum without chainId)
        this.address = getAddress(validatedAddress);
        this.decimals = decimals;
        this.symbol = symbol;
    }

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
    public toOnchainAmount(amount: string): bigint {
        return parseUnits(amount, this.decimals);
    }

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
    public fromOnchainAmount(amount: bigint): string {
        return formatUnits(amount, this.decimals);
    }

    equals(other: Token): boolean {
        return (
            this.address.toLowerCase() === other.address.toLowerCase() &&
            this.decimals === other.decimals &&
            this.symbol === other.symbol
        );
    }

    toString(): string {
        return this.symbol;
    }
}

export interface PermitDetails {
    token: Address;
    amount: bigint;
    expiration: number;
    nonce: number;
}

export interface AllowanceTransferPermitSingle {
    details: PermitDetails;
    spender: Address;
    sigDeadline: bigint;
}

export interface AllowanceTransferPermitBatch {
    details: PermitDetails[];
    spender: Address;
    sigDeadline: bigint;
}

export interface PrimitiveSignature {
    r: bigint;
    s: bigint;
    yParity: boolean;
}

// ====================
// Permit2 SignatureTransfer
// ====================

export interface TokenPermissions {
    token: Address;
    amount: bigint;
}

/**
 * Mirror of Permit2's ISignatureTransfer.PermitTransferFrom (but used for EIP-712 signing with an
 * extra spender field in the typed data, not in this struct).
 */
export interface SignatureTransferPermitTransferFrom {
    permitted: TokenPermissions;
    nonce: bigint;
    deadline: bigint;
}

/**
 * Mirror of Permit2's ISignatureTransfer.PermitBatchTransferFrom (but used for EIP-712 signing with an
 * extra spender field in the typed data, not in this struct).
 */
export interface SignatureTransferPermitBatchTransferFrom {
    permitted: TokenPermissions[];
    nonce: bigint;
    deadline: bigint;
}

export interface SignedSignatureTransfer {
    signature: PrimitiveSignature;
    permit: SignatureTransferPermitTransferFrom;
}

export interface SignedBatchSignatureTransfer {
    signature: PrimitiveSignature;
    permit: SignatureTransferPermitBatchTransferFrom;
}

// Onchain helpers use the raw signature hex for contract calls.
export interface SignedSignatureTransferOnchain {
    signature: Hex;
    permit: SignatureTransferPermitTransferFrom;
}

export interface SignedPermit {
    signature: PrimitiveSignature;
    permit: AllowanceTransferPermitSingle;
}

export interface SignedPermitOnchain {
    signature: Hex;
    permit: AllowanceTransferPermitSingle;
}

export interface SignedPermitBatch {
    signature: PrimitiveSignature;
    permit: AllowanceTransferPermitBatch;
}

/**
 * Optional, informational metadata attached to an order at submission time.
 *
 * Annotations are not part of the signed order and do not affect matching,
 * pricing, or settlement. They are stored alongside the order and returned on
 * {@link OrderDetails}.
 */
export interface OrderAnnotations {
    /**
     * Spread of the quote the order was created from, in hundredths of a basis
     * point (10_000 = 1%). Matches the `ammSpreadHbp` returned by `/api/quote`.
     */
    spreadAtSubmissionHbp?: number;
}

/**
 * Full struct to be sent to Turbine API to submit an order
 */
export interface AddOrder {
    order: OrderIntent;
    signedPermit: SignedPermit;
    /** Optional informational metadata stored with the order. */
    annotations?: OrderAnnotations;
}

/**
 * Struct to be sent to Turbine API to submit a smart order, which doesn't require permit data
 */
export interface AddSmartOrder {
    order: OrderIntent;
    /** Optional informational metadata stored with the order. */
    annotations?: OrderAnnotations;
}

/**
 * A piecewise-linear mid-price-delta curve parametrised in order-window basis points.
 *
 * `windowBps` runs from `0` at the order's `startTime` to `10_000` at its `endTime`.
 * Between `points`, `deltaBps` interpolates linearly; outside the curve clamps to
 * `startDeltaBps` / `endDeltaBps`. `deltaBps` is a signed integer in
 * `[-10_000, 9_999]` — negative values mean the order accepts only fills *better*
 * than the mid-price. `windowBps` is unsigned in `[1, 9_999]`.
 *
 * Use {@link import("./spreads").constant} for the flat case.
 */
export interface SpreadCurve {
    /** Mid-price delta at `windowBps = 0` (order start). i32, `[-10_000, 9_999]`. */
    startDeltaBps: number;
    /** Mid-price delta at `windowBps = 10_000` (order end). i32, `[-10_000, 9_999]`. */
    endDeltaBps: number;
    /** Interior knots, strictly increasing `windowBps`, each `windowBps` in `[1, 9_999]`. */
    points: CurvePoint[];
}

/** A single interior knot of a {@link SpreadCurve}. */
export interface CurvePoint {
    /** Position in the order window in basis points. u32, `[1, 9_999]`. */
    windowBps: number;
    /** Mid-price delta at this point. i32, `[-10_000, 9_999]`. */
    deltaBps: number;
}

/**
 * A swap order created by a user.
 */
export interface OrderIntent {
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
    /** Piecewise-linear spread curve over the order window. */
    spreadCurve: SpreadCurve;
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
export interface AddLiquidity {
    /** The intent to add liquidity */
    addLiquidity: AddLiquidityIntent;
    /** The Permit2 SignatureTransfer batch permit and signature for token0 and token1 */
    permitTokens: SignedBatchSignatureTransfer;
}

/**
 * A struct for the intent to add liquidity that user signs
 */
export interface AddLiquidityIntent {
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
export interface RemoveLiquidity {
    /** The intent to remove liquidity */
    removeLiquidity: RemoveLiquidityIntent;
    /** The Permit2 SignatureTransfer permit and signature for the LP token */
    permitLpToken: SignedSignatureTransfer;
}

/**
 * A struct for the intent to remove liquidity that user signs
 */
export interface RemoveLiquidityIntent {
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
export interface RemoveLiquidityIntentOnchain {
    /** The account withdrawing the liquidity */
    owner: Address;
    /** The identifier of the pool from which liquidity should be removed. */
    poolId: Hex;
    /** Amount of LP tokens to burn for withdrawal. */
    lpTokenAmount: bigint;
    /** Arbitrary user-provided salt to make the intent hash unique. */
    salt: Hex;
}

export interface TurbinePool {
    metadata: {
        token0: Address;
        token1: Address;
        fee: number; // in hundredths of basis point; i.e. 10000 = 1%
        lpToken: Address;
    };
    // reserves and weekly sell volumes are in onchain amounts (in atomic units)
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

export interface UserPosition {
    poolMetadata: {
        token0: Address;
        token1: Address;
        fee: number; // in hundredths of basis point; i.e. 10000 = 1%
        lpToken: Address;
    };
    userAddress: Address;
    lpTokenBalance: bigint;
}

/**
 * Represents the limit price of an order
 */
export interface Price {
    numerator: bigint;
    denominator: bigint;
}

/**
 * Represents a single, possibly partial, execution of an order
 */
export interface OrderExecution {
    txHash: Hex;
    clearedAt: Date;
    soldAmount: bigint;
    boughtAmount: bigint;
    surplusBoughtAmount: bigint;
    /** Mid-market price at execution time. Absent for older executions. */
    midPrice?: Price;
}

/**
 * Possible statuses of an order returned by the API.
 */
export type OrderStatus =
    | "Active"
    | "Filled"
    | "Expired"
    | "Canceled"
    | "PendingCancellation"
    | "Invalid"
    // Order was invalidated because it was signed against an incompatible (older) Turbine version.
    | "Incompatible";

/**
 * Resolved spread curve as returned on `OrderDetails`.
 *
 * Distinct from the request-side {@link SpreadCurve} (which uses `windowBps`
 * fractions of the order window). The response form carries absolute wall-clock
 * `startSecs`/`endSecs` and per-knot `timeSecs`, matching the server-internal
 * representation that the API serialises directly.
 */
export interface ResolvedSpreadCurve {
    /** Wall-clock unix-seconds at which the curve becomes active (matches `OrderDetails.startTime`). */
    startSecs: number;
    /** Wall-clock unix-seconds at which the curve ends (matches `OrderDetails.endTime`). */
    endSecs: number;
    /** Mid-price delta at `startSecs`. i32, `[-10_000, 9_999]`. */
    startDeltaBps: number;
    /** Mid-price delta at `endSecs`. i32, `[-10_000, 9_999]`. */
    endDeltaBps: number;
    /** Interior knots in strictly increasing `timeSecs` order. */
    points: ResolvedCurvePoint[];
}

/** A single interior knot of a {@link ResolvedSpreadCurve}. */
export interface ResolvedCurvePoint {
    /** Wall-clock unix-seconds of the knot. Strictly within `(startSecs, endSecs)`. */
    timeSecs: number;
    /** Mid-price delta at this knot. i32, `[-10_000, 9_999]`. */
    deltaBps: number;
}

/**
 * Display details of an order, preserved on `OrderState` even after the order
 * reaches a terminal status. Populated by endpoints that return enriched
 * `OrderState` (notably `GET /api/orders`).
 */
export interface OrderDetails {
    sellToken: Address;
    buyToken: Address;
    sellAmount: bigint;
    limitPrice: Price;
    startTime: bigint;
    endTime: bigint;
    /** Snapshot of the order's resolved spread curve at insertion time. */
    spreadCurve: ResolvedSpreadCurve;
    createdTimestamp: Date;
    /**
     * Informational metadata supplied at submission. Absent on orders submitted
     * without annotations or returned by backends predating the field.
     */
    annotations?: OrderAnnotations;
}

/**
 * Represents the status of an order
 */
export interface OrderState {
    hash: Hex;
    status: string; // e.g., "Active", "Invalid", etc.
    execution: OrderExecution[];
    executedSellAmount: bigint;
    executedBuyAmount: bigint;
    /**
     * Display detail for the order. Present on responses from endpoints that
     * carry enriched order data (e.g. `getOrders`); may be undefined on
     * responses from older endpoints or older backends.
     */
    orderDetails?: OrderDetails;
}

/**
 * Optional filters for {@link TurbineClient.getOrders}.
 */
export interface GetOrdersOptions {
    /** Direct lookup by order hash. Max 30. When set, pagination is skipped. */
    hashes?: Hex[];
    /** Filter by status. Multiple values are OR'd together. */
    statuses?: OrderStatus[];
    /** Opaque cursor returned by a previous call. Ignored when `hashes` is set. */
    cursor?: string;
    /** Page size. Defaults to 50 server-side; max 200. Ignored when `hashes` is set. */
    limit?: number;
}

/**
 * Response shape of {@link TurbineClient.getOrders}.
 */
export interface GetOrdersResponse {
    orders: OrderState[];
    /** Cursor to pass on the next call, or `null` on the last page. */
    cursor: string | null;
    hasMore: boolean;
}

export enum LiquidityIntentStatus {
    Pending = "Pending",
    Invalid = "Invalid",
    Expired = "Expired",
    Executed = "Executed",
    PendingCancellation = "PendingCancellation",
    Canceled = "Canceled",
}

/**
 * Represents the state of a liquidity intent
 */
export interface LiquidityIntentState {
    hash: Hex;
    status: LiquidityIntentStatus;
}

export interface OrderSettledAmount {
    hash: Hex;
    executedSellAmount: bigint;
}

/**
 * Payload for cancelling an order
 */
export interface CancelOrderPayload {
    orderHash: Hex;
}

/**
 * Payload for getting order statuses
 */
export interface GetOrderStatesPayload {
    orderHashes: Hex[];
}

/**
 * PoolKey
 */

export interface PoolKey {
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
