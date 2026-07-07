/**
 * Functions for interacting with Turbine smart contracts directly -
 * - without using Turbine API.
 */

import {
    Address,
    BaseError,
    ContractFunctionRevertedError,
    encodeAbiParameters,
    getAddress,
    Hex,
    keccak256,
    PublicClient,
    WalletClient,
} from "viem";
import {
    PoolKey,
    RemoveLiquidityIntent,
    RemoveLiquidityIntentOnchain,
    SignedSignatureTransferOnchain,
    TurbinePool,
    UserPosition,
} from "./models";
import {
    balanceOfABI,
    poolManagerABI,
    turbineHookABI,
    turbineLiquidityRouterABI,
} from "./abi";
import * as validate from "./validation";
import { getSignedSignatureTransfer } from "./permit2SignatureTransfer";
import { toTurbineError, TurbineError } from "./errorHandling";
import { SQRT_PRICE_IDENTITY } from "./constants";

/**
 * Build a Uniswap V4 PoolKey for a Turbine pool. Tokens are ordered so the
 * lower address is `currency0`, matching the on-chain convention.
 */
export function createPoolKey(
    hookAddress: Address,
    token0: Address,
    token1: Address,
    fee: number
): PoolKey {
    const [currency0, currency1] =
        token0 < token1 ? [token0, token1] : [token1, token0];
    return {
        currency0,
        currency1,
        fee,
        tickSpacing: 1,
        hooks: hookAddress,
    };
}

/**
 * Get the MINIMUM_LIQUIDITY constant from the TurbineHook contract.
 * This is the amount of LP tokens burned to address(0) on the first pool mint.
 * @param publicClient The public client used for blockchain interactions
 * @param hookAddress The address of the Turbine Hook contract
 * @returns A Promise that resolves to the minimum liquidity value
 */
export async function getMinimumLiquidity(
    publicClient: PublicClient,
    hookAddress: Address
): Promise<bigint> {
    const minimumLiquidity = await publicClient.readContract({
        address: hookAddress,
        abi: turbineHookABI,
        functionName: "MINIMUM_LIQUIDITY",
    });
    return minimumLiquidity as bigint;
}

/**
 * Get the INITIAL_LP_SCALE constant from the TurbineHook contract.
 * This is the scaling factor used for initial LP token calculation.
 * @param publicClient The public client used for blockchain interactions
 * @param hookAddress The address of the Turbine Hook contract
 * @returns A Promise that resolves to the initial LP scale value
 */
export async function getInitialLpScale(
    publicClient: PublicClient,
    hookAddress: Address
): Promise<bigint> {
    const initialLpScale = await publicClient.readContract({
        address: hookAddress,
        abi: turbineHookABI,
        functionName: "INITIAL_LP_SCALE",
    });
    return initialLpScale as bigint;
}

/**
 * Get both liquidity constants from the TurbineHook contract.
 * @param publicClient The public client used for blockchain interactions
 * @param hookAddress The address of the Turbine Hook contract
 * @returns A Promise that resolves to an object with minimumLiquidity and initialLpScale
 */
export async function getLiquidityConstants(
    publicClient: PublicClient,
    hookAddress: Address
): Promise<{ minimumLiquidity: bigint; initialLpScale: bigint }> {
    const [minimumLiquidity, initialLpScale] = await Promise.all([
        getMinimumLiquidity(publicClient, hookAddress),
        getInitialLpScale(publicClient, hookAddress),
    ]);
    return { minimumLiquidity, initialLpScale };
}

/**
 * Get the pool ID for a given token pair and fee.
 * Calls the computePoolId view function from the TurbineHook contract.
 * @param walletClient The wallet client (used as the simulation account)
 * @param publicClient The public client for reading blockchain data
 * @param hookAddress The address of the Turbine Hook contract
 * @param token0 The first token address
 * @param token1 The second token address
 * @param fee The pool fee in hundredths of basis point
 * @returns A Promise that resolves to the pool ID as a Hex string
 */
