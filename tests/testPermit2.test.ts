import { privateKeyToAccount } from "viem/accounts";
import { AllowanceTransferPermitSingle } from "../src/models";
import { getSignature } from "../src/permit2";
import {
    Address,
    createWalletClient,
    hashTypedData,
    Hex,
    http,
    recoverAddress,
} from "viem";
import { mainnet } from "viem/chains";
import { PERMIT2_ADDRESS } from "@uniswap/permit2-sdk";
import { CHAIN_ID } from "../src/config";
import { getSignedBatchSignatureTransfer } from "../src/permit2SignatureTransfer";

describe("Permit2", () => {
    it("should create a correct signature", async () => {
        const permit: AllowanceTransferPermitSingle = {
            details: {
                token: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
                amount: 1461501637330902918203684832716283019655932542975n,
                expiration: 1719735740,
                nonce: 0,
            },
            spender: "0x26df0ea798971a97ae121514b32999dfdb220e1f",
            sigDeadline: 1719735740n,
        };
        const pk = "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6";
        const wallet = createWalletClient({
            account: privateKeyToAccount(pk),
            transport: http(),
            chain: mainnet,
        });

        const res = await getSignature(permit, wallet);

        expect(res).toEqual(
            "0xf16d214dfba55ca463685b30f4ddd5b697616e4674557c9cd2ed9f93245ccebf3e57a84d4e3abf99ddafeda1a823e388aec812ed9545060d7a96eaacc02ff50c1c"
        );
    });

    it("matches Rust test_batch_signature_transfer_signature (spender-included typehash)", async () => {
        // Mirrors turbine-rust/src/api/signature.rs test_batch_signature_transfer_signature
        const pk = "0x66d43f2462420055e331769cd264c0b96b6e11235c74b6eb509f25e8817571d1";
        const account = privateKeyToAccount(pk);
        const owner = account.address;

        const spender = "0xc380c49EB54F5b6bC3D0546b304950Aaf2b0e088" as Address;

        const tokens = [
            "0x2e234DAe75C793f67A35089C9d99245E1C58470b" as Address,
            "0x5615dEB798BB3E4dFa0139dFa1b3D433Cc23b72f" as Address,
        ];
        const amounts = [111n, 222n];

        const deadline = 1234567890n;
        const expectedNonce = 100n;

        const publicClient = {
            readContract: jest.fn(),
        } as any;

        const walletClient = createWalletClient({
            account,
            transport: http(),
            chain: mainnet,
        });

        const { permit, permitSignature } = await getSignedBatchSignatureTransfer({
            tokens,
            amounts,
            walletClient,
            publicClient,
            deadline,
            spender,
            nonce: expectedNonce,
        });

        const expectedSignature =
            "0xaea8c8a67a637ad26b4d49cf46403ff84b906b99d1c961f7680d6186a2c422e21aec641131b9ef53ad8b1bca64086637873dce8b116ac487e57b9842730f33021b" as Hex;
        expect(permitSignature.toLowerCase()).toEqual(expectedSignature.toLowerCase());

        // Also validate that signature recovers to the correct owner
        // Reconstruct the types and domain for hashTypedData
        const types = {
            TokenPermissions: [
                { name: "token", type: "address" },
                { name: "amount", type: "uint256" },
            ],
            PermitBatchTransferFrom: [
                { name: "permitted", type: "TokenPermissions[]" },
                { name: "spender", type: "address" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" },
            ],
        } as const;

        const domain = {
            name: "Permit2",
            chainId: CHAIN_ID,
            verifyingContract: PERMIT2_ADDRESS as Address,
        } as const;

        const permitHash = hashTypedData({
            domain,
            types,
            primaryType: "PermitBatchTransferFrom",
            message: {
                permitted: permit.permitted,
                spender,
                nonce: permit.nonce,
                deadline: permit.deadline,
            },
        });
        const recovered = await recoverAddress({
            hash: permitHash,
            signature: permitSignature,
        });
        expect(recovered.toLowerCase()).toEqual(owner.toLowerCase());
    });
});
