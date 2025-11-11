#!/usr/bin/env ts-node

import { createPublicClient, createWalletClient, http, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { TurbineClient, getRandomSalt } from "../src/turbineClient";
import { RemoveLiquidityIntent } from "../src/models";
import { USDC, WETH } from "../src/constants";
import { RPC_URL } from "../src/config";

// Configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex;
if (!PRIVATE_KEY) {
    console.error("Please set PRIVATE_KEY environment variable");
    process.exit(1);
}

const TURBINE_API_URL = process.env.TURBINE_API_URL || "http://0.0.0.0:8080/api";

async function main() {
    console.log("🚀 Starting Turbine on-chain liquidity removal script...");

    // Set up clients
    const account = privateKeyToAccount(PRIVATE_KEY);
    const walletClient = createWalletClient({
        account,
        chain: mainnet,
        transport: http(RPC_URL),
    });
    const publicClient = createPublicClient({
        chain: mainnet,
        transport: http(RPC_URL),
    });

    const turbineClient = await TurbineClient.create(
        walletClient,
        publicClient,
        TURBINE_API_URL
    );

    console.log(`👤 Account: ${account.address}`);
    console.log(`🌐 Turbine API: ${TURBINE_API_URL}`);

    // Pool configuration
    const pool = {
        token0: USDC.address,
        token1: WETH.address,
        fee: 0xbb8, // 3000 = 0.3%
        lpToken: "0x24746c26c7b83ddabbaf384e02c3eb0e7b8cd307",
    };

    // Amount of LP tokens to burn (assumes 18 decimals)
    const lpTokenAmount = 1n * 10n ** 18n; // 1 LP token

    const removeIntent: RemoveLiquidityIntent = {
        owner: account.address,
        token0: pool.token0 as Hex,
        token1: pool.token1 as Hex,
        fee: pool.fee,
        lpToken: pool.lpToken as Hex,
        lpTokenAmount,
        salt: getRandomSalt(),
    };

    console.log("\n📊 Liquidity Removal Details:");
    console.log(`Pool: ${USDC.symbol}/${WETH.symbol} (${pool.fee / 10000}% fee)`);
    console.log(`LP Token: ${pool.lpToken}`);
    console.log(`LP Token Amount: ${lpTokenAmount.toString()} (wei units)`);

    try {
        // Submit liquidity removal on-chain
        console.log("\n🔄 Submitting liquidity removal intent on-chain...");

        const txHash = await turbineClient.removeLiquidityOnchain(removeIntent);

        console.log("\n✅ Liquidity removal intent submitted on-chain successfully!");
        console.log(`Transaction Hash: ${txHash}`);
        console.log(
            "\n💡 Note: The intent is now queued in the TurbineLiquidityRouter contract. It can be executed once eligible."
        );
    } catch (error) {
        console.error("\n❌ Error submitting liquidity removal on-chain:");
        console.error(error);
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
});

main().catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
});
