#!/usr/bin/env ts-node

import {
    Address,
    createPublicClient,
    createWalletClient,
    getAddress,
    Hex,
    http,
    isHash,
    PublicClient,
} from "viem";
import { mainnet } from "viem/chains";
import { TurbineClient } from "../src/turbineClient";
import { RPC_URL } from "../src/config";
import { getAccount } from "./utils/keystore";

// OLD-ROUTER RECOVERY SCRIPT — executes pending remove-liquidity intents that were
// submitted to the OLD (pre-redeploy) TurbineLiquidityRouter via
// `yarn remove-liquidity-from-old-router`.
const OLD_ROUTER_ADDRESS = getAddress("0xB6f2F9F7AB521d67604a42E879f2D3F94D5837E7");

// Eligibility rules enforced by TurbineLiquidityRouter.executePendingIntents():
//  - SPEEDBUMP_DURATION (12s): an intent younger than this is skipped.
//  - permit deadline (the SDK sets now + 2.5h): past it the intent is discarded,
//    not executed.
// The contract SILENTLY skips ineligible intents (no revert), so a naive call can
// "succeed" while moving nothing. We read on-chain state to check before/after.
const SPEEDBUMP_SECONDS = 12n;
const INTENT_LIFETIME_SECONDS = 9000n; // 2.5h, matches the SDK permit deadline

// Public getter for the `removeLiquidityCreatedAt` mapping: 0 means the intent is
// not stored (never submitted, wrong hash, already executed, or expired/purged).
const routerReadAbi = [
    {
        type: "function",
        name: "removeLiquidityCreatedAt",
        stateMutability: "view",
        inputs: [{ name: "", type: "bytes32" }],
        outputs: [{ name: "", type: "uint256" }],
    },
] as const;

const hashArgs = process.argv.slice(2);
if (hashArgs.length === 0) {
    console.error(
        "Please provide at least one remove-liquidity intent hash as an argument.\n" +
            "Example: yarn execute-pending-intents-from-old-router 0xabc... 0xdef..."
    );
    process.exit(1);
}

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

async function readCreatedAt(
    publicClient: PublicClient,
    router: Address,
    hash: Hex
): Promise<bigint> {
    return publicClient.readContract({
        address: router,
        abi: routerReadAbi,
        functionName: "removeLiquidityCreatedAt",
        args: [hash],
    });
}

/**
 * Classify each intent against the router's eligibility rules and return a list
 * of human-readable blockers. Emits a warning (not a blocker) for intents that
 * look expired, since executing them is harmless but pointless.
 */
async function findBlockers(
    publicClient: PublicClient,
    router: Address,
    hashes: Hex[],
    now: bigint
): Promise<string[]> {
    const blockers: string[] = [];
    for (const hash of hashes) {
        const createdAt = await readCreatedAt(publicClient, router, hash);
        if (createdAt === 0n) {
            blockers.push(
                `${hash}: not found on the old router (never submitted, wrong hash, already executed, or expired).`
            );
            continue;
        }
        const age = now - createdAt;
        if (age < SPEEDBUMP_SECONDS) {
            blockers.push(
                `${hash}: too new — wait ~${SPEEDBUMP_SECONDS - age}s more (12s speed bump), then retry.`
            );
        } else if (age > INTENT_LIFETIME_SECONDS) {
            console.warn(
                `⚠️  ${hash}: older than 2.5h and likely expired — executing will discard it.`
            );
        }
    }
    return blockers;
}

/**
 * After execution, an intent whose `createdAt` is cleared to 0 was consumed.
 * One still holding a timestamp was skipped (nothing moved).
 */
async function reportOutcome(
    publicClient: PublicClient,
    router: Address,
    hashes: Hex[]
): Promise<void> {
    const executed: Hex[] = [];
    const pending: Hex[] = [];
    for (const hash of hashes) {
        const createdAt = await readCreatedAt(publicClient, router, hash);
        (createdAt === 0n ? executed : pending).push(hash);
    }

    if (executed.length > 0) {
        console.log(`\n✅ Processed ${executed.length} intent(s) on-chain.`);
        console.log(
            "Check your wallet: the two pool tokens should have arrived and your LP balance should now be 0."
        );
        console.log(
            "If nothing arrived and your LP balance is unchanged, the request was discarded — re-run `yarn remove-liquidity-from-old-router` (make sure the wallet has ETH for gas)."
        );
    }
    if (pending.length > 0) {
        console.warn(`\n⚠️  Still pending (nothing moved): ${pending.join(", ")}`);
        console.warn("Wait ~30s after submitting, then run this script again.");
    }
}

async function main() {
    console.log("🚀 Starting Turbine OLD-ROUTER pending intent execution script...");

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

    const turbineClient = await TurbineClient.create(walletClient, publicClient);

    // Redirect the SDK to the old router that holds the funds.
    turbineClient.config.lpRouterAddress = OLD_ROUTER_ADDRESS;
    const router = turbineClient.config.lpRouterAddress;

    console.log(`👤 Account: ${account.address}`);
    console.log(`🏛️  Old router: ${router}`);
    console.log(`🧾 Pending Intents: ${intentHashes.length}`);

    // Execution must come from the intent owner (this wallet) or the settler, and
    // the contract skips anything ineligible without reverting. Check state first.
    const { timestamp: now } = await publicClient.getBlock();
    const blockers = await findBlockers(publicClient, router, intentHashes, now);
    if (blockers.length > 0) {
        console.error("\n❌ Cannot execute yet:");
        for (const blocker of blockers) {
            console.error(`   • ${blocker}`);
        }
        console.error(
            "\nMake sure you are running this from the SAME wallet that submitted the intent."
        );
        process.exit(1);
    }

    try {
        console.log("\n🔄 Executing pending remove liquidity intents on-chain...");

        await turbineClient.executePendingRemoveLiquidityIntentsOnchain(intentHashes);

        await reportOutcome(publicClient, router, intentHashes);
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
