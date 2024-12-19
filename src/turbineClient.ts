import { Account, Address, Hex, WalletClient } from "viem";
import { orderIntentABI } from "./abi";
import { TURBINE_API_URL, TURBINE_SETTLER_CONTRACT } from "./config";
import { TURBINE_DOMAIN } from "./constants";
import { AddOrder, OrderIntent, PrimitiveSignature } from "./models";
import { getSignedAllowance } from "./permit2";

export class TurbineClient {
    private turbineApiUrl: string;
    private settlerContract: Address;

    constructor(turbineApiUrl?: string, settlerContract?: Address) {
        this.turbineApiUrl = turbineApiUrl ?? TURBINE_API_URL;
        this.settlerContract = settlerContract ?? TURBINE_SETTLER_CONTRACT;
    }

    private getIntentTypedData(intent: OrderIntent) {
        return {
            domain: TURBINE_DOMAIN,
            types: {
                OrderIntent: orderIntentABI.components,
            },
            primaryType: "OrderIntent" as const,
            message: intent as unknown as Record<string, unknown>,
        };
    }

    private async signIntent(
        intent: OrderIntent,
        client: WalletClient,
        account?: Account | Hex
    ): Promise<Hex> {
        let typedData = this.getIntentTypedData(intent);
        return await client.signTypedData({
            ...typedData,
            account: account ?? client.account!,
        });
    }

    private async createAddOrderData(
        intent: OrderIntent,
        client: WalletClient
    ): Promise<AddOrder> {
        let intentSignature = await this.signIntent(intent, client);
        let { permit, permitSignature } = await getSignedAllowance({
            order: intent,
            wallet: client,
            spender: this.settlerContract,
        });
        return {
            order: intent,
            order_signature: convertSignature(intentSignature),
            permit,
            permit_signature: convertSignature(permitSignature),
        };
    }

    private async callAddOrder(payload: AddOrder) {
        const body = JSON.stringify(payload, bigIntReplacer);

        const response = await fetch(`${this.turbineApiUrl}/add_order`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body,
        });
        return response;
    }

    async addOrder(intent: OrderIntent, client: WalletClient) {
        const payload = await this.createAddOrderData(intent, client);
        const response = await this.callAddOrder(payload);
        if (!response.ok) {
            throw new Error(
                `Failed to add order: ${response.statusText}, ${await response.text()}`
            );
        }

        const responseText = await response.text();
        console.log(`Got a response: ${response}`);
        return responseText;
    }

    async addOrderArray(intents: OrderIntent[], client: WalletClient) {
        return await Promise.all(
            intents.map((intent) => this.addOrder(intent, client))
        );
    }

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

export function convertSignature(sig: Hex): PrimitiveSignature {
    return {
        r: BigInt(`0x${sig.slice(2, 66)}`),
        s: BigInt(`0x${sig.slice(66, 130)}`),
        yParity: `0x${parseInt(sig.slice(130, 132), 16) - 27}`, // Convert v (27/28) to y_parity (false/true)
    };
}

/** Helps serializing BigInts into JSON */
function bigIntReplacer(key: string, value: any): any {
    if (typeof value === "bigint") {
        return `0x${value.toString(16)}`;
    }
    return value;
}
