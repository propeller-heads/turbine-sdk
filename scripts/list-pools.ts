#!/usr/bin/env ts-node

import { Address, createPublicClient, getAddress, http, isAddress } from "viem";
import { mainnet } from "viem/chains";
import { turbineSettlerABI } from "../src/abi";
import { RPC_URL, TURBINE_API_URL } from "../src/config";
import { TurbineError } from "../src/errorHandling";
import { getPools } from "../src/onchain";
import { fetchPools, printPoolDetails } from "./utils/pools";

const API_URLS: Record<string, string> = {
    dev: "https://dev-api.turbine.exchange/api",
    staging: "https://staging-api.turbine.exchange/api",
    prod: "https://api.turbine.exchange/api",
};

const USAGE = `Usage: yarn list-pools [--env dev|staging|prod | --hook <address> | --settler <address>]

Lists all registered pools with their token pairs, fees, LP token addresses and reserves.

Options:
  --env <name>      Read the hook address from the Turbine API of this environment.
                    Without it, TURBINE_API_URL is used, or the production API if unset.
  --hook <address>  Read pools from this hook contract. The Turbine API is not called,
                    so this works when the API is unreachable.
  --settler <address>
                    Read the hook address from this settler contract, then read pools
                    from that hook. The Turbine API is not called.
  -h, --help        Show this help.

Only one of --env, --hook and --settler can be given.

Environment:
  RPC_URL           Mainnet RPC used to read the pools.`;

function printUsageIfRequested(): void {
    const args = process.argv.slice(2);
    if (args.includes("--help") || args.includes("-h")) {
        console.log(USAGE);
        process.exit(0);
    }
}

function checkExclusiveFlags(): void {
    const args = process.argv.slice(2);
    const given = ["--env", "--hook", "--settler"].filter((flag) =>
        args.includes(flag)
    );
    if (given.length > 1) {
        console.error(`Use only one of ${given.join(", ")}.`);
        process.exit(1);
    }
}

/**
 * Read the address given with `flag`. Returns undefined if the flag is absent.
 */
function parseAddressFlag(flag: string): Address | undefined {
    const args = process.argv.slice(2);
    const index = args.indexOf(flag);

    if (index === -1) {
        return undefined;
    }

    const address = args[index + 1];
    if (!address || !isAddress(address)) {
        console.error(`Invalid ${flag} address: ${address ?? "(missing)"}.`);
        process.exit(1);
    }
    return getAddress(address);
}

/**
 * Resolve which Turbine API to read the hook address from. Without `--env` this
 * keeps the usual behaviour: `TURBINE_API_URL`, or the production API.
 */
function parseApiUrl(): string {
    const args = process.argv.slice(2);
    const index = args.indexOf("--env");

    if (index === -1) {
        return TURBINE_API_URL;
    }

    const name = args[index + 1];
    const apiUrl = name ? API_URLS[name] : undefined;
    if (!apiUrl) {
        console.error(
            `Unknown environment: ${name ?? "(missing)"}. ` +
                `Use one of: ${Object.keys(API_URLS).join(", ")}.`
        );
        process.exit(1);
    }
    return apiUrl;
}

async function main() {
    printUsageIfRequested();
    checkExclusiveFlags();
    const settlerAddress = parseAddressFlag("--settler");
    let hookAddress = parseAddressFlag("--hook");
    const apiUrl = hookAddress || settlerAddress ? undefined : parseApiUrl();

    // Set up public client
    const publicClient = createPublicClient({
        chain: mainnet,
        transport: http(RPC_URL),
    });

    try {
        if (settlerAddress) {
            console.log(`🏛️  Settler address: ${settlerAddress}`);
            hookAddress = getAddress(
                (await publicClient.readContract({
                    address: settlerAddress,
                    abi: turbineSettlerABI,
                    functionName: "getTurbineHook",
                })) as Address
            );
        }
        if (hookAddress) {
            console.log(`🪝 Hook address: ${hookAddress}`);
        } else {
            console.log(`🌐 Turbine API: ${apiUrl}`);
        }
        console.log("🔍 Fetching registered pools...\n");

        const pools = hookAddress
            ? await getPools(publicClient, hookAddress)
            : await fetchPools(publicClient, apiUrl);

        if (pools.length === 0) {
            console.log("No registered pools found.");
            return;
        }

        console.log(`Found ${pools.length} registered pool(s):\n`);

        pools.forEach((pool, index) => {
            printPoolDetails(pool, index);
        });
    } catch (error) {
        if (error instanceof TurbineError && error.code === "CONFIG_FETCH_FAILED") {
            console.error(`\n❌ Could not read the hook address from ${apiUrl}.`);
            console.error(
                "   Pass --hook <address> or --settler <address> to skip the API."
            );
            process.exit(1);
        }
        console.error("\n❌ Error fetching pools:");
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
