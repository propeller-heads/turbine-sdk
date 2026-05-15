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

import { Address, Hex, hexToBytes, bytesToHex } from "viem";
import { TurbineError } from "./errorHandling";
import {
    OrderIntent,
    AddLiquidityIntent,
    RemoveLiquidityIntent,
    RemoveLiquidityIntentOnchain,
    LiquidityIntentStatus,
    PrimitiveSignature,
    TokenPermissions,
    SignedBatchSignatureTransfer,
    SignatureTransferPermitBatchTransferFrom,
    SignedSignatureTransferOnchain,
    SignatureTransferPermitTransferFrom,
    TurbineConfig,
    TurbineToken,
    TurbineTokenClass,
    Price,
    SpreadCurve,
    CurvePoint,
} from "./models";
import {
    MIN_DELTA_BPS,
    MAX_DELTA_BPS,
    MIN_WINDOW_BPS,
    MAX_WINDOW_BPS,
    MAX_SPREAD_CURVE_POINTS,
    NULL_ADDRESS,
} from "./constants";
import { validateNumber, validateObject, validateBigInt, validateBoolean, validateAddress, validatePositiveBigInt, validateHex, validateNonNegativeBigInt, validateSignatureHex, validateHash, validateBigIntConvertible, validateString, optional, validateBlockNumber, validateArray, validateFields } from "./validationPrimitives";
export * from "./validationPrimitives";


const WINDOW_BPS_DENOMINATOR = 10000;

// ============================================================================
// DOMAIN-SPECIFIC VALIDATORS
// ============================================================================

/**
 * Validates a fee value in hundredths of basis points
 * - 1 basis point = 0.01%
 * - 1 hundredth of basis point = 0.0001%
 * - 3000 = 0.3% (common Uniswap fee)
 * - Range: 0 to 1,000,000 (0% to 100%)
 *
 * @param fee - The fee value to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns The validated fee
 * @throws TurbineError if validation fails
 *
 * @example
 * validateFee(3000, 'fee') // 0.3% - OK
 * validateFee(1500000, 'fee') // > 100% - throws
 */
export function validateFee(fee: unknown, fieldName: string): number {
    const feeNum = validateNumber(fee, fieldName);

    // Fee must be an integer
    if (!Number.isInteger(feeNum)) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be an integer (in hundredths of basis points), got ${feeNum}`,
            { fieldName, receivedValue: fee }
        );
    }

    // Fee range: 0 to 1,000,000 (0% to 100%)
    if (feeNum < 0 || feeNum > 1000000) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be between 0 and 1000000 (0% to 100%), got ${feeNum}. Example: 3000 = 0.3%`,
            { fieldName, receivedValue: fee }
        );
    }

    return feeNum;
}

/** Validate a `deltaBps` field on a {@link SpreadCurve}. Signed `[-10_000, 9_999]`. */
function validateDeltaBps(value: unknown, fieldName: string): number {
    const n = validateNumber(value, fieldName);
    if (!Number.isInteger(n)) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be an integer (in basis points), got ${n}`,
            { fieldName, receivedValue: value }
        );
    }
    if (n < MIN_DELTA_BPS || n > MAX_DELTA_BPS) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be in [${MIN_DELTA_BPS}, ${MAX_DELTA_BPS}], got ${n}`,
            { fieldName, receivedValue: value }
        );
    }
    return n;
}

/** Validate a `windowBps` field on a {@link SpreadCurve} point. Unsigned `[1, 9_999]`. */
function validateWindowBps(value: unknown, fieldName: string): number {
    const n = validateNumber(value, fieldName);
    if (!Number.isInteger(n)) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be an integer (in basis points), got ${n}`,
            { fieldName, receivedValue: value }
        );
    }
    if (n < MIN_WINDOW_BPS || n > MAX_WINDOW_BPS) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be in [${MIN_WINDOW_BPS}, ${MAX_WINDOW_BPS}], got ${n}`,
            { fieldName, receivedValue: value }
        );
    }
    return n;
}

/**
 * Validate a {@link SpreadCurve}.
 *
 * Invariants enforced:
 * - `startDeltaBps`, `endDeltaBps`, and every `points[i].deltaBps` is an integer
 *   in `[-10_000, 9_999]`. `points[i].windowBps` is an integer in `[1, 9_999]`.
 * - `points` is an array (empty allowed) of `{ windowBps, deltaBps }`.
 * - `points[i].windowBps` is strictly increasing.
 */
