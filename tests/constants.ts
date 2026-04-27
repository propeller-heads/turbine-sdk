import { createPublicClient, createWalletClient, Hex, http, Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { RPC_URL } from "../src/config";
import { NULL_ADDRESS, USDC, USDT, WETH } from "../src/constants";
import {
    AddLiquidityIntent,
    OrderIntent,
    RemoveLiquidityIntent,
    TurbineConfig,
} from "../src/models";
import { TurbineClient } from "../src/turbineClient";
import { mainnet } from "viem/chains";
import { jest } from "@jest/globals";

export const PREFUNDED_PK: Hex =
    "0x91ab9a7e53c220e6210460b65a7a3bb2ca181412a8a7b43ff336b3df1737ce12";
export const USDC_SELLER_PK: Hex =
    (process.env.USDC_SELLER_PK as Hex) ||
    "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97"; // USDC seller in local deployment

export const ACCOUNT = privateKeyToAccount(PREFUNDED_PK);
export const WALLET_CLIENT = createWalletClient({
    account: ACCOUNT,
    chain: mainnet,
    transport: http(RPC_URL),
});
export const PUBLIC_CLIENT = createPublicClient({
    chain: mainnet,
    transport: http(RPC_URL),
});

const getCurrentTimestamp = () => BigInt(Math.floor(Date.now() / 1000));

export const ORDER_INTENT: OrderIntent = {
    owner: ACCOUNT.address,
    sellToken: USDC.address,
    buyToken: USDT.address,
    sellAmount: 100000000n,
    minBuyAmount: 95000000n,
    midPriceDelta: 5,
    startTime: getCurrentTimestamp(),
    endTime: getCurrentTimestamp() + 3600n, // 1 hour in the future
    partialFill: true,
    callData: "0x",
    callDataTarget: NULL_ADDRESS,
    salt: "0xbc99a2cb0a86c1eb704c1b670ec4c59eae55ceaa8f1b0068f170d6d66d1301a1",
} as const;

// A smart order is characterized by having calldata and callDataTarget fields set
export const SMART_ORDER_INTENT: OrderIntent = {
    owner: ACCOUNT.address,
    sellToken: USDC.address,
    buyToken: USDT.address,
    sellAmount: 100000000n,
    minBuyAmount: 95000000n,
    midPriceDelta: 0,
    startTime: getCurrentTimestamp(),
    endTime: getCurrentTimestamp() + 3600n, // 1 hour in the future
    partialFill: true,
    callData: "0x12345678",
    callDataTarget: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    salt: "0xbc99a2cb0a86c1eb704c1b670ec4c59eae55ceaa8f1b0068f170d6d66d1301a1",
} as const;

export const ADD_LIQUIDITY_INTENT: AddLiquidityIntent = {
    owner: ACCOUNT.address,
    token0: USDC.address,
    token1: WETH.address,
    fee: 3000,
    token0Amount: 200000000n,
    token1Amount: 100000000000000000000000n,
    exact: true,
    salt: "0xbc99a2cb0a86c1eb704c1b670ec4c59eae55ceaa8f1b0068f170d6d66d1301a1",
} as const;

export const REMOVE_LIQUIDITY_INTENT: RemoveLiquidityIntent = {
    owner: ACCOUNT.address,
    token0: USDC.address,
    token1: WETH.address,
    fee: 3000,
    lpToken: "0x0000000000000000000000000000000000000000", // to be filled in by the test
    lpTokenAmount: 2000000000000n,
    salt: "0xbc99a2cb0a86c1eb704c1b670ec4c59eae55ceaa8f1b0068f170d6d66d1301a1",
} as const;

// Mock configuration for testing
export const MOCK_TURBINE_CONFIG: TurbineConfig = {
    turbineSettlerAddress: "0x1234567890123456789012345678901234567890" as Address,
    lpHookAddress: "0x2345678901234567890123456789012345678901" as Address,
    lpRouterAddress: "0x3456789012345678901234567890123456789012" as Address,
    poolManagerAddress: "0x4567890123456789012345678901234567890123" as Address,
    submitSettlements: true,
    siweDomain: "test.propellerheads.xyz",
    siweUri: "https://test-turbine.propellerheads.xyz/api",
    tokens: [
        {
            address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
            symbol: "USDC",
            decimals: 6,
            class: "Stable",
        },
        {
            address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address,
            symbol: "WETH",
            decimals: 18,
            class: "Regular",
        },
    ],
};

// Helper function to create a mocked TurbineClient for testing
export async function createMockTurbineClient(
    customApiUrl?: string
): Promise<TurbineClient> {
    // Mock the status check and config fetch
    jest.spyOn(global, "fetch").mockImplementation(
        async (url: string | URL | Request) => {
            const urlString = url.toString();

            if (urlString.includes("/status")) {
                return new Response("OK", { status: 200 });
            }

            if (urlString.includes("/config")) {
                return new Response(JSON.stringify(MOCK_TURBINE_CONFIG), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }

            throw new Error(`Unmocked fetch URL: ${urlString}`);
        }
    );

    const client = await TurbineClient.create(
        WALLET_CLIENT,
        PUBLIC_CLIENT,
        customApiUrl
    );

    jest.spyOn(client as any, "getBlockTimestamp").mockImplementation(
        (...args: unknown[]) => {
            const blockNumber = args[0] as number;
            if (blockNumber === 23882001) {
                return Promise.resolve(1764148979);
            }
            if (blockNumber === 23882281) {
                return Promise.resolve(1764152387);
            }
            throw new Error(`Unmocked block number: ${blockNumber}`);
        }
    );

    // Mock SignatureTransfer permit helpers to prevent real blockchain calls (nonceBitmap reads).
    jest.spyOn(
        await import("../src/permit2SignatureTransfer"),
        "getSignedSignatureTransfer"
    ).mockResolvedValue({
        permit: {
            permitted: {
                token: USDC.address as Address,
                amount: BigInt("1000000000000000000000000000000"),
            },
            nonce: 0n,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
        },
        permitSignature:
            "0x111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111b" as Hex, // Added 1b at end for valid v value (v=27)
    });

    jest.spyOn(
        await import("../src/permit2SignatureTransfer"),
        "getSignedBatchSignatureTransfer"
    ).mockResolvedValue({
        permit: {
            permitted: [
                {
                    token: USDC.address as Address,
                    amount: BigInt("1000000000000000000000000000000"),
                },
                {
                    token: WETH.address as Address,
                    amount: BigInt("1000000000000000000000000000000"),
                },
            ],
            nonce: 0n,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
        },
        permitSignature:
            "0x222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222221c" as Hex, // Added 1c at end for valid v value (v=28)
    });

    // Mock the getSignedAllowance function to prevent real blockchain calls
    jest.spyOn(await import("../src/permit2"), "getSignedAllowance").mockResolvedValue({
        permit: {
            details: {
                token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
                amount: BigInt("1000000000000000000000000000000"),
                expiration: Math.floor(Date.now() / 1000) + 3600,
                nonce: 0,
            },
            spender: MOCK_TURBINE_CONFIG.turbineSettlerAddress,
            sigDeadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
        },
        permitSignature:
            "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b" as Hex, // Changed last byte from 12 to 1b (v=27)
    });

    // Mock the batch allowance as well to avoid real RPC calls during tests
    jest.spyOn(
        await import("../src/permit2"),
        "getBatchSignedAllowance"
    ).mockResolvedValue({
        permit: {
            details: [
                {
                    token: USDC.address as Address,
                    amount: BigInt("1000000000000000000000000000000"),
                    expiration: Math.floor(Date.now() / 1000) + 3600,
                    nonce: 0,
                },
                {
                    token: WETH.address as Address,
                    amount: BigInt("1000000000000000000000000000000"),
                    expiration: Math.floor(Date.now() / 1000) + 3600,
                    nonce: 0,
                },
            ],
            spender: MOCK_TURBINE_CONFIG.lpRouterAddress,
            sigDeadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
        },
        permitSignature:
            "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefab1b" as Hex, // Changed last 2 chars to 1b for valid v value (v=27)
    });

    return client;
}

// ============================================================================
// VALIDATION TEST CONSTANTS
// ============================================================================

// Valid test data
export const VALID_ADDRESS = USDC.address;
export const VALID_HASH =
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
export const VALID_SIGNATURE_HEX = "0x" + "1".repeat(128) + "1b"; // v=27

// Invalid test data
export const INVALID_ADDRESS_TOO_SHORT = "0x1234";
export const INVALID_HASH_TOO_SHORT = "0x" + "1".repeat(63);
export const INVALID_HASH_TOO_LONG = "0x" + "1".repeat(65);
export const INVALID_SIGNATURE_WRONG_V = "0x" + "1".repeat(128) + "1a"; // v=26

// PrimitiveSignature
export const VALID_PRIMITIVE_SIGNATURE = {
    r: BigInt("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"),
    s: BigInt("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"),
    yParity: false,
};

// TokenPermissions
export const VALID_TOKEN_PERMISSIONS = {
    token: USDC.address as Address,
    amount: BigInt("1000000000000000000"),
};

// SignedBatchSignatureTransfer
export const VALID_SIGNED_BATCH_SIGNATURE_TRANSFER = {
    signature: VALID_PRIMITIVE_SIGNATURE,
    permit: {
        permitted: [
            VALID_TOKEN_PERMISSIONS,
            { token: WETH.address as Address, amount: 1000n },
        ],
        nonce: 0n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
    },
};
