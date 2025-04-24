import { Account, Address, Hex, PublicClient, WalletClient } from "viem";
import { orderIntentABI } from "./abi";
import { TURBINE_API_URL, TURBINE_DOMAIN, TURBINE_SETTLER_CONTRACT } from "./config";
import { AddOrder, AddSmartOrder, OrderIntent, PrimitiveSignature } from "./models";
import { getSignedAllowance } from "./permit2";
import { NULL_ADDRESS } from "./constants";

export class TurbineClient {
    public turbineApiUrl: string;
    public settlerContract: Address;

    constructor(turbineApiUrl?: string, settlerContract?: Address) {
        this.turbineApiUrl = turbineApiUrl ?? TURBINE_API_URL;
        this.settlerContract = settlerContract ?? TURBINE_SETTLER_CONTRACT;
    }

    private getTurbineDomain() {
        return {
            ...TURBINE_DOMAIN,
            verifyingContract: this.settlerContract,
        };
    }

    private getIntentTypedData(intent: OrderIntent) {
        return {
            domain: this.getTurbineDomain(),
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
        walletClient: WalletClient,
        publicClient: PublicClient
    ): Promise<AddOrder | AddSmartOrder> {
        let intentSignature = await this.signIntent(intent, walletClient);

        // Skip permit data for smart orders
        if (this.is_smart_order(intent)) {
            return {
                order: intent,
                orderSignature: convertSignature(intentSignature),
            };
        }

        let { permit, permitSignature } = await getSignedAllowance({
            order: intent,
            walletClient,
            publicClient,
            spender: this.settlerContract,
        });
        return {
            order: intent,
            orderSignature: convertSignature(intentSignature),
            signedPermit: {
                signature: convertSignature(permitSignature),
                permit: permit,
            },
        };
    }

    private async callAddOrder(payload: AddOrder | AddSmartOrder) {
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

    private async callAddOrders(payloads: (AddOrder | AddSmartOrder)[]) {
        const body = JSON.stringify(payloads, bigIntReplacer);

        const response = await fetch(`${this.turbineApiUrl}/add_orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body,
        });
        return response;
    }

    /**
     * Add an order to the Turbine API.
     * @param intent An `OrderIntent` object containing the details of the trade to be executed
     * @param walletClient The wallet client used for signing the order intent
     * @param publicClient The public client used for blockchain interactions and permit2 allowance
     * @returns A Promise that resolves to a string containing the submitted order hash.
     */
    async addOrder(
        intent: OrderIntent,
        walletClient: WalletClient,
        publicClient: PublicClient
    ): Promise<string> {
        const payload = await this.createAddOrderData(
            intent,
            walletClient,
            publicClient
        );
        const response = await this.callAddOrder(payload);
        if (!response.ok) {
            throw new Error(
                `Failed to add order: ${response.statusText}, ${await response.text()}`
            );
        }

        let responseJson;
        try {
            responseJson = await response.json();
        } catch (e) {
            throw new Error(`Failed to parse response as JSON: ${e}`);
        }

        if (!responseJson || !responseJson["order_hash"]) {
            throw new Error(
                `Response missing required order_hash field: ${JSON.stringify(responseJson)}`
            );
        }

        return responseJson["order_hash"];
    }

    /**
     * Add an array of orders to the Turbine API.
     * @param intents An array of `OrderIntent` objects containing the details of the trades to be executed
     * @param walletClient The wallet client used for signing the order intents
     * @param publicClient The public client used for blockchain interactions and permit2 allowances
     * @returns A Promise that resolves to an array of strings containing the submitted order hashes.
     */
    async addOrders(
        intents: OrderIntent[],
        walletClient: WalletClient,
        publicClient: PublicClient
    ): Promise<string[]> {
        const payloads = await Promise.all(
            intents.map((intent) =>
                this.createAddOrderData(intent, walletClient, publicClient)
            )
        );
        const response = await this.callAddOrders(payloads);
        if (!response.ok) {
            throw new Error(
                `Failed to add orders: ${response.statusText}, ${await response.text()}`
            );
        }

        let responseJson;
        try {
            responseJson = await response.json();
        } catch (e) {
            throw new Error(`Failed to parse response as JSON: ${e}`);
        }

        if (!responseJson || !responseJson.length) {
            throw new Error(
                `Response missing required order hashes: ${JSON.stringify(responseJson)}`
            );
        }

        return responseJson.map((order: any) => order.order_hash);
    }

    /**
     * Remove an order from the Turbine API.
     * @param orderHash The hash of the order to remove
     * @param walletClient The wallet client used for signing the removal request
     * @returns A Promise that resolves to the response message from the API.
     */
    async removeOrder(
        orderHash: Hex,
        walletClient: WalletClient
    ): Promise<{ order_hash: string; message: string }> {
        // Sign the order hash to prove ownership
        const signature = await walletClient.signMessage({
            message: { raw: orderHash },
            account: walletClient.account!,
        });

        const payload = {
            order_hash: orderHash,
            signature: convertSignature(signature),
        };

        const response = await fetch(`${this.turbineApiUrl}/remove_order`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload, bigIntReplacer),
        });

        if (!response.ok) {
            throw new Error(
                `Failed to remove order: ${response.statusText}, ${await response.text()}`
            );
        }

        let responseJson;
        try {
            responseJson = await response.json();
        } catch (e) {
            throw new Error(`Failed to parse response as JSON: ${e}`);
        }

        if (!responseJson || !responseJson.order_hash || !responseJson.message) {
            throw new Error(
                `Response missing required fields: ${JSON.stringify(responseJson)}`
            );
        }

        return responseJson;
    }

    private is_smart_order(intent: OrderIntent): Boolean {
        return intent.callDataTarget != NULL_ADDRESS && intent.callData != "0x";
    }
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
        yParity: parseInt(sig.slice(130, 132), 16) - 27 === 1, // Convert v (27/28) to y_parity (false/true)
    };
}

/** Helps serializing BigInts into JSON */
function bigIntReplacer(key: string, value: any): any {
    if (typeof value === "bigint") {
        return `0x${value.toString(16)}`;
    }
    return value;
}
