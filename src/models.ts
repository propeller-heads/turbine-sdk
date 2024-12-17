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

/**
 * Full struct to be sent to Turbine API to submit an order
 */
export interface AddOrder {
    order: OrderIntent,
    order_signature: Hex,
    permit: AllowanceTransferPermitSingle,
    permit_signature: Hex,
}

/**
 * A swap order created by a user.
 */
export interface OrderIntent {
    /** Address of the swapper */
    owner: Address;
    /** Address of sell token */
    sellToken: Address;
    buyToken: Address;
    /** Sell amount */
    sellAmount: bigint /** Address of buy token */;
    /** Minimum buy amount, effectively defining limit price. Currently unsupported. */
    minBuyAmount: bigint;
    // maxGas: number;
    /**
     * Start mid-price delta in basis points.
     * E.g. 1% (100 basis points) mid-price delta means that the trade will be executed
     * at a price at most 1% worse than mid-price.
     */
    midPriceDelta: number;
    /**
     * End mid-price delta in basis points.
     *
     * Set to the same value as minMidPriceDelta to keep the delta static.
     *
     * Alternatively, set this to a value higher than minMidPriceDelta
     * to make the delta increase over time, so that the order gets easier to fill.
     */
    // endMidPriceDelta: number;
    /** Block timestamp since when the order is valid */
    startTime: number;
    /**
     * Block timestamp until when the order is valid.
     * This is when maxMidPriceDelta will be reached.
     */
    endTime: number;
    partialFill: boolean;
    // callData: Hex;
    // callDataTarget: Address;
    salt: Hex;
}
