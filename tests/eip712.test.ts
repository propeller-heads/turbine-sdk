import { describe, expect, jest } from "@jest/globals";
import {
    Address,
    getAddress,
    hashTypedData,
    Hex,
    keccak256,
    numberToHex,
    recoverAddress,
    stringToBytes,
} from "viem";
import { TURBINE_API_URL } from "../src/config";
import { NULL_ADDRESS } from "../src/constants";
import {
    buildSignedOrderIntentMessage,
    EIP712_TYPES,
    generateEip712Nonce,
    resolveSpreadCurvePoints,
} from "../src/eip712";
import { OrderIntent } from "../src/models";
import { validateTurbineConfig } from "../src/validation";
import {
    ACCOUNT,
    createMockTurbineClient,
    MOCK_TURBINE_CONFIG,
    ORDER_INTENT,
} from "./constants";

/**
 * Cross-implementation fixtures from the backend's `src/api/eip712/envelope.rs`:
 * the signatures were produced by foundry's independent EIP-712 implementation
 * (`cast wallet sign --data`) with the key of FIXTURE_SIGNER. Recovering them
 * through our typed data pins the type-strings (field names, order, types,
 * nested-struct encoding) and the domain against drift.
 */
const FIXTURE_DOMAIN = {
    name: "Turbine",
    version: "1",
    chainId: 1,
    verifyingContract: "0x26df0ea798971a97ae121514b32999dfdb220e1f" as Address,
    salt: keccak256(stringToBytes("https://dev-api.turbine.exchange/api")),
} as const;

const FIXTURE_SIGNER = "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720";

const FIXTURE_HASH: Hex =
    "0xbc99a2cb0a86c1eb704c1b670ec4c59eae55ceaa8f1b0068f170d6d66d1301a1";

const FIXTURE_ORDER_INTENT: OrderIntent = {
    owner: "0x9858EfFD232B4033E47d90003D41EC34EcaEda94",
    sellToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    buyToken: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    sellAmount: 1000000n,
    minBuyAmount: 250000000000000n,
    spreadCurve: {
        startDeltaBps: 25,
        endDeltaBps: 40,
        points: [{ windowBps: 5000, deltaBps: 30 }],
    },
    startTime: 1760000000n,
    endTime: 1760003600n,
    partialFill: true,
    callData: "0x",
    callDataTarget: NULL_ADDRESS,
    salt: FIXTURE_HASH,
};

/** Rebuilds a 32-byte-padded signature object from a serialized auth block. */
function authSignature(auth: any): { r: Hex; s: Hex; yParity: number } {
    return {
        r: numberToHex(BigInt(auth.signature.r), { size: 32 }),
        s: numberToHex(BigInt(auth.signature.s), { size: 32 }),
        yParity: auth.signature.yParity ? 1 : 0,
    };
}

describe("EIP-712 typed data", () => {
    it("pins the fixture domain salt to the backend's value", () => {
        expect(FIXTURE_DOMAIN.salt).toBe(
            "0x36f58a53af15d7999b9a370d51197631b7a193e5b3010f1950ea636907e5274d"
        );
    });

    it("recovers the cast-signed AddOrder fixture", async () => {
        const hash = hashTypedData({
            domain: FIXTURE_DOMAIN,
            types: EIP712_TYPES.AddOrder,
            primaryType: "AddOrder",
            message: {
                order: buildSignedOrderIntentMessage(FIXTURE_ORDER_INTENT),
                nonce: 8421337650123n,
                deadline: 1760000600n,
            },
        });
        const recovered = await recoverAddress({
            hash,
            signature:
                "0x913d2e9a20244e3efed83e4a1e98aa3c727809d419a2c98dc855fd06366de24862aa8fc0bb5c0a88fda65a7e0f15f178c8b027ec1f5bb7b1f66943366bf2eb051c",
        });
        expect(getAddress(recovered)).toBe(getAddress(FIXTURE_SIGNER));
    });

    it("recovers the cast-signed QueryOrders fixture", async () => {
        const hash = hashTypedData({
            domain: FIXTURE_DOMAIN,
            types: EIP712_TYPES.QueryOrders,
            primaryType: "QueryOrders",
            message: {
                hashes: [FIXTURE_HASH],
                statuses: ["Active", "Filled"],
                cursor: "",
                limit: 50,
                nonce: 8421337650123n,
                deadline: 1760000060n,
            },
        });
        const recovered = await recoverAddress({
            hash,
            signature:
                "0xc8fa9c6bc1d6c6724dd7ca0bc129a36dff899f8a4698da9fb6690855b537c04216fc08dd7fb613fad8bcaf9fc41449c1b9bfd44bd3c752c7960aed55d0acec391b",
        });
        expect(getAddress(recovered)).toBe(getAddress(FIXTURE_SIGNER));
    });
});

