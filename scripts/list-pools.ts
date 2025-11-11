#!/usr/bin/env ts-node

import { createPublicClient, http, Address } from "viem";
import { mainnet } from "viem/chains";
import { getPools, fetchConfig } from "../src/turbineClient";
import { RPC_URL, TURBINE_API_URL } from "../src/config";
import { ADDR2TOKEN } from "../src/constants";

function getTokenDisplay(address: Address): string {
    const token = ADDR2TOKEN.get(address);
    return token ? token.symbol : address;
}

async function main() {
    console.log("🔍 Fetching registered pools...\n");

    // Set up public client
    const publicClient = createPublicClient({
        chain: mainnet,
        transport: http(RPC_URL),
    });

    // Fetch config to get the hook address
    const config = await fetchConfig(TURBINE_API_URL);

    try {
        const pools = await getPools(publicClient, config.lpHookAddress);

        if (pools.length === 0) {
            console.log("No registered pools found.");
            return;
        }

        console.log(`Found ${pools.length} registered pool(s):\n`);

        pools.forEach((pool, index) => {
            console.log(`Pool #${index + 1}:`);
            console.log(`  Token0: ${getTokenDisplay(pool.metadata.token0)}`);
            console.log(`  Token1: ${getTokenDisplay(pool.metadata.token1)}`);
            console.log(
                `  Fee: ${pool.metadata.fee / 10000}% (raw: ${pool.metadata.fee})`
            );
            console.log(`  LP Token: ${pool.metadata.lpToken}`);
            console.log(`  Reserve0: ${pool.state.reserve0.toString()}`);
            console.log(`  Reserve1: ${pool.state.reserve1.toString()}`);
            console.log(`  Liquidity: ${pool.state.liquidity.toString()}`);
            console.log("");
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
