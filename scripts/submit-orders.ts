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
        account,
        chain: mainnet,
        transport: http(RPC_URL),
    });
    const publicClient = createPublicClient({
        chain: mainnet,
        transport: http(RPC_URL),
    });

    const turbineClient = new TurbineClient(TURBINE_API_URL);

    console.log(`📝 Account: ${account.address}`);
    console.log(`🔗 Turbine API: ${TURBINE_API_URL}`);

    // Get current timestamp
    const now = BigInt(Math.floor(Date.now() / 1000));
    const orderDuration = 300n; // 5 minutes
    const USDCAmount = USDC.toOnchainAmount(25);
    const WETHAmount = WETH.toOnchainAmount(0.01);

    // Create order 1: Sell USDC for WETH
    const order1: OrderIntent = {
        owner: account.address,
        sellToken: USDC.address,
        buyToken: WETH.address,
        sellAmount: USDCAmount,
        minBuyAmount: (WETHAmount * 75n) / 100n, // 75% of WETHAmount
        midPriceDelta: 2500, // 25%
        startTime: now,
        endTime: now + orderDuration,
        partialFill: true,
        callData: "0x",
        callDataTarget: NULL_ADDRESS,
        salt: getRandomSalt(),
    };

    // Create order 2: Sell WETH for USDC
    const order2: OrderIntent = {
        owner: account.address,
        sellToken: WETH.address,
        buyToken: USDC.address,
        sellAmount: WETHAmount,
        minBuyAmount: (USDCAmount * 75n) / 100n, // 75% of USDCAmount
        midPriceDelta: 2500, // 25%
        startTime: now,
        endTime: now + orderDuration,
        partialFill: true,
        callData: "0x",
        callDataTarget: NULL_ADDRESS,
        salt: getRandomSalt(),
    };

    console.log("\n📋 Order Details:");
    console.log(
        `Order 1: Sell ${USDC.fromOnchainAmount(order1.sellAmount)} ${USDC.symbol} for ${WETH.symbol}`
    );
    console.log(
        `Order 2: Sell ${WETH.fromOnchainAmount(order2.sellAmount)} ${WETH.symbol} for ${USDC.symbol}`
    );
    console.log(
        `Both orders valid until: ${new Date(Number(order1.endTime) * 1000).toISOString()}`
    );

    try {
        // Submit orders
        console.log("\n🔄 Submitting orders to Turbine...");

        const orderHashes = await turbineClient.addOrders(
            [order1, order2],
            walletClient,
            publicClient
        );

        console.log("\n✅ Orders submitted successfully!");
        console.log(`Order 1 Hash: ${orderHashes[0]}`);
        console.log(`Order 2 Hash: ${orderHashes[1]}`);
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
