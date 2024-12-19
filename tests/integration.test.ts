import { USDC, USDT } from "../src/constants";
import { OrderIntent, PrimitiveSignature } from "../src/models";
import { convertSignature, getRandomSalt, TurbineClient } from "../src/turbineClient";
import { ACCOUNT, ORDER_INTENT, WALLET_CLIENT } from "./constants";

describe("Integration test", () => {
    it("should successfully sign an order intent", async () => {
        const turbineClient = new TurbineClient();
        // Define order here to avoid signature invalidation in case
        // we ever change the order defined in test constants.
        const orderIntent: OrderIntent = {
            owner: ACCOUNT.address,
            sellToken: USDC.address,
            buyToken: USDT.address,
            sellAmount: 1000n,
            minBuyAmount: 950n,
            midPriceDelta: 5,
            startTime: 1630000000n,
            endTime: 1630003600n,
            partialFill: true,
            salt: "0xbc99a2cb0a86c1eb704c1b670ec4c59eae55ceaa8f1b0068f170d6d66d1301a1",
        } as const;

        const signature = await turbineClient["signIntent"](orderIntent, WALLET_CLIENT);

        const convertedSignature = convertSignature(signature);
        // The values below are taken from Rust implementation
        const expected: PrimitiveSignature = {
            r: BigInt(
                "0xc3671a04e7b7d275b29cd2e431581700049c50fe29f85ed6f3311c497f71a4eb"
            ),
            s: BigInt(
                "0x5922f8c8f199d220a92a5937e7a8da7448711442ae16a335b58107984b26c618"
            ),
            yParity: "0x1",
        };
        expect(convertedSignature).toEqual(expected);
    });

    it("should successfully submit an order", async () => {
        const turbineClient = new TurbineClient();

        await turbineClient.addOrder(ORDER_INTENT, WALLET_CLIENT);
    });

    it("should successfully submit order array", async () => {
        const turbineClient = new TurbineClient();

        const intents: OrderIntent[] = Array.from({ length: 5 }, () => ({
            ...ORDER_INTENT,
            salt: getRandomSalt(),
        }));

        const result = await turbineClient.addOrderArray(intents, WALLET_CLIENT);

        result.forEach((response) => {
            expect(response).toBeDefined();
        });
    });
});
