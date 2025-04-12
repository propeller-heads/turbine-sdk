import { Address, getAddress, Hex } from "viem";

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
        if (amount < 1) {
            return BigInt(Math.round(amount * 10 ** this.decimals));
        } else {
            return BigInt(Math.round(amount)) * BigInt(10 ** this.decimals);
        }
    }

    public fromOnchainAmount(amount: bigint): number {
        return Number(amount) / 10 ** this.decimals;
    }
}

export interface AllowanceTransferPermitSingle {
    details: {
        token: Address;
        amount: bigint;
        expiration: bigint;
        nonce: bigint;
    };
    spender: Address;
    sigDeadline: bigint;
}

export interface PrimitiveSignature {
    r: BigInt;
    s: BigInt;
    yParity: Hex; // boolean as hex, i.e. 0x0 or 0x1
}

export interface SignedPermit {
    signature: PrimitiveSignature;
    permit: AllowanceTransferPermitSingle;
}

/**
 * Full struct to be sent to Turbine API to submit an order
 */
export interface AddOrder {
    order: OrderIntent;
    order_signature: PrimitiveSignature;
    signed_permit: SignedPermit;
}

/**
 * Struct to be sent to Turbine API to submit a smart order, which doesn't require permit data
 */
export interface AddSmartOrder {
    order: OrderIntent;
    order_signature: PrimitiveSignature;
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
    sellAmount: bigint /** Address of buy token */;
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
    /** The intent to add liquidity with cryptographic signature validating it */
    signed_intent: SignedAddLiquidityIntent;
    /** The permit signature and permit data for token0 */
    permit_token0: SignedPermit;
    /** The permit signature and permit data for token1 */
    permit_token1: SignedPermit;
}

export interface SignedAddLiquidityIntent {
    intent: AddLiquidityIntent;
    signature: PrimitiveSignature;
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
    /** fee of the pool to which the liquidity is provided, in 1/100 of bip (3000=0.3%) */
    fee: bigint;
    /** Maximum amount of token0 of the pool that the user is willing to provide */
    maxToken0: bigint;
    /** Maximum amount of token1 of the pool that the user is willing to provide */
    maxToken1: bigint;
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
    /** The intent to remove liquidity with cryptographic signature validating it */
    signed_intent: SignedRemoveLiquidityIntent;
    /** The permit signature and permit data for the lp token */
    permit_lp_token: SignedPermit;
}

export interface SignedRemoveLiquidityIntent {
    intent: RemoveLiquidityIntent;
    signature: PrimitiveSignature;
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
    /** fee of the pool to which the liquidity is withdrawing, in 1/100 of bip (3000=0.3%) */
    fee: bigint;
    /** Address of the LP token that the user wants to burn. */
    lpToken: Address;
    /** Quantity of LP tokens that the user wants to burn. */
    lpTokenAmount: bigint;
    /** Arbitrary value differentiating intents whose other fields are the same */
    salt: Hex;
}
