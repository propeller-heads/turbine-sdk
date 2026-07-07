#!/usr/bin/env ts-node

import {
    createPublicClient,
    createWalletClient,
    getAddress,
    Hex,
    http,
    isAddress,
    isHash,
} from "viem";
import { mainnet } from "viem/chains";
import { executePendingRemoveLiquidityIntentsOnchain } from "../src/onchain";
import { RPC_URL } from "../src/config";
import { getAccount } from "./utils/keystore";

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error(
        "Please provide the TurbineLiquidityRouter address followed by at least one remove-liquidity intent hash.\n" +
            "Example: yarn execute-pending-onchain-intents 0xRouter... 0xIntent1... [0xIntent2...]"
    );
    process.exit(1);
}

const [routerArg, ...hashArgs] = args;

if (!isAddress(routerArg)) {
    console.error(`Invalid TurbineLiquidityRouter address provided: ${routerArg}`);
    process.exit(1);
}
const lpRouterAddress = getAddress(routerArg);

const intentHashes = hashArgs.map((hash) => {
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

    console.log(`👤 Account: ${account.address}`);
    console.log(`🚦 Liquidity Router: ${lpRouterAddress}`);
    console.log(`🧾 Pending Intents: ${intentHashes.length}`);

    try {
        console.log("\n🔄 Executing pending remove liquidity intents on-chain...");

        await executePendingRemoveLiquidityIntentsOnchain(
            walletClient,
            publicClient,
            lpRouterAddress,
            intentHashes
        );

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
