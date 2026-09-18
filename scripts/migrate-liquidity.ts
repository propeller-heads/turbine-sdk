#!/usr/bin/env tsx

/**
 * Migrate liquidity from an old Turbine deployment to the currently deployed one.
 *
 * For every pool where the signing account holds LP tokens on the *old* TurbineHook,
 * the script:
 *   1. approves the LP token for Permit2 (if needed),
 *   2. submits an on-chain remove-liquidity intent to the old TurbineLiquidityRouter,
 *   3. waits out the router speedbump and executes the intents itself,
 *   4. creates the matching pool on the new hook if it does not exist yet,
 *   5. submits an add-liquidity intent to the Turbine API with the exact amounts
 *      that came out of the old pool.
 *
 * The old deployment does not need a running backend: removal is executed by the
 * intent owner directly. The new deployment is read from the API `/config`
 * endpoint, so it always matches what the backend is actually settling on.
 *
 * Progress is persisted to `scripts/.migration-state/` from the moment the first intent
 * is submitted, so nothing is ever stranded: re-running the same command picks the file
 * up, settles whatever is still pending on the old router (including intents that landed
 * after an earlier run gave up on them), and carries on with the deposits.
 *
 * Usage:
 *   yarn migrate-liquidity [--env staging|prod|all] [--dry-run] [--yes]
 *   yarn migrate-liquidity --env prod --old-settler 0x... --api-url https://...
 *   yarn migrate-liquidity --dry-run --address 0x...   # preview, no key needed
 *
 * Authentication: paste the private key when prompted, or set PRIVATE_KEY.
 */

