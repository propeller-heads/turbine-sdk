#!/usr/bin/env ts-node

import { createPublicClient, createWalletClient, Hex, http, isHash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { TurbineClient } from "../src/turbineClient";
import { RPC_URL } from "../src/config";

// Configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex;
if (!PRIVATE_KEY) {
    console.error("Please set PRIVATE_KEY environment variable");
    process.exit(1);
}

const TURBINE_API_URL = process.env.TURBINE_API_URL || "http://0.0.0.0:8080/api";

const hashArgs = process.argv.slice(2);
if (hashArgs.length === 0) {
    console.error(
        "Please provide at least one remove-liquidity intent hash as an argument.\n" +
            "Example: ts-node scripts/execute-pending-onchain-intents.ts 0xabc... 0xdef..."
    );
    process.exit(1);
}

const intentHashes = hashArgs.map((hash) => {
    // Validate hash format using viem's isHash
    if (!isHash(hash)) {
        console.error(`Invalid hash provided: ${hash}`);
        console.error(
            "Expected format: 0x followed by 64 hexadecimal characters (32 bytes)"
        );
        process.exit(1);
    }
    return hash as Hex;
});

async function main() {
    console.log("🚀 Starting Turbine pending intent execution script...");

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
    console.log(`🧾 Pending Intents: ${intentHashes.length}`);

    try {
        console.log("\n🔄 Executing pending remove liquidity intents on-chain...");

        await turbineClient.executePendingRemoveLiquidityIntentsOnchain(intentHashes);

        console.log("\n✅ Pending intents executed successfully!");
        console.log("All provided intent hashes have been processed on-chain.");
    } catch (error) {
        console.error("\n❌ Error executing pending intents on-chain:");
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