export function validateSpreadCurve(value: unknown, fieldName: string): SpreadCurve {
    const obj = validateObject(value, fieldName);
    const curve = obj as Record<string, unknown>;

    const startDeltaBps = validateDeltaBps(
        curve.startDeltaBps,
        `${fieldName}.startDeltaBps`
    );
    const endDeltaBps = validateDeltaBps(curve.endDeltaBps, `${fieldName}.endDeltaBps`);

    if (!Array.isArray(curve.points)) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName}.points must be an array`,
            { fieldName: `${fieldName}.points`, receivedValue: curve.points }
        );
    }

    // DoS guard: cap before per-point allocation. Backend enforces a tighter
    // duration-relative cap; this is a coarse pre-check so a malicious caller cannot
    // force the SDK to walk a huge array before the wire validator rejects.
    if (curve.points.length > MAX_SPREAD_CURVE_POINTS) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName}.points has ${curve.points.length} entries; max is ${MAX_SPREAD_CURVE_POINTS}`,
            { fieldName: `${fieldName}.points`, receivedValue: curve.points.length }
        );
    }

    const points: CurvePoint[] = curve.points.map((p, i) => {
        const pObj = validateObject(p, `${fieldName}.points[${i}]`);
        const point = pObj as Record<string, unknown>;
        return {
            windowBps: validateWindowBps(
                point.windowBps,
                `${fieldName}.points[${i}].windowBps`
            ),
            deltaBps: validateDeltaBps(
                point.deltaBps,
                `${fieldName}.points[${i}].deltaBps`
            ),
        };
    });

    for (let i = 1; i < points.length; i++) {
        if (points[i].windowBps <= points[i - 1].windowBps) {
            throw new TurbineError(
                "INPUT_VALIDATION_ERROR",
                `${fieldName}.points must have strictly increasing windowBps; ` +
                    `got points[${i - 1}].windowBps=${points[i - 1].windowBps} >= ` +
                    `points[${i}].windowBps=${points[i].windowBps}`,
                { fieldName, receivedValue: value }
            );
        }
    }

    return { startDeltaBps, endDeltaBps, points };
}

/**
 * Cross-validate a {@link SpreadCurve}'s interior `points` against an order's
 * duration in seconds.
 *
 * The backend converts `windowBps` to an absolute time offset via integer
 * truncation `floor(windowBps * durationSecs / 10_000)`, so for short orders:
 *
 * - small `windowBps` values can round to offset `0` and collide with the order
 *   start (rejected on-server as "PointOutsideWindow"), and
 * - distinct `windowBps` values can map to the same `time_secs` and trip the
 *   backend's `NonMonotonicPoints` check.
 *
 * The minimum effective resolution is `durationSecs / 10_000` seconds; for an
 * order shorter than 10_000 seconds you cannot place an interior point at every
 * possible `windowBps`. This validator surfaces both failure modes with a clear
 * error before the order is signed and submitted.
 */
