"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ADDR2TOKEN: () => ADDR2TOKEN,
  CHAIN_ID: () => CHAIN_ID,
  DAI: () => DAI,
  LiquidityIntentStatus: () => LiquidityIntentStatus,
  MOCKED_TURBINE_POOL: () => MOCKED_TURBINE_POOL,
  NULL_ADDRESS: () => NULL_ADDRESS,
  PEPE: () => PEPE,
  RPC_URL: () => RPC_URL,
  SQRT_PRICE_IDENTITY: () => SQRT_PRICE_IDENTITY,
  TURBINE_API_URL: () => TURBINE_API_URL,
  Token: () => Token,
  TurbineClient: () => TurbineClient,
  TurbineError: () => TurbineError,
  UNI: () => UNI,
  USDC: () => USDC,
  USDT: () => USDT,
  W3_BLOCK_NUMBER_RPC_URL: () => W3_BLOCK_NUMBER_RPC_URL,
  W3_WEBSOCKET: () => W3_WEBSOCKET,
  WBTC: () => WBTC,
  WEETH: () => WEETH,
  WETH: () => WETH,
  balanceOfABI: () => balanceOfABI,
  buildApiUrl: () => buildApiUrl,
  checkStatus: () => checkStatus,
  convertSignature: () => convertSignature,
  fetchConfig: () => fetchConfig,
  getBatchSignedAllowance: () => getBatchSignedAllowance,
  getNonce: () => getNonce,
  getPools: () => getPools,
  getRandomNonce: () => getRandomNonce,
  getRandomSalt: () => getRandomSalt,
  getSignature: () => getSignature,
  getSignedAllowance: () => getSignedAllowance,
  getSignedBatchSignatureTransfer: () => getSignedBatchSignatureTransfer,
  getSignedSignatureTransfer: () => getSignedSignatureTransfer,
  getUserPositions: () => getUserPositions,
  isTurbineError: () => isTurbineError,
  orderSettledABI: () => orderSettledABI,
  poolManagerABI: () => poolManagerABI,
  toTurbineError: () => toTurbineError,
  turbineHookABI: () => turbineHookABI,
  turbineLiquidityRouterABI: () => turbineLiquidityRouterABI,
  unsuccessfulResponseToTurbineError: () => unsuccessfulResponseToTurbineError,
  validateAddLiquidityIntent: () => validateAddLiquidityIntent,
  validateOrderIntent: () => validateOrderIntent,
  validateRemoveLiquidityIntent: () => validateRemoveLiquidityIntent,
  validateRemoveLiquidityIntentOnchain: () => validateRemoveLiquidityIntentOnchain
});
module.exports = __toCommonJS(index_exports);

// src/turbineClient.ts
var import_viem5 = require("viem");
var import_siwe = require("viem/siwe");

