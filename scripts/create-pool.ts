#!/usr/bin/env ts-node

// This script creates a pool on Turbine.
//
// Set following environment variables before running the script:
// PRIVATE_KEY: Private key of the account that will create the pool
// TURBINE_API_URL: URL of the Turbine API (to fetch contract addresses)
// RPC_URL: URL of the RPC endpoint
//
// You can change pool details directly in the script.

import { createPublicClient, createWalletClient, http, Hex, Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { TurbineClient } from "../src/turbineClient";
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
    console.log("🚀 Starting Turbine pool creation script...");

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
    const token0 = USDC.address as Address;
    const token1 = WETH.address as Address;
    const fee = 3002; // 10000 = 1%

    console.log("\n📊 Pool Creation Details:");
    console.log(`Token0: ${token0}`);
    console.log(`Token1: ${token1}`);
    console.log(`Fee: ${fee / 10000}%`);

    try {
        // Create pool
        console.log("\n🔄 Creating pool on Turbine...");

        const txHash = await turbineClient.createPool(token0, token1, fee);

        console.log("\n✅ Pool created successfully!");
        console.log(`Transaction Hash: ${txHash}`);
        console.log(
            "\n💡 Note: The pool has been initialized on the blockchain. You can now add liquidity to it."
        );
    } catch (error) {
        console.error("\n❌ Error creating pool:");
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
