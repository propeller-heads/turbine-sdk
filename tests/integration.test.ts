import { OrderIntent } from "../src/models";
import { getRandomSalt, TurbineClient } from "../src/turbineClient";
import { ORDER_INTENT, PUBLIC_CLIENT, WALLET_CLIENT } from "./constants";

describe("Integration test", () => {
    it("should successfully submit an order", async () => {
        const turbineClient = new TurbineClient();

        const intent: OrderIntent = {
            ...ORDER_INTENT,
            salt: getRandomSalt(),
        };

        const result = await turbineClient.addOrder(
            intent,
            WALLET_CLIENT,
            PUBLIC_CLIENT
        );

        expect(result).toBeDefined();
    });

    it("should successfully submit an order array", async () => {
        const turbineClient = new TurbineClient();

        const intents: OrderIntent[] = Array.from({ length: 5 }, () => ({
            ...ORDER_INTENT,
            salt: getRandomSalt(),
        }));

        const result = await turbineClient.addOrders(
            intents,
            WALLET_CLIENT,
            PUBLIC_CLIENT
        );

        result.forEach((response) => {
            expect(response).toBeDefined();
        });
    });
});
