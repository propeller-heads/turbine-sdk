import { createWalletClient, Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { RPC_URL } from "../src/config";
import { NULL_ADDRESS, USDC, USDT } from "../src/constants";
import { OrderIntent } from "../src/models";
import { mainnet } from "viem/chains";

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

export const ORDER_INTENT: OrderIntent = {
    owner: ACCOUNT.address,
    sellToken: USDC.address,
    buyToken: USDT.address,
    sellAmount: 1000n,
    minBuyAmount: 950n,
    midPriceDelta: 5,
    startTime: 1630000000n,
    endTime: 1630003600n,
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
    sellAmount: 1000n,
    minBuyAmount: 950n,
    midPriceDelta: 0,
    startTime: 1630000000n,
    endTime: 1630003600n,
    partialFill: true,
    callData: "0x12345678",
    callDataTarget: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    salt: "0xbc99a2cb0a86c1eb704c1b670ec4c59eae55ceaa8f1b0068f170d6d66d1301a1",
} as const;