export async function getPoolId(
    walletClient: WalletClient,
    publicClient: PublicClient,
    hookAddress: Address,
    token0: Address,
    token1: Address,
    fee: number
): Promise<Hex> {
    // Call computePoolId view function from TurbineHook contract
    const { request } = await publicClient.simulateContract({
        address: hookAddress,
        abi: turbineHookABI,
        functionName: "computePoolId",
        args: [token0, token1, fee],
        account: walletClient.account!,
        chain: publicClient.chain!,
    });
    const poolId = await publicClient.readContract(request);

    validate.validateHash(poolId, "poolId");

    return poolId as Hex;
}

/**
 * Compute the hash of a remove liquidity intent.
 * This matches the hash computation in the TurbineLiquidityRouter contract:
 * keccak256(abi.encode(intent))
 * @param intent The onchain remove liquidity intent
 * @returns The intent hash as a Hex string
 */
export function computeRemoveLiquidityIntentHash(
    intent: RemoveLiquidityIntentOnchain
): Hex {
    validate.validateRemoveLiquidityIntentOnchain(intent);

    const encoded = encodeAbiParameters(
        [
            { name: "owner", type: "address" },
            { name: "poolId", type: "bytes32" },
            { name: "lpTokenAmount", type: "uint256" },
            { name: "salt", type: "bytes32" },
        ],
        [intent.owner, intent.poolId, intent.lpTokenAmount, intent.salt]
    );
    return keccak256(encoded);
}

/**
 * Create remove liquidity data for onchain submission.
 * Computes the pool ID and creates the onchain intent format with Permit2 signature.
 * @param walletClient The wallet client for signing the permit
 * @param publicClient The public client for reading blockchain data
 * @param hookAddress The address of the Turbine Hook contract
 * @param routerAddress The address of the TurbineLiquidityRouter contract (permit spender)
 * @param intent The liquidity removal intent
 * @returns A Promise that resolves to an object containing the onchain intent and signed permit
 */
export async function createRemoveLiquidityDataOnchain(
    walletClient: WalletClient,
    publicClient: PublicClient,
    hookAddress: Address,
    routerAddress: Address,
    intent: RemoveLiquidityIntent
): Promise<{
    intent: RemoveLiquidityIntentOnchain;
    permit: SignedSignatureTransferOnchain;
}> {
    const poolId = await getPoolId(
        walletClient,
        publicClient,
        hookAddress,
        intent.token0,
        intent.token1,
        intent.fee
    );
    const removeLiquidityIntentOnchain: RemoveLiquidityIntentOnchain = {
        owner: intent.owner,
        poolId: poolId,
        lpTokenAmount: intent.lpTokenAmount,
        salt: intent.salt,
    };
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 2.5); // 2.5 hours from now
    const { permit, permitSignature } = await getSignedSignatureTransfer({
        token: intent.lpToken,
        amount: intent.lpTokenAmount,
        walletClient,
        publicClient,
        deadline,
        spender: routerAddress,
    });
    return {
        intent: removeLiquidityIntentOnchain,
        permit: {
            signature: permitSignature,
            permit: permit,
        },
    };
}

/**
 * Submit a remove liquidity intent directly to the TurbineLiquidityRouter contract on-chain.
 * Simulates the contract call, writes the transaction, and waits for confirmation.
 * @param walletClient The wallet client for signing the transaction
 * @param publicClient The public client for reading blockchain data
 * @param routerAddress The address of the TurbineLiquidityRouter contract
 * @param intent The onchain remove liquidity intent containing owner, poolId, lpTokenAmount, and salt
 * @param permit The signed Permit2 permit allowing the router to spend LP tokens
 * @returns A Promise that resolves to the transaction hash
 * @throws {TurbineError} If the transaction fails or is reverted
 */
