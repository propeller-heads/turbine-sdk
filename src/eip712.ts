/**
 * EIP-712 request signing for the `/api/eip712/` endpoints.
 *
 * Every request to those endpoints is a signed envelope `{payload, auth}`: the
 * EIP-712 signature covers the payload's typed struct together with a random
 * `nonce` and a `deadline`. The typed-data structs mirror the backend's
 * `turbine_eip712.sol` verbatim.
 */

import { Address, bytesToBigInt, Hex } from "viem";
import { TurbineError } from "./errorHandling";
import {
    AddLiquidityIntent,
    AddOrder,
    AddSmartOrder,
    OrderAnnotations,
    OrderIntent,
    OrderStatus,
    PrimitiveSignature,
    RemoveLiquidityIntent,
    SignedPermit,
    SpreadCurve,
} from "./models";

/** Maps an `/api/eip712/` endpoint to the primary type of its signed typed-data struct. */
export const EIP712_PRIMARY_TYPES = {
    add_order: "AddOrder",
    add_orders: "AddOrder",
    cancel_order: "CancelOrder",
    orders: "QueryOrders",
    liquidity_intents: "QueryLiquidityIntents",
    add_liquidity: "AddLiquidityEip712",
    remove_liquidity: "RemoveLiquidityEip712",
} as const;

export type Eip712Endpoint = keyof typeof EIP712_PRIMARY_TYPES;
export type Eip712PrimaryType = (typeof EIP712_PRIMARY_TYPES)[Eip712Endpoint];

const orderIntentTypes = {
    OrderIntent: [
        { name: "owner", type: "address" },
        { name: "sellToken", type: "address" },
        { name: "buyToken", type: "address" },
        { name: "sellAmount", type: "uint256" },
        { name: "minBuyAmount", type: "uint256" },
        { name: "startDeltaBps", type: "int32" },
        { name: "endDeltaBps", type: "int32" },
        { name: "points", type: "SpreadCurvePoint[]" },
        { name: "startTime", type: "uint256" },
        { name: "endTime", type: "uint256" },
        { name: "partialFill", type: "bool" },
        { name: "callData", type: "bytes" },
        { name: "callDataTarget", type: "address" },
        { name: "salt", type: "bytes32" },
    ],
    SpreadCurvePoint: [
        { name: "timeSecs", type: "uint64" },
        { name: "deltaBps", type: "int32" },
    ],
};

/**
 * EIP-712 type definitions per primary type, mirroring `turbine_eip712.sol`.
 */
export const EIP712_TYPES: Record<
    Eip712PrimaryType,
    Record<string, { name: string; type: string }[]>
> = {
    AddOrder: {
        AddOrder: [
            { name: "order", type: "OrderIntent" },
            { name: "nonce", type: "uint64" },
            { name: "deadline", type: "uint64" },
        ],
        ...orderIntentTypes,
    },
    CancelOrder: {
        CancelOrder: [
            { name: "orderHash", type: "bytes32" },
            { name: "nonce", type: "uint64" },
            { name: "deadline", type: "uint64" },
        ],
    },
    QueryOrders: {
        QueryOrders: [
            { name: "hashes", type: "bytes32[]" },
            { name: "statuses", type: "string[]" },
            { name: "cursor", type: "string" },
            { name: "limit", type: "uint64" },
            { name: "nonce", type: "uint64" },
            { name: "deadline", type: "uint64" },
        ],
    },
    QueryLiquidityIntents: {
        QueryLiquidityIntents: [
            { name: "hashes", type: "bytes32[]" },
            { name: "nonce", type: "uint64" },
            { name: "deadline", type: "uint64" },
        ],
    },
    AddLiquidityEip712: {
        AddLiquidityEip712: [
            { name: "intent", type: "AddLiquidityIntent" },
            { name: "nonce", type: "uint64" },
            { name: "deadline", type: "uint64" },
        ],
        AddLiquidityIntent: [
            { name: "owner", type: "address" },
            { name: "token0", type: "address" },
            { name: "token1", type: "address" },
            { name: "fee", type: "uint24" },
            { name: "token0Amount", type: "uint256" },
            { name: "token1Amount", type: "uint256" },
            { name: "exact", type: "bool" },
            { name: "salt", type: "bytes32" },
        ],
    },
    RemoveLiquidityEip712: {
        RemoveLiquidityEip712: [
            { name: "intent", type: "RemoveLiquidityIntent" },
            { name: "nonce", type: "uint64" },
            { name: "deadline", type: "uint64" },
        ],
        RemoveLiquidityIntent: [
            { name: "owner", type: "address" },
            { name: "token0", type: "address" },
            { name: "token1", type: "address" },
            { name: "fee", type: "uint24" },
            { name: "lpToken", type: "address" },
            { name: "lpTokenAmount", type: "uint256" },
            { name: "salt", type: "bytes32" },
        ],
    },
};

/**
 * The signed form of an {@link OrderIntent}: instead of the request-side
 * `spreadCurve` it commits `startDeltaBps`/`endDeltaBps` plus knots resolved
 * to absolute unix timestamps, matching the backend's canonical order struct.
 */
