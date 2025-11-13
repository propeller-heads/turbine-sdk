import { Address, getAddress, Hex } from "viem";

export interface TurbineConfig {
    turbineSettlerAddress: Address;
    lpHookAddress: Address;
    lpRouterAddress: Address;
    poolManagerAddress: Address;
    submitSettlements: boolean;
    siweDomain: string;
    siweUri: string;
}

export class Token {
    public address: Address;
    public decimals: number;
    public symbol: string;

    constructor(address: Address, decimals: number, symbol: string) {
        this.address = getAddress(address);
        this.decimals = decimals;
        this.symbol = symbol;
    }

    public toOnchainAmount(amount: number): bigint {
        return BigInt(Math.round(amount * 10 ** this.decimals));
    }

    public fromOnchainAmount(amount: bigint): number {
        return Number(amount) / 10 ** this.decimals;
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
    r: BigInt;
    s: BigInt;
    yParity: boolean;
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
 * Full struct to be sent to Turbine API to submit an order
 */
export interface AddOrder {
    order: OrderIntent;
    signedPermit: SignedPermit;
}

/**
 * Struct to be sent to Turbine API to submit a smart order, which doesn't require permit data
 */
export interface AddSmartOrder {
    order: OrderIntent;
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
    /**
     * Allowed deviation from the mid-price delta in basis points.
     * E.g. 1% (100 basis points) mid-price delta means that the trade will be executed
     * at a price at most 1% worse than mid-price.
     */
    midPriceDelta: number;
    /** Block timestamp since when the order is valid */
    startTime: bigint;
    /**
     * Block timestamp until when the order is valid.
     * This is when maxMidPriceDelta will be reached.
     */
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
    /** The permit signature and permit data for both tokens */
    permitTokens: SignedPermitBatch;
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
    /** Maximum amount of token0 of the pool that the user is willing to provide */
    token0Amount: bigint;
    /** Maximum amount of token1 of the pool that the user is willing to provide */
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
    /** The permit signature and permit data for the lp token */
    permitLpToken: SignedPermit;
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
 * Represents an order as returned by the order status endpoint
 */
export interface OrderStatusOrder {
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
export interface OrderExecution {
    batchId: number;
    txHash: Hex;
    clearedAt: Date;
    soldAmount: bigint;
    boughtAmount: bigint;
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
