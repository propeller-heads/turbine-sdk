import { privateKeyToAccount } from "viem/accounts";
import { AllowanceTransferPermitSingle } from "../src/models";
import { getSignature } from "../src/permit2";
import { createWalletClient, http } from "viem";
import { mainnet } from "viem/chains";

describe("Permit2", () => {
    it("should create a correct signature", async () => {
        const permit: AllowanceTransferPermitSingle = {
            details: {
                token: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
                amount: 1461501637330902918203684832716283019655932542975n,
                expiration: 1719735740n,
                nonce: 0n,
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
});
