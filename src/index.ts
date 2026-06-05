// Public API barrel.
// Deep imports into src/* remain supported for backwards-compatibility.

export {
    TurbineClient,
    fetchConfig,
    getPools,
    getUserPositions,
    getRandomSalt,
} from "./turbineClient";

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