function validateSpreadCurveTruncation(
    curve: SpreadCurve,
    durationSecs: bigint,
    fieldName: string
): void {
    if (curve.points.length === 0) return;

    if (durationSecs <= 0n) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName}: order duration must be positive to host any interior curve points`,
            { fieldName, receivedValue: durationSecs.toString() }
        );
    }

    let prevOffset: bigint | null = null;
    for (let i = 0; i < curve.points.length; i++) {
        const point = curve.points[i];
        const offset =
            (BigInt(point.windowBps) * durationSecs) / BigInt(WINDOW_BPS_DENOMINATOR);
        if (offset === 0n) {
            throw new TurbineError(
                "INPUT_VALIDATION_ERROR",
                `${fieldName}.points[${i}].windowBps=${point.windowBps} truncates to ` +
                    `time offset 0 against order duration ${durationSecs}s ` +
                    `(min effective windowBps = ceil(10000 / durationSecs)). ` +
                    `Increase order duration or drop the point.`,
                { fieldName, receivedValue: point.windowBps }
            );
        }
        // `offset >= durationSecs` is unreachable: validateSpreadCurve already
        // bounds `windowBps <= 9999`, so `floor(9999 * d / 10000) < d` for any
        // positive `d`. The upper boundary is enforced by `validateSpreadCurve`'s
        // open-interval bps check.
        if (prevOffset !== null && offset <= prevOffset) {
            throw new TurbineError(
                "INPUT_VALIDATION_ERROR",
                `${fieldName}.points[${i}].windowBps=${point.windowBps} collides with ` +
                    `points[${i - 1}] after truncation against order duration ${durationSecs}s ` +
                    `(both resolve to time offset ${offset}s). ` +
                    `Min spacing in windowBps = ceil(10000 / durationSecs).`,
                { fieldName, receivedValue: point.windowBps }
            );
        }
        prevOffset = offset;
    }
}

/**
 * Validates a Unix timestamp (seconds since epoch)
 *
 * @param timestamp - The timestamp to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @param options - Validation options
 * @param options.allowPast - Allow timestamps in the past (default: true)
 * @param options.allowFuture - Allow timestamps in the future (default: true)
 * @returns The validated timestamp
 * @throws TurbineError if validation fails
 */
export function validateTimestamp(
    timestamp: unknown,
    fieldName: string,
    options: { allowPast?: boolean; allowFuture?: boolean } = {}
): bigint {
    const { allowPast = true, allowFuture = true } = options;

    const ts = validateBigInt(timestamp, fieldName);

    if (ts < 0n) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must be non-negative, got ${ts}`,
            { fieldName, receivedValue: timestamp }
        );
    }

    const now = BigInt(Math.floor(Date.now() / 1000));

    if (!allowPast && ts < now) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} cannot be in the past. Got ${ts}, current time is ${now}`,
            { fieldName, receivedValue: timestamp, currentTime: now }
        );
    }

    if (!allowFuture && ts > now) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} cannot be in the future. Got ${ts}, current time is ${now}`,
            { fieldName, receivedValue: timestamp, currentTime: now }
        );
    }

    return ts;
}

/**
 * Validates that a time range is valid (startTime < endTime)
 *
 * @param startTime - The start timestamp
 * @param endTime - The end timestamp
 * @throws TurbineError if validation fails
 */
export function validateTimeRange(startTime: bigint, endTime: bigint): void {
    if (startTime >= endTime) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `endTime must be greater than startTime. Got startTime=${startTime}, endTime=${endTime}`,
            { startTime, endTime }
        );
    }
}

/**
 * Validates that two token addresses form a valid pair
 * - Tokens must be different
 * - Neither token can be the NULL_ADDRESS
 *
 * @param token0 - First token address
 * @param token1 - Second token address
 * @throws TurbineError if validation fails
 */
export function validateTokenPair(token0: Address, token1: Address): void {
    if (token0.toLowerCase() === token1.toLowerCase()) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `token0 and token1 must be different addresses. Both are ${token0}`,
            { token0, token1 }
        );
    }

    if (token0.toLowerCase() === NULL_ADDRESS.toLowerCase()) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `token0 cannot be the NULL_ADDRESS (${NULL_ADDRESS})`,
            { token0 }
        );
    }

    if (token1.toLowerCase() === NULL_ADDRESS.toLowerCase()) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `token1 cannot be the NULL_ADDRESS (${NULL_ADDRESS})`,
            { token1 }
        );
    }
}

/**
 * Validates a PrimitiveSignature object
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns The validated signature
 * @throws TurbineError if validation fails
 */
