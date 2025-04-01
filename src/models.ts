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

/**
 * Full struct to be sent to Turbine API to submit an order
 */
export interface AddOrder {
    order: OrderIntent;
    order_signature: PrimitiveSignature;
    permit: AllowanceTransferPermitSingle;
    permit_signature: PrimitiveSignature;
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
