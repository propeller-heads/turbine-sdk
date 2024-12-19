import { Address, createWalletClient, Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { USDC, USDT } from "../src/constants";
import { OrderIntent } from "../src/models";
import { mainnet } from "viem/chains";
import { RPC_URL } from "../src/config";

export const PREFUNDED_ADDRESS: Address = "0xBE69d72ca5f88aCba033a063dF5DBe43a4148De0";
export const PREFUNDED_PK: Hex =
    "0x91ab9a7e53c220e6210460b65a7a3bb2ca181412a8a7b43ff336b3df1737ce12";
export const USDC_SELLER_PK: Hex =
    (process.env.USDC_SELLER_PK as Hex) ||
    "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97"; // USDC seller in local deployment

export const ACCOUNT = privateKeyToAccount(PREFUNDED_PK);
export const WALLET_CLIENT = createWalletClient({
    account: ACCOUNT,
    chain: mainnet,
    transport: http(),
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
    salt: "0xbc99a2cb0a86c1eb704c1b670ec4c59eae55ceaa8f1b0068f170d6d66d1301a1",
} as const;
