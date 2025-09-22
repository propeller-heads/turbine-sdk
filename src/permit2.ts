import {
    AllowanceTransfer,
    PERMIT2_ADDRESS,
    PermitSingle,
    PermitSingleData,
} from "@uniswap/permit2-sdk";
import { Address, Hex, maxUint160, PublicClient, WalletClient } from "viem";
import { CHAIN_ID } from "./config";
import { AllowanceTransferPermitSingle } from "./models";

/* Get current nonce of Permit2 AllowanceTransfer.
 * This nonce should be used in a new allowance.
 */
async function getNonce(
    owner: Address,
    token: Address,
    spender: Address,
    client: PublicClient
): Promise<number> {
    const allowance = await client.readContract({
        address: PERMIT2_ADDRESS,
        abi: [
            {
                inputs: [
                    { name: "owner", type: "address" },
                    { name: "token", type: "address" },
                    { name: "spender", type: "address" },
                ],
                name: "allowance",
                outputs: [
                    { name: "amount", type: "uint160" },
                    { name: "expiration", type: "uint48" },
                    { name: "nonce", type: "uint48" },
                ],
                stateMutability: "view",
                type: "function",
            },
        ],
        functionName: "allowance",
        args: [owner, token, spender],
    });
    const nonce = allowance[2];
    return nonce;
}

/**
 * Generate permit object for an order and sign it.
 * @param order The order to sign
 * @param walletClient User wallet client that will be used to sign the order
 * @param publicClient An instance of PublicClient to use for getting
 * the Permit2 nonce.
 * @param deadline When allowance and signature expire. By default
 * will be set to order's endTime.
 * @param amount The amount of tokens to approve. By default will be set to maxUint160.
 * @param spender The address of allowed token spender. By default
 * will be set to OrderSettler address.
 */
export async function getSignedAllowance({
    token,
    walletClient,
    publicClient,
    deadline,
    amount = maxUint160, // infinite approval
    spender,
}: {
    token: Address;
    walletClient: WalletClient;
    publicClient: PublicClient;
    deadline: number;
    amount?: bigint;
    spender: Address;
}): Promise<getSignedAllowanceReturnType> {
    const nonce = await getNonce(
        (await walletClient.getAddresses())[0],
        token,
        spender,
        publicClient
    );
    const permit: AllowanceTransferPermitSingle = {
        details: {
            token: token,
            amount: amount,
            expiration: deadline,
            nonce: nonce,
        },
        spender: spender,
        sigDeadline: BigInt(deadline),
    };

    const permitSignature = await getSignature(permit, walletClient);

    return { permit, permitSignature };
}
export type getSignedAllowanceReturnType = {
    permit: AllowanceTransferPermitSingle;
    permitSignature: Hex;
};

/**
 * Get Permit2 signature for order.
 * We do some type conversions because `AllowanceTransfer.getPermitData` returns
 * data suited for `ethers` wallet, while we're using `viem` wallet.
 */
export async function getSignature(
    permit: AllowanceTransferPermitSingle,
    wallet: WalletClient
): Promise<Hex> {
    const { domain, types, values } = AllowanceTransfer.getPermitData(
        permit as PermitSingle,
        PERMIT2_ADDRESS,
        CHAIN_ID // TODO use chainId from wallet?
    ) as PermitSingleData;
    const signature = await wallet.signTypedData({
        account: wallet.account!,
        domain: {
            name: domain.name,
            chainId: Number(domain.chainId),
            verifyingContract: domain.verifyingContract as Address,
        },
        types: types,
        primaryType: "PermitSingle",
        message: values as unknown as { [key_4: string]: unknown },
    });
    return signature;
}
