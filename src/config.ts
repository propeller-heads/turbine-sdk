import { Address, getAddress } from "viem";

export const TURBINE_API_URL = process.env.TURBINE_API_URL || "http://0.0.0.0:8080";
export const TURBINE_SETTLER_CONTRACT: Address = getAddress(
    "0xA860c3a85eb909c256CAec827B6226bdAb25AabE"
);

export const RPC_URL = process.env.RPC_URL; // leave unset to use default for Mainnet
export const CHAIN_ID = 1;

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
