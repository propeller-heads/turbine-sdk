#!/usr/bin/env ts-node

import { createPublicClient, createWalletClient, http, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { TurbineClient, getRandomSalt } from "../src/turbineClient";
import { RemoveLiquidityIntent } from "../src/models";
import { USDC, WETH } from "../src/constants";
import { RPC_URL } from "../src/config";
import { balanceOfABI } from "../src/abi";

// Configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex;
if (!PRIVATE_KEY) {
    console.error("Please set PRIVATE_KEY environment variable");
    process.exit(1);
}

const TURBINE_API_URL = process.env.TURBINE_API_URL || "http://0.0.0.0:8080/api";

async function main() {
    console.log("🚀 Starting Turbine liquidity removal script...");

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
        fee: 3000, // 0.3%
        lpToken: "0x24746c26c7b83ddabbaf384e02c3eb0e7b8cd307",
    };

    // Get current LP token balance of walletClient account
    const lpTokenBalance = await publicClient.readContract({
        address: pool.lpToken as Hex,
        abi: balanceOfABI,
        functionName: "balanceOf",
        args: [account.address],
    });

    const lpTokenToBurn = lpTokenBalance / 5n; // Burn 20% of the balance

    // Create liquidity removal intent
    const removeIntent: RemoveLiquidityIntent = {
        owner: account.address,
        token0: pool.token0 as Hex,
        token1: pool.token1 as Hex,
        fee: pool.fee,
        lpToken: pool.lpToken as Hex,
        lpTokenAmount: lpTokenToBurn,
        salt: getRandomSalt(),
    };

    console.log("\n📊 Liquidity Removal Details:");
    console.log(`Pool: ${USDC.symbol}/${WETH.symbol} (${pool.fee / 10000}% fee)`);
    console.log(`LP Token: ${pool.lpToken}`);
    console.log(
        `LP Token to burn: ${lpTokenToBurn.toString()} (wei units) (~${(lpTokenToBurn * 100n) / lpTokenBalance}% of balance)`
    );

    try {
        // Submit liquidity removal
        console.log("\n🔄 Submitting liquidity removal to Turbine...");

        const intentHash = await turbineClient.removeLiquidity(removeIntent);

        console.log("\n✅ Liquidity removal submitted successfully!");
        console.log(`Intent Hash: ${intentHash}`);
        console.log(
            "\n💡 Note: The actual liquidity removal will be executed by Turbine's settlement system."
        );
    } catch (error) {
        console.error("\n❌ Error submitting liquidity removal:");
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
