import { Account, Address, Hex, PublicClient, WalletClient } from "viem";
import { addLiquidityIntentABI, orderIntentABI, removeLiquidityIntentABI } from "./abi";
import { TURBINE_API_URL, TURBINE_SETTLER_CONTRACT, TURBINE_DOMAIN } from "./config";
import {
    AddLiquidity,
    AddLiquidityIntent,
    AddOrder,
    AddSmartOrder,
    OrderIntent,
    PrimitiveSignature,
    RemoveLiquidity,
    RemoveLiquidityIntent,
} from "./models";
import { getSignedAllowance } from "./permit2";
import { NULL_ADDRESS } from "./constants";

export class TurbineClient {
    public turbineApiUrl: string;
    public settlerContract: Address;

    constructor(turbineApiUrl?: string, settlerContract?: Address) {
        this.turbineApiUrl = turbineApiUrl ?? TURBINE_API_URL;
        this.settlerContract = settlerContract ?? TURBINE_SETTLER_CONTRACT;
    }

    /* PUBLIC METHODS */

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
        const response = await this.callAPIendpoint(payload, "add_order");
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
        const response = await this.callAPIendpoint(payloads, "add_orders");
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
     * Add a liquidity addition intent to the Turbine API.
     * @param intent The intent to add liquidity
     * @param walletClient The wallet client used for signing the intent
     * @param publicClient The public client used for blockchain interactions and permit2 allowances
     * @returns A Promise that resolves to a string containing the submitted order hash.
     */
    async addLiquidity(
        intent: AddLiquidityIntent,
        walletClient: WalletClient,
        publicClient: PublicClient
    ): Promise<string> {
        const payload = await this.createAddLiquidityData(
            intent,
            walletClient,
            publicClient
        );
        const response = await this.callAPIendpoint(payload, "add_liquidity");
        if (!response.ok) {
            throw new Error(
                `Failed to add liquidity: ${response.statusText}, ${await response.text()}`
            );
        }

        let responseJson;
        try {
            responseJson = await response.json();
        } catch (e) {
            throw new Error(`Failed to parse response as JSON: ${e}`);
        }

        if (!responseJson || !responseJson["hash"]) {
            throw new Error(
                `Response missing required hash field: ${JSON.stringify(responseJson)}`
            );
        }

        return responseJson["hash"];
    }

    /**
     * Add a liquidity removal intent to the Turbine API.
     * @param intent The intent to remove liquidity
     * @param walletClient The wallet client used for signing the intent
     * @param publicClient The public client used for blockchain interactions and permit2 allowances
     * @returns A Promise that resolves to a string containing the submitted order hash.
     */
    async removeLiquidity(
        intent: RemoveLiquidityIntent,
        walletClient: WalletClient,
        publicClient: PublicClient
    ): Promise<string> {
        const payload = await this.createRemoveLiquidityData(
            intent,
            walletClient,
            publicClient
        );
        const response = await this.callAPIendpoint(payload, "remove_liquidity");
        if (!response.ok) {
            throw new Error(
                `Failed to remove liquidity: ${response.statusText}, ${await response.text()}`
            );
        }

        let responseJson;
        try {
            responseJson = await response.json();
        } catch (e) {
            throw new Error(`Failed to parse response as JSON: ${e}`);
        }

        if (!responseJson || !responseJson["hash"]) {
            throw new Error(
                `Response missing required hash field: ${JSON.stringify(responseJson)}`
            );
        }

        return responseJson["hash"];
    }

    /**
     * Cancel an order by its hash.
     * Order cancellation is subjected to a speedbump. If the next settlement
     * happens before the speedbump time passes, your order may still be filled.
     * @param orderHash Order hash
     */
    async cancelOrder(orderHash: string) {
        throw new Error("Not implemented in SDK nor Turbine API");
    }