import * as fs from "fs";
import * as path from "path";
import {
    Account,
    Address,
    createPublicClient,
    createWalletClient,
    formatGwei,
    formatUnits,
    getAddress,
    Hex,
    http,
    isAddress,
    maxUint256,
    PublicClient,
    WaitForTransactionReceiptTimeoutError,
    WalletClient,
    zeroAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { PERMIT2_ADDRESS } from "@uniswap/permit2-sdk";
import prompts from "prompts";
import { TurbineClient, fetchConfig, getRandomSalt } from "../src/turbineClient";
import {
    executePendingRemoveLiquidityIntentsOnchain,
    getPools,
    getUserPositions,
    submitRemoveLiquidityIntentOnchain,
} from "../src/onchain";
import { AddLiquidityIntent, TurbinePool, UserPosition } from "../src/models";
import { RPC_URL } from "../src/config";
import { turbineSettlerABI } from "../src/abi";

/** An old deployment to migrate away from, and the API that serves its replacement. */
interface MigrationEnvironment {
    name: string;
    apiUrl: string;
    /** TurbineSettler of the *previous* deployment; router and hook are read from it. */
    oldSettlerAddress: Address;
}

/**
 * Previous deployments, taken from the turbine repo configs before commit 5647c4f1
 * ("feat: Update staging and prod contracts").
 */
const ENVIRONMENTS: Record<string, MigrationEnvironment> = {
    staging: {
        name: "staging",
        apiUrl: "https://staging-api.turbine.exchange/api",
        oldSettlerAddress: getAddress("0x073D894Fb68a6450dA4Ae6019936D14ef9144479"),
    },
    prod: {
        name: "prod",
        apiUrl: "https://api.turbine.exchange/api",
        oldSettlerAddress: getAddress("0x2AADB59279619cB33D34AD1a3696E23a2EfFb394"),
    },
};

/**
 * TurbineLiquidityRouter.SPEEDBUMP_DURATION is 12s; intents are only executable once
 * they are older than that. Add a block of margin so the execution transaction does
 * not land too early and silently skip the intent.
 */
const SPEEDBUMP_WAIT_MS = 26_000;

/**
 * How long to wait for a transaction before treating it as stuck and replacing it with a
 * higher priority fee. Mainnet blocks are 12s, so this is roughly seven blocks.
 */
const TX_CONFIRMATION_TIMEOUT_MS = 90_000;
const TX_ATTEMPTS = 4;

/**
 * Lower bound for the priority fee, matching the `priority_fee` Turbine itself uses on
 * mainnet. Some RPCs report a tip estimate of 0, and a transaction offering no tip is
 * not picked up by builders.
 */
const MIN_PRIORITY_FEE_WEI = 100_000_000n; // 0.1 gwei

/** How long to wait for the backend to pick up a freshly created pool, and to settle an intent. */
const POOL_REGISTRATION_WAIT_MS = 30_000;
const SETTLEMENT_POLL_TIMEOUT_MS = 300_000;
const SETTLEMENT_POLL_INTERVAL_MS = 15_000;

const STATE_DIR = path.resolve(__dirname, ".migration-state");

const erc20ABI = [
    {
        inputs: [{ name: "", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
        ],
        name: "allowance",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        name: "approve",
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "totalSupply",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "symbol",
        outputs: [{ name: "", type: "string" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "decimals",
        outputs: [{ name: "", type: "uint8" }],
        stateMutability: "view",
        type: "function",
    },
] as const;

/** Public mapping on TurbineLiquidityRouter; a zero owner means the intent is gone. */
const removeLiquidityIntentsABI = [
    {
        inputs: [{ name: "", type: "bytes32" }],
        name: "removeLiquidityIntents",
        outputs: [
            { name: "owner", type: "address" },
            { name: "poolId", type: "bytes32" },
            { name: "lpTokenAmount", type: "uint256" },
            { name: "salt", type: "bytes32" },
        ],
        stateMutability: "view",
        type: "function",
    },
] as const;

async function main() {
    const options = parseArgs();
    const environments = await selectEnvironments(options);
    const signer = options.previewAddress ? undefined : await promptAccount();
    const owner = signer ? signer.address : options.previewAddress!;

    console.log(`\n👤 Account: ${owner}`);

    for (const environment of environments) {
        await migrateEnvironment(environment, signer, owner, options);
    }

    console.log("\n🏁 Done.");
}

interface Options {
    envArg?: string;
    dryRun: boolean;
    skipConfirmation: boolean;
    oldSettlerOverride?: Address;
    apiUrlOverride?: string;
    /** Dry-run only: plan for this address without asking for its private key. */
    previewAddress?: Address;
}

function parseArgs(): Options {
    const args = process.argv.slice(2);
    const options: Options = { dryRun: false, skipConfirmation: false };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case "--dry-run":
                options.dryRun = true;
                break;
            case "-y":
            case "--yes":
                options.skipConfirmation = true;
                break;
            case "--env":
                options.envArg = args[++i];
                break;
            case "--old-settler":
                options.oldSettlerOverride = requireAddress(args[++i], "--old-settler");
                break;
            case "--api-url":
                options.apiUrlOverride = args[++i];
                break;
            case "--address":
                options.previewAddress = requireAddress(args[++i], "--address");
                break;
            default:
                console.error(`Unknown argument: ${arg}`);
                console.error(
                    "Usage: yarn migrate-liquidity [--env staging|prod|all] [--dry-run] [--yes] " +
                        "[--old-settler 0x...] [--api-url https://...] [--address 0x...]"
                );
                process.exit(1);
        }
    }

    if ((options.oldSettlerOverride || options.apiUrlOverride) && !options.envArg) {
        console.error(
            "--old-settler and --api-url require --env staging or --env prod."
        );
        process.exit(1);
    }
    if (options.previewAddress && !options.dryRun) {
        console.error("--address only makes sense together with --dry-run.");
        process.exit(1);
    }
    return options;
}

function requireAddress(value: string | undefined, flag: string): Address {
    if (!value || !isAddress(value)) {
        console.error(`${flag} needs a valid Ethereum address, got: ${value}`);
        process.exit(1);
    }
    return getAddress(value);
}

async function selectEnvironments(options: Options): Promise<MigrationEnvironment[]> {
    let selected = options.envArg;

    if (!selected) {
        const response = await prompts({
            type: "select",
            name: "env",
            message: "Which deployment do you want to migrate?",
            choices: [
                { title: "staging", value: "staging" },
                { title: "prod", value: "prod" },
                { title: "both (staging first)", value: "all" },
            ],
        });
        if (!response.env) {
            console.log("\n❌ Operation cancelled");
            process.exit(1);
        }
        selected = response.env;
    }

    const names = selected === "all" ? ["staging", "prod"] : [selected!];
    return names.map((name) => {
        const environment = ENVIRONMENTS[name];
        if (!environment) {
            console.error(`Unknown environment: ${name}. Use staging, prod or all.`);
            process.exit(1);
        }
        return {
            ...environment,
            apiUrl: options.apiUrlOverride ?? environment.apiUrl,
            oldSettlerAddress:
                options.oldSettlerOverride ?? environment.oldSettlerAddress,
        };
    });
}

/**
 * Get the signing account: PRIVATE_KEY if set (for automation), otherwise a masked
 * paste prompt. Deliberately does not fall back to the keystore flow, so a single
 * paste covers every environment in one run.
 */
async function promptAccount(): Promise<Account> {
    if (process.env.PRIVATE_KEY) {
        console.log("🔑 Using PRIVATE_KEY from the environment.");
        return privateKeyToAccount(normalizePrivateKey(process.env.PRIVATE_KEY));
    }

    const response = await prompts({
        type: "password",
        name: "privateKey",
        message: "🔑 Paste the private key of the liquidity provider:",
        validate: (value: string) => {
            try {
                normalizePrivateKey(value);
                return true;
            } catch (error) {
                return error instanceof Error ? error.message : "Invalid private key";
            }
        },
    });

    if (!response.privateKey) {
        console.log("\n❌ Operation cancelled");
        process.exit(1);
    }
    return privateKeyToAccount(normalizePrivateKey(response.privateKey));
}

function normalizePrivateKey(value: string): Hex {
    const trimmed = value.trim();
    const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
    if (!/^0x[0-9a-fA-F]{64}$/.test(prefixed)) {
        throw new Error("Expected 64 hex characters, optionally prefixed with 0x");
    }
    return prefixed as Hex;
}

/**
 * What a run has achieved so far, persisted between the two halves of the migration:
 * either the intents are out on the old router, or the tokens are back in the wallet
 * and only the deposits are left.
 */
type MigrationState =
    | { stage: "removing"; intents: SubmittedIntent[] }
    | { stage: "depositing"; withdrawals: Withdrawal[] };

/** A remove-liquidity intent on the old router, with the reserves it will draw from. */
interface SubmittedIntent {
    hash: Hex;
    token0: Address;
    token1: Address;
    fee: number;
    lpToken: Address;
    reserve0Before: bigint;
    reserve1Before: bigint;
}

/** Amounts recovered from one old pool, to be re-deposited into its new counterpart. */
interface Withdrawal {
    token0: Address;
    token1: Address;
    fee: number;
    amount0: bigint;
    amount1: bigint;
}

async function migrateEnvironment(
    environment: MigrationEnvironment,
    signer: Account | undefined,
    owner: Address,
    options: Options
) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`🌀 Migrating ${environment.name}`);
    console.log(`${"=".repeat(70)}`);

    const publicClient = createPublicClient({
        chain: mainnet,
        transport: http(RPC_URL),
    }) as PublicClient;

    const oldDeployment = await resolveOldDeployment(
        publicClient,
        environment.oldSettlerAddress
    );
    const config = await fetchConfig(environment.apiUrl);

    console.log(`🌐 API: ${environment.apiUrl} (backend ${config.version})`);
    console.log(`🏚️  Old hook:   ${oldDeployment.hook}`);
    console.log(`🏚️  Old router: ${oldDeployment.router}`);
    console.log(`🏠 New hook:   ${config.lpHookAddress}`);
    console.log(`🏠 New router: ${config.lpRouterAddress}`);

    if (getAddress(oldDeployment.hook) === getAddress(config.lpHookAddress)) {
        console.error(
            "\n❌ The old settler points at the hook the API is already using. Nothing to migrate."
        );
        return;
    }

    const resumed = readState(environment, owner);
    if (resumed) {
        const account = requireSigner(signer);
        let withdrawals: Withdrawal[];

        if (resumed.stage === "removing") {
            console.log(
                `\n♻️  Resuming: ${resumed.intents.length} remove-liquidity intent(s) from an earlier run.`
            );
            withdrawals = await finishRemoval(
                publicClient,
                account,
                oldDeployment,
                resumed.intents
            );
            writeState(environment, owner, { stage: "depositing", withdrawals });
        } else {
            console.log(
                `\n♻️  Resuming: ${resumed.withdrawals.length} deposit(s) still to make.`
            );
            withdrawals = resumed.withdrawals;
        }

        const client = await createClient(publicClient, environment, account);
        await addLiquidityToNewPools(client, publicClient, account, withdrawals);
        clearState(environment, owner);
        return;
    }

    const positions = await getUserPositions(publicClient, owner, oldDeployment.hook);
    if (positions.length === 0) {
        console.log("\n✅ No LP tokens held on the old hook; nothing to migrate.");
        return;
    }

    const newPools = await getPools(publicClient, config.lpHookAddress);
    await printPlan(publicClient, owner, positions, oldDeployment, newPools);

    if (options.dryRun) {
        console.log("\n🧪 Dry run — stopping before any transaction.");
        return;
    }
    if (!options.skipConfirmation && !(await confirm(environment.name))) {
        console.log("❌ Migration cancelled by user.");
        return;
    }

    const account = requireSigner(signer);
    const withdrawals = await removeLiquidityFromOldPools(
        publicClient,
        account,
        environment,
        oldDeployment,
        positions
    );
    writeState(environment, owner, { stage: "depositing", withdrawals });

    const client = await createClient(publicClient, environment, account);
    await addLiquidityToNewPools(client, publicClient, account, withdrawals);
    clearState(environment, owner);
}

