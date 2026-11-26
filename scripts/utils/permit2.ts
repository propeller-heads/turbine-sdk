import {
    Account,
    Address,
    erc20Abi,
    maxUint256,
    PublicClient,
    WalletClient,
} from "viem";
import { mainnet } from "viem/chains";
import { PERMIT2_ADDRESS } from "@uniswap/permit2-sdk";

/**
 * Make sure Permit2 may spend at least `required` of `token` on behalf of `account`.
 * If the current ERC20 allowance is too low, grant Permit2 an infinite approval.
 */
export async function ensurePermit2Allowance(
    walletClient: WalletClient,
    publicClient: PublicClient,
    account: Account,
    token: Address,
    required: bigint
) {
    const allowance = await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account.address, PERMIT2_ADDRESS as Address],
    });
    if (allowance >= required) {
        console.log(`   ${token}: allowance sufficient`);
        return;
    }

    const { request } = await publicClient.simulateContract({
        address: token,
        abi: erc20Abi,
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