    /* PRIVATE METHODS */

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
                order_signature: convertSignature(intentSignature),
            };
        }

        let { permit, permitSignature } = await getSignedAllowance({
            token: intent.sellToken,
            walletClient,
            publicClient,
            deadline: intent.endTime,
            spender: this.settlerContract,
        });
        return {
            order: intent,
            order_signature: convertSignature(intentSignature),
            signed_permit: {
                signature: convertSignature(permitSignature),
                permit: permit,
            },
        };
    }

    private async createAddLiquidityData(
        intent: AddLiquidityIntent,
        walletClient: WalletClient,
        publicClient: PublicClient
    ): Promise<AddLiquidity> {
        let intentSignature = await this.signIntent(intent, walletClient);

        // TODO: Add start time and end time to the liquidity intents ?
        let deadline = BigInt(Date.now() + 300_000); // 5 minutes from now
        let { permit: permit0, permitSignature: permitSignature0 } =
            await getSignedAllowance({
                token: intent.token0,
                walletClient,
                publicClient,
                deadline: deadline,
                spender: this.settlerContract,
            });
        let { permit: permit1, permitSignature: permitSignature1 } =
            await getSignedAllowance({
                token: intent.token1,
                walletClient,
                publicClient,
                deadline: deadline,
                spender: this.settlerContract,
            });
        return {
            signed_intent: {
                intent: intent,
                signature: convertSignature(intentSignature),
            },
            permit_token0: {
                signature: convertSignature(permitSignature0),
                permit: permit0,
            },
            permit_token1: {
                signature: convertSignature(permitSignature1),
                permit: permit1,
            },
        };
    }

    private async createRemoveLiquidityData(
        intent: RemoveLiquidityIntent,
        walletClient: WalletClient,
        publicClient: PublicClient
    ): Promise<RemoveLiquidity> {
        let intentSignature = await this.signIntent(intent, walletClient);

        let deadline = BigInt(Date.now() + 300_000); // 5 minutes from now
        let { permit: permit, permitSignature: permitSignature } =
            await getSignedAllowance({
                token: intent.lpToken,
                walletClient,
                publicClient,
                deadline: deadline,
            });
        return {
            signed_intent: {
                intent: intent,
                signature: convertSignature(intentSignature),
            },
            permit_lp_token: {
                signature: convertSignature(permitSignature),
                permit: permit,
            },
        };
    }

    private is_smart_order(intent: OrderIntent): Boolean {
        return intent.callDataTarget != NULL_ADDRESS && intent.callData != "0x";
    }

    private getTurbineDomain() {
        return {
            ...TURBINE_DOMAIN,
            verifyingContract: this.settlerContract,
        };
    }

    private getIntentTypedData(
        intent: OrderIntent | AddLiquidityIntent | RemoveLiquidityIntent
    ) {
        let typedData: {
            domain: {
                verifyingContract: Address;
                name: string;
                version: string;
                chainId: number;
                salt: Hex;
            };
            types: any;
            primaryType: string;
            message: Record<string, unknown>;
        } = {
            domain: this.getTurbineDomain(),
            types: {},
            primaryType: "",
            message: intent as unknown as Record<string, unknown>,
        };

        // Determine the primary type based on the intent
        if ("sellToken" in intent && "buyToken" in intent) {
            typedData.types["OrderIntent"] = orderIntentABI.components;
            typedData.primaryType = "OrderIntent";
        } else if ("token0" in intent && "token1" in intent && "maxToken0" in intent) {
            typedData.types["AddLiquidityIntent"] = addLiquidityIntentABI.components;
            typedData.primaryType = "AddLiquidityIntent";
        } else if ("token0" in intent && "token1" in intent && "lpToken" in intent) {
            typedData.types["RemoveLiquidityIntent"] =
                removeLiquidityIntentABI.components;
            typedData.primaryType = "RemoveLiquidityIntent";
        }

        return typedData;
    }

    /**
     * Signs the intent using the wallet client.
     * @param intent The order intent, add liquidity intent, or remove liquidity intent to sign
     * @param client The wallet client used for signing
     * @param account Optional account to use for signing. If not provided, the default account of the client is used.
     * @returns A Promise that resolves to a hex string containing the signed intent.
     */
    private async signIntent(
        intent: OrderIntent | AddLiquidityIntent | RemoveLiquidityIntent,
        client: WalletClient,
        account?: Account | Hex
    ): Promise<Hex> {
        let typedData = this.getIntentTypedData(intent);
        return await client.signTypedData({
            ...typedData,
            account: account ?? client.account!,
        });
    }

    /**
     * Calls the Turbine API endpoint with the given payload.
     * @param payload The payload to send to the endpoint
     * @param endpoint The endpoint to call. One of "add_order", "add_orders", "add_liquidity", "remove_liquidity"
     * @returns A Promise that resolves to the response from the endpoint
     */
    private async callAPIendpoint(
        payload:
            | AddOrder
            | AddSmartOrder
            | (AddOrder | AddSmartOrder)[]
            | AddLiquidity
            | RemoveLiquidity,
        endpoint: string
    ) {
        const body = JSON.stringify(payload, bigIntReplacer);

        const response = await fetch(`${this.turbineApiUrl}/${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body,
        });
        return response;
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