function requireSigner(signer: Account | undefined): Account {
    if (!signer) {
        throw new Error("This step needs the private key; re-run without --address.");
    }
    return signer;
}

async function createClient(
    publicClient: PublicClient,
    environment: MigrationEnvironment,
    account: Account
): Promise<TurbineClient> {
    return TurbineClient.create(
        createSigningClient(publicClient, account),
        publicClient,
        {
            turbineApiUrl: environment.apiUrl,
        }
    );
}

/**
 * A wallet client whose `writeContract` waits for the receipt itself and, if the
 * transaction does not land in time, replaces it at the same nonce with a higher
 * priority fee. Everything in this script — including the SDK helpers it calls —
 * sends through this one function, so a transaction stuck behind a fee spike never
 * blocks the migration halfway through.
 */
function createSigningClient(
    publicClient: PublicClient,
    account: Account
): WalletClient {
    const walletClient = createWalletClient({
        account,
        chain: mainnet,
        transport: http(RPC_URL),
    });
    return {
        ...walletClient,
        writeContract: (request: any) =>
            writeContractWithFeeBumps(walletClient, publicClient, request),
    } as unknown as WalletClient;
}

async function writeContractWithFeeBumps(
    walletClient: WalletClient,
    publicClient: PublicClient,
    request: any
): Promise<Hex> {
    // Pin the nonce: viem reads it with blockTag "pending", so a plain retry would
    // queue behind the stuck transaction instead of replacing it.
    const nonce = await publicClient.getTransactionCount({
        address: (walletClient.account as Account).address,
        blockTag: "pending",
    });
    // Estimate gas once and reuse it. A replacement is estimated against a pending state
    // that already contains the transaction it replaces, which under-estimates any call
    // whose first execution writes a storage slot the replaced one already set — the
    // replacement would then run out of gas.
    // The 25% headroom also keeps the router's own `gasleft()` guard happy if state
    // moves between the estimate and the block the transaction finally lands in.
    const gas =
        request.gas ?? ((await publicClient.estimateContractGas(request)) * 5n) / 4n;

    let fees = await estimateFees(publicClient);
    const sent: Hex[] = [];

    for (let attempt = 1; attempt <= TX_ATTEMPTS; attempt++) {
        if (attempt > 1) {
            fees = await estimateFees(publicClient, fees);
        }
        console.log(
            `   ⛽ ${attempt > 1 ? "replacing transaction" : "sending"}: tip ` +
                `${formatGwei(fees.maxPriorityFeePerGas)} gwei, cap ` +
                `${formatGwei(fees.maxFeePerGas)} gwei (attempt ${attempt}/${TX_ATTEMPTS})`
        );

        try {
            sent.push(
                await walletClient.writeContract({ ...request, ...fees, gas, nonce })
            );
        } catch (error) {
            // "nonce too low"/"already known": an earlier attempt made it into a block.
            const mined = await firstMinedTransaction(publicClient, sent);
            if (mined) {
                return mined;
            }
            throw error;
        }

        try {
            await publicClient.waitForTransactionReceipt({
                hash: sent[sent.length - 1],
                timeout: TX_CONFIRMATION_TIMEOUT_MS,
            });
            return sent[sent.length - 1];
        } catch (error) {
            if (!(error instanceof WaitForTransactionReceiptTimeoutError)) {
                throw error;
            }
            const mined = await firstMinedTransaction(publicClient, sent);
            if (mined) {
                return mined;
            }
        }
    }

    throw new Error(
        `Transaction did not confirm after ${TX_ATTEMPTS} attempts at nonce ${nonce}. ` +
            `Last hash: ${sent[sent.length - 1]}`
    );
}

