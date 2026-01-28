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
    // Find the first pool with USDC as token0 and WETH as token1
    const pool = pools.find(
        (p) =>
            p.metadata.token0.toLowerCase() === USDC.address.toLowerCase() &&
            p.metadata.token1.toLowerCase() === WETH.address.toLowerCase()
    )?.metadata;
    if (!pool) {
        console.error(
            "No USDC/WETH pool found. Please create one or adjust the script."
        );
        process.exit(1);
    }

    // ⚠️  IMPORTANT: Update these amounts before running this script!
    // Set realistic amounts based on your needs and current market conditions
    const usdcAmountDecimal = 0; // UPDATE THIS - e.g., 10 for 10 USDC
    const wethAmountDecimal = 0; // UPDATE THIS - e.g., 0.004 for 0.004 WETH

    const maxUSDCAmount = USDC.toOnchainAmount(usdcAmountDecimal);
    const maxWETHAmount = WETH.toOnchainAmount(wethAmountDecimal);

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
