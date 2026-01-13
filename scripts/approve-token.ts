#!/usr/bin/env ts-node

/**
 * Approve Permit2 contract to spend an arbitrary token.
 *
 * This script:
 * 1. Takes a token address as a command line argument
 * 2. Grants infinite approval to the Permit2 contract to spend the specified token
 *
 * Environment Variables:
 * - PRIVATE_KEY (required): Private key of the account that will approve the token (with 0x prefix)
 * - RPC_URL (optional): RPC endpoint URL for Ethereum mainnet (uses default if not set)
 *
 * Usage:
 *   yarn approve-token <TOKEN_ADDRESS> [-y]
 *   or
 *   ts-node scripts/approve-token.ts <TOKEN_ADDRESS> [-y]
 *
 * Arguments:
 *   TOKEN_ADDRESS: The address of the token to approve
 *   -y: Skip interactive confirmation (auto-approve)
 *
 * Example:
 *   ts-node scripts/approve-token.ts 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
 *   ts-node scripts/approve-token.ts 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 -y
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
    // Get token address from command line arguments
    const tokenAddressArg = process.argv[2];
    if (!tokenAddressArg) {
        console.error("Error: Token address is required");
        console.error("\nUsage:");
        console.error("  yarn approve-token <TOKEN_ADDRESS> [-y]");
        console.error("  or");
        console.error("  ts-node scripts/approve-token.ts <TOKEN_ADDRESS> [-y]");
        console.error("\nArguments:");
        console.error("  TOKEN_ADDRESS: The address of the token to approve");
        console.error("  -y: Skip interactive confirmation (auto-approve)");
        console.error("\nExample:");
        console.error(
            "  ts-node scripts/approve-token.ts 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        );
        console.error(
            "  ts-node scripts/approve-token.ts 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 -y"
        );
        process.exit(1);
    }

    // Check for -y flag (skip confirmation)
    const skipConfirmation = process.argv.includes("-y");

    // Validate token address
    if (!isAddress(tokenAddressArg)) {
        console.error(`Error: Invalid address format: ${tokenAddressArg}`);
        process.exit(1);
    }

    const tokenAddress = tokenAddressArg as Address;

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
    console.log(`🪙 Token: ${getTokenDisplay(tokenAddress)}`);
    console.log(`📋 Permit2 Address: ${PERMIT2_ADDRESS}\n`);

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
            return;
        }

        console.log(`   Current allowance: ${currentAllowance.toString()}\n`);

        // Interactive confirmation (unless -y flag is passed)
        if (!skipConfirmation) {
            const rl = createReadlineInterface();
            const answer = await question(
                rl,
                "⚠️  Do you want to proceed with granting infinite approval to Permit2? (yes/no): "
            );
            rl.close();

            const normalizedAnswer = answer.trim().toLowerCase();
            if (normalizedAnswer !== "yes" && normalizedAnswer !== "y") {
                console.log("❌ Approval cancelled by user.");
                return;
            }
            console.log();
        }

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
            console.log("\n✅ Successfully approved Permit2 to spend tokens!");
            console.log(`   Transaction confirmed in block: ${receipt.blockNumber}`);
        } else {
            console.error("\n❌ Transaction failed!");
            process.exit(1);
        }
    } catch (error) {
        console.error("\n❌ Error:");
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