interface Fees {
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
}

/**
 * Price a transaction, or a replacement for one that did not land.
 *
 * Do not trust the node's tip estimate on its own: some RPCs answer
 * `eth_maxPriorityFeePerGas` with 0, and a zero-tip transaction is simply never picked
 * up. Hence the floor, and hence a bump that adds the floor on top of the percentage —
 * a percentage of a near-zero tip is still near-zero, so a purely multiplicative bump
 * can never climb out of it.
 */
async function estimateFees(
    publicClient: PublicClient,
    previous?: Fees
): Promise<Fees> {
    const [block, networkTip] = await Promise.all([
        publicClient.getBlock({ blockTag: "latest" }),
        publicClient.estimateMaxPriorityFeePerGas().catch(() => 0n),
    ]);
    const baseFee = block.baseFeePerGas ?? 0n;

    let maxPriorityFeePerGas = maxBigInt(networkTip, MIN_PRIORITY_FEE_WEI);
    if (previous) {
        // A replacement has to beat the transaction it replaces by 10% on both caps.
        maxPriorityFeePerGas = maxBigInt(
            maxPriorityFeePerGas,
            (previous.maxPriorityFeePerGas * 5n) / 4n + MIN_PRIORITY_FEE_WEI
        );
    }

    // Twice the base fee absorbs roughly six blocks of base-fee growth.
    let maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;
    if (previous) {
        maxFeePerGas = maxBigInt(maxFeePerGas, (previous.maxFeePerGas * 5n) / 4n);
    }
    return { maxFeePerGas, maxPriorityFeePerGas };
}

/** Returns the hash of whichever of these transactions made it into a block, if any. */
async function firstMinedTransaction(
    publicClient: PublicClient,
    hashes: Hex[]
): Promise<Hex | undefined> {
    for (const hash of hashes) {
        try {
            await publicClient.getTransactionReceipt({ hash });
            return hash;
        } catch {
            // Not mined; try the next one.
        }
    }
    return undefined;
}

function maxBigInt(a: bigint, b: bigint): bigint {
    return a > b ? a : b;
}

interface Deployment {
    settler: Address;
    router: Address;
    hook: Address;
}

