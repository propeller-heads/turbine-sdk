#!/usr/bin/env ts-node

// This script gets the current Permit2 nonce for a given owner, token, and spender.
//
// Usage:
//   ts-node scripts/get-permit2-nonce.ts <owner> <token> <spender>
//
// Example:
//   ts-node scripts/get-permit2-nonce.ts 0x123... 0xabc... 0xdef...
//
// Set following environment variables before running the script:
//   RPC_URL: URL of the RPC endpoint

import { createPublicClient, http, Address } from "viem";
import { mainnet } from "viem/chains";
import { getNonce } from "../src/permit2";
import { RPC_URL } from "../src/config";

// Parse CLI arguments
const args = process.argv.slice(2);
if (args.length !== 3) {
    console.error(
        "Usage: ts-node scripts/get-permit2-nonce.ts <owner> <token> <spender>\n" +
            "Example: ts-node scripts/get-permit2-nonce.ts 0x123... 0xabc... 0xdef..."
    );
    process.exit(1);
}

const [ownerArg, tokenArg, spenderArg] = args;

// Validate addresses
function validateAddress(address: string, name: string): Address {
    if (!address.startsWith("0x") || address.length !== 42) {
        console.error(`Invalid ${name} address: ${address}`);
        console.error("Address must be a valid Ethereum address (0x followed by 40 hex characters)");
        process.exit(1);
    }
    return address as Address;
}

const owner = validateAddress(ownerArg, "owner");
const token = validateAddress(tokenArg, "token");
const spender = validateAddress(spenderArg, "spender");

async function main() {
    console.log("🔍 Fetching Permit2 nonce...\n");

    // Set up public client
    const publicClient = createPublicClient({
        chain: mainnet,
        transport: http(RPC_URL),
    });

    console.log(`Owner: ${owner}`);
    console.log(`Token: ${token}`);
    console.log(`Spender: ${spender}\n`);

    try {
        const nonce = await getNonce(owner, token, spender, publicClient);

        console.log(`✅ Current Permit2 nonce: ${nonce}`);
    } catch (error) {
        console.error("\n❌ Error fetching Permit2 nonce:");
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

