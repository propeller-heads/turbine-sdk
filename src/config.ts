import { Address, getAddress, Hex } from "viem";

export const CHAIN_ID = 1;

export const TURBINE_API_URL = process.env.TURBINE_API_URL || "http://0.0.0.0:8080";
export const TURBINE_SETTLER_CONTRACT: Address = getAddress(
    process.env.TURBINE_SETTLER_CONTRACT || "0x7B39F073d2f2511a5e1ff664AeC5daee02044967"
);
const TURBINE_SALT =
    "0xea6078b87659a262f2239bc31d5f870898575eed78c14d5feb90615aafb06587";
export const TURBINE_DOMAIN = {
    name: "Turbine",
    version: "0.1.0",
    chainId: CHAIN_ID,
    verifyingContract: TURBINE_SETTLER_CONTRACT,
    salt: TURBINE_SALT as Hex,
} as const;

export const RPC_URL = process.env.RPC_URL; // leave unset to use default for Mainnet

/**
 * Web3 connection details. Used to sync to new blocks.
 *
 * Should be of form "wss://..."
 *
 * It's possible to get notifications about new blocks from one chain,
 * but use block number from another chain. This is useful if you're testing
 * with a Tenderly Virtual Testnet that syncs with Mainnet. In such case
 * you need to subscribe to Mainnet to get new block notifications (because
 * Testnet will not advance until a transaction is sent to it), but you need
 * block numbers from Testnet (because it advances at a different rate than
 * Mainnet).
 *
 * If W3_BLOCK_NUMBER_RPC_URL is undefined (default), block numbers will be taken
 * from new block notifications obtained from the websocket.
 */
export const W3_WEBSOCKET = process.env.W3_WEBSOCKET;
export const W3_BLOCK_NUMBER_RPC_URL = process.env.W3_BLOCK_NUMBER_RPC_URL || undefined;