export interface OrderIntentSigned {
    owner: Address;
    sellToken: Address;
    buyToken: Address;
    sellAmount: bigint;
    minBuyAmount: bigint;
    startDeltaBps: number;
    endDeltaBps: number;
    points: SignedCurvePoint[];
    startTime: bigint;
    endTime: bigint;
    partialFill: boolean;
    callData: Hex;
    callDataTarget: Address;
    salt: Hex;
}

/** A single knot of the signed spread curve, with an absolute unix timestamp. */
export interface SignedCurvePoint {
    timeSecs: bigint;
    deltaBps: number;
}

/**
 * The signed message fields per primary type, minus `nonce` and `deadline`
 * (appended by the signer).
 */
export interface Eip712Messages {
    AddOrder: { order: OrderIntentSigned };
    CancelOrder: { orderHash: Hex };
    QueryOrders: {
        hashes: Hex[];
        statuses: OrderStatus[];
        cursor: string;
        limit: number;
    };
    QueryLiquidityIntents: { hashes: Hex[] };
    AddLiquidityEip712: { intent: AddLiquidityIntent };
    RemoveLiquidityEip712: { intent: RemoveLiquidityIntent };
}

/** Auth block carried by every EIP-712 envelope. */
export interface Eip712AuthBlock {
    signer: Address;
    /** Random per-request value; decimal string on the wire. */
    nonce: string;
    /** Unix seconds; bounded by `maxSignatureLifetimeS` from the config. */
    deadline: number;
    signature: PrimitiveSignature;
}

/** The body of a request to an `/api/eip712/` endpoint. */
export interface Eip712RequestBody {
    payload: unknown;
    auth: Eip712AuthBlock;
}

/**
 * Wire form of `POST /api/eip712/add_order`: unlike the session API, the
 * spread curve is a payload-level sibling of the order, not inline.
 */
export interface AddOrderEip712Wire {
    order: Omit<OrderIntent, "spreadCurve">;
    spreadCurve: SpreadCurve;
    signedPermit?: SignedPermit;
    annotations?: OrderAnnotations;
}

/**
 * Generates a random u64 nonce as a decimal string. The backend parses the
 * nonce from a decimal string (a bare JSON number would lose precision past
 * 2^53 in JavaScript), so it must stay a string on the wire.
 */
export function generateEip712Nonce(): string {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return bytesToBigInt(bytes).toString(10);
}

/**
 * Deadline for an EIP-712 auth signature: now plus the configured maximum
 * lifetime, less a small margin — the backend allows zero clock skew, so a
 * slightly-ahead client clock would otherwise exceed the maximum lifetime.
 */
export function eip712Deadline(maxSignatureLifetimeS: number): number {
    return Math.floor(Date.now() / 1000) + maxSignatureLifetimeS - 5;
}

const WINDOW_BPS_DENOMINATOR = 10000n;

/**
 * Resolves a spread curve's `windowBps` knots to absolute unix timestamps,
 * replicating the backend's integer math: `timeSecs = startTime +
 * (windowBps * (endTime - startTime)) / 10_000`, rounded down.
 *
 * Range and monotonicity of `windowBps` are already enforced by
 * `validateSpreadCurve`; this only rejects knots that collapse to
 * non-increasing timestamps after truncation, which happens when the order
 * window is too short for the curve's knot spacing.
 */
export function resolveSpreadCurvePoints(
    startTime: bigint,
    endTime: bigint,
    curve: SpreadCurve
): SignedCurvePoint[] {
    const duration = endTime - startTime;
    let prevTimeSecs = startTime;
    return curve.points.map((point) => {
        const timeSecs =
            startTime + (BigInt(point.windowBps) * duration) / WINDOW_BPS_DENOMINATOR;
        if (timeSecs <= prevTimeSecs) {
            throw new TurbineError(
                "INPUT_VALIDATION_ERROR",
                `Spread curve knot at windowBps ${point.windowBps} resolves to timestamp ${timeSecs}, which does not increase over the previous knot at ${prevTimeSecs}. The order window is too short for the curve's knot spacing.`,
                { windowBps: point.windowBps, startTime, endTime }
            );
        }
        prevTimeSecs = timeSecs;
        return { timeSecs, deltaBps: point.deltaBps };
    });
}

/**
 * Builds the signed order message for the `AddOrder` envelope: the intent's
 * inline `spreadCurve` is replaced by `startDeltaBps`/`endDeltaBps` and the
 * knots resolved to absolute timestamps.
 */
export function buildSignedOrderIntentMessage(intent: OrderIntent): OrderIntentSigned {
    const { spreadCurve, ...rest } = intent;
    return {
        ...rest,
        startDeltaBps: spreadCurve.startDeltaBps,
        endDeltaBps: spreadCurve.endDeltaBps,
        points: resolveSpreadCurvePoints(intent.startTime, intent.endTime, spreadCurve),
    };
}

/**
 * Splits a session-API add-order payload into the EIP-712 wire form, moving
 * the spread curve out of the order to the payload level.
 */
export function buildAddOrderWirePayload(
    payload: AddOrder | AddSmartOrder
): AddOrderEip712Wire {
    const { spreadCurve, ...order } = payload.order;
    return {
        order,
        spreadCurve,
        ...("signedPermit" in payload && { signedPermit: payload.signedPermit }),
        ...(payload.annotations !== undefined && { annotations: payload.annotations }),
    };
}
