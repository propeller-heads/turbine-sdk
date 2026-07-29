#!/usr/bin/env tsx

/**
 * Liquidity-intent queue stress tool.
 *
 * Submits a large number of *valid* add-liquidity intents from a single wallet at a bounded
 * rate and reports when Turbine starts rejecting them (synchronously, via a non-2xx response)
 * or later marks accepted intents as `Invalid` (the async path: the API pre-checks the queue
 * caps and returns 200, but the actual enqueue loses a race against the cap and invalidates
 * the intent). Both are the behaviours the TRB-1275 queue-bound work added.
 *
 * This is a single-use, non-interactive tool. The signing key is read from the PRIVATE_KEY
 * environment variable. Dev does not execute intents, so on-chain state is not altered; the
 * intents simply sit in the queue as Pending until they expire.
 *
 * Required env:
 *   PRIVATE_KEY       - hex private key of the submitting account (0x-prefixed)
 *   TURBINE_API_URL   - dev API base URL, e.g. https://api.dev.turbine.exchange/api
 *   RPC_URL           - RPC endpoint for the dev chain (used for Permit2 nonce reads / pool data)
 *
 * Optional env overrides for the tuning constants below: RATE_LIMIT_RPS, TOTAL_INTENTS,
 * MAX_IN_FLIGHT, POOL_INDEX, STOP_AFTER_REJECTIONS.
 */

import { createPublicClient, createWalletClient, http, Hex } from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { TurbineClient, getRandomSalt } from "../src/turbineClient";
import { AddLiquidityIntent, LiquidityIntentStatus, TurbinePool } from "../src/models";
import { RPC_URL, TURBINE_API_URL } from "../src/config";
import { isTurbineError } from "../src/errorHandling";

// ---------------------------------------------------------------------------
// Tuning constants (all overridable via env for convenience; defaults stand alone).
// ---------------------------------------------------------------------------

/** Target submission rate. Default 1000 requests/second. */
const RATE_LIMIT_RPS = numFromEnv("RATE_LIMIT_RPS", 1000);

/** Total intents to attempt before stopping (upper bound on the run). */
const TOTAL_INTENTS = numFromEnv("TOTAL_INTENTS", 5000);

/**
 * Cap on concurrently in-flight submissions. Bounds sockets/memory and, when the backend or
 * RPC can't keep up with RATE_LIMIT_RPS, throttles the real rate instead of piling up requests.
 */
const MAX_IN_FLIGHT = numFromEnv("MAX_IN_FLIGHT", 300);

/** Which registered pool to target (index into the eligible-pool list). */
const POOL_INDEX = numFromEnv("POOL_INDEX", 0);

/**
 * Stop early once this many rejections have been observed — enough to confirm the queue is
 * bounded without hammering the dev API further. Set to 0 to run the full TOTAL_INTENTS.
 */
const STOP_AFTER_REJECTIONS = numFromEnv("STOP_AFTER_REJECTIONS", 200);

/** Provide this fraction (1/divisor) of pool reserves per intent, so each intent is non-trivial. */
const RESERVE_FRACTION_DIVISOR = 1000n; // 0.1% of reserves

/** Hashes per status-poll request when checking for async `Invalid` markings. */
const STATUS_POLL_BATCH = 200;

/** Dispatcher wake-up interval; the token bucket keeps the average rate at RATE_LIMIT_RPS. */
const DISPATCH_TICK_MS = 20;

// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function numFromEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (raw === undefined || raw.trim() === "") return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid ${name}: ${raw}`);
    }
    return value;
}

interface FirstRejection {
    index: number;
    atMs: number;
    label: string;
    message: string;
}

interface RunStats {
    submitted: number;
    accepted: number;
    rejected: number;
    inFlight: number;
    firstRejection: FirstRejection | null;
    byLabel: Record<string, number>;
    acceptedHashes: Hex[];
}

/**
 * Reduce any thrown error to a stable label + message. Backend cap errors
 * (USER_LIQUIDITY_ACTION_LIMIT_REACHED / GLOBAL_LIQUIDITY_ACTION_LIMIT_REACHED) are not in the
 * SDK's known-code list, so the SDK reports them as code "UNKNOWN_ERROR" with the real code in
 * `details.originalCode`; prefer that so the report names the actual rejection reason.
 */
