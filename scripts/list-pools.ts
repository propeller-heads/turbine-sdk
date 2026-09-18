#!/usr/bin/env ts-node

import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { RPC_URL, TURBINE_API_URL } from "../src/config";
import { fetchPools, printPoolDetails } from "./utils/pools";

const API_URLS: Record<string, string> = {
    dev: "https://dev-api.turbine.exchange/api",
    staging: "https://staging-api.turbine.exchange/api",
    prod: "https://api.turbine.exchange/api",
};

/**
 * Resolve which Turbine API to read the hook address from. Without `--env` this
 * keeps the usual behaviour: `TURBINE_API_URL`, or the production API.
 */
function parseApiUrl(): string {
    const args = process.argv.slice(2);
    const index = args.indexOf("--env");

    if (index === -1) {
        return TURBINE_API_URL;
    }

    const name = args[index + 1];
    const apiUrl = name ? API_URLS[name] : undefined;
    if (!apiUrl) {
        console.error(
            `Unknown environment: ${name ?? "(missing)"}. ` +
                `Use one of: ${Object.keys(API_URLS).join(", ")}.`
        );
        process.exit(1);
    }
    return apiUrl;
}

async function main() {
    const apiUrl = parseApiUrl();

    console.log(`🌐 Turbine API: ${apiUrl}`);
    console.log("🔍 Fetching registered pools...\n");

    // Set up public client
    const publicClient = createPublicClient({
        chain: mainnet,
        transport: http(RPC_URL),
    });

    try {
        const pools = await fetchPools(publicClient, apiUrl);

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
