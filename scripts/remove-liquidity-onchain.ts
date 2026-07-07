#!/usr/bin/env ts-node

import {
    createPublicClient,
    createWalletClient,
    http,
    getAddress,
    isAddress,
} from "viem";
import { mainnet } from "viem/chains";
import prompts from "prompts";
import { getRandomSalt } from "../src/turbineClient";
import { getUserPositions, submitRemoveLiquidityIntentOnchain } from "../src/onchain";
import { RemoveLiquidityIntent, UserPosition } from "../src/models";
import { RPC_URL } from "../src/config";
import { turbineSettlerABI } from "../src/abi";
import { getTokenDisplay } from "./utils/pools";
import { getAccount } from "./utils/keystore";

/**
 * Parse a user-supplied LP token amount (in atomic units, matching how
 * balances are reported on-chain) and validate it against the account balance.
 */
function parseLpAmount(value: string, balance: bigint): bigint {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
        throw new Error("Must be a whole number of LP tokens (atomic units)");
    }
    const amount = BigInt(trimmed);
    if (amount <= 0n) {
        throw new Error("Amount must be greater than 0");
    }
    if (amount > balance) {
        throw new Error(`Amount exceeds your balance of ${balance.toString()}`);
    }
    return amount;
}

function validateLpAmount(value: string, balance: bigint): true | string {
    try {
        parseLpAmount(value, balance);
        return true;
    } catch (error) {
        return error instanceof Error ? error.message : "Invalid amount";
    }
}

/**
 * Format a one-line label for a user's LP position, including their balance.
 */
function formatPositionLabel(position: UserPosition): string {
    const t0 = getTokenDisplay(position.poolMetadata.token0);
    const t1 = getTokenDisplay(position.poolMetadata.token1);
    const feePercent = position.poolMetadata.fee / 10000;
    return `${t0} / ${t1} ${feePercent}%  (balance: ${position.lpTokenBalance.toString()} LP)`;
}

async function main() {
    console.log("🚀 Starting Turbine on-chain liquidity removal script...");

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

    // Prompt for the TurbineSettler contract address. Everything else (the
    // liquidity router, the hook, and the registered pools) is derived from it
    // on-chain, so this script never contacts the Turbine API.
    const settlerResponse = await prompts({
        type: "text",
        name: "settlerAddress",
        message: "Enter the TurbineSettler contract address:",
        validate: (value: string) =>
            isAddress(value.trim()) ? true : "Must be a valid Ethereum address",
    });

    // Handle Ctrl+C
    if (settlerResponse.settlerAddress === undefined) {
        console.log("\n❌ Operation cancelled");
        process.exit(1);
    }

    const settlerAddress = getAddress(settlerResponse.settlerAddress.trim());

    // Derive the liquidity router and hook from the settler:
    // settler -> liquidity router -> hook (see turbine contracts).
    const [lpRouterAddress, lpHookAddress] = await Promise.all([
        publicClient.readContract({
            address: settlerAddress,
            abi: turbineSettlerABI,
            functionName: "getTurbineLiquidityRouter",
        }),
        publicClient.readContract({
            address: settlerAddress,
            abi: turbineSettlerABI,
            functionName: "getTurbineHook",
        }),
    ]);

    // Infer the available pools from the settler's hook and keep only the pools
    // where this account actually holds LP tokens (getUserPositions omits
    // zero-balance positions).
    console.log("\n🔍 Looking up your liquidity positions...");
    const positions = await getUserPositions(
        publicClient,
        account.address,
        getAddress(lpHookAddress)
    );

    if (positions.length === 0) {
        console.error(
            `\n❌ Account ${account.address} holds no LP tokens in any pool registered on this settler; nothing to remove.`
        );
        process.exit(1);
    }

    // Show the largest positions first.
    positions.sort((a, b) => {
        if (a.lpTokenBalance === b.lpTokenBalance) return 0;
        return a.lpTokenBalance > b.lpTokenBalance ? -1 : 1;
    });

    console.log(`\n📊 You hold LP tokens in ${positions.length} pool(s):\n`);
    positions.forEach((position, index) => {
        console.log(`  #${index}: ${formatPositionLabel(position)}`);
    });

    const selection = await prompts({
        type: "select",
        name: "positionIndex",
        message: "Select a pool to remove liquidity from:",
        choices: positions.map((position, index) => ({
            title: formatPositionLabel(position),
            value: index,
        })),
    });

    // Handle Ctrl+C
    if (selection.positionIndex === undefined) {
        console.log("\n❌ Operation cancelled");
        process.exit(1);
    }

    const position = positions[selection.positionIndex];
    const lpTokenBalance = position.lpTokenBalance;

    // Ask how many LP tokens to burn (atomic units, same as the reported balance).
    const burnResponse = await prompts({
        type: "text",
        name: "amount",
        message: `Amount of LP tokens to burn (atomic units, max ${lpTokenBalance.toString()}):`,
        validate: (value: string) => validateLpAmount(value, lpTokenBalance),
    });

    // Handle Ctrl+C
    if (burnResponse.amount === undefined) {
        console.log("\n❌ Operation cancelled");
        process.exit(1);
    }

    const lpTokenToBurn = parseLpAmount(burnResponse.amount, lpTokenBalance);

    const removeIntent: RemoveLiquidityIntent = {
        owner: account.address,
        token0: position.poolMetadata.token0,
        token1: position.poolMetadata.token1,
        fee: position.poolMetadata.fee,
        lpToken: position.poolMetadata.lpToken,
        lpTokenAmount: lpTokenToBurn,
        salt: getRandomSalt(),
    };

    console.log("\n📊 Liquidity Removal Details:");
    console.log(`Pool: ${formatPositionLabel(position)}`);
    console.log(`LP Token: ${position.poolMetadata.lpToken}`);
    console.log(
        `LP Token to burn: ${lpTokenToBurn.toString()} (wei units) (~${(lpTokenToBurn * 100n) / lpTokenBalance}% of balance)`
    );

    try {
        // Submit liquidity removal on-chain
        console.log("\n🔄 Submitting liquidity removal intent on-chain...");

        const { txHash, intentHash } = await submitRemoveLiquidityIntentOnchain(
            walletClient,
            publicClient,
            getAddress(lpHookAddress),
            getAddress(lpRouterAddress),
            removeIntent
        );

        console.log("\n✅ Liquidity removal intent submitted on-chain successfully!");
        console.log(`Transaction hash: ${txHash}`);
        console.log(`Intent hash: ${intentHash}`);
        console.log(
            "\n💡 Note: The intent is now queued in the TurbineLiquidityRouter contract. Once it passes the speedbump, execute it with:"
        );
        console.log(
            `\n   yarn execute-pending-onchain-intents ${getAddress(lpRouterAddress)} ${intentHash}`
        );
    } catch (error) {
        console.error("\n❌ Error submitting liquidity removal on-chain:");
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
