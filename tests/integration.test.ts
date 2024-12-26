import { OrderIntent } from "../src/models";
import { getRandomSalt, TurbineClient } from "../src/turbineClient";
import { ORDER_INTENT, WALLET_CLIENT } from "./constants";

describe("Integration test", () => {
    it("should successfully submit an order", async () => {
        const turbineClient = new TurbineClient("http://0.0.0.0:8080");

        await turbineClient.addOrder(ORDER_INTENT, WALLET_CLIENT);
    });

    it("should successfully submit a smart order", async () => {
        const turbineClient = new TurbineClient("http://0.0.0.0:8080");

        await turbineClient.addSmartOrder(SMART_ORDER_INTENT, WALLET_CLIENT);
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