describe("resolveSpreadCurvePoints", () => {
    it("resolves windowBps knots to absolute timestamps with integer math", () => {
        const points = resolveSpreadCurvePoints(1760000000n, 1760003600n, {
            startDeltaBps: 25,
            endDeltaBps: 40,
            points: [{ windowBps: 5000, deltaBps: 30 }],
        });
        expect(points).toEqual([{ timeSecs: 1760001800n, deltaBps: 30 }]);
    });

    it("rounds down like the backend", () => {
        // 3333 * 3600 / 10000 = 1199.88 -> 1199
        const points = resolveSpreadCurvePoints(1760000000n, 1760003600n, {
            startDeltaBps: 0,
            endDeltaBps: 0,
            points: [{ windowBps: 3333, deltaBps: 10 }],
        });
        expect(points).toEqual([{ timeSecs: 1760001199n, deltaBps: 10 }]);
    });

    it("rejects knots that collapse onto the window start", () => {
        // 1 * 1000 / 10000 = 0.1 -> 0, so the knot lands on startTime
        expect(() =>
            resolveSpreadCurvePoints(1760000000n, 1760001000n, {
                startDeltaBps: 0,
                endDeltaBps: 0,
                points: [{ windowBps: 1, deltaBps: 10 }],
            })
        ).toThrow(
            expect.objectContaining({ code: "INPUT_VALIDATION_ERROR" })
        );
    });

    it("rejects knots that collapse onto each other after truncation", () => {
        // On a 10-second window both knots truncate to startTime + 1s:
        // 1000 * 10 / 10000 = 1 and 1500 * 10 / 10000 = 1.5 -> 1
        expect(() =>
            resolveSpreadCurvePoints(1760000000n, 1760000010n, {
                startDeltaBps: 0,
                endDeltaBps: 0,
                points: [
                    { windowBps: 1000, deltaBps: 10 },
                    { windowBps: 1500, deltaBps: 20 },
                ],
            })
        ).toThrow(
            expect.objectContaining({ code: "INPUT_VALIDATION_ERROR" })
        );
    });
});

describe("generateEip712Nonce", () => {
    it("returns a decimal string that fits in a u64", () => {
        for (let i = 0; i < 100; i++) {
            const nonce = generateEip712Nonce();
            expect(nonce).toMatch(/^\d+$/);
            expect(BigInt(nonce)).toBeLessThan(2n ** 64n);
        }
    });

    it("returns distinct values", () => {
        const nonces = new Set(
            Array.from({ length: 100 }, () => generateEip712Nonce())
        );
        expect(nonces.size).toBe(100);
    });
});

describe("TurbineConfig eip712Domain validation", () => {
    it("rejects a config without eip712Domain", () => {
        const { eip712Domain, ...config } = MOCK_TURBINE_CONFIG;
        expect(() => validateTurbineConfig(config, TURBINE_API_URL)).toThrow(
            expect.objectContaining({ code: "INPUT_VALIDATION_ERROR" })
        );
    });

    it("rejects a config without maxSignatureLifetimeS", () => {
        const { maxSignatureLifetimeS, ...config } = MOCK_TURBINE_CONFIG;
        expect(() => validateTurbineConfig(config, TURBINE_API_URL)).toThrow(
            expect.objectContaining({ code: "INPUT_VALIDATION_ERROR" })
        );
    });

    it("rejects a domain whose verifyingContract is not the settler", () => {
        const config = {
            ...MOCK_TURBINE_CONFIG,
            eip712Domain: {
                ...MOCK_TURBINE_CONFIG.eip712Domain,
                verifyingContract:
                    "0x9999999999999999999999999999999999999999" as Address,
            },
        };
        expect(() => validateTurbineConfig(config, TURBINE_API_URL)).toThrow(
            expect.objectContaining({ code: "INPUT_VALIDATION_ERROR" })
        );
    });

    it("rejects a domain whose salt does not commit to the API URI", () => {
        const config = {
            ...MOCK_TURBINE_CONFIG,
            eip712Domain: {
                ...MOCK_TURBINE_CONFIG.eip712Domain,
                salt: FIXTURE_HASH,
            },
        };
        expect(() => validateTurbineConfig(config, TURBINE_API_URL)).toThrow(
            expect.objectContaining({ code: "INPUT_VALIDATION_ERROR" })
        );
    });
});

