import { Address, getAddress, Hex } from "viem";

export const CHAIN_ID = 1;

export const TURBINE_API_URL =
    process.env.TURBINE_API_URL || "http://127.0.0.1:8080/api";
export const SIWE_DOMAIN = process.env.SIWE_DOMAIN || "dev-swap.propellerheads.xyz";
export const TURBINE_SETTLER_CONTRACT: Address = getAddress(
    process.env.TURBINE_SETTLER_CONTRACT || "0x93feD5239b89D3Bf85B937822C3aB05F4Fb1d910"
);
export const TURBINE_LIQUIDITY_ROUTER_CONTRACT: Address = getAddress(
    process.env.TURBINE_LIQUIDITY_ROUTER_CONTRACT ||
        "0xD9A3087e6AFe906110642D16b1993A43a487d967"
);
export const TURBINE_HOOK_CONTRACT: Address = getAddress(
    process.env.TURBINE_HOOK_CONTRACT || "0x6bbDcb2d52B1319AED9615035844F56597C8a088"
);

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
        fee: 30, // 0.3% in basis points
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