export function validatePrimitiveSignature(
    value: unknown,
    fieldName: string
): PrimitiveSignature {
    const obj = validateObject(value, fieldName);

    if (!("r" in obj) || !("s" in obj) || !("yParity" in obj)) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} must have r, s, and yParity properties`,
            { fieldName, receivedValue: value }
        );
    }

    // Validate r and s are valid BigInts (note: BigInt with capital B is the constructor)
    if (typeof (obj as any).r !== "bigint") {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName}.r must be a bigint, got ${typeof (obj as any).r}`,
            { fieldName, receivedValue: value }
        );
    }

    if (typeof (obj as any).s !== "bigint") {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName}.s must be a bigint, got ${typeof (obj as any).s}`,
            { fieldName, receivedValue: value }
        );
    }

    validateBoolean((obj as any).yParity, `${fieldName}.yParity`);

    return obj as PrimitiveSignature;
}

// ============================================================================
// COMPLEX OBJECT VALIDATORS
// ============================================================================

/**
 * Validates an OrderIntent object
 * Performs comprehensive validation of all fields
 *
 * @param intent - The order intent to validate
 * @returns The validated order intent
 * @throws TurbineError if validation fails
 */
export function validateOrderIntent(intent: unknown): OrderIntent {
    const obj = validateObject(intent, "orderIntent") as Record<string, unknown>;

    // Both `callData` and `callDataTarget` must point at a real target for smart
    // orders, or both unset for regular orders. Reject half-set early — calldata
    // aimed at the null address (or a target with no calldata) would otherwise
    // produce an unexecutable on-chain transaction.
    const callDataPresent = typeof obj.callData === "string" && obj.callData !== "0x";
    const callDataTargetPresent =
        typeof obj.callDataTarget === "string" && obj.callDataTarget !== NULL_ADDRESS;
    if (callDataPresent !== callDataTargetPresent) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            "orderIntent: `callData` and `callDataTarget` must both be set for a smart " +
                "order or both unset for a regular order. Got callData=" +
                (callDataPresent ? "non-empty" : '"0x"') +
                ", callDataTarget=" +
                (callDataTargetPresent ? "non-zero" : "NULL_ADDRESS"),
            {
                field: "orderIntent.callData/callDataTarget",
                receivedValue: {
                    callData: obj.callData,
                    callDataTarget: obj.callDataTarget,
                },
            }
        );
    }

    const validated = validateFields<OrderIntent>(
        intent,
        {
            owner: validateAddress,
            sellToken: validateAddress,
            buyToken: validateAddress,
            sellAmount: validatePositiveBigInt,
            minBuyAmount: validatePositiveBigInt,
            spreadCurve: validateSpreadCurve,
            startTime: validateTimestamp,
            endTime: (v: unknown, n: string) =>
                validateTimestamp(v, n, { allowPast: false }),
            partialFill: validateBoolean,
            callData: validateHex,
            callDataTarget: validateAddress,
            salt: validateHex,
        },
        "orderIntent"
    );

    validateTimeRange(validated.startTime, validated.endTime);
    validateTokenPair(validated.sellToken, validated.buyToken);

    // Reject curves whose `windowBps` points truncate to the order start or
    // collide after truncation. Catches the failure modes the backend surfaces
    // as `PointOutsideWindow` / `NonMonotonicPoints` for short-duration orders.
    validateSpreadCurveTruncation(
        validated.spreadCurve,
        validated.endTime - validated.startTime,
        "orderIntent.spreadCurve"
    );

    return validated;
}

/**
 * Validates an AddLiquidityIntent object
 *
 * @param intent - The add liquidity intent to validate
 * @returns The validated intent
 * @throws TurbineError if validation fails
 */
export function validateAddLiquidityIntent(intent: unknown): AddLiquidityIntent {
    const validated = validateFields<AddLiquidityIntent>(
        intent,
        {
            owner: validateAddress,
            token0: validateAddress,
            token1: validateAddress,
            fee: validateFee,
            token0Amount: validateNonNegativeBigInt,
            token1Amount: validateNonNegativeBigInt,
            exact: validateBoolean,
            salt: validateHex,
        },
        "addLiquidityIntent"
    );

    // Check that at least one amount is positive (allow single-sided liquidity)
    if (validated.token0Amount === 0n && validated.token1Amount === 0n) {
        throw new TurbineError(
            "ZERO_LIQUIDITY",
            "At least one token amount must be greater than zero for liquidity addition."
        );
    }

    // Relationship validation
    validateTokenPair(validated.token0, validated.token1);

    return validated;
}

/**
 * Validates a RemoveLiquidityIntent object
 *
 * @param intent - The remove liquidity intent to validate
 * @returns The validated intent
 * @throws TurbineError if validation fails
 */
export function validateRemoveLiquidityIntent(intent: unknown): RemoveLiquidityIntent {
    const validated = validateFields<RemoveLiquidityIntent>(
        intent,
        {
            owner: validateAddress,
            token0: validateAddress,
            token1: validateAddress,
            fee: validateFee,
            lpToken: validateAddress,
            lpTokenAmount: validatePositiveBigInt,
            salt: validateHex,
        },
        "removeLiquidityIntent"
    );

    // Check that LP token amount is positive
    if (validated.lpTokenAmount === 0n) {
        throw new TurbineError(
            "ZERO_LIQUIDITY",
            "LP token amount must be greater than zero for liquidity removal."
        );
    }

    // Relationship validation
    validateTokenPair(validated.token0, validated.token1);

    return validated;
}

// ============================================================================
// PERMIT2 AND LIQUIDITY VALIDATORS
// ============================================================================

/**
 * Validates a TokenPermissions object
 *
 * @param value - The value to validate
 * @returns The validated token permissions
 * @throws TurbineError if validation fails
 */
export function validateTokenPermissions(value: unknown): TokenPermissions {
    return validateFields<TokenPermissions>(
        value,
        {
            token: validateAddress,
            amount: validateNonNegativeBigInt,
        },
        "tokenPermissions"
    );
}

/**
 * Validates an array of TokenPermissions objects
 *
 * @param value - The value to validate
 * @param expectedLength - Optional expected length of the array
 * @throws TurbineError if validation fails
 */
export function validateTokenPermissionsArray(
    value: unknown,
    expectedLength?: number
): void {
    if (!Array.isArray(value)) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            "tokenPermissions must be an array",
            { receivedValue: value, receivedType: typeof value }
        );
    }

    if (expectedLength !== undefined && value.length !== expectedLength) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `tokenPermissions array must have exactly ${expectedLength} elements, got ${value.length}`,
            { expectedLength, actualLength: value.length }
        );
    }

    value.forEach((item, index) => {
        try {
            validateTokenPermissions(item);
        } catch (error) {
            if (error instanceof TurbineError) {
                throw new TurbineError(
                    error.code,
                    `tokenPermissions[${index}]: ${error.message}`,
                    error.details
                );
            }
            throw error;
        }
    });
}

/**
 * Validates a SignedBatchSignatureTransfer object
 * Used for batch token approvals (e.g., token0 and token1 for liquidity)
 *
 * @param value - The value to validate
 * @throws TurbineError if validation fails
 */
export function validateSignedBatchSignatureTransfer(value: unknown): void {
    // Helper validator for permitted array
    const validatePermittedArray = (
        v: unknown,
        fieldName: string
    ): TokenPermissions[] => {
        if (!Array.isArray(v)) {
            throw new TurbineError(
                "INPUT_VALIDATION_ERROR",
                `${fieldName} must be an array for batch signature transfer`,
                { fieldName, receivedValue: v }
            );
        }
        return v.map((item, index) => {
            try {
                return validateTokenPermissions(item);
            } catch (error) {
                if (error instanceof TurbineError) {
                    throw new TurbineError(
                        error.code,
                        `${fieldName}[${index}]: ${error.message}`,
                        error.details
                    );
                }
                throw error;
            }
        });
    };

    validateFields<SignedBatchSignatureTransfer>(
        value,
        {
            signature: validatePrimitiveSignature,
            permit: (v, n) =>
                validateFields<SignatureTransferPermitBatchTransferFrom>(
                    v,
                    {
                        permitted: validatePermittedArray,
                        nonce: validateBigInt,
                        deadline: validatePositiveBigInt,
                    },
                    n
                ),
        },
        "signedBatchSignatureTransfer"
    );
}

/**
 * Validates a SignedSignatureTransferOnchain object
 * Used for onchain permit transfers with raw signature hex
 *
 * @param value - The value to validate
 * @returns The validated signed signature transfer
 * @throws TurbineError if validation fails
 */
export function validateSignedSignatureTransferOnchain(
    value: unknown
): SignedSignatureTransferOnchain {
    return validateFields<SignedSignatureTransferOnchain>(
        value,
        {
            signature: validateSignatureHex,
            permit: (v, n) =>
                validateFields<SignatureTransferPermitTransferFrom>(
                    v,
                    {
                        permitted: validateTokenPermissions,
                        nonce: validateBigInt,
                        deadline: validatePositiveBigInt,
                    },
                    n
                ),
        },
        "signedSignatureTransferOnchain"
    );
}

/**
 * Validates a RemoveLiquidityIntentOnchain object
 *
 * @param intent - The intent to validate
 * @throws TurbineError if validation fails
 */
export function validateRemoveLiquidityIntentOnchain(intent: unknown): void {
    validateFields<RemoveLiquidityIntentOnchain>(
        intent,
        {
            owner: validateAddress,
            poolId: validateHash,
            lpTokenAmount: validatePositiveBigInt,
            salt: validateHex,
        },
        "removeLiquidityIntentOnchain"
    );
}

/**
 * Validates an AddLiquidity payload object
 * Used for adding liquidity with signed permit
 *
 * @param payload - The payload to validate
 * @throws TurbineError if validation fails
 */
export function validateAddLiquidityPayload(payload: unknown): void {
    const obj = validateObject(payload, "addLiquidityPayload");

    // Validate required fields exist
    if (!("addLiquidity" in obj) || !("permitTokens" in obj)) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            "addLiquidityPayload must have addLiquidity and permitTokens properties",
            { receivedValue: payload }
        );
    }

    const payloadAny = obj as any;

    validateAddLiquidityIntent(payloadAny.addLiquidity);
    validateSignedBatchSignatureTransfer(payloadAny.permitTokens);
}

// ============================================================================
// CONTRACT RESPONSE VALIDATORS
// ============================================================================

/**
 * Validates pool data returned from the TurbineHook contract
 *
 * @param poolData - The pool data object from the contract
 * @param index - Index of the pool in the array (for error messages)
 * @throws TurbineError if validation fails
 */
export function validatePoolData(poolData: unknown, index: number): void {
    const validated = validateFields<any>(
        poolData,
        {
            token0: validateAddress,
            token1: validateAddress,
            fee: validateFee,
            lpToken: validateAddress,
            reserve0: validateBigIntConvertible,
            reserve1: validateBigIntConvertible,
            liquidity: validateBigIntConvertible,
        },
        `poolData[${index}]`
    );

    // Relationship validation
    validateTokenPair(validated.token0, validated.token1);
}

/**
 * Validates a balance result from a multicall
 *
 * @param result - The balance result from multicall
 * @param fieldName - Name of the field being validated (for error messages)
 * @throws TurbineError if validation fails
 */
export function validateBalanceResult(result: unknown, fieldName: string): void {
    const obj = validateObject(result, fieldName);

    if (!("status" in obj)) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName} is missing required field: status`,
            { receivedValue: result }
        );
    }

    const resultAny = obj as any;
    const status = validateString(resultAny.status, `${fieldName}.status`);

    if (status !== "success" && status !== "failure") {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `${fieldName}.status must be "success" or "failure", got ${status}`,
            { receivedValue: result }
        );
    }

    if (status === "success") {
        if (!("result" in resultAny)) {
            throw new TurbineError(
                "INPUT_VALIDATION_ERROR",
                `${fieldName} with status "success" must have result field`,
                { receivedValue: result }
            );
        }
        // Validate result is a bigint
        validateBigInt(resultAny.result, `${fieldName}.result`);
    }
}

