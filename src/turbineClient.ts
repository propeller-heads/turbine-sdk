import { Hex } from "viem";
import { AddOrder } from "./models";

export class TurbineClient {
    constructor(
    ) {
    }

    async addOrder(addOrderData: AddOrder): Promise<string> {}

    async addOrderArray(addOrderArrayData: AddOrder[]): Promise<string[]> {}

    /**
     * Cancel an order by its ID.
     * Order cancellation is subjected to a speedbump. If the next settlement
     * happens before the speedbump time passes, your order may still be filled.
     * @param orderId Order ID
     */
    async cancelOrder(orderId: string) {}
}

// Returns random bytes32 as a hex string
export function getRandomSalt(): Hex {
    const randomBytes = new Array(32)
        .fill(0)
        .map(() => Math.floor(Math.random() * 256));
    return `0x${randomBytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