// src/abi.ts
var turbineLiquidityRouterABI = [
  {
    type: "function",
    name: "submitRemoveLiquidityIntent",
    inputs: [
      {
        name: "intent",
        type: "tuple",
        internalType: "struct RemoveLiquidityIntent",
        components: [
          { name: "owner", type: "address", internalType: "address" },
          { name: "poolId", type: "bytes32", internalType: "PoolId" },
          { name: "lpTokenAmount", type: "uint256", internalType: "uint256" },
          { name: "salt", type: "bytes32", internalType: "bytes32" }
        ]
      },
      {
        name: "signatureTransferParams",
        type: "tuple",
        internalType: "struct SignatureTransferParams",
        components: [
          {
            name: "permit",
            type: "tuple",
            internalType: "struct ISignatureTransfer.PermitTransferFrom",
            components: [
              {
                name: "permitted",
                type: "tuple",
                internalType: "struct ISignatureTransfer.TokenPermissions",
                components: [
                  {
                    name: "token",
                    type: "address",
                    internalType: "address"
                  },
                  {
                    name: "amount",
                    type: "uint256",
                    internalType: "uint256"
                  }
                ]
              },
              {
                name: "nonce",
                type: "uint256",
                internalType: "uint256"
              },
              {
                name: "deadline",
                type: "uint256",
                internalType: "uint256"
              }
            ]
          },
          { name: "signature", type: "bytes", internalType: "bytes" }
        ]
      }
    ],
    outputs: [
      {
        name: "intentHash",
        type: "bytes32",
        internalType: "RemoveLiquidityIntentHash"
      }
    ],
    stateMutability: "nonpayable"
  },
  {
    inputs: [
      {
        internalType: "RemoveLiquidityIntentHash[]",
        name: "hashes",
        type: "bytes32[]"
      }
    ],
    stateMutability: "nonpayable",
    type: "function",
    name: "executePendingIntents"
  },
  {
    type: "function",
    name: "flushExpiredIntents",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable"
  }
];
var turbineHookABI = [
  {
    type: "function",
    name: "MINIMUM_LIQUIDITY",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "INITIAL_LP_SCALE",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getNumberOfRegisteredPools",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "computePoolId",
    inputs: [
      { name: "currency0", type: "address", internalType: "address" },
      { name: "currency1", type: "address", internalType: "address" },
      { name: "fee", type: "uint24", internalType: "uint24" }
    ],
    outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "pure"
  },
  {
    type: "function",
    name: "getRegisteredPoolsSlice",
    inputs: [
      {
        name: "startIndex",
        type: "uint256",
        internalType: "uint256"
      },
      {
        name: "endIndex",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    outputs: [
      {
        name: "poolsInfo",
        type: "tuple[]",
        internalType: "struct TurbineHook.PoolInfo[]",
        components: [
          {
            name: "poolId",
            type: "bytes32",
            internalType: "bytes32"
          },
          {
            name: "token0",
            type: "address",
            internalType: "address"
          },
          {
            name: "token1",
            type: "address",
            internalType: "address"
          },
          {
            name: "fee",
            type: "uint24",
            internalType: "uint24"
          },
          {
            name: "lpToken",
            type: "address",
            internalType: "address"
          },
          {
            name: "reserve0",
            type: "uint128",
            internalType: "uint128"
          },
          {
            name: "reserve1",
            type: "uint128",
            internalType: "uint128"
          },
          {
            name: "liquidity",
            type: "uint256",
            internalType: "uint256"
          }
        ]
      }
    ],
    stateMutability: "view"
  }
];
var balanceOfABI = [
  {
    constant: true,
    inputs: [
      {
        name: "owner",
        type: "address"
      }
    ],
    name: "balanceOf",
    outputs: [
      {
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
];
var poolManagerABI = [
  {
    inputs: [
      {
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" }
        ],
        name: "key",
        type: "tuple"
      },
      { name: "sqrtPriceX96", type: "uint160" }
    ],
    name: "initialize",
    outputs: [{ name: "tick", type: "int24" }],
    stateMutability: "nonpayable",
    type: "function"
  }
];
var orderSettledABI = {
  anonymous: false,
  inputs: [
    {
      indexed: true,
      name: "owner",
      type: "address"
    },
    {
      indexed: true,
      name: "orderHash",
      type: "bytes32"
    },
    {
      indexed: false,
      name: "receiveAmount",
      type: "uint256"
    },
    {
      indexed: false,
      name: "sendAmount",
      type: "uint256"
    }
  ],
  name: "OrderSettled",
  type: "event"
};

// src/config.ts
var import_viem = require("viem");
var CHAIN_ID = 1;
var TURBINE_API_URL = process.env.TURBINE_API_URL || "http://127.0.0.1:8080/api";
var RPC_URL = process.env.RPC_URL;
var W3_WEBSOCKET = process.env.W3_WEBSOCKET;
var W3_BLOCK_NUMBER_RPC_URL = process.env.W3_BLOCK_NUMBER_RPC_URL || void 0;
var MOCKED_TURBINE_POOL = {
  metadata: {
    token0: (0, import_viem.getAddress)("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
    // USDC
    token1: (0, import_viem.getAddress)("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
    // WETH
    fee: 3e3,
    // 0.3% in hundredths of basis point
    lpToken: (0, import_viem.getAddress)("0x24746c26c7b83ddabbaf384e02c3eb0e7b8cd307")
  },
  state: {
    reserve0: 1e6,
    // Mock reserve for token0 (USDC)
    reserve1: 500
    // Mock reserve for token1 (WETH)
  },
  stats: {
    weeklySellVolumeToken0: 1e7,
    // Mock weekly volume for token0
    weeklySellVolumeToken1: 5e3
    // Mock weekly volume for token1
  }
};

// src/cookieJar.ts
var TurbineCookieJar = class {
  constructor() {
    this.jar = null;
    if (typeof window === "undefined") {
      try {
        const requireFn = typeof module !== "undefined" && typeof module.require === "function" ? module.require.bind(module) : void 0;
        if (requireFn) {
          const { CookieJar } = requireFn("tough-cookie");
          this.jar = new CookieJar();
        }
      } catch {
      }
    }
  }
  /**
   * Store a cookie from a Set-Cookie header.
   * No-op in browser environments.
   * @param setCookieHeader The Set-Cookie header value
   * @param url The URL where the cookie was received
   */
  async setCookieFromHeader(setCookieHeader, url) {
    if (!this.jar) return;
    try {
      await this.jar.setCookie(setCookieHeader, url);
    } catch (error) {
      console.debug("Failed to set cookie:", error);
    }
  }
  /**
   * Get the Cookie header value for a given URL.
   * Respects all cookie security attributes (Secure, HttpOnly, Domain, Path, Expires, SameSite).
   * Returns empty string in browser environments.
   * @param url The URL to get cookies for
   * @returns The Cookie header value (empty string if no cookies)
   */
  async getCookieHeader(url) {
    if (!this.jar) return "";
    try {
      const cookieString = await this.jar.getCookieString(url, { expire: true });
      return cookieString;
    } catch (error) {
      console.debug("Failed to get cookies:", error);
      return "";
    }
  }
  /**
   * Clear all cookies from the jar.
   * No-op in browser environments.
   */
  async clear() {
    if (!this.jar) return;
    try {
      await this.jar.removeAllCookies();
    } catch (error) {
      console.debug("Failed to clear cookies:", error);
    }
  }
};

// src/models.ts
var import_viem3 = require("viem");

// src/validation.ts
var import_viem2 = require("viem");

// src/errorHandling.ts
var TURBINE_ERROR_CODES = [
  // Backend error codes
  "INTERNAL_ERROR",
  // something went very wrong and Turbine is aware of it
  "TEE_ERROR",
  // problem related to the trusted execution environment
  "INPUT_VALIDATION_ERROR",
  // specific validation errors
  "ORDERBOOK_CAPACITY_ERROR",
  // orderbook is full
  "USER_ORDER_LIMIT_REACHED",
  // user has reached the maximum number of orders they can have
  "MAX_ORDERS_IN_PAYLOAD",
  // the number of orders in the payload is too large
  "VALIDATION_ERRORS",
  // multiple validation errors occurred, expect inner errors
  "ORDER_ALREADY_EXISTS",
  // order already exists (can be returned only when the SAME user submits the same order again)
  "DUPLICATED_ORDER",
  // same order present in a single payload multiple times
  "USER_NOT_AUTHORIZED",
  // user not authenticated or authenticated with a different address
  "ALREADY_AUTHENTICATED",
  // tried to authenticate again without logging out first
  "NO_NONCE_GENERATED",
  // tried to verify without generating a nonce first
  "AUTHENTICATED_WITH_NONCE",
  // authenticated, but nonce still present in the backend; this should never happen
  "VERIFICATION_FAILED",
  // failed to verify authentication request
  "ORDER_NOT_AVAILABLE",
  // order not found or owner is not authenticated
  "MID_PRICE_NOT_FOUND",
  // Turbine couldn't determine mid-price necessary to perform the operation
  // SDK-specific error codes
  "SDK_ERROR",
  // developer error, wrong usage of the SDK
  "UNEXPECTED_CANCELLATION_RESPONSE",
  // server returned a successful but unexpected response format for a cancellation request
  "UNEXPECTED_ADD_ORDER_RESPONSE",
  // server returned a successful but unexpected response format for an add order(s) request
  "UNEXPECTED_REMOVE_LIQUIDITY_RESPONSE",
  // server returned a successful but unexpected response format for a remove liquidity request
  "UNEXPECTED_ADD_LIQUIDITY_RESPONSE",
  // server returned a successful but unexpected response format for an add liquidity request
  "USER_REJECTION",
  // user rejected the operation in the wallet
  "AUTHENTICATION_FAILED",
  // tried to authenticate but backend still answers as if unauthenticated
  "AUTHENTICATION_ERROR",
  // some other error occurred during authentication
  "UNAUTHORIZED",
  // authenticated user does not match the owner of submitted intent
  "INVALID_RESPONSE",
  // server returned an unexpected response format; the response is in the details field
  "INTERNAL_SERVER_ERROR",
  // server returned a 500 error
  "REMOVE_LIQUIDITY_INTENT_ONCHAIN_FAILED",
  // remove liquidity intent onchain transaction was reverted
  "EXECUTE_PENDING_REMOVE_LIQUIDITY_INTENTS_FAILED",
  // execute pending remove liquidity intents transaction was reverted
  "FLUSH_EXPIRED_REMOVE_LIQUIDITY_INTENTS_FAILED",
  // flush expired remove liquidity intents transaction was reverted
  "POOL_ALREADY_INITIALIZED",
  // pool already initialized
  "POOL_CREATION_FAILED",
  // pool creation transaction was reverted for some other reason
  "CONFIG_FETCH_FAILED",
  // unable to fetch configuration
  "SERVICE_UNAVAILABLE",
  // Turbine is currently unavailable
  "ZERO_LIQUIDITY",
  // liquidity amount is zero
  "UNKNOWN_ERROR"
  // unknown error occurred
];
var TurbineError = class _TurbineError extends Error {
  constructor(code, message, details = null, inner = null) {
    super(message);
    this.code = code;
    this.message = message;
    this.details = details;
    this.inner = inner;
    this.name = "TurbineError";
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, _TurbineError);
    }
  }
  /**
   * Returns the raw error with technical details for logging
   */
  getTechnicalDetails() {
    let details = `[${this.code}] ${this.message}`;
    if (this.inner && this.inner.length > 0) {
      details += `
Nested errors:
${this.inner.map((err) => `  - ${err.getTechnicalDetails()}`).join("\n")}`;
    }
    return details;
  }
};
function isTurbineError(error) {
  return error instanceof Error && "code" in error && typeof error.code === "string" && "message" in error && typeof error.message === "string" && error.name === "TurbineError";
}
function isValidTurbineErrorPayload(item) {
  return item && typeof item === "object" && typeof item.code === "string" && typeof item.message === "string";
}
function parseErrorResponse(responseText) {
  const parsed = JSON.parse(responseText);
  if (isValidTurbineErrorPayload(parsed)) {
    let code = parsed.code;
    let message = parsed.message;
    let inner = null;
    let details = null;
    if (!TURBINE_ERROR_CODES.includes(parsed.code)) {
      code = "UNKNOWN_ERROR";
      details = { originalCode: parsed.code };
    }
    if (parsed.inner && Array.isArray(parsed.inner)) {
      inner = parsed.inner.map((item) => {
        if (isValidTurbineErrorPayload(item)) {
          let innerCode = item.code;
          let innerMessage = item.message;
          let innerDetails = null;
          if (!TURBINE_ERROR_CODES.includes(item.code)) {
            innerCode = "UNKNOWN_ERROR";
            innerDetails = { originalCode: item.code };
          }
          return new TurbineError(innerCode, innerMessage, innerDetails);
        } else {
          return null;
        }
      }).filter((item) => item !== null);
    }
    return new TurbineError(code, message, details, inner);
  }
  throw new Error("Invalid error response format");
}
async function unsuccessfulResponseToTurbineError(response) {
  const responseText = await response.text();
  try {
    return parseErrorResponse(responseText);
  } catch (error) {
    return new TurbineError(
      response.status === 500 ? "INTERNAL_SERVER_ERROR" : "UNKNOWN_ERROR",
      responseText || "An error occurred while processing your request. Please try again."
    );
  }
}
function toTurbineError(error) {
  if (error instanceof TurbineError) {
    return error;
  }
  const errorMessage = error instanceof Error ? error.message : String(error);
  if (errorMessage.toLowerCase().includes("user rejected")) {
    return new TurbineError(
      "USER_REJECTION",
      "Rejected by the wallet. Please try again if you want to complete this operation.",
      errorMessage
    );
  }
  return new TurbineError("UNKNOWN_ERROR", errorMessage, error);
}

// src/validation.ts
var NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
function optional(validator, value, fieldName) {
  if (value === null) return null;
  return validator(value, fieldName);
}
function validateString(value, fieldName) {
  if (typeof value !== "string") {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} must be a string, got ${typeof value}`,
      { fieldName, receivedValue: value, receivedType: typeof value }
    );
  }
  return value;
}
function validateBoolean(value, fieldName) {
  if (typeof value !== "boolean") {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} must be a boolean, got ${typeof value}`,
      { fieldName, receivedValue: value, receivedType: typeof value }
    );
  }
  return value;
}
function validateNumber(value, fieldName) {
  if (typeof value !== "number") {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} must be a number, got ${typeof value}`,
      { fieldName, receivedValue: value, receivedType: typeof value }
    );
  }
  if (isNaN(value)) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} must be a valid number, got NaN`,
      { fieldName, receivedValue: value }
    );
  }
  if (!isFinite(value)) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} must be a finite number, got ${value}`,
      { fieldName, receivedValue: value }
    );
  }
  return value;
}
function validatePositiveNumber(value, fieldName) {
  const num = validateNumber(value, fieldName);
  if (num <= 0) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} must be positive (> 0), got ${num}`,
      { fieldName, receivedValue: value }
    );
  }
  return num;
}
function validateBlockNumber(value, fieldName) {
  let numValue;
  if (typeof value === "string") {
    numValue = Number(value);
  } else if (typeof value === "number") {
    numValue = value;
  } else {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} must be a number or numeric string, got ${typeof value}`,
      { fieldName, receivedValue: value, receivedType: typeof value }
    );
  }
  return validatePositiveNumber(numValue, fieldName);
}
function validateBigIntConvertible(value, fieldName) {
  try {
    return BigInt(value);
  } catch (error) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} cannot be converted to BigInt: ${value}`,
      { fieldName, receivedValue: value }
    );
  }
}
function validateBigInt(value, fieldName) {
  if (typeof value !== "bigint") {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} must be a bigint, got ${typeof value}`,
      { fieldName, receivedValue: value, receivedType: typeof value }
    );
  }
  return value;
}
function validatePositiveBigInt(value, fieldName) {
  const bigIntValue = validateBigInt(value, fieldName);
  if (bigIntValue <= 0n) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} must be positive (> 0), got ${bigIntValue}`,
      { fieldName, receivedValue: value }
    );
  }
  return bigIntValue;
}
function validateNonNegativeBigInt(value, fieldName) {
  const bigIntValue = validateBigInt(value, fieldName);
  if (bigIntValue < 0n) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} must be non-negative (>= 0), got ${bigIntValue}`,
      { fieldName, receivedValue: value }
    );
  }
  return bigIntValue;
}
function validateObject(value, fieldName) {
  if (typeof value !== "object" || value === null) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} must be a non-null object, got ${value === null ? "null" : typeof value}`,
      { fieldName, receivedValue: value }
    );
  }
  return value;
}
function validateAddress(value, fieldName) {
  const strValue = validateString(value, fieldName);
  if (!(0, import_viem2.isAddress)(strValue)) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} is not a valid Ethereum address: ${strValue}. Expected format: 0x followed by 40 hexadecimal characters.`,
      { fieldName, receivedValue: value }
    );
  }
  return strValue;
}
function validateHex(value, fieldName) {
  const strValue = validateString(value, fieldName);
  if (!(0, import_viem2.isHex)(strValue)) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} is not a valid hex string: ${strValue}. Expected format: 0x followed by hexadecimal characters (0-9, a-f, A-F).`,
      { fieldName, receivedValue: value }
    );
  }
  return strValue;
}
function validateHash(value, fieldName) {
  const hexValue = validateHex(value, fieldName);
  if (hexValue.length !== 66) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} must be a 32-byte hash (0x followed by 64 hexadecimal characters), got ${hexValue.length} characters. Received: ${hexValue}`,
      {
        fieldName,
        receivedValue: value,
        expectedLength: 66,
        actualLength: hexValue.length
      }
    );
  }
  return hexValue;
}
function validateSignatureHex(value, fieldName) {
  const hexValue = validateHex(value, fieldName);
  if (hexValue.length !== 132) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} must be a 65-byte signature (0x followed by 130 hexadecimal characters), got ${hexValue.length} characters.`,
      {
        fieldName,
        receivedValue: value,
        expectedLength: 132,
        actualLength: hexValue.length
      }
    );
  }
  const bytes = (0, import_viem2.hexToBytes)(hexValue);
  const v = bytes[64];
  if (v !== 27 && v !== 28 && v !== 0 && v !== 1) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} has invalid v value: ${v}. Must be 27, 28 (legacy) or 0, 1 (EIP-2098).`,
      { fieldName, receivedValue: value, vValue: v }
    );
  }
  return hexValue;
}
function validateFee(fee, fieldName) {
  const feeNum = validateNumber(fee, fieldName);
  if (!Number.isInteger(feeNum)) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} must be an integer (in hundredths of basis points), got ${feeNum}`,
      { fieldName, receivedValue: fee }
    );
  }
  if (feeNum < 0 || feeNum > 1e6) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} must be between 0 and 1000000 (0% to 100%), got ${feeNum}. Example: 3000 = 0.3%`,
      { fieldName, receivedValue: fee }
    );
  }
  return feeNum;
}
function validateMidPriceDelta(delta, fieldName) {
  const deltaNum = validateNumber(delta, fieldName);
  if (!Number.isInteger(deltaNum)) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} must be an integer (in basis points), got ${deltaNum}`,
      { fieldName, receivedValue: delta }
    );
  }
  if (deltaNum < -1e4 || deltaNum > 1e4) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} must be between -10000 and 10000 (-100% to 100%), got ${deltaNum}. Example: 500 = 5% (allow 5% worse than mid-price), -10 = -0.1% (earn 0.1% more than mid-price)`,
      { fieldName, receivedValue: delta }
    );
  }
  return deltaNum;
}
function validateTimestamp(timestamp, fieldName, options = {}) {
  const { allowPast = true, allowFuture = true } = options;
  const ts = validateBigInt(timestamp, fieldName);
  if (ts < 0n) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} must be non-negative, got ${ts}`,
      { fieldName, receivedValue: timestamp }
    );
  }
  const now = BigInt(Math.floor(Date.now() / 1e3));
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
function validateTimeRange(startTime, endTime) {
  if (startTime >= endTime) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `endTime must be greater than startTime. Got startTime=${startTime}, endTime=${endTime}`,
      { startTime, endTime }
    );
  }
}
function validateTokenPair(token0, token1) {
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
function validatePrimitiveSignature(value, fieldName) {
  const obj = validateObject(value, fieldName);
  if (!("r" in obj) || !("s" in obj) || !("yParity" in obj)) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} must have r, s, and yParity properties`,
      { fieldName, receivedValue: value }
    );
  }
  if (typeof obj.r !== "bigint") {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName}.r must be a bigint, got ${typeof obj.r}`,
      { fieldName, receivedValue: value }
    );
  }
  if (typeof obj.s !== "bigint") {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName}.s must be a bigint, got ${typeof obj.s}`,
      { fieldName, receivedValue: value }
    );
  }
  validateBoolean(obj.yParity, `${fieldName}.yParity`);
  return obj;
}
function validateArray(value, fieldName, validator) {
  if (!Array.isArray(value)) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} must be an array, got ${typeof value}`,
      { fieldName, receivedValue: value }
    );
  }
  return value.map((item, index) => {
    try {
      return validator(item, index);
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
}
function validateNonEmptyArray(value, fieldName, validator) {
  const arr = validateArray(value, fieldName, validator);
  if (arr.length === 0) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} must be a non-empty array`,
      { fieldName, receivedValue: value }
    );
  }
  return arr;
}
function validateFields(obj, fieldValidators, contextName) {
  const validObj = validateObject(obj, contextName);
  const missingFields = [];
  for (const field of Object.keys(fieldValidators)) {
    if (!(field in validObj)) {
      missingFields.push(field);
    }
  }
  if (missingFields.length > 0) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${contextName} is missing required field${missingFields.length > 1 ? "s" : ""}: ${missingFields.join(", ")}`,
      { contextName, missingFields, receivedValue: obj }
    );
  }
  const validated = {};
  const objAny = validObj;
  for (const [field, validator] of Object.entries(fieldValidators)) {
    const fieldPath = `${contextName}.${field}`;
    validated[field] = validator(objAny[field], fieldPath);
  }
  return validated;
}
function validateOrderIntent(intent) {
  const validated = validateFields(
    intent,
    {
      owner: validateAddress,
      sellToken: validateAddress,
      buyToken: validateAddress,
      sellAmount: validatePositiveBigInt,
      minBuyAmount: validatePositiveBigInt,
      midPriceDelta: validateMidPriceDelta,
      startTime: validateTimestamp,
      endTime: (v, n) => validateTimestamp(v, n, { allowPast: false }),
      partialFill: validateBoolean,
      callData: validateHex,
      callDataTarget: validateAddress,
      salt: validateHex
    },
    "orderIntent"
  );
  validateTimeRange(validated.startTime, validated.endTime);
  validateTokenPair(validated.sellToken, validated.buyToken);
  return validated;
}
function validateAddLiquidityIntent(intent) {
  const validated = validateFields(
    intent,
    {
      owner: validateAddress,
      token0: validateAddress,
      token1: validateAddress,
      fee: validateFee,
      token0Amount: validateNonNegativeBigInt,
      token1Amount: validateNonNegativeBigInt,
      exact: validateBoolean,
      salt: validateHex
    },
    "addLiquidityIntent"
  );
  if (validated.token0Amount === 0n && validated.token1Amount === 0n) {
    throw new TurbineError(
      "ZERO_LIQUIDITY",
      "At least one token amount must be greater than zero for liquidity addition."
    );
  }
  validateTokenPair(validated.token0, validated.token1);
  return validated;
}
function validateRemoveLiquidityIntent(intent) {
  const validated = validateFields(
    intent,
    {
      owner: validateAddress,
      token0: validateAddress,
      token1: validateAddress,
      fee: validateFee,
      lpToken: validateAddress,
      lpTokenAmount: validatePositiveBigInt,
      salt: validateHex
    },
    "removeLiquidityIntent"
  );
  if (validated.lpTokenAmount === 0n) {
    throw new TurbineError(
      "ZERO_LIQUIDITY",
      "LP token amount must be greater than zero for liquidity removal."
    );
  }
  validateTokenPair(validated.token0, validated.token1);
  return validated;
}
function validateTokenPermissions(value) {
  return validateFields(
    value,
    {
      token: validateAddress,
      amount: validateNonNegativeBigInt
    },
    "tokenPermissions"
  );
}
function validateSignedBatchSignatureTransfer(value) {
  const validatePermittedArray = (v, fieldName) => {
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
  validateFields(
    value,
    {
      signature: validatePrimitiveSignature,
      permit: (v, n) => validateFields(
        v,
        {
          permitted: validatePermittedArray,
          nonce: validateBigInt,
          deadline: validatePositiveBigInt
        },
        n
      )
    },
    "signedBatchSignatureTransfer"
  );
}
function validateSignedSignatureTransferOnchain(value) {
  return validateFields(
    value,
    {
      signature: validateSignatureHex,
      permit: (v, n) => validateFields(
        v,
        {
          permitted: validateTokenPermissions,
          nonce: validateBigInt,
          deadline: validatePositiveBigInt
        },
        n
      )
    },
    "signedSignatureTransferOnchain"
  );
}
function validateRemoveLiquidityIntentOnchain(intent) {
  validateFields(
    intent,
    {
      owner: validateAddress,
      poolId: validateHash,
      lpTokenAmount: validatePositiveBigInt,
      salt: validateHex
    },
    "removeLiquidityIntentOnchain"
  );
}
function validateAddLiquidityPayload(payload) {
  const obj = validateObject(payload, "addLiquidityPayload");
  if (!("addLiquidity" in obj) || !("permitTokens" in obj)) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      "addLiquidityPayload must have addLiquidity and permitTokens properties",
      { receivedValue: payload }
    );
  }
  const payloadAny = obj;
  validateAddLiquidityIntent(payloadAny.addLiquidity);
  validateSignedBatchSignatureTransfer(payloadAny.permitTokens);
}
function validatePoolData(poolData, index) {
  const validated = validateFields(
    poolData,
    {
      token0: validateAddress,
      token1: validateAddress,
      fee: validateFee,
      lpToken: validateAddress,
      reserve0: validateBigIntConvertible,
      reserve1: validateBigIntConvertible,
      liquidity: validateBigIntConvertible
    },
    `poolData[${index}]`
  );
  validateTokenPair(validated.token0, validated.token1);
}
function validateBalanceResult(result, fieldName) {
  const obj = validateObject(result, fieldName);
  if (!("status" in obj)) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `${fieldName} is missing required field: status`,
      { receivedValue: result }
    );
  }
  const resultAny = obj;
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
    validateBigInt(resultAny.result, `${fieldName}.result`);
  }
}
function validateTurbineConfig(config) {
  return validateFields(
    config,
    {
      turbineSettlerAddress: validateAddress,
      lpHookAddress: validateAddress,
      lpRouterAddress: validateAddress,
      poolManagerAddress: validateAddress,
      submitSettlements: validateBoolean,
      siweDomain: validateString,
      siweUri: validateString
    },
    "TurbineConfig"
  );
}
function validateOrderExecutionResponse(value) {
  const obj = validateObject(value, "orderExecution");
  const requiredFields = [
    "tx_hash",
    "block_number",
    "sold_amount",
    "bought_amount",
    "surplus_buy_amount"
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
  const execAny = obj;
  optional(validateHash, execAny.tx_hash, "orderExecution.tx_hash");
  validateBlockNumber(execAny.block_number, "orderExecution.block_number");
  validateBigIntConvertible(execAny.sold_amount, "orderExecution.sold_amount");
  validateBigIntConvertible(execAny.bought_amount, "orderExecution.bought_amount");
  validateBigIntConvertible(
    execAny.surplus_buy_amount,
    "orderExecution.surplus_buy_amount"
  );
}
function validateOrderStateResponse(value) {
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
  const stateAny = obj;
  validateHash(stateAny.hash, "orderState.hash");
  validateString(stateAny.status, "orderState.status");
  validateArray(stateAny.execution, "orderState.execution", (exec) => {
    validateOrderExecutionResponse(exec);
  });
}
function validateLiquidityIntentStateResponse(value) {
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
  const stateAny = obj;
  validateHash(stateAny.hash, "liquidityIntentState.hash");
  const statusStr = validateString(stateAny.status, "liquidityIntentState.status");
  const statusKey = statusStr;
  if (!(statusKey in LiquidityIntentStatus)) {
    throw new TurbineError(
      "INPUT_VALIDATION_ERROR",
      `liquidityIntentState.status has invalid value: ${statusStr}. Must be one of: ${Object.keys(LiquidityIntentStatus).join(", ")}`,
      {
        receivedValue: statusStr,
        validValues: Object.keys(LiquidityIntentStatus)
      }
    );
  }
}
function hexToSignature(hex) {
  return (0, import_viem2.hexToBytes)(hex);
}
function parseSignatureBytes(signature) {
  return {
    r: signature.slice(0, 32),
    s: signature.slice(32, 64),
    v: signature[64]
  };
}
function signatureToComponents(signature) {
  const { r, s, v } = parseSignatureBytes(signature);
  return {
    r: bytesToBigInt(r),
    s: bytesToBigInt(s),
    yParity: v === 28 || v === 1
    // Convert v (27/28 or 0/1) to yParity (false/true)
  };
}
function bytesToBigInt(bytes) {
  if (bytes.length === 0) {
    return 0n;
  }
  return BigInt((0, import_viem2.bytesToHex)(bytes));
}

// src/models.ts
var Token = class {
  constructor(address, decimals, symbol) {
    const validatedAddress = validateAddress(address, "address");
    this.address = (0, import_viem3.getAddress)(validatedAddress);
    this.decimals = decimals;
    this.symbol = symbol;
  }
  /**
   * Converts a human-readable amount to on-chain atomic units (bigint).
   * Uses string input to preserve full precision without floating-point errors.
   *
   * @param amount - The amount as a string (e.g., "100.5" for 100.5 tokens)
   * @returns The amount in atomic units as a bigint
   *
   * @example
   * const usdc = new Token("0x...", 6, "USDC");
   * usdc.toOnchainAmount("100.5"); // Returns 100500000n
   */
  toOnchainAmount(amount) {
    return (0, import_viem3.parseUnits)(amount, this.decimals);
  }
  /**
   * Converts an on-chain amount (in atomic units) to a human-readable string.
   * Returns a string to preserve full precision without floating-point errors.
   *
   * @param amount - The amount in atomic units as a bigint
   * @returns The amount as a decimal string
   *
   * @example
   * const usdc = new Token("0x...", 6, "USDC");
   * usdc.fromOnchainAmount(100500000n); // Returns "100.5"
   */
  fromOnchainAmount(amount) {
    return (0, import_viem3.formatUnits)(amount, this.decimals);
  }
  equals(other) {
    return this.address.toLowerCase() === other.address.toLowerCase() && this.decimals === other.decimals && this.symbol === other.symbol;
  }
  toString() {
    return this.symbol;
  }
};
var LiquidityIntentStatus = /* @__PURE__ */ ((LiquidityIntentStatus2) => {
  LiquidityIntentStatus2["Pending"] = "Pending";
  LiquidityIntentStatus2["Invalid"] = "Invalid";
  LiquidityIntentStatus2["Expired"] = "Expired";
  LiquidityIntentStatus2["Executed"] = "Executed";
  LiquidityIntentStatus2["PendingCancellation"] = "PendingCancellation";
  LiquidityIntentStatus2["Canceled"] = "Canceled";
  return LiquidityIntentStatus2;
})(LiquidityIntentStatus || {});

// src/constants.ts
var USDC = new Token("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", 6, "USDC");
var USDT = new Token("0xdAC17F958D2ee523a2206206994597C13D831ec7", 6, "USDT");
var DAI = new Token("0x6B175474E89094C44Da98b954EedeAC495271d0F", 18, "DAI");
var UNI = new Token("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", 18, "UNI");
var WETH = new Token("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 18, "WETH");
var WEETH = new Token(
  "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee",
  18,
  "WEETH"
);
var PEPE = new Token("0x6982508145454Ce325dDbE47a25d4ec3d2311933", 18, "PEPE");
var WBTC = new Token("0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", 8, "WBTC");
var ADDR2TOKEN = /* @__PURE__ */ new Map([
  [USDC.address, USDC],
  [USDT.address, USDT],
  [DAI.address, DAI],
  [UNI.address, UNI],
  [WETH.address, WETH],
  [WEETH.address, WEETH],
  [PEPE.address, PEPE],
  [WBTC.address, WBTC]
]);
var SQRT_PRICE_IDENTITY = 79228162514264337593543950336n;

// src/permit2.ts
var import_permit2_sdk = require("@uniswap/permit2-sdk");
var import_viem4 = require("viem");
async function getNonce(owner, token, spender, client) {
  const allowance = await client.readContract({
    address: import_permit2_sdk.PERMIT2_ADDRESS,
    abi: [
      {
        inputs: [
          { name: "owner", type: "address" },
          { name: "token", type: "address" },
          { name: "spender", type: "address" }
        ],
        name: "allowance",
        outputs: [
          { name: "amount", type: "uint160" },
          { name: "expiration", type: "uint48" },
          { name: "nonce", type: "uint48" }
        ],
        stateMutability: "view",
        type: "function"
      }
    ],
    functionName: "allowance",
    args: [owner, token, spender]
  });
  const nonce = allowance[2];
  return nonce;
}
async function getSignedAllowance({
  token,
  walletClient,
  publicClient,
  deadline,
  amount = import_viem4.maxUint160,
  // infinite approval
  spender
}) {
  const nonce = await getNonce(
    (await walletClient.getAddresses())[0],
    token,
    spender,
    publicClient
  );
  const permit = {
    details: {
      token,
      amount,
      expiration: deadline,
      nonce
    },
    spender,
    sigDeadline: BigInt(deadline)
  };
  const permitSignature = await getSignature(permit, walletClient);
  return { permit, permitSignature };
}
async function getBatchSignedAllowance({
  tokens,
  walletClient,
  publicClient,
  deadline,
  amounts = [import_viem4.maxUint160, import_viem4.maxUint160],
  // infinite approval
  spender
}) {
  const permitDetails = [];
  for (let i = 0; i < tokens.length; i++) {
    if (amounts[i] === void 0) {
      amounts[i] = import_viem4.maxUint160;
    }
    const nonce = await getNonce(
      (await walletClient.getAddresses())[0],
      tokens[i],
      spender,
      publicClient
    );
    permitDetails.push({
      token: tokens[i],
      amount: amounts[i],
      expiration: deadline,
      nonce
    });
  }
  const permit = {
    details: permitDetails,
    spender,
    sigDeadline: BigInt(deadline)
  };
  const permitSignature = await getSignature(permit, walletClient, "PermitBatch");
  return { permit, permitSignature };
}
async function getSignature(permit, wallet, permitType = "PermitSingle") {
  const chainId = wallet.chain?.id ?? await wallet.getChainId();
  let permitData;
  if (permitType === "PermitSingle") {
    permitData = import_permit2_sdk.AllowanceTransfer.getPermitData(
      permit,
      import_permit2_sdk.PERMIT2_ADDRESS,
      chainId
    );
  } else if (permitType === "PermitBatch") {
    permitData = import_permit2_sdk.AllowanceTransfer.getPermitData(
      permit,
      import_permit2_sdk.PERMIT2_ADDRESS,
      chainId
    );
  } else {
    throw new TurbineError("SDK_ERROR", "Invalid permit type");
  }
  const signature = await wallet.signTypedData({
    account: wallet.account,
    domain: {
      name: permitData.domain.name,
      chainId: Number(permitData.domain.chainId),
      verifyingContract: permitData.domain.verifyingContract
    },
    types: permitData.types,
    primaryType: permitType,
    message: permitData.values
  });
  return signature;
}

// src/permit2SignatureTransfer.ts
var import_permit2_sdk2 = require("@uniswap/permit2-sdk");
var import_crypto = require("crypto");
var permit2NonceBitmapAbi = [
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "wordPos", type: "uint256" }
    ],
    name: "nonceBitmap",
    outputs: [{ name: "bitmap", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
];
var signatureTransferTypes = {
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" }
  ],
  PermitTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ],
  PermitBatchTransferFrom: [
    { name: "permitted", type: "TokenPermissions[]" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ]
};
async function readNonceBitmap(publicClient, owner, wordPos) {
  return await publicClient.readContract({
    address: import_permit2_sdk2.PERMIT2_ADDRESS,
    abi: permit2NonceBitmapAbi,
    functionName: "nonceBitmap",
    args: [owner, wordPos]
  });
}
async function getRandomNonce(publicClient, owner) {
  const maxAttempts = 100;
  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    const bytes = (0, import_crypto.randomBytes)(32);
    const randomHex = "0x" + bytes.toString("hex");
    const randomNonce = BigInt(randomHex);
    const randomWordPos = randomNonce >> 8n;
    const randomBitPos = Number(randomNonce & 0xffn);
    const randomBitmap = await readNonceBitmap(publicClient, owner, randomWordPos);
    const randomMask = 1n << BigInt(randomBitPos);
    if ((randomBitmap & randomMask) === 0n) {
      return randomNonce;
    }
  }
  throw new Error(`Failed to find unused nonce after ${maxAttempts} attempts`);
}
async function getSignedSignatureTransfer({
  token,
  amount,
  walletClient,
  publicClient,
  deadline,
  spender,
  nonce: providedNonce
}) {
  try {
    const owner = (await walletClient.getAddresses())[0];
    const nonce = providedNonce ?? await getRandomNonce(publicClient, owner);
    const chainId = walletClient.chain?.id ?? await walletClient.getChainId();
    const permitted = { token, amount };
    const permit = {
      permitted,
      nonce,
      deadline
    };
    const permitSignature = await walletClient.signTypedData({
      account: walletClient.account,
      domain: {
        name: "Permit2",
        chainId,
        verifyingContract: import_permit2_sdk2.PERMIT2_ADDRESS
      },
      types: signatureTransferTypes,
      primaryType: "PermitTransferFrom",
      // Include spender in the signed message
      message: {
        permitted,
        spender,
        nonce,
        deadline
      }
    });
    return { permit, permitSignature };
  } catch (e) {
    throw toTurbineError(e);
  }
}
async function getSignedBatchSignatureTransfer({
  tokens,
  amounts,
  walletClient,
  publicClient,
  deadline,
  spender,
  nonce: providedNonce
}) {
  try {
    if (tokens.length !== amounts.length) {
      throw new Error(
        `tokens/amounts length mismatch: tokens=${tokens.length} amounts=${amounts.length}`
      );
    }
    const owner = (await walletClient.getAddresses())[0];
    const nonce = providedNonce ?? await getRandomNonce(publicClient, owner);
    const chainId = walletClient.chain?.id ?? await walletClient.getChainId();
    const permitted = tokens.map((token, i) => ({
      token,
      amount: amounts[i]
    }));
    const permit = {
      permitted,
      nonce,
      deadline
    };
    const permitSignature = await walletClient.signTypedData({
      account: walletClient.account,
      domain: {
        name: "Permit2",
        chainId,
        verifyingContract: import_permit2_sdk2.PERMIT2_ADDRESS
      },
      types: signatureTransferTypes,
      primaryType: "PermitBatchTransferFrom",
      // Include spender in the signed message
      message: {
        permitted,
        spender,
        nonce,
        deadline
      }
    });
    return { permit, permitSignature };
  } catch (e) {
    throw toTurbineError(e);
  }
}

