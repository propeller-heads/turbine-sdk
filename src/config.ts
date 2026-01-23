import { getAddress } from "viem";

export const CHAIN_ID = 1;

export const TURBINE_API_URL =
    process.env.TURBINE_API_URL || "http://127.0.0.1:8080/api";

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

// Mocked Turbine Pool for testing/development
export const MOCKED_TURBINE_POOL = {
    metadata: {
        token0: getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"), // USDC
        token1: getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"), // WETH
        fee: 3000, // 0.3% in hundredths of basis point
        lpToken: getAddress("0x24746c26c7b83ddabbaf384e02c3eb0e7b8cd307"),
    },
    state: {
        reserve0: 1000000, // Mock reserve for token0 (USDC)
        reserve1: 500, // Mock reserve for token1 (WETH)
    },
    stats: {
        weeklySellVolumeToken0: 10000000, // Mock weekly volume for token0
        weeklySellVolumeToken1: 5000, // Mock weekly volume for token1
    },
};