describe("TurbineClient in EIP-712 mode", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    async function createEip712Client() {
        return await createMockTurbineClient(undefined, { authMethod: "eip712" });
    }

    it("defaults to SIWE mode", async () => {
        const client = await createMockTurbineClient();
        expect(client.authMethod).toBe("siwe");
    });

    it("cancelOrder posts a signed envelope to eip712/cancel_order", async () => {
        const client = await createEip712Client();
        const spy = jest
            .spyOn(client as any, "fetchWithCookies")
            .mockResolvedValue(
                new Response(JSON.stringify({ orderHash: FIXTURE_HASH }), {
                    status: 200,
                })
            );

        const before = Math.floor(Date.now() / 1000);
        const result = await client.cancelOrder(FIXTURE_HASH);
        expect(result.orderHash).toBe(FIXTURE_HASH);

        expect(spy).toHaveBeenCalledTimes(1);
        const [endpoint, options] = spy.mock.calls[0] as [string, RequestInit];
        expect(endpoint).toBe("eip712/cancel_order");
        const body = JSON.parse(options.body as string);

        expect(body.payload).toEqual({ orderHash: FIXTURE_HASH });
        expect(getAddress(body.auth.signer)).toBe(getAddress(ACCOUNT.address));
        expect(body.auth.nonce).toMatch(/^\d+$/);
        expect(body.auth.deadline).toBeGreaterThanOrEqual(
            before + MOCK_TURBINE_CONFIG.maxSignatureLifetimeS - 10
        );
        expect(body.auth.deadline).toBeLessThanOrEqual(
            before + MOCK_TURBINE_CONFIG.maxSignatureLifetimeS
        );

        // The signature must recover to the signer over the typed data.
        const hash = hashTypedData({
            domain: MOCK_TURBINE_CONFIG.eip712Domain,
            types: EIP712_TYPES.CancelOrder,
            primaryType: "CancelOrder",
            message: {
                orderHash: FIXTURE_HASH,
                nonce: BigInt(body.auth.nonce),
                deadline: BigInt(body.auth.deadline),
            },
        });
        const recovered = await recoverAddress({
            hash,
            signature: authSignature(body.auth),
        });
        expect(getAddress(recovered)).toBe(getAddress(ACCOUNT.address));
    });

    it("does not touch the session endpoints", async () => {
        const client = await createEip712Client();
        const spy = jest
            .spyOn(client as any, "fetchWithCookies")
            .mockResolvedValue(
                new Response(JSON.stringify({ orderHash: FIXTURE_HASH }), {
                    status: 200,
                })
            );

        await client.cancelOrder(FIXTURE_HASH);

        const endpoints = spy.mock.calls.map((call) => call[0]);
        expect(endpoints).not.toEqual(
            expect.arrayContaining(["me", "/me", "nonce", "verify"])
        );
    });

    it("retries the identical envelope once on HTTP 409", async () => {
        const client = await createEip712Client();
        const spy = jest
            .spyOn(client as any, "fetchWithCookies")
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        code: "NONCE_ALREADY_USED",
                        message: "nonce already used",
                    }),
                    { status: 409 }
                )
            )
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ orderHash: FIXTURE_HASH }), {
                    status: 200,
                })
            );

        const result = await client.cancelOrder(FIXTURE_HASH);
        expect(result.orderHash).toBe(FIXTURE_HASH);

        expect(spy).toHaveBeenCalledTimes(2);
        const firstBody = (spy.mock.calls[0][1] as RequestInit).body;
        const secondBody = (spy.mock.calls[1][1] as RequestInit).body;
        expect(secondBody).toBe(firstBody);
    });

    it("surfaces the error when the 409 retry fails too", async () => {
        const client = await createEip712Client();
        jest.spyOn(client as any, "fetchWithCookies").mockResolvedValue(
            new Response(
                JSON.stringify({
                    code: "NONCE_ALREADY_USED",
                    message: "nonce already used",
                }),
                { status: 409 }
            )
        );

        await expect(client.cancelOrder(FIXTURE_HASH)).rejects.toMatchObject({
            code: "NONCE_ALREADY_USED",
        });
    });

    it("getOrders signs zero-value defaults for unset filters", async () => {
        const client = await createEip712Client();
        const spy = jest
            .spyOn(client as any, "fetchWithCookies")
            .mockResolvedValue(
                new Response(
                    JSON.stringify({ orders: [], cursor: null, hasMore: false }),
                    { status: 200 }
                )
            );

        const result = await client.getOrders();
        expect(result).toEqual({ orders: [], cursor: null, hasMore: false });

        const [endpoint, options] = spy.mock.calls[0] as [string, RequestInit];
        expect(endpoint).toBe("eip712/orders");
        const body = JSON.parse(options.body as string);
        expect(body.payload).toEqual({
            hashes: [],
            statuses: [],
            cursor: "",
            limit: 0,
        });
    });

    it("getOrders passes filters through to the signed payload", async () => {
        const client = await createEip712Client();
        const spy = jest
            .spyOn(client as any, "fetchWithCookies")
            .mockResolvedValue(
                new Response(
                    JSON.stringify({ orders: [], cursor: null, hasMore: false }),
                    { status: 200 }
                )
            );

        await client.getOrders({
            hashes: [FIXTURE_HASH],
            statuses: ["Active", "Filled"],
            limit: 5,
        });

        const body = JSON.parse(
            (spy.mock.calls[0][1] as RequestInit).body as string
        );
        expect(body.payload).toEqual({
            hashes: [FIXTURE_HASH],
            statuses: ["Active", "Filled"],
            cursor: "",
            limit: 5,
        });
    });

    it("getLiquidityIntents posts the hashes to eip712/liquidity_intents", async () => {
        const client = await createEip712Client();
        const spy = jest
            .spyOn(client as any, "fetchWithCookies")
            .mockResolvedValue(
                new Response(
                    JSON.stringify([{ hash: FIXTURE_HASH, status: "Pending" }]),
                    { status: 200 }
                )
            );

        const result = await client.getLiquidityIntents([FIXTURE_HASH]);
        expect(result).toEqual([{ hash: FIXTURE_HASH, status: "Pending" }]);

        const [endpoint, options] = spy.mock.calls[0] as [string, RequestInit];
        expect(endpoint).toBe("eip712/liquidity_intents");
        const body = JSON.parse(options.body as string);
        expect(body.payload).toEqual({ hashes: [FIXTURE_HASH] });
    });

    it("addOrder moves the spread curve out of the signed order payload", async () => {
        const client = await createEip712Client();
        const spy = jest
            .spyOn(client as any, "fetchWithCookies")
            .mockResolvedValue(
                new Response(JSON.stringify({ orderHash: FIXTURE_HASH }), {
                    status: 200,
                })
            );

        const orderHash = await client.addOrder(ORDER_INTENT);
        expect(orderHash).toBe(FIXTURE_HASH);

        const [endpoint, options] = spy.mock.calls[0] as [string, RequestInit];
        expect(endpoint).toBe("eip712/add_order");
        const body = JSON.parse(options.body as string);

        expect(body.payload.order.spreadCurve).toBeUndefined();
        expect(body.payload.spreadCurve).toEqual(ORDER_INTENT.spreadCurve);
        expect(body.payload.signedPermit).toBeDefined();

        // The signature must recover over the resolved-curve order struct.
        const hash = hashTypedData({
            domain: MOCK_TURBINE_CONFIG.eip712Domain,
            types: EIP712_TYPES.AddOrder,
            primaryType: "AddOrder",
            message: {
                order: buildSignedOrderIntentMessage(ORDER_INTENT),
                nonce: BigInt(body.auth.nonce),
                deadline: BigInt(body.auth.deadline),
            },
        });
        const recovered = await recoverAddress({
            hash,
            signature: authSignature(body.auth),
        });
        expect(getAddress(recovered)).toBe(getAddress(ACCOUNT.address));
    });

    it("addOrders posts a bare array of envelopes with distinct nonces", async () => {
        const client = await createEip712Client();
        const spy = jest
            .spyOn(client as any, "fetchWithCookies")
            .mockResolvedValue(
                new Response(
                    JSON.stringify([
                        { orderHash: FIXTURE_HASH },
                        { orderHash: FIXTURE_HASH },
                    ]),
                    { status: 200 }
                )
            );

        const secondIntent: OrderIntent = {
            ...ORDER_INTENT,
            salt: "0x1111111111111111111111111111111111111111111111111111111111111111",
        };
        const hashes = await client.addOrders([ORDER_INTENT, secondIntent]);
        expect(hashes).toEqual([FIXTURE_HASH, FIXTURE_HASH]);

        const [endpoint, options] = spy.mock.calls[0] as [string, RequestInit];
        expect(endpoint).toBe("eip712/add_orders");
        const body = JSON.parse(options.body as string);

        expect(Array.isArray(body)).toBe(true);
        expect(body).toHaveLength(2);
        expect(body[0].auth.nonce).not.toBe(body[1].auth.nonce);
        expect(body[0].payload.order.salt).toBe(ORDER_INTENT.salt);
        expect(body[1].payload.order.salt).toBe(secondIntent.salt);
    });

    it("rejects orders whose owner is not the wallet address", async () => {
        const client = await createEip712Client();

        await expect(
            client.addOrder({
                ...ORDER_INTENT,
                owner: "0x9858EfFD232B4033E47d90003D41EC34EcaEda94",
            })
        ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("session-only methods throw NOT_SUPPORTED_IN_EIP712_MODE", async () => {
        const client = await createEip712Client();

        const calls = [
            () => client.authenticate(),
            () => client.logout(),
            () => client.getAuthStatus(),
            () => client.getOrderStates([FIXTURE_HASH]),
            () => client.getSettledAmounts([FIXTURE_HASH]),
        ];
        for (const call of calls) {
            await expect(call()).rejects.toMatchObject({
                code: "NOT_SUPPORTED_IN_EIP712_MODE",
            });
        }
    });
});
