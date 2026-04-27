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
    TurbineConfig,
    TurbineToken,
    TurbineTokenClass,
} from "./models";

export { TurbineError, isTurbineError } from "./errorHandling";

export { USDT } from "./constants";

export { TURBINE_API_URL } from "./config";