/** Read the liquidity router and hook off a settler, so only one address has to be configured. */
async function resolveOldDeployment(
    publicClient: PublicClient,
    settler: Address
): Promise<Deployment> {
    const [router, hook] = await Promise.all([
        publicClient.readContract({
            address: settler,
            abi: turbineSettlerABI,
            functionName: "getTurbineLiquidityRouter",
        }),
        publicClient.readContract({
            address: settler,
            abi: turbineSettlerABI,
            functionName: "getTurbineHook",
        }),
    ]);
    return {
        settler,
        router: getAddress(router as Address),
        hook: getAddress(hook as Address),
    };
}

async function printPlan(
    publicClient: PublicClient,
    owner: Address,
    positions: UserPosition[],
    oldDeployment: Deployment,
    newPools: TurbinePool[]
) {
    const oldPools = await getPools(publicClient, oldDeployment.hook);
    const ethBalance = await publicClient.getBalance({ address: owner });

    console.log(`\n📋 Plan (${positions.length} position(s)):\n`);

    for (const position of positions) {
        const pool = findPool(
            oldPools,
            position.poolMetadata.token0,
            position.poolMetadata.token1,
            position.poolMetadata.fee
        )!;
        const [token0, token1] = await Promise.all([
            describeToken(publicClient, pool.metadata.token0),
            describeToken(publicClient, pool.metadata.token1),
        ]);
        const { amount0, amount1 } = await estimateWithdrawal(
            publicClient,
            pool,
            position.lpTokenBalance
        );
        const targetExists = !!findPool(
            newPools,
            pool.metadata.token0,
            pool.metadata.token1,
            pool.metadata.fee
        );

        console.log(
            `  ${token0.symbol}/${token1.symbol} fee=${pool.metadata.fee} (${pool.metadata.fee / 10000}%)`
        );
        console.log(`    LP token:   ${pool.metadata.lpToken}`);
        console.log(`    LP balance: ${position.lpTokenBalance}`);
        console.log(
            `    withdraws:  ${formatUnits(amount0, token0.decimals)} ${token0.symbol} + ` +
                `${formatUnits(amount1, token1.decimals)} ${token1.symbol}`
        );
        console.log(
            `    new pool:   ${targetExists ? "exists" : "will be created on the new hook"}`
        );
        if (amount0 === 0n || amount1 === 0n) {
            console.log(
                "    ⚠️  one side is empty — the new pool will be seeded one-sided"
            );
        }
        console.log("");
    }

    console.log(`  ⛽ ETH balance: ${formatUnits(ethBalance, 18)} ETH`);
    if (ethBalance < 20_000_000_000_000_000n) {
        console.log(
            "  ⚠️  Less than 0.02 ETH — top the account up before running the migration."
        );
    }
}

async function confirm(environmentName: string): Promise<boolean> {
    const response = await prompts({
        type: "confirm",
        name: "proceed",
        message: `Remove this liquidity from the old ${environmentName} contracts and re-add it to the new ones?`,
        initial: false,
    });
    return response.proceed === true;
}

/**
 * Burn every LP position on the old hook and return the token amounts actually
 * recovered, measured as the drop in each pool's reserves.
 */
async function removeLiquidityFromOldPools(
    publicClient: PublicClient,
    account: Account,
    environment: MigrationEnvironment,
    oldDeployment: Deployment,
    positions: UserPosition[]
): Promise<Withdrawal[]> {
    const walletClient = createSigningClient(publicClient, account);

    console.log("\n🔓 Step 1/3: approving LP tokens for Permit2...");
    for (const position of positions) {
        await ensurePermit2Allowance(
            walletClient,
            publicClient,
            account,
            position.poolMetadata.lpToken,
            position.lpTokenBalance
        );
    }

    console.log("\n📤 Step 2/3: submitting remove-liquidity intents on-chain...");
    const reservesBefore = await readReserves(publicClient, oldDeployment.hook);
    const intents: SubmittedIntent[] = [];
    for (const position of positions) {
        const { txHash, intentHash } = await submitRemoveLiquidityIntentOnchain(
            walletClient,
            publicClient,
            oldDeployment.hook,
            oldDeployment.router,
            {
                owner: account.address,
                token0: position.poolMetadata.token0,
                token1: position.poolMetadata.token1,
                fee: position.poolMetadata.fee,
                lpToken: position.poolMetadata.lpToken,
                lpTokenAmount: position.lpTokenBalance,
                salt: getRandomSalt(),
            }
        );
        console.log(`   intent ${intentHash} submitted (tx ${txHash})`);

        const pool = reservesBefore.get(
            poolKey(
                position.poolMetadata.token0,
                position.poolMetadata.token1,
                position.poolMetadata.fee
            )
        )!;
        intents.push({
            hash: intentHash,
            token0: position.poolMetadata.token0,
            token1: position.poolMetadata.token1,
            fee: position.poolMetadata.fee,
            lpToken: position.poolMetadata.lpToken,
            reserve0Before: pool.state.reserve0,
            reserve1Before: pool.state.reserve1,
        });
        // Persist after every submission. A submitted intent may land minutes after this
        // script gives up on it, so the pre-execution reserves have to survive a crash —
        // they are the only way to tell afterwards how much the pool actually paid out.
        writeState(environment, account.address, { stage: "removing", intents });
    }

    // Guard against a hash mismatch: an intent the router does not know about would be
    // skipped by executePendingIntents without any error.
    const stored = await pendingIntents(
        publicClient,
        oldDeployment.router,
        intents.map((intent) => intent.hash)
    );
    if (stored.length !== intents.length) {
        throw new Error(
            "The router does not have every submitted intent stored under the hash the SDK computed. Aborting before the speedbump."
        );
    }

    console.log(
        `\n⏳ Step 3/3: waiting ${SPEEDBUMP_WAIT_MS / 1000}s for the router speedbump...`
    );
    await sleep(SPEEDBUMP_WAIT_MS);
    return finishRemoval(publicClient, account, oldDeployment, intents);
}