/**
 * Validates a TurbineConfig object
 *
 * @param config - The config object to validate
 * @returns The validated config
 * @throws TurbineError if validation fails
 */
export function validateTurbineToken(token: unknown, fieldName: string): TurbineToken {
    return validateFields<TurbineToken>(
        token,
        {
            address: validateAddress,
            symbol: validateString,
            decimals: validateNumber,
            class: (value: unknown, name: string) => {
                const str = validateString(value, name);
                if (str !== "Regular" && str !== "Stable" && str !== "Meme") {
                    throw new TurbineError(
                        "INPUT_VALIDATION_ERROR",
                        `${name} must be "Regular", "Stable", or "Meme", got "${str}"`,
                        { fieldName: name, receivedValue: value }
                    );
                }
                return str as TurbineTokenClass;
            },
        },
        fieldName
    );
}

export function validateTurbineConfig(config: unknown): TurbineConfig {
    return validateFields<TurbineConfig>(
        config,
        {
            turbineSettlerAddress: validateAddress,
            lpHookAddress: validateAddress,
            lpRouterAddress: validateAddress,
            poolManagerAddress: validateAddress,
            submitSettlements: validateBoolean,
            siweDomain: validateString,
            siweUri: validateString,
            tokens: (value: unknown, name: string) =>
                validateArray(value, name, (item, index) =>
                    validateTurbineToken(item, `${name}[${index}]`)
                ),
        },
        "TurbineConfig"
    );
}

