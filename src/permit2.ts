import {
    AllowanceTransfer,
    PERMIT2_ADDRESS,
    PermitBatch,
    PermitBatchData,
    PermitSingle,
    PermitSingleData,
} from "@uniswap/permit2-sdk";
import {
    Address,
    Hex,
    maxUint160,
    PublicClient,
    TypedDataDomain,
    WalletClient,
} from "viem";
import { CHAIN_ID, TURBINE_SETTLER_CONTRACT } from "./config";
import {
    AllowanceTransferBatchPermit,
    AllowanceTransferPermitSingle,
    PermitDetails,
} from "./models";

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
 * Generate permit object for a token and sign it.
 * @param token The token to approve
 * @param walletClient User wallet client that will be used to sign
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
    spender = TURBINE_SETTLER_CONTRACT,
}: {
    token: Address;
    walletClient: WalletClient;
    publicClient: PublicClient;
    deadline: number;
    amount?: bigint;
    spender?: Address;
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
 * Generate permit object for a pair of tokens and sign it.
 * @param tokens The tokens to approve
 * @param walletClient User wallet client that will be used to sign
 * @param publicClient An instance of PublicClient to use for getting
 * the Permit2 nonce.
 * @param deadline When allowance and signature expire. By default
 * will be set to order's endTime.
 * @param amounts The amounts of tokens to approve. By default will be set to maxUint160.
 * @param spender The address of allowed token spender. By default
 * will be set to OrderSettler address.
 */
export async function getBatchSignedAllowance({
    tokens,
    walletClient,
    publicClient,
    deadline,
    amounts = [maxUint160, maxUint160], // infinite approval
    spender = TURBINE_SETTLER_CONTRACT,
}: {
    tokens: [Address, Address];
    walletClient: WalletClient;
    publicClient: PublicClient;
    deadline: number;
    amounts?: [bigint, bigint];
    spender?: Address;
}): Promise<getBatchSignedAllowanceReturnType> {
    const permitDetails: PermitDetails[] = [];
    for (let i = 0; i < tokens.length; i++) {
        if (amounts[i] === undefined) {
            amounts[i] = maxUint160;
        }
        const nonce = await getNonce(
            (await walletClient.getAddresses())[0],
            tokens[i],
            spender,
            publicClient
        );
        permitDetails.push({
            token: tokens[i],
            amount: amounts[i],
            expiration: deadline,
            nonce: nonce,
        });
    }

    const permit: AllowanceTransferBatchPermit = {
        details: permitDetails,
        spender: spender,
        sigDeadline: BigInt(deadline),
    };

    const permitSignature = await getSignature(permit, walletClient, "PermitBatch");

    return { permit, permitSignature };
}
export type getBatchSignedAllowanceReturnType = {
    permit: AllowanceTransferBatchPermit;
    permitSignature: Hex;
};

/**
 * Get Permit2 signature for order. Supports both single and batch permits.
 * We do some type conversions because `AllowanceTransfer.getPermitData` returns
 * data suited for `ethers` wallet, while we're using `viem` wallet.
 */
export async function getSignature(
    permit: AllowanceTransferPermitSingle | AllowanceTransferBatchPermit,
    wallet: WalletClient,
    permitType: "PermitSingle" | "PermitBatch" = "PermitSingle"
): Promise<Hex> {
    let permitData: PermitSingleData | PermitBatchData;
    if (permitType === "PermitSingle") {
        permitData = AllowanceTransfer.getPermitData(
            permit as PermitSingle,
            PERMIT2_ADDRESS,
            CHAIN_ID // TODO use chainId from wallet?
        ) as PermitSingleData;
    } else {
        permitData = AllowanceTransfer.getPermitData(
            permit as PermitBatch,
            PERMIT2_ADDRESS,
            CHAIN_ID // TODO use chainId from wallet?
        ) as PermitBatchData;
    }
    const signature = await wallet.signTypedData({
        account: wallet.account!,
        domain: {
            name: permitData.domain.name,
            chainId: Number(permitData.domain.chainId),
            verifyingContract: permitData.domain.verifyingContract as Address,
        },
        types: permitData.types,
        primaryType: permitType,
        message: permitData.values as unknown as { [key_4: string]: unknown },
    });
    return signature;
}
