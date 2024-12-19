import { Address } from "viem";
import { Token } from "./models";
import { CHAIN_ID, TURBINE_SETTLER_CONTRACT } from "./config";

export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

export const TURBINE_DOMAIN = {
    name: "Turbine",
    version: "0.1.0",
    chainId: CHAIN_ID,
    verifyingContract: TURBINE_SETTLER_CONTRACT,
    salt: "0xea6078b87659a262f2239bc31d5f870898575eed78c14d5feb90615aafb06587",
} as const;

export const USDC = new Token("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", 6, "USDC");
export const USDT = new Token("0xdAC17F958D2ee523a2206206994597C13D831ec7", 6, "USDT");
export const DAI = new Token("0x6B175474E89094C44Da98b954EedeAC495271d0F", 18, "DAI");
export const UNI = new Token("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", 18, "UNI");
export const WETH = new Token("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 18, "WETH");
export const WEETH = new Token(
    "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee",
    18,
    "WEETH"
);
export const PEPE = new Token("0x6982508145454Ce325dDbE47a25d4ec3d2311933", 18, "PEPE");
export const WBTC = new Token("0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", 8, "WBTC");

export const ADDR2TOKEN: Map<Address, Token> = new Map([
    [USDC.address, USDC],
    [USDT.address, USDT],
    [DAI.address, DAI],
    [UNI.address, UNI],
    [WETH.address, WETH],
    [WEETH.address, WEETH],
    [PEPE.address, PEPE],
    [WBTC.address, WBTC],
]);