export async function submitRemoveLiquidityTransaction(
    walletClient: WalletClient,
    publicClient: PublicClient,
    routerAddress: Address,
    intent: RemoveLiquidityIntentOnchain,
    permit: SignedSignatureTransferOnchain
): Promise<string> {
    validate.validateRemoveLiquidityIntentOnchain(intent);
    validate.validateSignedSignatureTransferOnchain(permit);

    const { request } = await publicClient.simulateContract({
        address: routerAddress,
        abi: turbineLiquidityRouterABI,
        functionName: "submitRemoveLiquidityIntent",
        args: [
            {
                owner: intent.owner,
                poolId: intent.poolId,
                lpTokenAmount: intent.lpTokenAmount,
                salt: intent.salt,
            },
            {
                signature: permit.signature,
                permit: {
                    permitted: {
                        token: permit.permit.permitted.token,
                        amount: permit.permit.permitted.amount,
                    },
                    nonce: permit.permit.nonce,
                    deadline: permit.permit.deadline,
                },
            },
        ],
        account: walletClient.account!,
        chain: publicClient.chain!,
    });
    const txHash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
    });
    if (receipt.status !== "success") {
        throw new TurbineError(
            "REMOVE_LIQUIDITY_INTENT_ONCHAIN_FAILED",
            "The remove liquidity intent onchain transaction was reverted. Please try again.",
            receipt
        );
    }

    return txHash;
}

/**
 * Submit a liquidity removal intent directly on-chain.
 * Creates the onchain intent data and permit, then submits it to the TurbineLiquidityRouter contract.
 * @param walletClient The wallet client for signing the transaction and permit
 * @param publicClient The public client for reading blockchain data
 * @param hookAddress The address of the Turbine Hook contract
 * @param routerAddress The address of the TurbineLiquidityRouter contract
 * @param intent The intent to remove liquidity
 * @returns A Promise that resolves to the transaction hash and intent hash of the submitted intent
 */
export async function submitRemoveLiquidityIntentOnchain(
    walletClient: WalletClient,
    publicClient: PublicClient,
    hookAddress: Address,
    routerAddress: Address,
    intent: RemoveLiquidityIntent
): Promise<{ txHash: string; intentHash: Hex }> {
    validate.validateRemoveLiquidityIntent(intent);

    try {
        const data = await createRemoveLiquidityDataOnchain(
            walletClient,
            publicClient,
            hookAddress,
            routerAddress,
            intent
        );
        const txHash = await submitRemoveLiquidityTransaction(
            walletClient,
            publicClient,
            routerAddress,
            data.intent,
            data.permit
        );

        // Compute the intent hash (matches keccak256(abi.encode(intent)) in the contract)
        const intentHash = computeRemoveLiquidityIntentHash({
            owner: intent.owner,
            poolId: data.intent.poolId,
            lpTokenAmount: intent.lpTokenAmount,
            salt: intent.salt,
        });

        validate.validateHash(txHash, "txHash");
        validate.validateHash(intentHash, "intentHash");

        return { txHash, intentHash };
    } catch (error) {
        throw toTurbineError(error);
    }
}

/**
 * Execute pending remove liquidity intents on-chain.
 * Calls executePendingIntents on the TurbineLiquidityRouter contract.
 * @param walletClient The wallet client for signing the transaction
 * @param publicClient The public client for reading blockchain data
 * @param routerAddress The address of the TurbineLiquidityRouter contract
 * @param hashes An array of intent hashes to execute
 * @returns A Promise that resolves when the transaction is confirmed
 * @throws {TurbineError} If the transaction fails or is reverted
 */
export async function executePendingRemoveLiquidityIntentsOnchain(
    walletClient: WalletClient,
    publicClient: PublicClient,
    routerAddress: Address,
    hashes: Hex[]
): Promise<void> {
    const orderHashes = validate.validateNonEmptyArray(
        hashes,
        "executePendingRemoveLiquidityIntentsOnchain hashes",
        (hash, index) => validate.validateHash(hash, `hashes[${index}]`)
    );

    const { request } = await publicClient.simulateContract({
        address: routerAddress,
        abi: turbineLiquidityRouterABI,
        functionName: "executePendingIntents",
        args: [orderHashes],
        account: walletClient.account!,
        chain: publicClient.chain!,
    });
    const txHash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
    });
    if (receipt.status !== "success") {
        throw new TurbineError(
            "EXECUTE_PENDING_REMOVE_LIQUIDITY_INTENTS_FAILED",
            "The execute pending remove liquidity intents transaction was reverted. Please try again.",
            receipt
        );
    }
}