// ============================================================================
// API RESPONSE VALIDATORS
// ============================================================================

/**
 * Validates a Price structure (numerator and denominator).
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns The validated Price with numerator and denominator as bigints
 * @throws TurbineError if validation fails
 */
export function validatePrice(value: unknown, fieldName: string): Price {
    return validateFields<Price>(
        value,
        {
            numerator: validateBigIntConvertible,
            denominator: validateBigIntConvertible,
        },
        fieldName
    );
}

/**
 * Validates a raw OrderExecution response from the API (with camelCase fields).
 * Only validates structure and types, does not transform the data.
 *
 * @param value - The value to validate
 * @throws TurbineError if validation fails
 */
export function validateOrderExecutionResponse(value: unknown): void {
    const obj = validateObject(value, "orderExecution");

    const requiredFields = [
        "txHash",
        "blockNumber",
        "soldAmount",
        "boughtAmount",
        "surplusBuyAmount",
    ];

    for (const field of requiredFields) {
        if (!(field in obj)) {
            throw new TurbineError(
                "INPUT_VALIDATION_ERROR",
                `orderExecution is missing required field: ${field}`,
                { field, receivedValue: value }
            );
        }
    }

    const execAny = obj as any;

    optional(validateHash, execAny.txHash, "orderExecution.txHash");
    validateBlockNumber(execAny.blockNumber, "orderExecution.blockNumber");

    validateBigIntConvertible(execAny.soldAmount, "orderExecution.soldAmount");
    validateBigIntConvertible(execAny.boughtAmount, "orderExecution.boughtAmount");
    validateBigIntConvertible(
        execAny.surplusBuyAmount,
        "orderExecution.surplusBuyAmount"
    );

    if (execAny.midPrice != null) {
        validatePrice(execAny.midPrice, "orderExecution.midPrice");
    }
}

