#!/usr/bin/env ts-node

import { createPublicClient, createWalletClient, http, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { TurbineClient, getRandomSalt } from "../src/turbineClient";
import { AddLiquidityIntent } from "../src/models";
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
    console.log("🚀 Starting Turbine liquidity addition script...");

    // Set up clients
    const account = privateKeyToAccount(PRIVATE_KEY);
    const walletClient = createWalletClient({
        account: account,
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
        token0: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
        token1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
        fee: 0xbb8, // 3000 = 0.3%
        lpToken: "0x24746c26c7b83ddabbaf384e02c3eb0e7b8cd307",
    };

    // Liquidity amounts
    const maxUSDCAmount = USDC.toOnchainAmount(10); // 10 USDC
    const maxWETHAmount = WETH.toOnchainAmount(0.004); // 0.004 WETH ~ $10

    // Create liquidity addition intent
    const liquidityIntent: AddLiquidityIntent = {
        owner: account.address,
        token0: pool.token0 as Hex,
        token1: pool.token1 as Hex,
        fee: pool.fee,
        token0Amount: maxUSDCAmount,
        token1Amount: maxWETHAmount,
        exact: true,
        salt: getRandomSalt(),
    };

    console.log("\n📊 Liquidity Addition Details:");
    console.log(`Pool: ${USDC.symbol}/${WETH.symbol} (${pool.fee / 10000}% fee)`);
    console.log(
        `Token0 (${USDC.symbol}): ${USDC.fromOnchainAmount(maxUSDCAmount)} ${USDC.symbol}`
    );
    console.log(
        `Token1 (${WETH.symbol}): ${WETH.fromOnchainAmount(maxWETHAmount)} ${WETH.symbol}`
    );
    console.log(`LP Token: ${pool.lpToken}`);

    try {
        // Submit liquidity addition
        console.log("\n🔄 Submitting liquidity addition to Turbine...");

        const intentHash = await turbineClient.addLiquidity(liquidityIntent);

        console.log("\n✅ Liquidity addition submitted successfully!");
        console.log(`Intent Hash: ${intentHash}`);
        console.log(
            "\n💡 Note: The actual liquidity addition will be executed by Turbine's settlement system."
        );
    } catch (error) {
        console.error("\n❌ Error submitting liquidity addition:");
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
