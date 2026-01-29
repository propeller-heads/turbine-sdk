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
    const pools = await turbineClient.getPools();
    if (pools.length === 0) {
        console.error("No pools found. Please create a pool first.");
        process.exit(1);
    }

    // ⚠️  IMPORTANT: Update these amounts and pool tokens before running this script!
    const token0 = USDC;
    const token1 = WETH;
    // Set realistic amounts based on your needs and current market conditions
    const token0Amount = "0"; // UPDATE THIS - e.g., "10" for 10 USDC
    const token1Amount = "0"; // UPDATE THIS - e.g., "0.004" for 0.004 WETH

    // Find the first pool with token0 and token1 tokens
    const pool = pools.find(
        (p) =>
            p.metadata.token0.toLowerCase() === token0.address.toLowerCase() &&
            p.metadata.token1.toLowerCase() === token1.address.toLowerCase()
    )?.metadata;
    if (!pool) {
        console.error(
            `No ${token0.symbol}/${token1.symbol} pool found. Please create one or adjust the script.`
        );
        process.exit(1);
    }

    const maxToken0Amount = token0.toOnchainAmount(token0Amount);
    const maxToken1Amount = token1.toOnchainAmount(token1Amount);

    // Create liquidity addition intent
    const liquidityIntent: AddLiquidityIntent = {
        owner: account.address,
        token0: token0.address as Hex,
        token1: token1.address as Hex,
        fee: pool.fee,
        token0Amount: maxToken0Amount,
        token1Amount: maxToken1Amount,
        exact: true,
        salt: getRandomSalt(),
    };

    console.log("\n📊 Liquidity Addition Details:");
    console.log(`Pool: ${token0.symbol}/${token1.symbol} (${pool.fee / 10000}% fee)`);
    console.log(
        `Token0 (${token0.symbol}): ${token0.fromOnchainAmount(maxToken0Amount)} ${token0.symbol}`
    );
    console.log(
        `Token1 (${token1.symbol}): ${token1.fromOnchainAmount(maxToken1Amount)} ${token1.symbol}`
    );
    console.log(`LP Token: ${pool.lpToken}`);

    // Ask the user to confirm before submitting
    const readline = require("readline");

    async function promptConfirmation(message: string): Promise<boolean> {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        return new Promise((resolve) => {
            rl.question(`${message} (y/N): `, (answer: string) => {
                rl.close();
                resolve(answer.trim().toLowerCase() === "y");
            });
        });
    }

    const confirmed = await promptConfirmation(
        "Do you want to proceed with the liquidity provision above?"
    );

    if (!confirmed) {
        console.log("❌ Liquidity provision cancelled by user.");
        process.exit(0);
    }

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
