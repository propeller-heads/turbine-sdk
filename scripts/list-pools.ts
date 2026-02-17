#!/usr/bin/env ts-node

import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { RPC_URL } from "../src/config";
import { fetchPools, printPoolDetails } from "./utils/pools";

async function main() {
    console.log("🔍 Fetching registered pools...\n");

    // Set up public client
    const publicClient = createPublicClient({
        chain: mainnet,
        transport: http(RPC_URL),
    });

    try {
        const pools = await fetchPools(publicClient);

        if (pools.length === 0) {
            console.log("No registered pools found.");
            return;
        }

        console.log(`Found ${pools.length} registered pool(s):\n`);

        pools.forEach((pool, index) => {
            printPoolDetails(pool, index);
        });
    } catch (error) {
        console.error("\n❌ Error fetching pools:");
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