// src/utils.ts
function buildApiUrl(baseUrl, endpoint) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  if (!URL.canParse(normalizedEndpoint, normalizedBase)) {
    throw new TurbineError(
      "SDK_ERROR",
      `Failed to construct URL from base "${baseUrl}" and endpoint "${endpoint}": ${normalizedEndpoint}${normalizedBase}`
    );
  }
  const url = new URL(normalizedEndpoint, normalizedBase);
  if (url.protocol === "http:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1" && url.hostname !== "[::1]") {
    throw new TurbineError(
      "SDK_ERROR",
      `HTTPS required for non-localhost URLs. Attempted to use: ${url.toString()}`
    );
  }
  return url.toString();
}

// src/turbineClient.ts
var _TurbineClient = class _TurbineClient {
  constructor(walletClient, publicClient, turbineApiUrl, config) {
    this.authenticationInProgress = false;
    this.walletClient = walletClient;
    this.publicClient = publicClient;
    this.turbineApiUrl = turbineApiUrl;
    this.config = config;
    this.cookieJar = new TurbineCookieJar();
  }
  /**
   * Creates a new TurbineClient instance with configuration fetched from the API
   * @param walletClient The wallet client for signing transactions
   * @param publicClient The public client for reading blockchain data
   * @param turbineApiUrl Optional API URL (defaults to TURBINE_API_URL)
   * @returns Promise that resolves to a configured TurbineClient instance
   */
  static async create(walletClient, publicClient, turbineApiUrl) {
    const apiUrl = turbineApiUrl || TURBINE_API_URL;
    await checkStatus(apiUrl);
    const config = await fetchConfig(apiUrl);
    return new _TurbineClient(walletClient, publicClient, apiUrl, config);
  }
  /**
   * Estimate LP tokens for initial pool mint (empty pool).
   * First mint burns minimumLiquidity to address(0).
   *
   * @param token0Amount - Amount of token0 to provide
   * @param token1Amount - Amount of token1 to provide
   * @param initialLpScale - Scaling factor for initial LP calculation (fetch via getInitialLpScale())
   * @param minimumLiquidity - Minimum liquidity burned on first mint (fetch via getMinimumLiquidity())
   * @returns LP tokens the user will receive (after minimumLiquidity burn)
   */
  static estimateInitialLpTokens(token0Amount, token1Amount, initialLpScale, minimumLiquidity) {
    const totalLiquidity = (token0Amount + token1Amount) * initialLpScale;
    if (totalLiquidity <= minimumLiquidity) {
      return 0n;
    }
    return totalLiquidity - minimumLiquidity;
  }
  /**
   * Estimate LP tokens for adding liquidity to a pool.
   * Handles initial mints, proportional mode, and exact mode.
   *
   * @param token0Amount - Amount of token0 to provide
   * @param token1Amount - Amount of token1 to provide
   * @param reserve0 - Current pool reserve of token0
   * @param reserve1 - Current pool reserve of token1
   * @param lpSupply - Current total LP token supply
   * @param initialLpScale - Scaling factor for initial LP calculation (fetch via getInitialLpScale())
   * @param minimumLiquidity - Minimum liquidity burned on first mint (fetch via getMinimumLiquidity())
   * @param exact - Whether to use exact mode (true) or proportional mode (false)
   * @param fee - Pool fee in hundredths of basis points (e.g., 3000 for 0.3%), required for exact mode
   * @returns Object with estimated LP tokens and actual token amounts used
   */
  static estimateLpTokens(token0Amount, token1Amount, reserve0, reserve1, lpSupply, initialLpScale, minimumLiquidity, exact = false, fee = 0) {
    if (lpSupply === 0n) {
      const lpTokens = _TurbineClient.estimateInitialLpTokens(
        token0Amount,
        token1Amount,
        initialLpScale,
        minimumLiquidity
      );
      return { lpTokens, actualToken0: token0Amount, actualToken1: token1Amount };
    }
    const ratiosEqual = token0Amount * reserve1 === reserve0 * token1Amount;
    if (ratiosEqual) {
      const lpTokens = reserve1 > 0n ? lpSupply * token1Amount / reserve1 : lpSupply * token0Amount / reserve0;
      return { lpTokens, actualToken0: token0Amount, actualToken1: token1Amount };
    }
    const providedRatioLess = token0Amount * reserve1 < reserve0 * token1Amount;
    if (exact) {
      return _TurbineClient.calculateExactLiquidity(
        token0Amount,
        token1Amount,
        reserve0,
        reserve1,
        lpSupply,
        fee,
        providedRatioLess
      );
    } else {
      return _TurbineClient.calculateProportionalLiquidity(
        token0Amount,
        token1Amount,
        reserve0,
        reserve1,
        lpSupply,
        providedRatioLess
      );
    }
  }
  /**
   * Calculate LP tokens for proportional mode (exact: false).
   * Adjusts provided amounts to match the pool's reserve ratio.
   */
  static calculateProportionalLiquidity(token0Amount, token1Amount, reserve0, reserve1, lpSupply, providedRatioLess) {
    let actualToken0;
    let actualToken1;
    let lpTokens;
    if (providedRatioLess) {
      actualToken0 = token0Amount;
      actualToken1 = token0Amount * reserve1 / reserve0;
      lpTokens = reserve1 > 0n ? lpSupply * actualToken1 / reserve1 : lpSupply * actualToken0 / reserve0;
    } else {
      actualToken1 = token1Amount;
      actualToken0 = token1Amount * reserve0 / reserve1;
      lpTokens = reserve1 > 0n ? lpSupply * actualToken1 / reserve1 : lpSupply * actualToken0 / reserve0;
    }
    return { lpTokens, actualToken0, actualToken1 };
  }
  /**
   * Calculate LP tokens for exact mode (exact: true).
   * Uses all provided amounts and applies a virtual swap fee for imbalance.
   */
  static calculateExactLiquidity(token0Amount, token1Amount, reserve0, reserve1, lpSupply, fee, providedRatioLess) {
    const feeBigInt = BigInt(fee);
    const feeComplement = _TurbineClient.POOL_FEE_PRECISION - feeBigInt;
    let effectivePriceNum;
    let effectivePriceDen;
    if (providedRatioLess) {
      effectivePriceNum = reserve1 * feeComplement;
      effectivePriceDen = reserve0 * _TurbineClient.POOL_FEE_PRECISION;
    } else {
      effectivePriceNum = reserve1 * _TurbineClient.POOL_FEE_PRECISION;
      effectivePriceDen = reserve0 * feeComplement;
    }
    const addedValue = effectivePriceNum * token1Amount + token0Amount * effectivePriceDen;
    const poolValue = effectivePriceNum * reserve1 + reserve0 * effectivePriceDen;
    const lpTokens = lpSupply * addedValue / poolValue;
    return { lpTokens, actualToken0: token0Amount, actualToken1: token1Amount };
  }
  /**
   * Get the MINIMUM_LIQUIDITY constant from the TurbineHook contract.
   * This is the amount of LP tokens burned to address(0) on the first pool mint.
   * @returns A Promise that resolves to the minimum liquidity value
   */
  async getMinimumLiquidity() {
    const minimumLiquidity = await this.publicClient.readContract({
      address: this.config.lpHookAddress,
      abi: turbineHookABI,
      functionName: "MINIMUM_LIQUIDITY"
    });
    return minimumLiquidity;
  }
  /**
   * Get the INITIAL_LP_SCALE constant from the TurbineHook contract.
   * This is the scaling factor used for initial LP token calculation.
   * @returns A Promise that resolves to the initial LP scale value
   */
  async getInitialLpScale() {
    const initialLpScale = await this.publicClient.readContract({
      address: this.config.lpHookAddress,
      abi: turbineHookABI,
      functionName: "INITIAL_LP_SCALE"
    });
    return initialLpScale;
  }
  /**
   * Get both liquidity constants from the TurbineHook contract in a single call.
   * @returns A Promise that resolves to an object with minimumLiquidity and initialLpScale
   */
  async getLiquidityConstants() {
    const [minimumLiquidity, initialLpScale] = await Promise.all([
      this.getMinimumLiquidity(),
      this.getInitialLpScale()
    ]);
    return { minimumLiquidity, initialLpScale };
  }
  /* PRIVATE HELPER METHODS */
  /**
   * Extracts and stores cookies from fetch response headers using CookieJar.
   * No-op in browser environments (cookie jar methods are no-ops there).
   */
  async extractAndStoreCookies(response, url) {
    const setCookieHeaders = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    for (const cookie of setCookieHeaders) {
      await this.cookieJar.setCookieFromHeader(cookie, url);
    }
  }
  /**
   * Creates headers with cookies from CookieJar.
   * In browser environments, getCookieHeader returns "" (no-op), so no Cookie header is added
   * — the browser handles cookies natively via fetch credentials.
   */
  async createHeaders(additionalHeaders = {}, url) {
    const headers = {
      "Content-Type": "application/json",
      ...additionalHeaders
    };
    const cookieHeader = await this.cookieJar.getCookieHeader(url);
    if (cookieHeader) {
      headers["Cookie"] = cookieHeader;
    }
    return headers;
  }
  /**
   * Reads response body with size limit to prevent memory exhaustion attacks.
   * Streams the response chunk-by-chunk, checking size BEFORE accumulating each chunk.
   *
   * @param response - The fetch Response object
   * @param maxSize - Maximum allowed size in bytes (default: 10 MB)
   * @returns Response with validated body
   * @throws TurbineError if response exceeds size limit
   */
  async validateResponseSize(response, maxSize = 10 * 1024 * 1024) {
    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (size > maxSize) {
        throw new TurbineError(
          "SDK_ERROR",
          `Response size (${size} bytes) exceeds maximum allowed size (${maxSize} bytes)`
        );
      }
    }
    if (!response.body) {
      return response;
    }
    const reader = response.body.getReader();
    const chunks = [];
    let totalSize = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value.length > maxSize) {
          await reader.cancel();
          throw new TurbineError(
            "SDK_ERROR",
            `Single response chunk (${value.length} bytes) exceeds maximum size (${maxSize} bytes)`
          );
        }
        if (totalSize + value.length > maxSize) {
          await reader.cancel();
          throw new TurbineError(
            "SDK_ERROR",
            `Response size exceeds maximum allowed size (${maxSize} bytes)`
          );
        }
        chunks.push(value);
        totalSize += value.length;
      }
    } finally {
      reader.releaseLock();
    }
    const blob = new Blob(chunks);
    return new Response(blob, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }
  /**
   * Makes a fetch request with automatic cookie handling and security controls
   * In browsers: relies on credentials: "include" for automatic cookie handling
   * In Node.js: manually manages cookies via CookieJar
   *
   * Security features:
   * - HTTPS enforcement (via buildApiUrl, except localhost)
   * - 10 second request timeout
   * - Redirects disabled (returns error on redirect)
   * - Response body size limited to 10 MB
   */
  async fetchWithCookies(endpoint, options = {}) {
    const url = buildApiUrl(this.turbineApiUrl, endpoint);
    const headers = await this.createHeaders(
      options.headers,
      url
    );
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1e4);
    try {
      let response = await fetch(url, {
        ...options,
        headers,
        credentials: "include",
        signal: controller.signal,
        redirect: "error"
        // Disable redirects - will throw on 3xx responses
      });
      response = await this.validateResponseSize(response);
      await this.extractAndStoreCookies(response, url);
      return response;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new TurbineError(
          "SDK_ERROR",
          "Request timed out after 10 seconds"
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  createPoolKey(token0, token1, fee) {
    const [currency0, currency1] = token0 < token1 ? [token0, token1] : [token1, token0];
    return {
      currency0,
      currency1,
      fee,
      tickSpacing: 1,
      hooks: this.config.lpHookAddress
    };
  }
  /* PUBLIC METHODS */
  /* AUTHENTICATED METHODS */
  /**
   * Add an order to the Turbine API.
   * @param intent An `OrderIntent` object containing the details of the trade to be executed
   * @returns A Promise that resolves to a string containing the submitted order hash.
   */
  async addOrder(intent) {
    intent = validateOrderIntent(intent);
    const address = await this.ensureAuthenticated();
    if ((0, import_viem5.getAddress)(address) !== (0, import_viem5.getAddress)(intent.owner)) {
      throw new TurbineError(
        "UNAUTHORIZED",
        "Authenticated user does not match order owner."
      );
    }
    try {
      const payload = await this.createAddOrderData(intent);
      const response = await this.callApiEndpoint(payload, "add_order");
      if (!response.ok) {
        throw await unsuccessfulResponseToTurbineError(response);
      }
      const responseJson = await response.json();
      validateObject(responseJson, "addOrder response");
      if (!("orderHash" in responseJson)) {
        throw new TurbineError(
          "UNEXPECTED_ADD_ORDER_RESPONSE",
          "Order was submitted but confirmation is missing. Please check your orders to verify if it was processed.",
          responseJson
        );
      }
      const orderHash = validateHash(
        responseJson["orderHash"],
        "addOrder response.orderHash"
      );
      return orderHash;
    } catch (error) {
      throw toTurbineError(error);
    }
  }
  /**
   * Add an array of orders to the Turbine API.
   * @param intents An array of `OrderIntent` objects containing the details of the trades to be executed
   * @returns A Promise that resolves to an array of strings containing the submitted order hashes.
   */
  async addOrders(intents) {
    intents = validateNonEmptyArray(
      intents,
      "addOrders intents",
      (intent, _) => validateOrderIntent(intent)
    );
    const address = await this.ensureAuthenticated();
    if (intents.some((intent) => (0, import_viem5.getAddress)(intent.owner) !== (0, import_viem5.getAddress)(address))) {
      throw new TurbineError(
        "UNAUTHORIZED",
        "Authenticated user does not match some of the orders' owner."
      );
    }
    try {
      const payloads = await Promise.all(
        intents.map((intent) => this.createAddOrderData(intent))
      );
      const response = await this.callApiEndpoint(payloads, "add_orders");
      if (!response.ok) {
        throw await unsuccessfulResponseToTurbineError(response);
      }
      const responseJson = await response.json();
      if (!Array.isArray(responseJson) || responseJson.length === 0) {
        throw new TurbineError(
          "UNEXPECTED_ADD_ORDER_RESPONSE",
          "Orders were submitted but confirmations are missing. Please check your orders to verify if they were processed.",
          responseJson
        );
      }
      return responseJson.map((order, index) => {
        validateObject(order, `addOrders response.orders[${index}]`);
        return validateHash(
          order.orderHash,
          `addOrders response.orders[${index}].orderHash`
        );
      });
    } catch (error) {
      throw toTurbineError(error);
    }
  }
  /**
   * Add a liquidity addition intent to the Turbine API.
   * @param intent The intent to add liquidity
   * @returns A Promise that resolves to a string containing the submitted intent hash.
   */
  async addLiquidity(intent) {
    intent = validateAddLiquidityIntent(intent);
    try {
      const payload = await this.createAddLiquidityData(intent);
      return await this.addLiquidityWithSignedPermit(payload);
    } catch (error) {
      throw toTurbineError(error);
    }
  }
  /**
   * Add a liquidity removal intent to the Turbine API.
   * @param intent The intent to remove liquidity
   * @returns A Promise that resolves to a string containing the submitted intent hash.
   */
  async removeLiquidity(intent) {
    intent = validateRemoveLiquidityIntent(intent);
    const address = await this.ensureAuthenticated();
    if ((0, import_viem5.getAddress)(intent.owner) !== (0, import_viem5.getAddress)(address)) {
      throw new TurbineError(
        "UNAUTHORIZED",
        "Authenticated user does not match the intent owner."
      );
    }
    try {
      const payload = await this.createRemoveLiquidityData(intent);
      const response = await this.callApiEndpoint(payload, "remove_liquidity");
      if (!response.ok) {
        throw await unsuccessfulResponseToTurbineError(response);
      }
      const responseJson = await response.json();
      if (!responseJson || !responseJson["intentHash"]) {
        throw new TurbineError(
          "UNEXPECTED_REMOVE_LIQUIDITY_RESPONSE",
          "Liquidity removal was submitted but confirmation is missing. Please check your transactions to verify if it was processed.",
          responseJson
        );
      }
      return responseJson["intentHash"];
    } catch (error) {
      throw toTurbineError(error);
    }
  }
  /**
   * Cancel an order from the Turbine API.
   * @param orderHash The hash of the order to cancel
   * @returns A Promise that resolves to the response message from the API.
   */
  async cancelOrder(orderHash) {
    orderHash = validateHash(orderHash, "orderHash");
    await this.ensureAuthenticated();
    try {
      const payload = {
        orderHash
      };
      const response = await this.callApiEndpoint(payload, "cancel_order");
      if (!response.ok) {
        throw await unsuccessfulResponseToTurbineError(response);
      }
      const responseJson = await response.json();
      validateObject(responseJson, "cancelOrder response");
      if (!responseJson || !responseJson.orderHash) {
        throw new TurbineError(
          "UNEXPECTED_CANCELLATION_RESPONSE",
          "Order cancellation was submitted but confirmation is missing. Please check your orders to verify if it was processed.",
          responseJson
        );
      }
      const responseOrderHash = validateHash(
        responseJson.orderHash,
        "cancelOrder response.orderHash"
      );
      return { orderHash: responseOrderHash };
    } catch (error) {
      throw toTurbineError(error);
    }
  }
  /**
   * Get the status of multiple orders by their hashes.
   * @param orderHashes An array of order hashes to check
   * @returns A Promise that resolves to an array of `OrderState` objects.
   */
  async getOrderStates(orderHashes) {
    orderHashes = validateNonEmptyArray(
      orderHashes,
      "getOrderStates orderHashes",
      (hash, index) => validateHash(hash, `getOrderStates orderHashes[${index}]`)
    );
    await this.ensureAuthenticated();
    try {
      const payload = {
        orderHashes
      };
      const response = await this.callApiEndpoint(payload, "order_states");
      if (!response.ok) {
        throw await unsuccessfulResponseToTurbineError(response);
      }
      const responseJson = await response.json();
      if (!Array.isArray(responseJson)) {
        throw new TurbineError(
          "INVALID_RESPONSE",
          "Received unexpected response format from server. Please try again later.",
          responseJson
        );
      }
      validateArray(responseJson, "orderStates", (orderState) => {
        validateOrderStateResponse(orderState);
      });
      const orderStatesPromises = responseJson.map(
        (orderState) => this.parseOrderState(orderState)
      );
      const orderStates = await Promise.all(orderStatesPromises);
      return orderStates;
    } catch (error) {
      throw toTurbineError(error);
    }
  }
  /**
   * Get the state of multiple liquidity intents by their hashes.
   * @param intentHashes An array of liquidity intent hashes to check
   * @returns A Promise that resolves to an array of liquidity intent state objects.
   */
  async getLiquidityIntents(intentHashes) {
    const orderHashes = validateNonEmptyArray(
      intentHashes,
      "getLiquidityIntents intentHashes",
      (hash, index) => validateHash(hash, `intentHashes[${index}]`)
    );
    await this.ensureAuthenticated();
    try {
      const response = await this.fetchWithCookies("liquidity_intent_states", {
        method: "POST",
        body: JSON.stringify({ intentHashes: orderHashes })
      });
      if (!response.ok) {
        throw await unsuccessfulResponseToTurbineError(response);
      }
      const responseJson = await response.json();
      validateArray(responseJson, "liquidityIntentStates", (state) => {
        validateLiquidityIntentStateResponse(state);
      });
      return responseJson.map((state) => {
        const statusKey = state.status;
        return {
          hash: state.hash,
          status: LiquidityIntentStatus[statusKey]
        };
      });
    } catch (error) {
      throw toTurbineError(error);
    }
  }
  /**
   * Add liquidity using pre-signed permit data.
   * This method is used when permit data has already been created via createAddLiquidityData()
   * and the pool has been created. It submits the liquidity intent to Turbine without requiring
   * additional Permit2 signatures.
   *
   * @param payload The AddLiquidity payload containing the intent and pre-signed permit data
   * @returns A Promise that resolves to a string containing the submitted intent hash.
   */
  async addLiquidityWithSignedPermit(payload) {
    validateAddLiquidityPayload(payload);
    const address = await this.ensureAuthenticated();
    if ((0, import_viem5.getAddress)(payload.addLiquidity.owner) !== (0, import_viem5.getAddress)(address)) {
      throw new TurbineError(
        "UNAUTHORIZED",
        "Authenticated user does not match the intent owner."
      );
    }
    try {
      const response = await this.callApiEndpoint(payload, "add_liquidity");
      if (!response.ok) {
        throw await unsuccessfulResponseToTurbineError(response);
      }
      const responseJson = await response.json();
      if (!responseJson || !responseJson["intentHash"]) {
        throw new TurbineError(
          "UNEXPECTED_ADD_LIQUIDITY_RESPONSE",
          "Liquidity addition was submitted but confirmation is missing. Please check your transactions to verify if it was processed.",
          responseJson
        );
      }
      return validateHash(
        responseJson["intentHash"],
        "addLiquidity response.intentHash"
      );
    } catch (error) {
      throw toTurbineError(error);
    }
  }
  /* UNAUTHENTICATED METHODS */
  /**
   * Submit a liquidity removal intent directly on-chain.
   * This method creates the onchain intent data and permit, then submits it to the TurbineLiquidityRouter contract.
   * @param intent The intent to remove liquidity
   * @returns A Promise that resolves to the transaction hash and intent hash of the submitted intent
   */
  async submitRemoveLiquidityIntentOnchain(intent) {
    validateRemoveLiquidityIntent(intent);
    try {
      const data = await this.createRemoveLiquidityDataOnchain(intent);
      const txHash = await this.submitRemoveLiquidityTransaction(
        data.intent,
        data.permit
      );
      const intentHash = this.computeRemoveLiquidityIntentHash({
        owner: intent.owner,
        poolId: data.intent.poolId,
        lpTokenAmount: intent.lpTokenAmount,
        salt: intent.salt
      });
      validateHash(txHash, "txHash");
      validateHash(intentHash, "intentHash");
      return { txHash, intentHash };
    } catch (error) {
      throw toTurbineError(error);
    }
  }
  /**
   * Submit a remove liquidity intent directly to the TurbineLiquidityRouter contract on-chain.
   * This method simulates the contract call, writes the transaction, and waits for confirmation.
   * @param intent The onchain remove liquidity intent containing owner, poolId, lpTokenAmount, and salt
   * @param permit The signed Permit2 permit allowing the router to spend LP tokens
   * @returns A Promise that resolves to the transaction hash
   * @throws {TurbineError} If the transaction fails or is reverted
   */
  async submitRemoveLiquidityTransaction(intent, permit) {
    validateRemoveLiquidityIntentOnchain(intent);
    validateSignedSignatureTransferOnchain(permit);
    const { request } = await this.publicClient.simulateContract({
      address: this.config.lpRouterAddress,
      abi: turbineLiquidityRouterABI,
      functionName: "submitRemoveLiquidityIntent",
      args: [
        {
          owner: intent.owner,
          poolId: intent.poolId,
          lpTokenAmount: intent.lpTokenAmount,
          salt: intent.salt
        },
        {
          signature: permit.signature,
          permit: {
            permitted: {
              token: permit.permit.permitted.token,
              amount: permit.permit.permitted.amount
            },
            nonce: permit.permit.nonce,
            deadline: permit.permit.deadline
          }
        }
      ],
      account: this.walletClient.account,
      chain: this.publicClient.chain
    });
    const txHash = await this.walletClient.writeContract(request);
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash
    });
    if (receipt.status !== "success") {
      throw new TurbineError(
        "REMOVE_LIQUIDITY_INTENT_ONCHAIN_FAILED",
        "The remove liquidity intent onchain transaction was reverted. Please try again.",
        receipt
      );
    }
    return txHash;
  }
  /**
   * Execute pending remove liquidity intents on-chain.
   * This method calls the executePendingIntents function on the TurbineLiquidityRouter contract
   * to process and execute previously submitted remove liquidity intents.
   * @param hashes An array of intent hashes to execute
   * @returns A Promise that resolves when the transaction is confirmed
   * @throws {TurbineError} If the transaction fails or is reverted
   */
  async executePendingRemoveLiquidityIntentsOnchain(hashes) {
    const orderHashes = validateNonEmptyArray(
      hashes,
      "executePendingRemoveLiquidityIntentsOnchain hashes",
      (hash, index) => validateHash(hash, `hashes[${index}]`)
    );
    const { request } = await this.publicClient.simulateContract({
      address: this.config.lpRouterAddress,
      abi: turbineLiquidityRouterABI,
      functionName: "executePendingIntents",
      args: [orderHashes],
      account: this.walletClient.account,
      chain: this.publicClient.chain
    });
    const txHash = await this.walletClient.writeContract(request);
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash
    });
    if (receipt.status !== "success") {
      throw new TurbineError(
        "EXECUTE_PENDING_REMOVE_LIQUIDITY_INTENTS_FAILED",
        "The execute pending remove liquidity intents transaction was reverted. Please try again.",
        receipt
      );
    }
  }
  /**
   * Flush expired remove liquidity intents from the TurbineLiquidityRouter contract.
   * This method calls the flushExpiredIntents function to remove all intents that have passed their expiration time.
   * @returns A Promise that resolves when the transaction is confirmed
   * @throws {TurbineError} If the transaction fails or is reverted
   */
  async flushExpiredRemoveLiquidityIntentsOnchain() {
    const { request } = await this.publicClient.simulateContract({
      address: this.config.lpRouterAddress,
      abi: turbineLiquidityRouterABI,
      functionName: "flushExpiredIntents",
      args: [],
      account: this.walletClient.account,
      chain: this.publicClient.chain
    });
    const txHash = await this.walletClient.writeContract(request);
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash
    });
    if (receipt.status !== "success") {
      throw new TurbineError(
        "FLUSH_EXPIRED_REMOVE_LIQUIDITY_INTENTS_FAILED",
        "The flush expired remove liquidity intents transaction was reverted. Please try again.",
        receipt
      );
    }
  }
  /**
   * Get the pool ID for a given token pair and fee.
   * Calls the computePoolId view function from the TurbineHook contract.
   * @param token0 The first token address
   * @param token1 The second token address
   * @param fee The pool fee in hundredths of basis point
   * @returns A Promise that resolves to the pool ID as a Hex string
   */
  async getPoolId(token0, token1, fee) {
    const { request } = await this.publicClient.simulateContract({
      address: this.config.lpHookAddress,
      abi: turbineHookABI,
      functionName: "computePoolId",
      args: [token0, token1, fee],
      account: this.walletClient.account,
      chain: this.publicClient.chain
    });
    const poolId = await this.publicClient.readContract(request);
    validateHash(poolId, "poolId");
    return poolId;
  }
  /**
   * Compute the hash of a remove liquidity intent.
   * This matches the hash computation in the TurbineLiquidityRouter contract:
   * keccak256(abi.encode(intent))
   * @param intent The onchain remove liquidity intent
   * @returns The intent hash as a Hex string
   */
  computeRemoveLiquidityIntentHash(intent) {
    validateRemoveLiquidityIntentOnchain(intent);
    const encoded = (0, import_viem5.encodeAbiParameters)(
      [
        { name: "owner", type: "address" },
        { name: "poolId", type: "bytes32" },
        { name: "lpTokenAmount", type: "uint256" },
        { name: "salt", type: "bytes32" }
      ],
      [intent.owner, intent.poolId, intent.lpTokenAmount, intent.salt]
    );
    return (0, import_viem5.keccak256)(encoded);
  }
  /**
   * Create a new liquidity pool on-chain.
   * Initializes a new pool with the specified token pair and fee using the PoolManager contract.
   * @param token0 The first token address
   * @param token1 The second token address
   * @param fee The pool fee in hundredths of basis point
   * @returns A Promise that resolves to the transaction hash of the pool creation
   * @throws {TurbineError} If the pool already exists or the transaction fails
   */
  async createPool(token0, token1, fee) {
    const validatedToken0 = validateAddress(token0, "token0");
    const validatedToken1 = validateAddress(token1, "token1");
    const validatedFee = validateFee(fee, "fee");
    validateTokenPair(validatedToken0, validatedToken1);
    try {
      const poolKey = this.createPoolKey(
        validatedToken0,
        validatedToken1,
        validatedFee
      );
      const { request } = await this.publicClient.simulateContract({
        address: this.config.poolManagerAddress,
        abi: poolManagerABI,
        functionName: "initialize",
        args: [
          {
            currency0: poolKey.currency0,
            currency1: poolKey.currency1,
            fee: poolKey.fee,
            tickSpacing: poolKey.tickSpacing,
            hooks: poolKey.hooks
          },
          SQRT_PRICE_IDENTITY
        ],
        account: this.walletClient.account,
        chain: this.publicClient.chain
      });
      const txHash = await this.walletClient.writeContract(request);
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash
      });
      if (receipt.status !== "success") {
        throw new TurbineError(
          "POOL_CREATION_FAILED",
          "The pool creation transaction failed. Please try again.",
          receipt
        );
      }
      return validateHash(txHash, "txHash");
    } catch (err) {
      if (err instanceof import_viem5.BaseError) {
        const revertError = err.walk(
          (err2) => err2 instanceof import_viem5.ContractFunctionRevertedError
        );
        if (revertError instanceof import_viem5.ContractFunctionRevertedError && revertError.raw?.includes("b3e8301e")) {
          throw new TurbineError(
            "POOL_ALREADY_INITIALIZED",
            "The pool is already initialized. Please try creating a different pool.",
            revertError
          );
        }
      }
      throw toTurbineError(err);
    }
  }
  /**
   * Get the settled amounts for multiple orders.
   * Retrieves order states and extracts the executed sell amounts for each order.
   * @param orderHashes An array of order hashes to check
   * @returns A Promise that resolves to an array of OrderSettledAmount objects containing order hash and executed sell amount
   */
  async getSettledAmounts(orderHashes) {
    orderHashes = validateNonEmptyArray(
      orderHashes,
      "getSettledAmounts orderHashes",
      (hash, index) => validateHash(hash, `orderHashes[${index}]`)
    );
    let states = await this.getOrderStates(orderHashes);
    return states.map((state) => ({
      hash: validateHash(state.hash, "state.hash"),
      executedSellAmount: validateBigInt(
        state.executedSellAmount,
        "state.executedSellAmount"
      )
    }));
  }
  /**
   * Get the fee for a prospective order.
   * @param intent The intent for which to get the fee
   * @returns A Promise that resolves to a bigint containing the fee expressed in absolute amount of the buy token.
   */
  async getOrderFee(intent) {
    intent = validateOrderIntent(intent);
    try {
      const response = await this.fetchWithCookies("order_fees", {
        method: "POST",
        body: JSON.stringify(intent, bigIntReplacer)
      });
      if (!response.ok) {
        throw await unsuccessfulResponseToTurbineError(response);
      }
      const feeJson = await response.json();
      validateString(feeJson, "feeJson");
      return validateBigIntConvertible(feeJson, "feeJson");
    } catch (error) {
      throw toTurbineError(error);
    }
  }
  /**
   * Get all registered pools from the Turbine Hook contract.
   * @returns A Promise that resolves to an array of TurbinePool objects
   */
  async getPools() {
    return await getPools(this.publicClient, this.config.lpHookAddress);
  }
  /**
   * Get user positions for all registered pools.
   * Returns positions where the user has a non-zero LP token balance.
   * @returns A Promise that resolves to an array of UserPosition objects
   */
  async getUserPositions() {
    const address = await this.walletClient.getAddresses();
    return await getUserPositions(
      address[0],
      this.publicClient,
      this.config.lpHookAddress
    );
  }
  /**
   * Check if the Turbine service is available.
   * @returns A Promise that resolves to true if the service is available, or throws an error if unavailable
   */
  async checkStatus() {
    return await checkStatus(this.turbineApiUrl);
  }
  /**
   * Get the current configuration
   * @returns The TurbineConfig
   */
  getConfig() {
    return this.config;
  }
  /* PRIVATE METHODS */
  /**
   * Create add order data with Permit2 signature for non-smart orders.
   * Smart orders skip permit data as they handle their own token transfers.
   * @param intent The order intent to create data for
   * @returns A Promise that resolves to AddOrder or AddSmartOrder payload
   */
  async createAddOrderData(intent) {
    if (this.is_smart_order(intent)) {
      return {
        order: intent
      };
    }
    let { permit, permitSignature } = await getSignedAllowance({
      token: intent.sellToken,
      walletClient: this.walletClient,
      publicClient: this.publicClient,
      deadline: Number(intent.endTime),
      spender: this.config.turbineSettlerAddress
    });
    return {
      order: intent,
      signedPermit: {
        signature: convertSignature(permitSignature),
        permit
      }
    };
  }
  /**
   * Create add liquidity data with Permit2 signatures for both tokens.
   * Converts fee to hundredths of basis points and creates batch permit signatures.
   * @param intent The liquidity addition intent
   * @returns A Promise that resolves to AddLiquidity payload with signed permits
   */
  async createAddLiquidityData(intent) {
    const deadline = BigInt(Math.floor(Date.now() / 1e3) + 300);
    const { permit, permitSignature } = await getSignedBatchSignatureTransfer({
      tokens: [intent.token0, intent.token1],
      amounts: [intent.token0Amount, intent.token1Amount],
      walletClient: this.walletClient,
      publicClient: this.publicClient,
      deadline,
      spender: this.config.lpRouterAddress
    });
    return {
      addLiquidity: intent,
      permitTokens: {
        signature: convertSignature(permitSignature),
        permit
      }
    };
  }
  /**
   * Create remove liquidity data with Permit2 signature for LP token.
   * Converts fee to hundredths of basis points and creates permit signature.
   * @param intent The liquidity removal intent
   * @returns A Promise that resolves to RemoveLiquidity payload with signed permit
   */
  async createRemoveLiquidityData(intent) {
    const deadline = BigInt(Math.floor(Date.now() / 1e3) + 300);
    const { permit, permitSignature } = await getSignedSignatureTransfer({
      token: intent.lpToken,
      amount: intent.lpTokenAmount,
      walletClient: this.walletClient,
      publicClient: this.publicClient,
      deadline,
      spender: this.config.lpRouterAddress
    });
    return {
      removeLiquidity: intent,
      permitLpToken: {
        signature: convertSignature(permitSignature),
        permit
      }
    };
  }
  /**
   * Create remove liquidity data for onchain submission.
   * Computes the pool ID and creates the onchain intent format with Permit2 signature.
   * @param intent The liquidity removal intent
   * @returns A Promise that resolves to an object containing the onchain intent and signed permit
   */
  async createRemoveLiquidityDataOnchain(intent) {
    const poolId = await this.getPoolId(intent.token0, intent.token1, intent.fee);
    const removeLiquidityIntentOnchain = {
      owner: intent.owner,
      poolId,
      lpTokenAmount: intent.lpTokenAmount,
      salt: intent.salt
    };
    const deadline = BigInt(Math.floor(Date.now() / 1e3) + 60 * 60 * 2.5);
    const { permit, permitSignature } = await getSignedSignatureTransfer({
      token: intent.lpToken,
      amount: intent.lpTokenAmount,
      walletClient: this.walletClient,
      publicClient: this.publicClient,
      deadline,
      spender: this.config.lpRouterAddress
    });
    return {
      intent: removeLiquidityIntentOnchain,
      permit: {
        signature: permitSignature,
        permit
      }
    };
  }
  /**
   * Check if an order intent is a smart order.
   * Smart orders have a non-zero callDataTarget and non-empty callData.
   * @param intent The order intent to check
   * @returns true if the order is a smart order, false otherwise
   */
  is_smart_order(intent) {
    return intent.callDataTarget != NULL_ADDRESS && intent.callData != "0x";
  }
  /**
   * Authenticate with the Turbine API using a wallet client.
   * First calls /nonce to get nonce, then calls /verify with the signed message.
   */
  async authenticate() {
    const chainId = await this.walletClient.getChainId();
    const addresses = await this.walletClient.getAddresses();
    const address = addresses[0];
    const config = this.getConfig();
    try {
      const nonceResponse = await this.fetchWithCookies("nonce", {
        method: "POST"
      });
      const nonce = await nonceResponse.json();
      const message = (0, import_siwe.createSiweMessage)({
        address,
        chainId,
        domain: config.siweDomain,
        statement: "Sign in to Turbine with your Ethereum wallet",
        nonce,
        uri: config.siweUri,
        version: "1"
      });
      const signature = await this.walletClient.signMessage({
        message,
        account: this.walletClient.account
      });
      const structuredSignature = this.parseSignature(signature);
      const verifyResponse = await this.fetchWithCookies("verify", {
        method: "POST",
        body: JSON.stringify({
          message,
          signature: structuredSignature
        })
      });
      if (!verifyResponse.ok) {
        throw await unsuccessfulResponseToTurbineError(verifyResponse);
      }
    } catch (error) {
      throw toTurbineError(error);
    }
  }
  /**
   * Get the current authentication status for the authenticated user.
   * @returns A Promise that resolves to the authentication status
   */
  async getAuthStatus() {
    try {
      const response = await this.fetchWithCookies("me");
      if (!response.ok) {
        return { authenticated: false };
      }
      const data = await response.json();
      validateObject(data, "authStatus response");
      validateBoolean(data.authenticated, "authenticated");
      if (data.authenticated) {
        if (!("address" in data)) {
          throw new TurbineError(
            "INVALID_RESPONSE",
            "authStatus response missing address field when authenticated is true",
            data
          );
        }
        validateAddress(data.address, "address");
      }
      return {
        authenticated: data.authenticated,
        address: data.address
      };
    } catch (error) {
      console.error(error);
      return { authenticated: false };
    }
  }
  /**
   * Logout and clear the current session.
   */
  async logout() {
    try {
      await this.fetchWithCookies("logout", { method: "POST" });
      await this.cookieJar.clear();
    } catch (error) {
      await this.cookieJar.clear();
      throw toTurbineError(error);
    }
  }
  /**
   * Ensures that the user is authenticated with the Turbine API.
   *
   * This method checks the current authentication status by making a request to the `/me` endpoint.
   * If the user is not authenticated, it automatically attempts to authenticate them.
   * If authentication is successful, it returns the authenticated user's address.
   *
   * @throws {TurbineError} If authentication fails or if there is an error checking authentication status.
   * @returns {Promise<Address>} The authenticated user's address.
   */
  async ensureAuthenticated() {
    if (this.authenticationInProgress) {
      const startTime = Date.now();
      const timeout = 3e5;
      while (this.authenticationInProgress && Date.now() - startTime < timeout) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (this.authenticationInProgress) {
        this.authenticationInProgress = false;
      }
      const response = await this.fetchWithCookies("me");
      if (response.ok) {
        const authStatus = await response.json();
        if (authStatus.authenticated && authStatus.address) {
          return authStatus.address;
        }
      }
    }
    this.authenticationInProgress = true;
    try {
      const response = await this.fetchWithCookies("me");
      if (response.ok) {
        const authStatus = await response.json();
        if (authStatus.authenticated && authStatus.address) {
          return authStatus.address;
        }
      }
      await this.authenticate();
      const retryResponse = await this.fetchWithCookies("/me");
      if (!retryResponse.ok) {
        throw await unsuccessfulResponseToTurbineError(retryResponse);
      }
      const retryAuthStatus = await retryResponse.json();
      if (!retryAuthStatus.authenticated || !retryAuthStatus.address) {
        throw new TurbineError(
          "AUTHENTICATION_FAILED",
          "Unable to authenticate with your wallet. Please try again.",
          retryAuthStatus
        );
      }
      return retryAuthStatus.address;
    } catch (error) {
      if (error instanceof TurbineError) {
        throw error;
      }
      if (error.message && error.message.includes("Authentication failed:")) {
        throw new TurbineError("AUTHENTICATION_ERROR", error.message);
      }
      throw new TurbineError(
        "AUTHENTICATION_ERROR",
        "Unable to authenticate with your wallet. Please try again."
      );
    } finally {
      this.authenticationInProgress = false;
    }
  }
  /**
   * Calls the Turbine API endpoint with the given payload.
   * @param payload The payload to send to the endpoint
   * @param endpoint The endpoint to call. One of "add_order", "add_orders", "add_liquidity", "remove_liquidity", "cancel_order", "order_statuses"
   * @returns A Promise that resolves to a fetch response
   */
  async callApiEndpoint(payload, endpoint) {
    return await this.fetchWithCookies(endpoint, {
      method: "POST",
      body: JSON.stringify(payload, bigIntReplacer)
    });
  }
  /**
   * Parse an order status from the API response format to our TypeScript interface.
   * Converts snake_case to camelCase and string numbers to BigInts.
   * @param orderState The raw order status from the API
   * @returns The parsed OrderState object
   */
  async parseOrderState(orderState) {
    const executionsPromises = orderState.execution.map(async (exec) => ({
      txHash: exec.tx_hash,
      clearedAt: new Date(
        await this.getBlockTimestamp(Number(exec.block_number)) * 1e3
      ),
      soldAmount: BigInt(exec.sold_amount),
      boughtAmount: BigInt(exec.bought_amount),
      surplusBoughtAmount: BigInt(exec.surplus_buy_amount)
    }));
    const executions = await Promise.all(executionsPromises);
    return {
      hash: orderState.hash,
      status: orderState.status,
      execution: executions,
      executedSellAmount: executions.reduce(
        (acc, exec) => acc + exec.soldAmount,
        0n
      ),
      executedBuyAmount: executions.reduce(
        (acc, exec) => acc + exec.boughtAmount,
        0n
      )
    };
  }
  /**
   * Convert viem signature hex string to structured format expected by Turbine API
   */
  parseSignature(signature) {
    validateSignatureHex(signature, "signature");
    const sigBytes = hexToSignature(signature);
    const { r, s, v } = parseSignatureBytes(sigBytes);
    const rHex = (0, import_viem5.bytesToHex)(r);
    const sHex = (0, import_viem5.bytesToHex)(s);
    const yParity = v === 28 ? "0x1" : "0x0";
    return {
      r: rHex,
      s: sHex,
      yParity,
      v: `0x${v.toString(16)}`
    };
  }
  async getBlockTimestamp(blockNumber) {
    return await (0, import_viem5.withCache)(
      () => this.publicClient.getBlock({ blockNumber: BigInt(blockNumber) }).then((block) => Number(block.timestamp)),
      {
        cacheKey: `blockTimestamp.${this.publicClient.uid}.${blockNumber}`,
        cacheTime: Number.POSITIVE_INFINITY
      }
    );
  }
};
/** Fee precision constant matching the backend (1_000_000) */
_TurbineClient.POOL_FEE_PRECISION = 1000000n;
var TurbineClient = _TurbineClient;
async function getPools(publicClient, hookAddress) {
  try {
    const numberOfPools = await publicClient.readContract({
      address: hookAddress,
      abi: turbineHookABI,
      functionName: "getNumberOfRegisteredPools"
    });
    validateBigInt(numberOfPools, "numberOfPools");
    const BATCH_SIZE = 1000n;
    const poolsData = [];
    for (let start = 0n; start < numberOfPools; start += BATCH_SIZE) {
      const end = start + BATCH_SIZE > numberOfPools ? numberOfPools : start + BATCH_SIZE;
      const batch = await publicClient.readContract({
        address: hookAddress,
        abi: turbineHookABI,
        functionName: "getRegisteredPoolsSlice",
        args: [start, end]
      });
      poolsData.push(...batch);
    }
    poolsData.forEach((poolData, index) => {
      validatePoolData(poolData, index);
    });
    return poolsData.map(
      (poolData) => ({
        metadata: {
          token0: (0, import_viem5.getAddress)(poolData.token0),
          token1: (0, import_viem5.getAddress)(poolData.token1),
          fee: poolData.fee,
          lpToken: (0, import_viem5.getAddress)(poolData.lpToken)
        },
        state: {
          reserve0: BigInt(poolData.reserve0),
          reserve1: BigInt(poolData.reserve1),
          liquidity: BigInt(poolData.liquidity)
        },
        stats: {
          // Note: Weekly volume data is not available from the contract
          // Setting to 0 for now - this could be fetched from a subgraph. See TRB-464 https://propeller-heads.atlassian.net/browse/TRB-464
          weeklySellVolumeToken0: 0n,
          weeklySellVolumeToken1: 0n
        }
      })
    );
  } catch (error) {
    throw toTurbineError(error);
  }
}
async function getUserPositions(userAddress, publicClient, hookAddress) {
  try {
    const pools = await getPools(publicClient, hookAddress);
    if (pools.length === 0) {
      return [];
    }
    const multicallContracts = pools.map((pool) => ({
      address: pool.metadata.lpToken,
      abi: balanceOfABI,
      functionName: "balanceOf",
      args: [userAddress]
    }));
    const balanceResults = await publicClient.multicall({
      contracts: multicallContracts
    });
    const userPositions = [];
    for (let i = 0; i < pools.length; i++) {
      const pool = pools[i];
      const balanceResult = balanceResults[i];
      try {
        validateBalanceResult(balanceResult, `balanceResults[${i}]`);
      } catch (error) {
        console.warn(
          `Invalid balance result for LP token ${pool.metadata.lpToken}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        continue;
      }
      if (balanceResult.status === "success" && balanceResult.result > 0n) {
        userPositions.push({
          poolMetadata: pool.metadata,
          userAddress: (0, import_viem5.getAddress)(userAddress),
          lpTokenBalance: balanceResult.result
        });
      } else if (balanceResult.status === "failure") {
        console.warn(
          `Failed to get balance for LP token ${pool.metadata.lpToken}: ${balanceResult.error?.message || "Unknown error"}`
        );
      }
    }
    return userPositions;
  } catch (error) {
    throw toTurbineError(error);
  }
}
async function fetchConfig(turbineApiUrl) {
  try {
    const response = await fetch(buildApiUrl(turbineApiUrl, "config"));
    if (!response.ok) {
      throw await unsuccessfulResponseToTurbineError(response);
    }
    const config = await response.json();
    validateTurbineConfig(config);
    return config;
  } catch (error) {
    console.log(error);
    throw new TurbineError(
      "CONFIG_FETCH_FAILED",
      "Unable to fetch configuration. Please try again later.",
      error
    );
  }
}
async function checkStatus(turbineApiUrl) {
  try {
    const response = await fetch(buildApiUrl(turbineApiUrl, "status"));
    if (!response.ok) {
      throw await unsuccessfulResponseToTurbineError(response);
    }
    return true;
  } catch (error) {
    throw new TurbineError(
      "SERVICE_UNAVAILABLE",
      "Turbine is currently unavailable. Try again later.",
      error
    );
  }
}
function getRandomSalt() {
  const randomBytes2 = new Uint8Array(32);
  crypto.getRandomValues(randomBytes2);
  return (0, import_viem5.bytesToHex)(randomBytes2);
}
function convertSignature(sig) {
  const validatedSig = validateSignatureHex(sig, "signature");
  const sigBytes = hexToSignature(validatedSig);
  return signatureToComponents(sigBytes);
}
function bigIntReplacer(_key, value) {
  if (typeof value === "bigint") {
    return `0x${value.toString(16)}`;
  }
  return value;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ADDR2TOKEN,
  CHAIN_ID,
  DAI,
  LiquidityIntentStatus,
  MOCKED_TURBINE_POOL,
  NULL_ADDRESS,
  PEPE,
  RPC_URL,
  SQRT_PRICE_IDENTITY,
  TURBINE_API_URL,
  Token,
  TurbineClient,
  TurbineError,
  UNI,
  USDC,
  USDT,
  W3_BLOCK_NUMBER_RPC_URL,
  W3_WEBSOCKET,
  WBTC,
  WEETH,
  WETH,
  balanceOfABI,
  buildApiUrl,
  checkStatus,
  convertSignature,
  fetchConfig,
  getBatchSignedAllowance,
  getNonce,
  getPools,
  getRandomNonce,
  getRandomSalt,
  getSignature,
  getSignedAllowance,
  getSignedBatchSignatureTransfer,
  getSignedSignatureTransfer,
  getUserPositions,
  isTurbineError,
  orderSettledABI,
  poolManagerABI,
  toTurbineError,
  turbineHookABI,
  turbineLiquidityRouterABI,
  unsuccessfulResponseToTurbineError,
  validateAddLiquidityIntent,
  validateOrderIntent,
  validateRemoveLiquidityIntent,
  validateRemoveLiquidityIntentOnchain
});
