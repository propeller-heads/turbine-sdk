#!/usr/bin/env ts-node

import { createPublicClient, createWalletClient, http } from "viem";
import { mainnet } from "viem/chains";
import { TurbineClient } from "../src/turbineClient";
import { GetOrdersOptions, OrderState } from "../src/models";
import { RPC_URL } from "../src/config";
import { getAccount } from "./utils/keystore";

const TURBINE_API_URL = process.env.TURBINE_API_URL || "http://localhost:8080/api";

function displayPage(label: string, orders: OrderState[]): void {
    console.log("\n" + "=".repeat(80));
    console.log(`${label} (${orders.length} order${orders.length === 1 ? "" : "s"})`);
    console.log("=".repeat(80));

    orders.forEach((order, index) => {
        const details = order.orderDetails;
        console.log(`\n  ${index + 1}. ${order.hash}`);
        console.log(`     Status: ${order.status}`);
        if (details) {
            console.log(
                `     Sell: ${details.sellAmount.toString()} @ ${details.sellToken}`
            );
            console.log(`     Buy:  ${details.buyToken}`);
            console.log(
                `     Limit: ${details.limitPrice.numerator.toString()}/${details.limitPrice.denominator.toString()}`
            );
            console.log(`     Created: ${details.createdTimestamp.toISOString()}`);
        } else {
            console.log("     (no orderDetails on this response)");
        }
        if (order.execution.length > 0) {
            console.log(`     Executions: ${order.execution.length}`);
        }
    });
}

async function run(client: TurbineClient, label: string, options: GetOrdersOptions) {
    const result = await client.getOrders(options);
    displayPage(label, result.orders);
    console.log(`\n  cursor=${result.cursor ?? "null"}  hasMore=${result.hasMore}`);
    return result;
}

async function main() {
    console.log("🚀 getOrders smoke script");
    console.log(`🌐 Turbine API: ${TURBINE_API_URL}`);

    const account = await getAccount();
    const walletClient = createWalletClient({
        account,
        chain: mainnet,
        transport: http(RPC_URL),
    });
    const publicClient = createPublicClient({
        chain: mainnet,
        transport: http(RPC_URL),
    });

    const client = await TurbineClient.create(
        walletClient,
        publicClient,
        TURBINE_API_URL
    );
    console.log(`👤 Account: ${account.address}`);

    const all = await run(client, "All orders (no filters)", {});

    await run(client, "Active only", { statuses: ["Active"] });

    const firstPage = await run(client, "Limit 1 — first page", { limit: 1 });
    if (firstPage.cursor) {
        await run(client, "Limit 1 — second page", {
            limit: 1,
            cursor: firstPage.cursor,
        });
    } else {
        console.log(
            "\n(no cursor returned — fewer than 2 orders, skipping pagination check)"
        );
    }

    if (all.orders.length > 0) {
        const hash = all.orders[0].hash;
        await run(client, `Hash filter — ${hash}`, { hashes: [hash] });
    }
}

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
});

main().catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
});