/**
 * Flush expired remove liquidity intents from the TurbineLiquidityRouter contract.
 * @param walletClient The wallet client for signing the transaction
 * @param publicClient The public client for reading blockchain data
 * @param routerAddress The address of the TurbineLiquidityRouter contract
 * @returns A Promise that resolves when the transaction is confirmed
 * @throws {TurbineError} If the transaction fails or is reverted
 */
export async function flushExpiredRemoveLiquidityIntentsOnchain(
    walletClient: WalletClient,
    publicClient: PublicClient,
    routerAddress: Address
): Promise<void> {
    const { request } = await publicClient.simulateContract({
        address: routerAddress,
        abi: turbineLiquidityRouterABI,
        functionName: "flushExpiredIntents",
        args: [],
        account: walletClient.account!,
        chain: publicClient.chain!,
    });
    const txHash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
    });
    if (receipt.status !== "success") {
        throw new TurbineError(
            "FLUSH_EXPIRED_REMOVE_LIQUIDITY_INTENTS_FAILED",
            "The flush expired remove liquidity intents transaction was reverted. Please try again.",
            receipt
        );
    }
}

/**
 * Create a new liquidity pool on-chain.
 * Initializes a new pool with the specified token pair and fee using the PoolManager contract.
 * @param walletClient The wallet client for signing the transaction
 * @param publicClient The public client for reading blockchain data
 * @param hookAddress The address of the Turbine Hook contract
 * @param poolManagerAddress The address of the Uniswap V4 PoolManager contract
 * @param token0 The first token address
 * @param token1 The second token address
 * @param fee The pool fee in hundredths of basis point
 * @returns A Promise that resolves to the transaction hash of the pool creation
 * @throws {TurbineError} If the pool already exists or the transaction fails
 */
export async function createPool(
    walletClient: WalletClient,
    publicClient: PublicClient,
    hookAddress: Address,
    poolManagerAddress: Address,
    token0: Address,
    token1: Address,
    fee: number
): Promise<string> {
    const validatedToken0 = validate.validateAddress(token0, "token0");
    const validatedToken1 = validate.validateAddress(token1, "token1");
    const validatedFee = validate.validateFee(fee, "fee");

    validate.validateTokenPair(validatedToken0, validatedToken1);

    try {
        const poolKey = createPoolKey(
            hookAddress,
            validatedToken0,
            validatedToken1,
            validatedFee
        );

        const { request } = await publicClient.simulateContract({
            address: poolManagerAddress,
            abi: poolManagerABI,
            functionName: "initialize",
            args: [
                {
                    currency0: poolKey.currency0,
                    currency1: poolKey.currency1,
                    fee: poolKey.fee,
                    tickSpacing: poolKey.tickSpacing,
                    hooks: poolKey.hooks,
                },
                SQRT_PRICE_IDENTITY,
            ],
            account: walletClient.account!,
            chain: publicClient.chain!,
        });

        const txHash = await walletClient.writeContract(request);

        const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
        });
        if (receipt.status !== "success") {
            throw new TurbineError(
                "POOL_CREATION_FAILED",
                "The pool creation transaction failed. Please try again.",
                receipt
            );
        }

        return validate.validateHash(txHash, "txHash");
    } catch (err) {
        if (err instanceof BaseError) {
            const revertError = err.walk(
                (err) => err instanceof ContractFunctionRevertedError
            );
            // 0xb3e8301e is the selector of PoolAlreadyRegistered error from Hook contract.
            // PoolManager returns it wrapped in WrappedError, which itself has a different selector.
            if (
                revertError instanceof ContractFunctionRevertedError &&
                revertError.raw?.includes("b3e8301e")
            ) {
                throw new TurbineError(
                    "POOL_ALREADY_INITIALIZED",
                    "The pool is already initialized. Please try creating a different pool.",
                    revertError
                );
            }
        }
        throw toTurbineError(err);
    }
} /**
 * Get the registered pools from the Turbine Hook contract. Returns every
 * registered pool without filtering — callers that need to restrict the
 * result to a token allowlist (e.g. `TurbineClient.getPools`) should apply
 * the filter themselves.
 * @param publicClient The public client used for blockchain interactions
 * @param hookAddress The address of the Turbine Hook contract
 * @returns A Promise that resolves to an array of `TurbinePool` objects.
 */

