// Public API barrel.
// Deep imports into src/* remain supported for backwards-compatibility.

export { TurbineClient, fetchConfig, getRandomSalt } from "./turbineClient";

export type {
    OrderIntent,
    AddLiquidityIntent,
    RemoveLiquidityIntent,
    TurbinePool,
    UserPosition,
    OrderState,
    OrderStatus,
    OrderDetails,
    OrderAnnotations,
    GetOrdersOptions,
    GetOrdersResponse,
    TurbineConfig,
    TurbineToken,
    TurbineTokenClass,
    SpreadCurve,
    CurvePoint,
} from "./models";

export {
    computeRemoveLiquidityIntentHash,
    createPool,
    executePendingRemoveLiquidityIntentsOnchain,
    flushExpiredRemoveLiquidityIntentsOnchain,
    getInitialLpScale,
    getLiquidityConstants,
    getMinimumLiquidity,
    getPoolId,
    getPools,
    getUserPositions,
    submitRemoveLiquidityIntentOnchain,
    submitRemoveLiquidityTransaction,
} from "./onchain";

export * as spreads from "./spreads";

export { TurbineError, isTurbineError } from "./errorHandling";

export {
    USDT,
    MIN_DELTA_BPS,
    MAX_DELTA_BPS,
    MIN_WINDOW_BPS,
    MAX_WINDOW_BPS,
    MAX_SPREAD_CURVE_POINTS,
} from "./constants";

export { TURBINE_API_URL } from "./config";