/**
 * Validates a raw OrderState response from the API (with camelCase fields).
 * Only validates structure and types, does not transform the data.
 *
 * @param value - The value to validate
 * @throws TurbineError if validation fails
 */
export function validateOrderStateResponse(value: unknown): void {
    const obj = validateObject(value, "orderState");

    const requiredFields = ["hash", "status", "execution"];

    for (const field of requiredFields) {
        if (!(field in obj)) {
            throw new TurbineError(
                "INPUT_VALIDATION_ERROR",
                `orderState is missing required field: ${field}`,
                { field, receivedValue: value }
            );
        }
    }

    const stateAny = obj as any;

    validateHash(stateAny.hash, "orderState.hash");
    validateString(stateAny.status, "orderState.status");

    // Validate execution array and each execution
    validateArray(stateAny.execution, "orderState.execution", (exec) => {
        validateOrderExecutionResponse(exec);
    });

    if (stateAny.orderDetails != null) {
        validateOrderDetailsResponse(stateAny.orderDetails);
    }
}

/**
 * Validates a raw OrderDetails response from the API (with camelCase fields).
 * Only validates structure and types, does not transform the data.
 *
 * @param value - The value to validate
 * @throws TurbineError if validation fails
 */
export function validateOrderDetailsResponse(value: unknown): void {
    const obj = validateObject(value, "orderDetails");

    const requiredFields = [
        "sellToken",
        "buyToken",
        "sellAmount",
        "limitPrice",
        "startTime",
        "endTime",
        "createdTimestamp",
    ];

    for (const field of requiredFields) {
        if (!(field in obj)) {
            throw new TurbineError(
                "INPUT_VALIDATION_ERROR",
                `orderDetails is missing required field: ${field}`,
                { field, receivedValue: value }
            );
        }
    }

    const detailsAny = obj as any;

    validateAddress(detailsAny.sellToken, "orderDetails.sellToken");
    validateAddress(detailsAny.buyToken, "orderDetails.buyToken");
    validateBigIntConvertible(detailsAny.sellAmount, "orderDetails.sellAmount");
    validatePrice(detailsAny.limitPrice, "orderDetails.limitPrice");
    validateBigIntConvertible(detailsAny.startTime, "orderDetails.startTime");
    validateBigIntConvertible(detailsAny.endTime, "orderDetails.endTime");
    validateString(detailsAny.createdTimestamp, "orderDetails.createdTimestamp");
}

