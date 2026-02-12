#!/usr/bin/env ts-node

import { createPublicClient, createWalletClient, http, Hex } from "viem";
import { mainnet } from "viem/chains";
import { TurbineClient, getRandomSalt } from "../src/turbineClient";
import { AddLiquidityIntent } from "../src/models";
import { RPC_URL, TURBINE_API_URL } from "../src/config";
import { getAccount } from "./utils/keystore";
import {
    selectPool,
    getPoolTokens,
    formatPoolLabel,
    getTokenDisplay,
} from "./utils/pools";
import prompts from "prompts";

async function main() {
    console.log("🚀 Starting Turbine liquidity addition script...\n");

    // Set up clients
    const account = await getAccount();
    const walletClient = createWalletClient({
        account: account,
        chain: mainnet,
        transport: http(RPC_URL),
    });
    const publicClient = createPublicClient({
        chain: mainnet,
        transport: http(RPC_URL),
    });

    console.log(`👤 Account: ${account.address}`);
    console.log(`🌐 Turbine API: ${TURBINE_API_URL}\n`);

    // Step 1: Select a pool interactively
    const pool = await selectPool(publicClient);
    const { token0, token1 } = getPoolTokens(pool);
    const token0Display = getTokenDisplay(pool.metadata.token0);
    const token1Display = getTokenDisplay(pool.metadata.token1);

    console.log(`\n✅ Selected pool: ${formatPoolLabel(pool)}`);
    console.log(`   LP Token: ${pool.metadata.lpToken}\n`);

    // Step 2: Prompt for token amounts
    console.log(
        `\n💡 Enter amounts to add. Use base units (e.g. 10 USDC), not atomic units (not 10,000,000 USDC).\n`
    );
    const response = await prompts([
        {
            type: "text",
            name: "token0Amount",
            message: `Amount of ${token0Display} to add:`,
            validate: (value: string) => {
                if (!value.trim()) return "Amount is required";
                const num = Number(value);
                if (isNaN(num) || num < 0) return "Must be a valid non-negative number";
                return true;
            },
        },
        {
            type: "text",
            name: "token1Amount",
            message: `Amount of ${token1Display} to add:`,
            validate: (value: string) => {
                if (!value.trim()) return "Amount is required";
                const num = Number(value);
                if (isNaN(num) || num < 0) return "Must be a valid non-negative number";
                return true;
            },
        },
    ]);

    // Handle Ctrl+C
    if (response.token0Amount === undefined || response.token1Amount === undefined) {
        console.log("\n❌ Operation cancelled");
        process.exit(1);
    }

    const token0AmountStr: string = response.token0Amount.trim();
    const token1AmountStr: string = response.token1Amount.trim();

    // Convert to on-chain amounts
    // If we have known Token objects, use their decimals; otherwise fall back to raw bigint input
    let maxToken0Amount: bigint;
    let maxToken1Amount: bigint;

    if (token0) {
        maxToken0Amount = token0.toOnchainAmount(token0AmountStr);
    } else {
        maxToken0Amount = BigInt(token0AmountStr);
    }

    if (token1) {
        maxToken1Amount = token1.toOnchainAmount(token1AmountStr);
    } else {
        maxToken1Amount = BigInt(token1AmountStr);
    }

    // Create the TurbineClient for submitting the intent
    const turbineClient = await TurbineClient.create(
        walletClient,
        publicClient,
        TURBINE_API_URL
    );

    // Build the liquidity intent
    const liquidityIntent: AddLiquidityIntent = {
        owner: account.address,
        token0: pool.metadata.token0 as Hex,
        token1: pool.metadata.token1 as Hex,
        fee: pool.metadata.fee,
        token0Amount: maxToken0Amount,
        token1Amount: maxToken1Amount,
        exact: true,
        salt: getRandomSalt(),
    };

    // Display summary
    console.log("\n📊 Liquidity Addition Details:");
    console.log(`   Pool: ${formatPoolLabel(pool)}`);
    console.log(
        `   ${token0Display}: ${token0 ? token0.fromOnchainAmount(maxToken0Amount) : maxToken0Amount.toString()}`
    );
    console.log(
        `   ${token1Display}: ${token1 ? token1.fromOnchainAmount(maxToken1Amount) : maxToken1Amount.toString()}`
    );
    console.log(`   LP Token: ${pool.metadata.lpToken}`);

    // Confirm before submitting
    const confirm = await prompts({
        type: "confirm",
        name: "proceed",
        message: "Proceed with the liquidity provision above?",
        initial: false,
    });

    if (!confirm.proceed) {
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