/**
 * Execute whatever is still pending and work out what came out of each pool. Safe to
 * call again after an interrupted run: intents that already executed are simply no
 * longer stored on the router, and the reserve drop still tells us what they paid.
 */
async function finishRemoval(
    publicClient: PublicClient,
    account: Account,
    oldDeployment: Deployment,
    intents: SubmittedIntent[]
): Promise<Withdrawal[]> {
    const walletClient = createSigningClient(publicClient, account);
    const pending = await pendingIntents(
        publicClient,
        oldDeployment.router,
        intents.map((intent) => intent.hash)
    );

    if (pending.length > 0) {
        try {
            await executeIntentsUntilCleared(
                walletClient,
                publicClient,
                oldDeployment.router,
                pending
            );
        } catch (error) {
            console.error(
                "\n⚠️  Giving up on the execution transaction — but one of the attempts may still land later. " +
                    "Re-run the same command: it picks the intents up from the saved state and settles whatever is left."
            );
            throw error;
        }
    } else {
        console.log("   every intent has already been executed on-chain");
    }

    const reservesAfter = await readReserves(publicClient, oldDeployment.hook);
    return collectWithdrawals(publicClient, account, intents, reservesAfter);
}

async function ensurePermit2Allowance(
    walletClient: WalletClient,
    publicClient: PublicClient,
    account: Account,
    token: Address,
    required: bigint
) {
    const allowance = await publicClient.readContract({
        address: token,
        abi: erc20ABI,
        functionName: "allowance",
        args: [account.address, PERMIT2_ADDRESS as Address],
    });
    if (allowance >= required) {
        console.log(`   ${token}: allowance sufficient`);
        return;
    }

    const { request } = await publicClient.simulateContract({
        address: token,
        abi: erc20ABI,
        functionName: "approve",
        args: [PERMIT2_ADDRESS as Address, maxUint256],
        account,
        chain: mainnet,
    });
    const txHash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
        throw new Error(`Permit2 approval for ${token} reverted (tx ${txHash})`);
    }
    console.log(`   ${token}: approved Permit2 (tx ${txHash})`);
}

/**
 * `executePendingIntents` silently skips intents that are still inside the speedbump,
 * so keep calling it until the router has no record of them left.
 */
async function executeIntentsUntilCleared(
    walletClient: WalletClient,
    publicClient: PublicClient,
    router: Address,
    intentHashes: Hex[]
) {
    let pending = intentHashes;

    for (let attempt = 1; attempt <= 5; attempt++) {
        console.log(`   executing ${pending.length} intent(s) (attempt ${attempt})...`);
        await executePendingRemoveLiquidityIntentsOnchain(
            walletClient,
            publicClient,
            router,
            pending
        );

        pending = await pendingIntents(publicClient, router, pending);
        if (pending.length === 0) {
            console.log("   all intents executed");
            return;
        }
        console.log(`   ${pending.length} intent(s) still pending, retrying...`);
        await sleep(SPEEDBUMP_WAIT_MS);
    }

    throw new Error(
        `Intents still pending after 5 attempts: ${pending.join(", ")}. ` +
            `Execute them manually with: yarn execute-pending-onchain-intents ${router} ${pending.join(" ")}`
    );
}

async function pendingIntents(
    publicClient: PublicClient,
    router: Address,
    intentHashes: Hex[]
): Promise<Hex[]> {
    const stored = await Promise.all(
        intentHashes.map((hash) =>
            publicClient.readContract({
                address: router,
                abi: removeLiquidityIntentsABI,
                functionName: "removeLiquidityIntents",
                args: [hash],
            })
        )
    );
    return intentHashes.filter((_, index) => stored[index][0] !== zeroAddress);
}

/**
 * Turn the reserve deltas into per-pool withdrawals. The router swallows failures
 * inside `_removeLiquidity` and deletes the intent anyway, so an executed intent
 * that moved nothing has to be caught here rather than trusted.
 */