function classifyError(error: unknown): { label: string; message: string } {
    if (isTurbineError(error)) {
        const originalCode =
            error.details && typeof error.details === "object"
                ? (error.details as { originalCode?: string }).originalCode
                : undefined;
        return { label: originalCode ?? error.code, message: error.message };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { label: "NON_TURBINE_ERROR", message };
}

/** Pick an eligible pool (non-zero reserves and supply) to target. */
function selectPool(pools: TurbinePool[]): TurbinePool {
    const eligible = pools.filter(
        (p) => p.state.reserve0 > 0n && p.state.reserve1 > 0n && p.state.liquidity > 0n
    );
    if (eligible.length === 0) {
        throw new Error(
            "No eligible pool found (need non-zero reserves and LP supply). " +
                "Seed a pool on the dev environment first."
        );
    }
    if (POOL_INDEX >= eligible.length) {
        throw new Error(
            `POOL_INDEX ${POOL_INDEX} out of range; only ${eligible.length} eligible pool(s).`
        );
    }
    return eligible[POOL_INDEX];
}

function makeIntentBuilder(owner: Hex, pool: TurbinePool): () => AddLiquidityIntent {
    // Proportional-mode amounts matching the pool's reserve ratio keep the intent valid without
    // needing token decimals or exact-mode imbalance handling. Floored to 1 so neither side is 0.
    const token0Amount =
        pool.state.reserve0 / RESERVE_FRACTION_DIVISOR > 0n
            ? pool.state.reserve0 / RESERVE_FRACTION_DIVISOR
            : 1n;
    const token1Amount =
        pool.state.reserve1 / RESERVE_FRACTION_DIVISOR > 0n
            ? pool.state.reserve1 / RESERVE_FRACTION_DIVISOR
            : 1n;

    return () => ({
        owner,
        token0: pool.metadata.token0,
        token1: pool.metadata.token1,
        fee: pool.metadata.fee,
        token0Amount,
        token1Amount,
        exact: false,
        salt: getRandomSalt(),
    });
}

async function runStressTest(
    client: TurbineClient,
    buildIntent: () => AddLiquidityIntent
): Promise<RunStats> {
    const stats: RunStats = {
        submitted: 0,
        accepted: 0,
        rejected: 0,
        inFlight: 0,
        firstRejection: null,
        byLabel: {},
        acceptedHashes: [],
    };

    const inflight = new Set<Promise<void>>();
    const startMs = Date.now();
    let stopRequested = false;

    const onSigint = () => {
        console.log("\n⏹  Stop requested — draining in-flight submissions...");
        stopRequested = true;
    };
    process.on("SIGINT", onSigint);

    const dispatch = (index: number) => {
        stats.submitted++;
        stats.inFlight++;
        const task = (async () => {
            try {
                const hash = (await client.addLiquidity(buildIntent())) as Hex;
                stats.accepted++;
                stats.acceptedHashes.push(hash);
            } catch (error) {
                stats.rejected++;
                const { label, message } = classifyError(error);
                stats.byLabel[label] = (stats.byLabel[label] ?? 0) + 1;
                if (stats.firstRejection === null) {
                    stats.firstRejection = {
                        index,
                        atMs: Date.now() - startMs,
                        label,
                        message,
                    };
                    console.log(
                        `\n🚨 First rejection at intent #${index + 1} after ` +
                            `${((Date.now() - startMs) / 1000).toFixed(2)}s: ${label} — ${message}\n`
                    );
                }
            } finally {
                stats.inFlight--;
            }
        })();
        inflight.add(task);
        void task.finally(() => inflight.delete(task));
    };

    const progress = setInterval(() => {
        const elapsed = (Date.now() - startMs) / 1000;
        const rps = elapsed > 0 ? (stats.submitted / elapsed).toFixed(0) : "0";
        process.stdout.write(
            `\r⏳ submitted=${stats.submitted} accepted=${stats.accepted} ` +
                `rejected=${stats.rejected} inFlight=${stats.inFlight} ~${rps} rps   `
        );
    }, 1000);

    // Token-bucket dispatch: release up to (elapsed * RPS) submissions over time, never exceeding
    // MAX_IN_FLIGHT at once. If the backend keeps up, the average rate holds at RATE_LIMIT_RPS.
    while (stats.submitted < TOTAL_INTENTS && !stopRequested) {
        const elapsedS = (Date.now() - startMs) / 1000;
        const allowedSoFar = Math.floor(elapsedS * RATE_LIMIT_RPS);
        while (
            stats.submitted < allowedSoFar &&
            stats.submitted < TOTAL_INTENTS &&
            stats.inFlight < MAX_IN_FLIGHT
        ) {
            dispatch(stats.submitted);
        }
        if (STOP_AFTER_REJECTIONS > 0 && stats.rejected >= STOP_AFTER_REJECTIONS) {
            break;
        }
        await sleep(DISPATCH_TICK_MS);
    }

    await Promise.allSettled([...inflight]);
    clearInterval(progress);
    process.removeListener("SIGINT", onSigint);
    process.stdout.write("\n");

    return stats;
}

/** Poll the status of accepted intents to detect any later marked `Invalid` (async rejection). */
async function pollStatuses(
    client: TurbineClient,
    hashes: Hex[]
): Promise<{ tally: Record<string, number>; firstInvalid: Hex | null; found: number }> {
    const tally: Record<string, number> = {};
    let firstInvalid: Hex | null = null;
    let found = 0;

    for (let i = 0; i < hashes.length; i += STATUS_POLL_BATCH) {
        const batch = hashes.slice(i, i + STATUS_POLL_BATCH);
        const states = await client.getLiquidityIntents(batch);
        for (const state of states) {
            found++;
            tally[state.status] = (tally[state.status] ?? 0) + 1;
            if (
                state.status === LiquidityIntentStatus.Invalid &&
                firstInvalid === null
            ) {
                firstInvalid = state.hash;
            }
        }
    }

    return { tally, firstInvalid, found };
}

async function main() {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.error("❌ PRIVATE_KEY environment variable is required.");
        process.exit(1);
    }
    if (!RPC_URL) {
        console.error(
            "❌ RPC_URL environment variable is required (dev chain RPC for pool/nonce reads)."
        );
        process.exit(1);
    }

    const account = privateKeyToAccount(privateKey as Hex);
    const walletClient = createWalletClient({
        account,
        chain: mainnet,
        transport: http(RPC_URL),
    });
    const publicClient = createPublicClient({
        chain: mainnet,
        transport: http(RPC_URL),
    });

    console.log("💧 Turbine liquidity-intent queue stress tool");
    console.log(`   Account:  ${account.address}`);
    console.log(`   API:      ${TURBINE_API_URL}`);
    console.log(
        `   Config:   ${RATE_LIMIT_RPS} rps, up to ${TOTAL_INTENTS} intents, ` +
            `max ${MAX_IN_FLIGHT} in-flight` +
            (STOP_AFTER_REJECTIONS > 0
                ? `, stop after ${STOP_AFTER_REJECTIONS} rejections`
                : "")
    );

    const client = await TurbineClient.create(walletClient, publicClient);

    // Warm up the session once so the concurrent burst doesn't trigger an authentication storm.
    await client.ensureAuthenticated();

    const pools = await client.getPools();
    const pool = selectPool(pools);
    console.log(
        `   Pool:     ${pool.metadata.token0}/${pool.metadata.token1} fee=${pool.metadata.fee} ` +
            `(lpToken ${pool.metadata.lpToken})\n`
    );

    const buildIntent = makeIntentBuilder(account.address, pool);

    const stats = await runStressTest(client, buildIntent);

    console.log("\n================ Submission summary ================");
    console.log(`Submitted:  ${stats.submitted}`);
    console.log(`Accepted:   ${stats.accepted}`);
    console.log(`Rejected:   ${stats.rejected}`);
    if (stats.firstRejection) {
        console.log(
            `First rejection: intent #${stats.firstRejection.index + 1} at ` +
                `${(stats.firstRejection.atMs / 1000).toFixed(2)}s — ` +
                `${stats.firstRejection.label}`
        );
    } else {
        console.log("First rejection: none — the queue never rejected a submission.");
    }
    if (Object.keys(stats.byLabel).length > 0) {
        console.log("Rejections by reason:");
        for (const [label, count] of Object.entries(stats.byLabel).sort(
            (a, b) => b[1] - a[1]
        )) {
            console.log(`  ${count.toString().padStart(6)}  ${label}`);
        }
    }

    // Detect the async path: intents that returned 200 but were later marked Invalid.
    if (stats.acceptedHashes.length > 0) {
        console.log("\n================ Accepted-intent states ================");
        console.log(
            `Polling status of ${stats.acceptedHashes.length} accepted intent(s)...`
        );
        try {
            const { tally, firstInvalid, found } = await pollStatuses(
                client,
                stats.acceptedHashes
            );
            for (const [status, count] of Object.entries(tally).sort(
                (a, b) => b[1] - a[1]
            )) {
                console.log(`  ${count.toString().padStart(6)}  ${status}`);
            }
            const missing = stats.acceptedHashes.length - found;
            if (missing > 0) {
                console.log(
                    `  ${missing.toString().padStart(6)}  (not found in history)`
                );
            }
            const invalidCount = tally[LiquidityIntentStatus.Invalid] ?? 0;
            if (invalidCount > 0) {
                console.log(
                    `\n⚠️  ${invalidCount} accepted intent(s) were later marked Invalid ` +
                        `(async queue rejection). First: ${firstInvalid}`
                );
            } else {
                console.log(
                    "\n✅ No accepted intent was marked Invalid (no async queue rejections observed)."
                );
            }
        } catch (error) {
            const { label, message } = classifyError(error);
            console.log(`  Failed to poll intent states: ${label} — ${message}`);
        }
    }

    console.log("\nDone.");
}

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled rejection:", reason);
    process.exit(1);
});

main().catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
});
