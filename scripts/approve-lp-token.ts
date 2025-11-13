#!/usr/bin/env ts-node

/**
 * Approve Permit2 contract to spend LP tokens from a selected pool.
 *
 * This script:
 * 1. Fetches and displays the first 10 registered pools
 * 2. Prompts the user to interactively select a pool
 * 3. Grants infinite approval to the Permit2 contract to spend the selected pool's LP token
 *
 * Environment Variables:
 * - PRIVATE_KEY (required): Private key of the account that will approve the LP token (with 0x prefix)
 * - RPC_URL (optional): RPC endpoint URL for Ethereum mainnet (uses default if not set)
 * - TURBINE_API_URL (optional): Turbine API URL (defaults to http://127.0.0.1:8080/api)
 *
 * Usage:
 *   yarn approve-lp-token
 *   or
 *   ts-node scripts/approve-lp-token.ts
 */

import {
    createPublicClient,
    createWalletClient,
    http,
    Address,
    Hex,
    maxUint256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { PERMIT2_ADDRESS } from "@uniswap/permit2-sdk";
import * as readline from "readline";
import { getPools, fetchConfig } from "../src/turbineClient";
import { RPC_URL, TURBINE_API_URL } from "../src/config";
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

function getTokenDisplay(address: Address): string {
    const token = ADDR2TOKEN.get(address);
    return token ? token.symbol : address;
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
    console.log("🔍 Fetching registered pools...\n");

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

    console.log(`👤 Account: ${account.address}\n`);

    try {
        // Fetch config to get the hook address
        const config = await fetchConfig(TURBINE_API_URL);

        // Get pools
        const pools = await getPools(publicClient, config.lpHookAddress);

        if (pools.length === 0) {
            console.log("No registered pools found.");
            return;
        }

        // Limit to first 10 pools
        const poolsToShow = pools.slice(0, 10);
        console.log(
            `Found ${pools.length} registered pool(s) (showing first ${poolsToShow.length}):\n`
        );

        // Display pools
        poolsToShow.forEach((pool, index) => {
            const token0 = getTokenDisplay(pool.metadata.token0);
            const token1 = getTokenDisplay(pool.metadata.token1);
            const lpToken = pool.metadata.lpToken;
            console.log(
                `${index}: ${token0} / ${token1} ${pool.metadata.fee / 10000}% (LP token ${lpToken})`
            );
        });

        // Interactive selection
        const rl = createReadlineInterface();
        const answer = await question(
            rl,
            `\nSelect a pool (0-${poolsToShow.length - 1}) to approve its LP token for Permit2: `
        );
        rl.close();

        const selectedIndex = parseInt(answer.trim());

        if (
            isNaN(selectedIndex) ||
            selectedIndex < 0 ||
            selectedIndex >= poolsToShow.length
        ) {
            console.error(
                `Invalid selection. Please choose a number between 0 and ${poolsToShow.length - 1}.`
            );
            process.exit(1);
        }

        const selectedPool = poolsToShow[selectedIndex];
        const lpTokenAddress = selectedPool.metadata.lpToken;

        console.log(`\n✅ Selected Pool #${selectedIndex}:`);
        console.log(`   Token0: ${getTokenDisplay(selectedPool.metadata.token0)}`);
        console.log(`   Token1: ${getTokenDisplay(selectedPool.metadata.token1)}`);
        console.log(`   LP Token: ${lpTokenAddress}`);
        console.log(`   Permit2 Address: ${PERMIT2_ADDRESS}\n`);

        // Check current allowance
        console.log("🔍 Checking current allowance...");
        const currentAllowance = await publicClient.readContract({
            address: lpTokenAddress,
            abi: [
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
            ],
            functionName: "allowance",
            args: [account.address, PERMIT2_ADDRESS],
        });

        if (currentAllowance >= maxUint256) {
            console.log("✅ Permit2 already has infinite approval for this LP token.");
            return;
        }

        console.log(`   Current allowance: ${currentAllowance.toString()}\n`);

        // Approve Permit2 to spend LP tokens
        console.log("📝 Approving Permit2 to spend LP tokens (infinite approval)...");

        const { request } = await publicClient.simulateContract({
            address: lpTokenAddress,
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
            console.log("\n✅ Successfully approved Permit2 to spend LP tokens!");
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
