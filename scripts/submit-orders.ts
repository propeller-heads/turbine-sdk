#!/usr/bin/env ts-node

import { createPublicClient, createWalletClient, http, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { TurbineClient, getRandomSalt } from "../src/turbineClient";
import { OrderIntent } from "../src/models";
import { USDC, WETH, NULL_ADDRESS } from "../src/constants";
import { RPC_URL } from "../src/config";

// Configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex;
if (!PRIVATE_KEY) {
    console.error("Please set PRIVATE_KEY environment variable");
    process.exit(1);
}

const TURBINE_API_URL = process.env.TURBINE_API_URL || "http://0.0.0.0:8080/api";

async function main() {
    console.log("🚀 Starting Turbine order submission script...");

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

    console.log(`📝 Account: ${account.address}`);
    console.log(`🔗 Turbine API: ${TURBINE_API_URL}`);

    // Get current timestamp
    const now = BigInt(Math.floor(Date.now() / 1000));
    const orderDuration = 300n; // 5 minutes

    // ⚠️  IMPORTANT: Update these amounts and token pairs before running this script!
    // Set realistic amounts based on your needs and current market conditions
    const token0 = USDC;
    const token1 = WETH;
    const token0Amount = "0"; // UPDATE THIS - e.g., "50" for 50 USDC
    const token1Amount = "0"; // UPDATE THIS - e.g., "0.02" for 0.02 WETH

    const maxToken0Amount = token0.toOnchainAmount(token0Amount);
    const maxToken1Amount = token1.toOnchainAmount(token1Amount);

    // Define your orders here - modify this array as needed
    const orders: OrderIntent[] = [
        // Order 1: Sell token0 for token1
        {
            owner: account.address,
            sellToken: token0.address,
            buyToken: token1.address,
            sellAmount: maxToken0Amount,
            minBuyAmount: (maxToken1Amount * 75n) / 100n, // 75% of maxToken1Amount
            midPriceDelta: 500, // 5%
            startTime: now,
            endTime: now + orderDuration,
            partialFill: true,
            callData: "0x",
            callDataTarget: NULL_ADDRESS,
            salt: getRandomSalt(),
        },
        // Order 2: Sell token1 for token0
        {
            owner: account.address,
            sellToken: token1.address,
            buyToken: token0.address,
            sellAmount: maxToken1Amount,
            minBuyAmount: (maxToken0Amount * 75n) / 100n, // 75% of maxToken0Amount
            midPriceDelta: 500, // 5%
            startTime: now,
            endTime: now + orderDuration,
            partialFill: true,
            callData: "0x",
            callDataTarget: NULL_ADDRESS,
            salt: getRandomSalt(),
        },
    ];

    console.log(`\n📋 Order Details (${orders.length} orders):`);
    orders.forEach((order, index) => {
        const sellToken = order.sellToken === token0.address ? token0 : token1;
        const buyToken = order.buyToken === token0.address ? token0 : token1;
        console.log(
            `Order ${index + 1}: Sell ${sellToken.fromOnchainAmount(order.sellAmount)} ${sellToken.symbol} for ${buyToken.symbol}`
        );
    });
    console.log(
        `All orders valid until: ${new Date(Number(orders[0].endTime) * 1000).toISOString()}`
    );

    try {
        // Submit orders
        console.log(`\n🔄 Submitting ${orders.length} orders to Turbine...`);

        const orderHashes = await turbineClient.addOrders(orders);

        console.log("\n✅ Orders submitted successfully!");
        orderHashes.forEach((hash, index) => {
            console.log(`Order ${index + 1} Hash: ${hash}`);
        });
        console.log(`\n💻 Run the following command to watch the orders:`);
        console.log(`yarn get-order-states ${orderHashes.join(" ")}`);
    } catch (error) {
        console.error("\n❌ Error submitting orders:");
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
