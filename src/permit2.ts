import {
    AllowanceTransfer,
    PERMIT2_ADDRESS,
    PermitSingle,
    PermitSingleData,
} from "@uniswap/permit2-sdk";
import { Address, createPublicClient, Hex, http, maxUint160, WalletClient } from "viem";
import { mainnet } from "viem/chains";
import { CHAIN_ID, RPC_URL, TURBINE_SETTLER_CONTRACT } from "./config";
import { AllowanceTransferPermitSingle, OrderIntent } from "./models";

// Instantiate a public mainnet client
const defaultPublicClient = createPublicClient({
    chain: CHAIN_ID ? { ...mainnet, id: CHAIN_ID } : mainnet,
    transport: http(RPC_URL),
});

/* Get current nonce of Permit2 AllowanceTransfer.
 * This nonce should be used in a new allowance.
 */
async function getNonce(
    owner: Address,
    token: Address,
    spender: Address,
    client: ReturnType<typeof createPublicClient>
): Promise<bigint> {
    const packedAllowance = await client.readContract({
        address: PERMIT2_ADDRESS,
        abi: [
            {
                inputs: [
                    { name: "owner", type: "address" },
                    { name: "token", type: "address" },
                    { name: "spender", type: "address" },
                ],
                name: "allowance",
                outputs: [{ name: "", type: "bytes32" }],
                stateMutability: "view",
                type: "function",
            },
        ],
        functionName: "allowance",
        args: [owner, token, spender],
    });

    // Extract nonce from packed allowance
    // Nonce is stored in the most significant 48 bits
    const nonce = BigInt(packedAllowance) >> 208n;

    return nonce;
}

/**
 * Generate permit object for an order and sign it.
 * @param order The order to sign
 * @param wallet User wallet that will be used to sign the order
 * @param deadline When allowance and signature expire. By default
 * will be set to order's endTime.
 * @param spender The address of allowed token spender. By default
 * will be set to OrderSettler address.
 * @param publicClient An instance of PublicClient to use for getting
 * the Permit2 nonce. If not given, a default public client will be used.
 */
export async function getSignedAllowance({
    order,
    wallet,
    deadline = BigInt(order.endTime),
    spender = TURBINE_SETTLER_CONTRACT,
    publicClient = defaultPublicClient,
}: {
    order: OrderIntent;
    wallet: WalletClient;
    deadline?: bigint;
    spender?: Address;
    publicClient?: ReturnType<typeof createPublicClient>;
}): Promise<getSignedAllowanceReturnType> {
    const nonce = await getNonce(
        (await wallet.getAddresses())[0],
        order.sellToken,
        spender,
        publicClient
    );
    const permit: AllowanceTransferPermitSingle = {
        details: {
            token: order.sellToken,
            amount: maxUint160, // infinite approval
            expiration: deadline,
            nonce: nonce,
        },
        spender: spender,
        sigDeadline: deadline,
    };

    const permitSignature = await getSignature(permit, wallet);

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
        CHAIN_ID
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