export async function getPools(
    publicClient: PublicClient,
    hookAddress: Address
): Promise<TurbinePool[]> {
    try {
        const numberOfPools = await publicClient.readContract({
            address: hookAddress,
            abi: turbineHookABI,
            functionName: "getNumberOfRegisteredPools",
        });

        validate.validateBigInt(numberOfPools, "numberOfPools");

        // Fetch pools in batches of up to 1000 at a time
        const BATCH_SIZE = 1000n;
        const poolsData: any[] = [];
        for (let start = 0n; start < numberOfPools; start += BATCH_SIZE) {
            const end =
                start + BATCH_SIZE > numberOfPools ? numberOfPools : start + BATCH_SIZE;
            const batch = await publicClient.readContract({
                address: hookAddress,
                abi: turbineHookABI,
                functionName: "getRegisteredPoolsSlice",
                args: [start, end],
            });
            poolsData.push(...batch);
        }

        // Validate each pool data before mapping
        poolsData.forEach((poolData, index) => {
            validate.validatePoolData(poolData, index);
        });

        return poolsData.map(
            (poolData: any) =>
                ({
                    metadata: {
                        token0: getAddress(poolData.token0),
                        token1: getAddress(poolData.token1),
                        fee: poolData.fee,
                        lpToken: getAddress(poolData.lpToken),
                    },
                    state: {
                        reserve0: BigInt(poolData.reserve0),
                        reserve1: BigInt(poolData.reserve1),
                        liquidity: BigInt(poolData.liquidity),
                    },
                    stats: {
                        // Note: Weekly volume data is not available from the contract
                        // Setting to 0 for now - this could be fetched from a subgraph. See TRB-464 https://propeller-heads.atlassian.net/browse/TRB-464
                        weeklySellVolumeToken0: 0n,
                        weeklySellVolumeToken1: 0n,
                    },
                }) as TurbinePool
        );
    } catch (error) {
        throw toTurbineError(error);
    }
}
/**
 * Get user positions for all registered pools.
 * @param userAddress The address of the user to get positions for
 * @param publicClient The public client used for blockchain interactions
 * @param hookAddress The address of the Turbine Hook contract
 * @returns A Promise that resolves to an array of `UserPosition` objects.
 */

export async function getUserPositions(
    publicClient: PublicClient,
    userAddress: Address,
    hookAddress: Address
): Promise<UserPosition[]> {
    try {
        const pools = await getPools(publicClient, hookAddress);
        if (pools.length === 0) {
            return [];
        }

        // Execute all balance checks in a single multicall
        const multicallContracts = pools.map((pool) => ({
            address: pool.metadata.lpToken,
            abi: balanceOfABI,
            functionName: "balanceOf" as const,
            args: [userAddress],
        }));
        const balanceResults = await publicClient.multicall({
            contracts: multicallContracts,
        });

        // Process results and create user positions
        const userPositions: UserPosition[] = [];
        for (let i = 0; i < pools.length; i++) {
            const pool = pools[i];
            const balanceResult = balanceResults[i];

            // Validate balance result structure
            try {
                validate.validateBalanceResult(balanceResult, `balanceResults[${i}]`);
            } catch (error) {
                // Log warning for invalid balance result but continue processing
                console.warn(
                    `Invalid balance result for LP token ${pool.metadata.lpToken}: ${error instanceof Error ? error.message : "Unknown error"}`
                );
                continue;
            }

            if (balanceResult.status === "success" && balanceResult.result > 0n) {
                userPositions.push({
                    poolMetadata: pool.metadata,
                    userAddress: getAddress(userAddress),
                    lpTokenBalance: balanceResult.result as bigint,
                });
            } else if (balanceResult.status === "failure") {
                // Log warning for failed balance check but continue processing other pools
                console.warn(
                    `Failed to get balance for LP token ${pool.metadata.lpToken}: ${balanceResult.error?.message || "Unknown error"}`
                );
            }
        }

        return userPositions;
    } catch (error) {
        throw toTurbineError(error);
    }
}
