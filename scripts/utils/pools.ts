import { Address, PublicClient } from "viem";
import prompts from "prompts";
import { fetchConfig } from "../../src/turbineClient";
import { getPools } from "../../src/onchain";
import { TURBINE_API_URL } from "../../src/config";
import { ADDR2TOKEN } from "../../src/constants";
import { TurbinePool, Token } from "../../src/models";

/**
 * Resolve a token address to a human-readable display string.
 * Returns the token symbol if known, otherwise the raw address.
 */
export function getTokenDisplay(address: Address): string {
    const token = ADDR2TOKEN.get(address);
    return token ? token.symbol : address;
}

/**
 * Look up Token objects for a pool's token0 and token1.
 * Returns undefined for tokens not found in ADDR2TOKEN.
 */
export function getPoolTokens(pool: TurbinePool): {
    token0: Token;
    token1: Token;
} {
    const token0 = ADDR2TOKEN.get(pool.metadata.token0);
    const token1 = ADDR2TOKEN.get(pool.metadata.token1);
    if (!token0 || !token1) {
        throw new Error(
            `Token not found for address: ${pool.metadata.token0} or ${pool.metadata.token1}. Check ADDR2TOKEN map in constants.ts.`
        );
    }
    return {
        token0: token0!,
        token1: token1!,
    };
}

/**
 * Format a one-line label for a pool (e.g. "USDC / WETH 0.3%").
 */
export function formatPoolLabel(pool: TurbinePool): string {
    const t0 = getTokenDisplay(pool.metadata.token0);
    const t1 = getTokenDisplay(pool.metadata.token1);
    const feePercent = pool.metadata.fee / 10000;
    return `${t0} / ${t1} ${feePercent}%`;
}

/**
 * Print detailed information about a pool to the console.
 */
export function printPoolDetails(pool: TurbinePool, index?: number): void {
    const header = index !== undefined ? `Pool #${index}:` : "Pool:";
    console.log(header);
    console.log(`  Token0: ${getTokenDisplay(pool.metadata.token0)}`);
    console.log(`  Token1: ${getTokenDisplay(pool.metadata.token1)}`);
    console.log(`  Fee: ${pool.metadata.fee / 10000}% (raw: ${pool.metadata.fee})`);
    console.log(`  LP Token: ${pool.metadata.lpToken}`);
    console.log(`  Reserve0: ${pool.state.reserve0.toString()}`);
    console.log(`  Reserve1: ${pool.state.reserve1.toString()}`);
    console.log(`  Liquidity: ${pool.state.liquidity.toString()}`);
    console.log("");
}

/**
 * Fetch all registered pools from on-chain via the Turbine Hook contract.
 */
export async function fetchPools(publicClient: PublicClient): Promise<TurbinePool[]> {
    const config = await fetchConfig(TURBINE_API_URL);
    return getPools(publicClient, config.lpHookAddress);
}

/**
 * Interactively prompt the user to select a pool from the list.
 * Fetches pools, displays them, and returns the selected pool.
 *
 * Exits the process if no pools are found or the user cancels.
 */
export async function selectPool(publicClient: PublicClient): Promise<TurbinePool> {
    console.log("🔍 Fetching registered pools...\n");
    const pools = await fetchPools(publicClient);

    if (pools.length === 0) {
        console.error("No registered pools found.");
        process.exit(1);
    }

    const choices = pools.map((pool, index) => ({
        title: `${formatPoolLabel(pool)}  (LP: ${pool.metadata.lpToken})`,
        value: index,
    }));

    const response = await prompts({
        type: "select",
        name: "poolIndex",
        message: "Select a pool:",
        choices,
    });

    // Handle Ctrl+C
    if (response.poolIndex === undefined) {
        console.log("\n❌ Operation cancelled");
        process.exit(1);
    }

    return pools[response.poolIndex];
}
