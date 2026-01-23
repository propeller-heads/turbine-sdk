#!/usr/bin/env ts-node

import { createPublicClient, createWalletClient, Hex, http, isHash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { TurbineClient } from "../src/turbineClient";
import { OrderState } from "../src/models";
import { RPC_URL } from "../src/config";

// Configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex;
if (!PRIVATE_KEY) {
    console.error("Please set PRIVATE_KEY environment variable");
    process.exit(1);
}

const TURBINE_API_URL = process.env.TURBINE_API_URL || "http://0.0.0.0:8080/api";
const POLL_INTERVAL_MS = 12000; // 12 seconds

const hashArgs = process.argv.slice(2);
if (hashArgs.length === 0) {
    console.error(
        "Please provide at least one order hash as an argument.\n" +
            "Example: ts-node scripts/get-order-states.ts 0xabc... 0xdef..."
    );
    process.exit(1);
}

const orderHashes = hashArgs.map((hash) => {
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

/**
 * Sleep for the specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Display order states in a formatted way
 */
function displayOrderStates(orderStates: OrderState[]): void {
    console.log("\n" + "=".repeat(80));
    console.log(`Order States (${orderStates.length} orders):`);
    console.log("=".repeat(80));

    orderStates.forEach((state, index) => {
        console.log(`\nOrder ${index + 1}:`);
        console.log(`  Hash: ${state.hash}`);
        console.log(`  Status: ${state.status}`);
        console.log(`  Executed Sell Amount: ${state.executedSellAmount.toString()}`);
        console.log(`  Executed Buy Amount: ${state.executedBuyAmount.toString()}`);
        console.log(`  Executions: ${state.execution.length}`);

        if (state.execution.length > 0) {
            state.execution.forEach((exec, execIndex) => {
                console.log(`    Execution ${execIndex + 1}:`);
                console.log(`      TX Hash: ${exec.txHash}`);
                console.log(`      Cleared At: ${exec.clearedAt.toISOString()}`);
                console.log(`      Sold Amount: ${exec.soldAmount.toString()}`);
                console.log(`      Bought Amount: ${exec.boughtAmount.toString()}`);
                console.log(
                    `      Surplus Bought Amount: ${exec.surplusBoughtAmount.toString()}`
                );
            });
        }
    });
    console.log("\n" + "=".repeat(80));
}

/**
 * Check if any order has a status that requires continued polling
 */
function shouldContinuePolling(orderStates: OrderState[]): boolean {
    return orderStates.some(
        (state) => state.status === "Active" || state.status === "PendingCancellation"
    );
}

async function main() {
    console.log("🚀 Starting Turbine order state polling script...");

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
    console.log(`📋 Order Hashes: ${orderHashes.length}`);
    orderHashes.forEach((hash, index) => {
        console.log(`  ${index + 1}. ${hash}`);
    });

    try {
        let pollCount = 0;
        let allOrderStates: OrderState[] = [];

        while (true) {
            pollCount++;
            const timestamp = new Date().toISOString();
            console.log(`\n🔄 Poll #${pollCount} at ${timestamp}`);

            // Fetch order states
            allOrderStates = await turbineClient.getOrderStates(orderHashes);

            // Display current states
            displayOrderStates(allOrderStates);

            // Check if we should continue polling
            if (!shouldContinuePolling(allOrderStates)) {
                console.log(
                    "\n✅ All orders have reached final states (not Active or PendingCancellation)."
                );
                console.log("Stopping polling...\n");
                break;
            }

            // Show which orders are still being polled
            const activeOrders = allOrderStates.filter(
                (state) =>
                    state.status === "Active" || state.status === "PendingCancellation"
            );
            console.log(
                `\n⏳ Continuing to poll ${activeOrders.length} order(s) with status Active or PendingCancellation...`
            );
            activeOrders.forEach((state) => {
                console.log(`  - ${state.hash}: ${state.status}`);
            });

            // Wait before next poll
            console.log(
                `\n⏱️  Waiting ${POLL_INTERVAL_MS / 1000} seconds before next poll...`
            );
            await sleep(POLL_INTERVAL_MS);
        }

        // Final display of all order states
        console.log("\n📊 Final Order States:");
        displayOrderStates(allOrderStates);
    } catch (error) {
        console.error("\n❌ Error polling order states:");
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
