#!/usr/bin/env ts-node

import { createPublicClient, createWalletClient, getAddress, http, Hex } from "viem";
import { mainnet } from "viem/chains";
import { TurbineClient, getRandomSalt } from "../src/turbineClient";
import { RemoveLiquidityIntent } from "../src/models";
import { USDC, WETH } from "../src/constants";
import { RPC_URL } from "../src/config";
import { balanceOfABI } from "../src/abi";
import { getAccount } from "./utils/keystore";

// ─────────────────────────────────────────────────────────────────────────────
// OLD-ROUTER RECOVERY SCRIPT
//
// Turbine's contracts were redeployed. Liquidity deposited before the redeploy is
// still held by the OLD TurbineLiquidityRouter, which the current app no longer
// reads. `TurbineClient.create()` fetches the CURRENT (new) addresses from the
// API, so we override them below to target the old deployment where the funds sit.
//
//   OLD_ROUTER_ADDRESS – pre-redeploy TurbineLiquidityRouter (holds the funds)
//   OLD_HOOK_ADDRESS   – pre-redeploy TurbineHook, needed to compute the poolId
//                        of the old position.
// ─────────────────────────────────────────────────────────────────────────────
const OLD_ROUTER_ADDRESS = getAddress("0xB6f2F9F7AB521d67604a42E879f2D3F94D5837E7");
const OLD_HOOK_ADDRESS = getAddress("0xd994CFDC5464577426CBb282cDF4A3Db2354e088");

async function main() {
    console.log("🚀 Starting Turbine OLD-ROUTER liquidity removal script...");

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

    // Redirect the SDK from the new deployment (fetched by create()) to the old one.
    turbineClient.config.lpRouterAddress = OLD_ROUTER_ADDRESS;
    turbineClient.config.lpHookAddress = OLD_HOOK_ADDRESS;

    console.log(`👤 Account: ${account.address}`);
    console.log(
        `🏛️  Old router (funds held here): ${turbineClient.config.lpRouterAddress}`
    );

    // Pool configuration — these MUST match the OLD pool you deposited into and
    // the OLD LP token you received. Defaults below are the pre-redeploy
    // USDC/WETH 0.3% pool; change them if you deposited into a different pair.
    const pool = {
        token0: USDC,
        token1: WETH,
        fee: 3000, // 0.3%
        lpToken: "0x24746c26c7b83ddabbaf384e02c3eb0e7b8cd307",
    };

    // Get current LP token balance of walletClient account
    const lpTokenBalance = await publicClient.readContract({
        address: pool.lpToken as Hex,
        abi: balanceOfABI,
        functionName: "balanceOf",
        args: [account.address],
    });

    if (lpTokenBalance === 0n) {
        console.error(
            `\n❌ Account ${account.address} holds no LP tokens for ${pool.token0.symbol}/${pool.token1.symbol}; nothing to remove.`
        );
        process.exit(1);
    }

    const lpTokenToBurn = lpTokenBalance; // Withdraw the full LP balance

    const removeIntent: RemoveLiquidityIntent = {
        owner: account.address,
        token0: pool.token0.address as Hex,
        token1: pool.token1.address as Hex,
        fee: pool.fee,
        lpToken: pool.lpToken as Hex,
        lpTokenAmount: lpTokenToBurn,
        salt: getRandomSalt(),
    };

    console.log("\n📊 Liquidity Removal Details:");
    console.log(
        `Pool: ${pool.token0.symbol}/${pool.token1.symbol} (${pool.fee / 10000}% fee)`
    );
    console.log(`LP Token: ${pool.lpToken}`);
    console.log(
        `LP Token to burn: ${lpTokenToBurn.toString()} (wei units) — full balance`
    );

    try {
        // Submit liquidity removal on-chain
        console.log("\n🔄 Submitting liquidity removal intent on-chain...");

        const { txHash, intentHash } =
            await turbineClient.submitRemoveLiquidityIntentOnchain(removeIntent);

        console.log("\n✅ Liquidity removal intent submitted on-chain successfully!");
        console.log(`Transaction hash: ${txHash}`);
        console.log(`Intent hash: ${intentHash}`);
        console.log(
            "\n💡 Next step: wait ~30s (on-chain speed bump), then copy the Intent hash above and run:\n" +
                `   yarn execute-pending-intents-from-old-router ${intentHash}\n` +
                "Execute within 2.5 hours from the SAME wallet — after that the request expires and you must re-run this script."
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
