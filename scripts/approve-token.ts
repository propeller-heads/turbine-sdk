#!/usr/bin/env ts-node

/**
 * Approve Permit2 contract to spend one or more arbitrary tokens.
 *
 * This script:
 * 1. Takes one or more token addresses as command line arguments
 * 2. Grants infinite approval to the Permit2 contract to spend each specified token
 *
 * Environment Variables:
 * - PRIVATE_KEY (required): Private key of the account that will approve the tokens (with 0x prefix)
 * - RPC_URL (optional): RPC endpoint URL for Ethereum mainnet (uses default if not set)
 *
 * Usage:
 *   yarn approve-token <TOKEN_ADDRESS> [TOKEN_ADDRESS2] ... [-y]
 *   or
 *   ts-node scripts/approve-token.ts <TOKEN_ADDRESS> [TOKEN_ADDRESS2] ... [-y]
 *
 * Arguments:
 *   TOKEN_ADDRESS: The address(es) of the token(s) to approve (one or more)
 *   -y: Skip interactive confirmation (auto-approve)
 *
 * Example:
 *   ts-node scripts/approve-token.ts 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
 *   ts-node scripts/approve-token.ts 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 -y
 */

import {
    createPublicClient,
    createWalletClient,
    http,
    Address,
    Hex,
    maxUint256,
    isAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { PERMIT2_ADDRESS } from "@uniswap/permit2-sdk";
import * as readline from "readline";
import { RPC_URL } from "../src/config";
import { ADDR2TOKEN } from "../src/constants";

// Standard ERC20 approve ABI
const erc20ApproveABI = [
    {
        constant: false,
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        name: "approve",
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
    },
] as const;

// Standard ERC20 allowance ABI
const erc20AllowanceABI = [
    {
        constant: true,
        inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
        ],
        name: "allowance",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
] as const;

function getTokenDisplay(address: Address): string {
    const token = ADDR2TOKEN.get(address);
    return token ? `${token.symbol} (${address})` : address;
}

function createReadlineInterface(): readline.Interface {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
}

function question(rl: readline.Interface, query: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(query, resolve);
    });
}

async function main() {
    // Check for -y flag (skip confirmation)
    const skipConfirmation = process.argv.includes("-y");

    // Get token addresses from command line arguments (exclude -y flag)
    const tokenAddressArgs = process.argv.slice(2).filter((arg) => arg !== "-y");

    if (tokenAddressArgs.length === 0) {
        console.error("Error: At least one token address is required");
        console.error("\nUsage:");
        console.error("  yarn approve-token <TOKEN_ADDRESS> [TOKEN_ADDRESS2] ... [-y]");
        console.error("  or");
        console.error(
            "  ts-node scripts/approve-token.ts <TOKEN_ADDRESS> [TOKEN_ADDRESS2] ... [-y]"
        );
        console.error("\nArguments:");
        console.error("  TOKEN_ADDRESS: The address(es) of the token(s) to approve");
        console.error("  -y: Skip interactive confirmation (auto-approve)");
        console.error("\nExample:");
        console.error(
            "  ts-node scripts/approve-token.ts 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        );
        console.error(
            "  ts-node scripts/approve-token.ts 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 -y"
        );
        process.exit(1);
    }

    // Validate all token addresses
    const tokenAddresses: Address[] = [];
    for (const arg of tokenAddressArgs) {
        if (!isAddress(arg)) {
            console.error(`Error: Invalid address format: ${arg}`);
            process.exit(1);
        }
        tokenAddresses.push(arg as Address);
    }

    // Configuration
    const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex;
    if (!PRIVATE_KEY) {
        console.error("Please set PRIVATE_KEY environment variable");
        process.exit(1);
    }

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

    console.log(`👤 Account: ${account.address}`);
    console.log(`🪙 Tokens to approve: ${tokenAddresses.length}`);
    for (const tokenAddress of tokenAddresses) {
        console.log(`   - ${getTokenDisplay(tokenAddress)}`);
    }
    console.log(`📋 Permit2 Address: ${PERMIT2_ADDRESS}\n`);

    // Interactive confirmation (unless -y flag is passed)
    if (!skipConfirmation) {
        const rl = createReadlineInterface();
        const answer = await question(
            rl,
            `⚠️  Do you want to proceed with granting infinite approval to Permit2 for ${tokenAddresses.length} token(s)? (yes/no): `
        );
        rl.close();

        const normalizedAnswer = answer.trim().toLowerCase();
        if (normalizedAnswer !== "yes" && normalizedAnswer !== "y") {
            console.log("❌ Approval cancelled by user.");
            return;
        }
        console.log();
    }

    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < tokenAddresses.length; i++) {
        const tokenAddress = tokenAddresses[i];
        console.log(
            `\n━━━ [${i + 1}/${tokenAddresses.length}] ${getTokenDisplay(tokenAddress)} ━━━`
        );

        try {
            // Check current allowance
            console.log("🔍 Checking current allowance...");
            const currentAllowance = await publicClient.readContract({
                address: tokenAddress,
                abi: erc20AllowanceABI,
                functionName: "allowance",
                args: [account.address, PERMIT2_ADDRESS],
            });

            if (currentAllowance >= maxUint256) {
                console.log("✅ Permit2 already has infinite approval for this token.");
                skippedCount++;
                continue;
            }

            console.log(`   Current allowance: ${currentAllowance.toString()}`);

            // Approve Permit2 to spend tokens
            console.log("📝 Approving Permit2 to spend tokens (infinite approval)...");

            const { request } = await publicClient.simulateContract({
                address: tokenAddress,
                abi: erc20ApproveABI,
                functionName: "approve",
                args: [PERMIT2_ADDRESS, maxUint256],
                account: account,
                chain: mainnet,
            });

            const txHash = await walletClient.writeContract(request);
            console.log(`   Transaction hash: ${txHash}`);

            console.log("⏳ Waiting for transaction confirmation...");
            const receipt = await publicClient.waitForTransactionReceipt({
                hash: txHash,
            });

            if (receipt.status === "success") {
                console.log("✅ Successfully approved Permit2 to spend tokens!");
                console.log(
                    `   Transaction confirmed in block: ${receipt.blockNumber}`
                );
                successCount++;
            } else {
                console.error("❌ Transaction failed!");
                failedCount++;
            }
        } catch (error) {
            console.error("❌ Error:");
            console.error(error);
            failedCount++;
        }
    }

    // Summary
    console.log("\n━━━ Summary ━━━");
    console.log(`✅ Approved: ${successCount}`);
    console.log(`⏭️  Skipped (already approved): ${skippedCount}`);
    if (failedCount > 0) {
        console.log(`❌ Failed: ${failedCount}`);
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