async function collectWithdrawals(
    publicClient: PublicClient,
    account: Account,
    intents: SubmittedIntent[],
    reservesAfter: Map<string, TurbinePool>
): Promise<Withdrawal[]> {
    const withdrawals: Withdrawal[] = [];

    console.log("\n💰 Recovered from the old pools:");
    for (const intent of intents) {
        const after = reservesAfter.get(
            poolKey(intent.token0, intent.token1, intent.fee)
        )!;
        const amount0 = intent.reserve0Before - after.state.reserve0;
        const amount1 = intent.reserve1Before - after.state.reserve1;

        const lpBalance = await publicClient.readContract({
            address: intent.lpToken,
            abi: erc20ABI,
            functionName: "balanceOf",
            args: [account.address],
        });

        const [token0, token1] = await Promise.all([
            describeToken(publicClient, intent.token0),
            describeToken(publicClient, intent.token1),
        ]);
        console.log(
            `   ${token0.symbol}/${token1.symbol} fee=${intent.fee}: ` +
                `${formatUnits(amount0, token0.decimals)} ${token0.symbol} + ` +
                `${formatUnits(amount1, token1.decimals)} ${token1.symbol}`
        );

        if (amount0 <= 0n && amount1 <= 0n) {
            throw new Error(
                `Removing liquidity from ${token0.symbol}/${token1.symbol} fee=${intent.fee} ` +
                    `moved no tokens. The intent was consumed without paying out — inspect the old router before retrying.`
            );
        }
        if (lpBalance !== 0n) {
            console.log(
                `   ⚠️  ${lpBalance} LP tokens left on ${intent.lpToken}; only the burnt part is migrated.`
            );
        }

        withdrawals.push({
            token0: intent.token0,
            token1: intent.token1,
            fee: intent.fee,
            amount0,
            amount1,
        });
    }

    return withdrawals;
}

/**
 * Re-deposit the recovered amounts through the API. Pools missing on the new hook are
 * created first; the backend picks them up on the next block.
 */
async function addLiquidityToNewPools(
    turbineClient: TurbineClient,
    publicClient: PublicClient,
    account: Account,
    withdrawals: Withdrawal[]
) {
    const hook = turbineClient.config.lpHookAddress;
    let created = false;

    console.log("\n🏗️  Creating missing pools on the new hook...");
    for (const withdrawal of withdrawals) {
        const pools = await getPools(publicClient, hook);
        if (findPool(pools, withdrawal.token0, withdrawal.token1, withdrawal.fee)) {
            continue;
        }
        const txHash = await turbineClient.createPool(
            withdrawal.token0,
            withdrawal.token1,
            withdrawal.fee
        );
        console.log(
            `   created ${withdrawal.token0}/${withdrawal.token1} fee=${withdrawal.fee} (tx ${txHash})`
        );
        created = true;
    }
    if (created) {
        console.log(
            `   waiting ${POOL_REGISTRATION_WAIT_MS / 1000}s for the backend to register the new pool(s)...`
        );
        await sleep(POOL_REGISTRATION_WAIT_MS);
    } else {
        console.log("   all target pools already exist");
    }

    console.log("\n📥 Submitting add-liquidity intents...");
    for (const withdrawal of withdrawals) {
        await ensurePermit2Allowance(
            turbineClient.walletClient,
            publicClient,
            account,
            withdrawal.token0,
            withdrawal.amount0
        );
        await ensurePermit2Allowance(
            turbineClient.walletClient,
            publicClient,
            account,
            withdrawal.token1,
            withdrawal.amount1
        );

        const intentHash = await submitWithRetries(turbineClient, {
            owner: account.address,
            token0: withdrawal.token0,
            token1: withdrawal.token1,
            fee: withdrawal.fee,
            token0Amount: withdrawal.amount0,
            token1Amount: withdrawal.amount1,
            exact: true,
        });
        console.log(
            `   ${withdrawal.token0}/${withdrawal.token1} fee=${withdrawal.fee}: intent ${intentHash}`
        );
    }

    await waitForNewPositions(publicClient, account, hook, withdrawals.length);
}

/**
 * The backend refreshes its pool registry once per block, so an add-liquidity intent
 * sent right after pool creation can still be rejected. Retry a few times before failing.
 */
async function submitWithRetries(
    turbineClient: TurbineClient,
    intent: Omit<AddLiquidityIntent, "salt">
): Promise<string> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            return await turbineClient.addLiquidity({
                ...intent,
                salt: getRandomSalt(),
            });
        } catch (error) {
            lastError = error;
            console.log(
                `   attempt ${attempt} failed: ${error instanceof Error ? error.message : error}`
            );
            if (attempt < 5) {
                await sleep(SETTLEMENT_POLL_INTERVAL_MS);
            }
        }
    }
    throw lastError;
}

