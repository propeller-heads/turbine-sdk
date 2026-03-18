// Client
export {
    TurbineClient,
    getPools,
    getUserPositions,
    fetchConfig,
    checkStatus,
    getRandomSalt,
    convertSignature,
} from "./turbineClient";

// Models & Types
export type {
    TurbineConfig,
    PermitDetails,
    AllowanceTransferPermitSingle,
    AllowanceTransferPermitBatch,
    PrimitiveSignature,
    TokenPermissions,
    SignatureTransferPermitTransferFrom,
    SignatureTransferPermitBatchTransferFrom,
    SignedSignatureTransfer,
    SignedBatchSignatureTransfer,
    SignedSignatureTransferOnchain,
    SignedPermit,
    SignedPermitOnchain,
    SignedPermitBatch,
    AddOrder,
    AddSmartOrder,
    OrderIntent,
    AddLiquidity,
    AddLiquidityIntent,
    RemoveLiquidity,
    RemoveLiquidityIntent,
    RemoveLiquidityIntentOnchain,
    TurbinePool,
    UserPosition,
    Price,
    OrderStatusOrder,
    OrderExecution,
    OrderState,
    LiquidityIntentState,
    OrderSettledAmount,
    CancelOrderPayload,
    GetOrderStatesPayload,
    PoolKey,
} from "./models";
export { Token, LiquidityIntentStatus } from "./models";

// Error Handling
export type { TurbineErrorCode } from "./errorHandling";
export {
    TurbineError,
    isTurbineError,
    toTurbineError,
    unsuccessfulResponseToTurbineError,
} from "./errorHandling";

// Config
export { CHAIN_ID, TURBINE_API_URL } from "./config";

// Constants
export {
    USDC,
    USDT,
    DAI,
    UNI,
    WETH,
    WEETH,
    PEPE,
    WBTC,
    ADDR2TOKEN,
    SQRT_PRICE_IDENTITY,
    NULL_ADDRESS,
} from "./constants";

// Permit2 (AllowanceTransfer)
export type {
    getSignedAllowanceReturnType,
    getBatchSignedAllowanceReturnType,
} from "./permit2";
export {
    getNonce,
    getSignedAllowance,
    getBatchSignedAllowance,
    getSignature,
} from "./permit2";

// Permit2 (SignatureTransfer)
export type {
    GetSignedSignatureTransferReturnType,
    GetSignedBatchSignatureTransferReturnType,
} from "./permit2SignatureTransfer";
export {
    getRandomNonce,
    getSignedSignatureTransfer,
    getSignedBatchSignatureTransfer,
} from "./permit2SignatureTransfer";

// Validation
export {
    validateOrderIntent,
    validateAddLiquidityIntent,
    validateRemoveLiquidityIntent,
    validateRemoveLiquidityIntentOnchain,
} from "./validation";

// ABI
export {
    turbineLiquidityRouterABI,
    turbineHookABI,
    balanceOfABI,
    poolManagerABI,
    orderSettledABI,
} from "./abi";

// Utils
export { buildApiUrl } from "./utils";