/**
 * Validates a raw GetOrders response from the API.
 *
 * @param value - The value to validate
 * @throws TurbineError if validation fails
 */
export function validateGetOrdersResponse(value: unknown): void {
    const obj = validateObject(value, "getOrdersResponse");

    const requiredFields = ["orders", "cursor", "hasMore"];
    for (const field of requiredFields) {
        if (!(field in obj)) {
            throw new TurbineError(
                "INPUT_VALIDATION_ERROR",
                `getOrdersResponse is missing required field: ${field}`,
                { field, receivedValue: value }
            );
        }
    }

    const respAny = obj as any;

    validateArray(respAny.orders, "getOrdersResponse.orders", (order) => {
        validateOrderStateResponse(order);
    });

    if (respAny.cursor !== null) {
        validateString(respAny.cursor, "getOrdersResponse.cursor");
    }

    validateBoolean(respAny.hasMore, "getOrdersResponse.hasMore");
}

/**
 * Validates a raw LiquidityIntentState response from the API.
 * Only validates structure and types, does not transform the data.
 *
 * @param value - The value to validate
 * @throws TurbineError if validation fails
 */
export function validateLiquidityIntentStateResponse(value: unknown): void {
    const obj = validateObject(value, "liquidityIntentState");

    const requiredFields = ["hash", "status"];

    for (const field of requiredFields) {
        if (!(field in obj)) {
            throw new TurbineError(
                "INPUT_VALIDATION_ERROR",
                `liquidityIntentState is missing required field: ${field}`,
                { field, receivedValue: value }
            );
        }
    }

    const stateAny = obj as any;

    // Validate field types and formats
    validateHash(stateAny.hash, "liquidityIntentState.hash");
    const statusStr = validateString(stateAny.status, "liquidityIntentState.status");

    // Validate status is a valid enum value
    const statusKey = statusStr as keyof typeof LiquidityIntentStatus;
    if (!(statusKey in LiquidityIntentStatus)) {
        throw new TurbineError(
            "INPUT_VALIDATION_ERROR",
            `liquidityIntentState.status has invalid value: ${statusStr}. Must be one of: ${Object.keys(LiquidityIntentStatus).join(", ")}`,
            {
                receivedValue: statusStr,
                validValues: Object.keys(LiquidityIntentStatus),
            }
        );
    }
}

// ============================================================================
// SIGNATURE UTILITIES
// ============================================================================

/**
 * Convert hex string to 65-byte signature.
 * Does not validate - caller should validate using validateSignatureHex if needed.
 *
 * @param hex - 132-character hex string (0x + 130 hex chars)
 * @returns 65-byte signature
 */
export function hexToSignature(hex: Hex): Uint8Array {
    return hexToBytes(hex);
}

/**
 * Parse a 65-byte signature into its components.
 *
 * @param signature - 65-byte signature (r: 32, s: 32, v: 1)
 * @returns Object with r, s, and v components
 */
export function parseSignatureBytes(signature: Uint8Array): {
    r: Uint8Array; // 32 bytes
    s: Uint8Array; // 32 bytes
    v: number; // 1 byte (27/28 or 0/1)
} {
    return {
        r: signature.slice(0, 32),
        s: signature.slice(32, 64),
        v: signature[64],
    };
}

/**
 * Convert a 65-byte signature to bigint components.
 * This format is used in the PrimitiveSignature interface.
 *
 * @param signature - 65-byte signature
 * @returns Object with bigint r, s and boolean yParity
 */
export function signatureToComponents(signature: Uint8Array): {
    r: bigint;
    s: bigint;
    yParity: boolean;
} {
    const { r, s, v } = parseSignatureBytes(signature);

    return {
        r: bytesToBigInt(r),
        s: bytesToBigInt(s),
        yParity: v === 28 || v === 1, // Convert v (27/28 or 0/1) to yParity (false/true)
    };
}

/**
 * Convert Uint8Array to BigInt.
 * Interprets bytes as big-endian unsigned integer.
 *
 * @param bytes - Byte array to convert
 * @returns BigInt representation
 */
export function bytesToBigInt(bytes: Uint8Array): bigint {
    if (bytes.length === 0) {
        return 0n;
    }
    return BigInt(bytesToHex(bytes));
}