async function waitForNewPositions(
    publicClient: PublicClient,
    account: Account,
    hook: Address,
    expected: number
) {
    console.log("\n⏳ Waiting for the settlement system to execute the deposits...");
    const deadline = Date.now() + SETTLEMENT_POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
        const positions = await getUserPositions(publicClient, account.address, hook);
        if (positions.length >= expected) {
            console.log(`\n✅ ${positions.length} position(s) live on the new hook:`);
            for (const position of positions) {
                const [token0, token1] = await Promise.all([
                    describeToken(publicClient, position.poolMetadata.token0),
                    describeToken(publicClient, position.poolMetadata.token1),
                ]);
                console.log(
                    `   ${token0.symbol}/${token1.symbol} fee=${position.poolMetadata.fee}: ` +
                        `${position.lpTokenBalance} LP`
                );
            }
            return;
        }
        await sleep(SETTLEMENT_POLL_INTERVAL_MS);
    }

    console.log(
        "\n⚠️  The deposits were accepted but have not settled yet. Check with `yarn list-pools` in a few minutes."
    );
}

function stateFile(environment: MigrationEnvironment, owner: Address): string {
    return path.join(STATE_DIR, `${environment.name}-${owner.toLowerCase()}.json`);
}

function readState(
    environment: MigrationEnvironment,
    owner: Address
): MigrationState | undefined {
    const file = stateFile(environment, owner);
    if (!fs.existsSync(file)) {
        return undefined;
    }
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (raw.stage === "removing") {
        return {
            stage: "removing",
            intents: raw.intents.map((intent: any) => ({
                hash: intent.hash,
                token0: getAddress(intent.token0),
                token1: getAddress(intent.token1),
                fee: intent.fee,
                lpToken: getAddress(intent.lpToken),
                reserve0Before: BigInt(intent.reserve0Before),
                reserve1Before: BigInt(intent.reserve1Before),
            })),
        };
    }
    return {
        stage: "depositing",
        withdrawals: raw.withdrawals.map((withdrawal: any) => ({
            token0: getAddress(withdrawal.token0),
            token1: getAddress(withdrawal.token1),
            fee: withdrawal.fee,
            amount0: BigInt(withdrawal.amount0),
            amount1: BigInt(withdrawal.amount1),
        })),
    };
}

function writeState(
    environment: MigrationEnvironment,
    owner: Address,
    state: MigrationState
) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    const file = stateFile(environment, owner);
    fs.writeFileSync(
        file,
        JSON.stringify(state, (_, value) =>
            typeof value === "bigint" ? value.toString() : value
        )
    );
    console.log(`\n💾 Progress saved to ${file}`);
}

function clearState(environment: MigrationEnvironment, owner: Address) {
    const file = stateFile(environment, owner);
    if (fs.existsSync(file)) {
        fs.unlinkSync(file);
    }
}

async function readReserves(
    publicClient: PublicClient,
    hook: Address
): Promise<Map<string, TurbinePool>> {
    const pools = await getPools(publicClient, hook);
    return new Map(
        pools.map((pool) => [
            poolKey(pool.metadata.token0, pool.metadata.token1, pool.metadata.fee),
            pool,
        ])
    );
}

async function estimateWithdrawal(
    publicClient: PublicClient,
    pool: TurbinePool,
    lpTokenAmount: bigint
): Promise<{ amount0: bigint; amount1: bigint }> {
    const totalSupply = await publicClient.readContract({
        address: pool.metadata.lpToken,
        abi: erc20ABI,
        functionName: "totalSupply",
    });
    if (totalSupply === 0n) {
        return { amount0: 0n, amount1: 0n };
    }
    return {
        amount0: (pool.state.reserve0 * lpTokenAmount) / totalSupply,
        amount1: (pool.state.reserve1 * lpTokenAmount) / totalSupply,
    };
}

function findPool(
    pools: TurbinePool[],
    token0: Address,
    token1: Address,
    fee: number
): TurbinePool | undefined {
    const key = poolKey(token0, token1, fee);
    return pools.find(
        (pool) =>
            poolKey(pool.metadata.token0, pool.metadata.token1, pool.metadata.fee) ===
            key
    );
}

function poolKey(token0: Address, token1: Address, fee: number): string {
    return `${token0.toLowerCase()}-${token1.toLowerCase()}-${fee}`;
}

const tokenCache = new Map<string, { symbol: string; decimals: number }>();

async function describeToken(
    publicClient: PublicClient,
    token: Address
): Promise<{ symbol: string; decimals: number }> {
    const cached = tokenCache.get(token.toLowerCase());
    if (cached) {
        return cached;
    }
    const [symbol, decimals] = await Promise.all([
        publicClient.readContract({
            address: token,
            abi: erc20ABI,
            functionName: "symbol",
        }),
        publicClient.readContract({
            address: token,
            abi: erc20ABI,
            functionName: "decimals",
        }),
    ]);
    const described = { symbol: symbol as string, decimals: Number(decimals) };
    tokenCache.set(token.toLowerCase(), described);
    return described;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
});

main().catch((error) => {
    console.error("\n❌ Migration failed:");
    console.error(error);
    process.exit(1);
});
