import { PERMIT2_ADDRESS } from "@uniswap/permit2-sdk";
import { Address, Hex, PublicClient, WalletClient } from "viem";
import { CHAIN_ID } from "./config";
import { toTurbineError } from "./errorHandling";
import {
    SignatureTransferPermitBatchTransferFrom,
    SignatureTransferPermitTransferFrom,
    TokenPermissions,
} from "./models";
import { randomBytes } from "crypto";

// Minimal ABI for Permit2 nonce bitmap reads
const permit2NonceBitmapAbi = [
    {
        inputs: [
            { name: "owner", type: "address" },
            { name: "wordPos", type: "uint256" },
        ],
        name: "nonceBitmap",
        outputs: [{ name: "bitmap", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
] as const;

// EIP-712 types for Permit2 SignatureTransfer with spender included in the typehash.
// NOTE: `spender` is not part of the Permit2 structs themselves, but *is* part of the signed
// typehash.
const signatureTransferTypes = {
    TokenPermissions: [
        { name: "token", type: "address" },
        { name: "amount", type: "uint256" },
    ],
    PermitTransferFrom: [
        { name: "permitted", type: "TokenPermissions" },
        { name: "spender", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
    ],
    PermitBatchTransferFrom: [
        { name: "permitted", type: "TokenPermissions[]" },
        { name: "spender", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
    ],
} as const;

async function readNonceBitmap(
    publicClient: PublicClient,
    owner: Address,
    wordPos: bigint
): Promise<bigint> {
    return (await publicClient.readContract({
        address: PERMIT2_ADDRESS as Address,
        abi: permit2NonceBitmapAbi,
        functionName: "nonceBitmap",
        args: [owner, wordPos],
    })) as bigint;
}

/**
 * Picks an unused unordered nonce from Permit2's bitmap for the given owner.
 * Generates a random nonce first, then checks if it's unused. If used, generates a new random nonce and retries up to 100 times.
 *
 * Permit2 uses unordered nonces with a bitmap layout:
 * - wordPos = nonce >> 8
 * - bitPos  = nonce & 0xff
 */
export async function getRandomNonce(
    publicClient: PublicClient,
    owner: Address
): Promise<bigint> {
    const maxAttempts = 100;
    for (let attempts = 0; attempts < maxAttempts; attempts++) {
        // Generate a random 256-bit nonce using crypto.randomBytes
        const bytes = randomBytes(32);
        const randomHex = "0x" + bytes.toString("hex");
        const randomNonce = BigInt(randomHex);

        const randomWordPos = randomNonce >> 8n;
        const randomBitPos = Number(randomNonce & 0xffn);
        const randomBitmap = await readNonceBitmap(publicClient, owner, randomWordPos);
        const randomMask = 1n << BigInt(randomBitPos);
        if ((randomBitmap & randomMask) === 0n) {
            return randomNonce;
        }
    }
    throw new Error(`Failed to find unused nonce after ${maxAttempts} attempts`);
}

export type GetSignedSignatureTransferReturnType = {
    permit: SignatureTransferPermitTransferFrom;
    permitSignature: Hex;
};

export async function getSignedSignatureTransfer({
    token,
    amount,
    walletClient,
    publicClient,
    deadline,
    spender,
    nonce: providedNonce,
}: {
    token: Address;
    amount: bigint;
    walletClient: WalletClient;
    publicClient: PublicClient;
    deadline: bigint;
    spender: Address;
    nonce?: bigint;
}): Promise<GetSignedSignatureTransferReturnType> {
    try {
        const owner = (await walletClient.getAddresses())[0];
        const nonce = providedNonce ?? (await getRandomNonce(publicClient, owner));

        const permitted: TokenPermissions = { token, amount };
        const permit: SignatureTransferPermitTransferFrom = {
            permitted,
            nonce,
            deadline,
        };

        const permitSignature = await walletClient.signTypedData({
            account: walletClient.account!,
            domain: {
                name: "Permit2",
                chainId: CHAIN_ID,
                verifyingContract: PERMIT2_ADDRESS as Address,
            },
            types: signatureTransferTypes,
            primaryType: "PermitTransferFrom",
            // Include spender in the signed message
            message: {
                permitted,
                spender,
                nonce,
                deadline,
            },
        });

        return { permit, permitSignature };
    } catch (e) {
        throw toTurbineError(e);
    }
}

export type GetSignedBatchSignatureTransferReturnType = {
    permit: SignatureTransferPermitBatchTransferFrom;
    permitSignature: Hex;
};

export async function getSignedBatchSignatureTransfer({
    tokens,
    amounts,
    walletClient,
    publicClient,
    deadline,
    spender,
    nonce: providedNonce,
}: {
    tokens: Address[];
    amounts: bigint[];
    walletClient: WalletClient;
    publicClient: PublicClient;
    deadline: bigint;
    spender: Address;
    nonce?: bigint;
}): Promise<GetSignedBatchSignatureTransferReturnType> {
    try {
        if (tokens.length !== amounts.length) {
            throw new Error(
                `tokens/amounts length mismatch: tokens=${tokens.length} amounts=${amounts.length}`
            );
        }
        const owner = (await walletClient.getAddresses())[0];
        const nonce = providedNonce ?? (await getRandomNonce(publicClient, owner));

        const permitted: TokenPermissions[] = tokens.map((token, i) => ({
            token,
            amount: amounts[i],
        }));

        const permit: SignatureTransferPermitBatchTransferFrom = {
            permitted,
            nonce,
            deadline,
        };

        const permitSignature = await walletClient.signTypedData({
            account: walletClient.account!,
            domain: {
                name: "Permit2",
                chainId: CHAIN_ID,
                verifyingContract: PERMIT2_ADDRESS as Address,
            },
            types: signatureTransferTypes,
            primaryType: "PermitBatchTransferFrom",
            // Include spender in the signed message
            message: {
                permitted,
                spender,
                nonce,
                deadline,
            },
        });

        return { permit, permitSignature };
    } catch (e) {
        throw toTurbineError(e);
    }
}
