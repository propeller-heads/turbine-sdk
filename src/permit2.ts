import {
    AllowanceTransfer,
    PERMIT2_ADDRESS,
    PermitSingle,
    PermitSingleData,
} from "@uniswap/permit2-sdk";
import { Address, createPublicClient, Hex, http, maxUint160, Transport, WalletClient } from "viem";
import { mainnet } from "viem/chains";
import { L1_CHAIN_ID, L1_RPC_URL, TURBINE_SETTLER_CONTRACT } from "./config";
import { AllowanceTransferPermitSingle, OrderIntent } from "./models";

// Instantiate a public mainnet client
const l1Client = createPublicClient({
    chain: L1_CHAIN_ID ? { ...mainnet, id: L1_CHAIN_ID } : mainnet,
    transport: http(L1_RPC_URL),
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
 * Convert Order to OrderWithAllowance.
 * It adds Permit2 allowanceParams attribute to Order object.
 * @param order The order to sign
 * @param wallet User wallet that will be used to sign the order
 * @param deadline When allowance and signature expire. By default
 * will be set to order's endTime.
 * @param spender The address of allowed token spender. By default
 * will be set to OrderSettler address.
 * @param publicClient An instance of PublicClient to use for getting
 * the Permit2 nonce. If not given, a default L1 public client will be used.
 */
export async function getSignedAllowance(
    order: OrderIntent,
    wallet: WalletClient,
    deadline = BigInt(order.endTime),
    spender: Address = TURBINE_SETTLER_CONTRACT,
    publicClient: ReturnType<typeof createPublicClient> = l1Client
): Promise<getSignedAllowanceReturnType> {
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

    const permit_signature = await getSignature(permit, wallet);

    return { permit, permit_signature };
}
type getSignedAllowanceReturnType = { permit: AllowanceTransferPermitSingle; permit_signature: Hex };

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
        L1_CHAIN_ID
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
