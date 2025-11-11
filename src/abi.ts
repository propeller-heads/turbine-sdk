export const turbineLiquidityRouterABI = [
    {
        type: "function",
        name: "submitRemoveLiquidityIntent",
        inputs: [
            {
                name: "intent",
                type: "tuple",
                internalType: "struct RemoveLiquidityIntent",
                components: [
                    { name: "owner", type: "address", internalType: "address" },
                    { name: "poolId", type: "bytes32", internalType: "PoolId" },
                    { name: "lpTokenAmount", type: "uint256", internalType: "uint256" },
                    { name: "salt", type: "bytes32", internalType: "bytes32" },
                ],
            },
            {
                name: "permitParams",
                type: "tuple",
                internalType: "struct AllowanceParams",
                components: [
                    { name: "signature", type: "bytes", internalType: "bytes" },
                    {
                        name: "permit",
                        type: "tuple",
                        internalType: "struct IAllowanceTransfer.PermitSingle",
                        components: [
                            {
                                name: "details",
                                type: "tuple",
                                internalType: "struct IAllowanceTransfer.PermitDetails",
                                components: [
                                    {
                                        name: "token",
                                        type: "address",
                                        internalType: "address",
                                    },
                                    {
                                        name: "amount",
                                        type: "uint160",
                                        internalType: "uint160",
                                    },
                                    {
                                        name: "expiration",
                                        type: "uint48",
                                        internalType: "uint48",
                                    },
                                    {
                                        name: "nonce",
                                        type: "uint48",
                                        internalType: "uint48",
                                    },
                                ],
                            },
                            {
                                name: "spender",
                                type: "address",
                                internalType: "address",
                            },
                            {
                                name: "sigDeadline",
                                type: "uint256",
                                internalType: "uint256",
                            },
                        ],
                    },
                ],
            },
        ],
        outputs: [
            {
                name: "intentHash",
                type: "bytes32",
                internalType: "RemoveLiquidityIntentHash",
            },
        ],
        stateMutability: "nonpayable",
    },
    {
        inputs: [
            {
                internalType: "RemoveLiquidityIntentHash[]",
                name: "hashes",
                type: "bytes32[]",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
        name: "executePendingIntents",
    },
    {
        type: "function",
        name: "flushExpiredIntents",
        inputs: [],
        outputs: [],
        stateMutability: "nonpayable",
    },
] as const;

export const turbineHookABI = [
    {
        type: "function",
        name: "getNumberOfRegisteredPools",
        inputs: [],
        outputs: [
            {
                name: "",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "computePoolId",
        inputs: [
            { name: "currency0", type: "address", internalType: "address" },
            { name: "currency1", type: "address", internalType: "address" },
            { name: "fee", type: "uint24", internalType: "uint24" },
        ],
        outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
        stateMutability: "pure",
    },
    {
        type: "function",
        name: "getRegisteredPoolsSlice",
        inputs: [
            {
                name: "startIndex",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "endIndex",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        outputs: [
            {
                name: "poolsInfo",
                type: "tuple[]",
                internalType: "struct TurbineHook.PoolInfo[]",
                components: [
                    {
                        name: "poolId",
                        type: "bytes32",
                        internalType: "bytes32",
                    },
                    {
                        name: "token0",
                        type: "address",
                        internalType: "address",
                    },
                    {
                        name: "token1",
                        type: "address",
                        internalType: "address",
                    },
                    {
                        name: "fee",
                        type: "uint24",
                        internalType: "uint24",
                    },
                    {
                        name: "lpToken",
                        type: "address",
                        internalType: "address",
                    },
                    {
                        name: "reserve0",
                        type: "uint128",
                        internalType: "uint128",
                    },
                    {
                        name: "reserve1",
                        type: "uint128",
                        internalType: "uint128",
                    },
                    {
                        name: "liquidity",
                        type: "uint256",
                        internalType: "uint256",
                    },
                ],
            },
        ],
        stateMutability: "view",
    },
] as const;

export const balanceOfABI = [
    {
        constant: true,
        inputs: [
            {
                name: "owner",
                type: "address",
            },
        ],
        name: "balanceOf",
        outputs: [
            {
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
] as const;

export const poolManagerABI = [
    {
        inputs: [
            {
                components: [
                    { name: "currency0", type: "address" },
                    { name: "currency1", type: "address" },
                    { name: "fee", type: "uint24" },
                    { name: "tickSpacing", type: "int24" },
                    { name: "hooks", type: "address" },
                ],
                name: "key",
                type: "tuple",
            },
            { name: "sqrtPriceX96", type: "uint160" },
        ],
        name: "initialize",
        outputs: [{ name: "tick", type: "int24" }],
        stateMutability: "nonpayable",
        type: "function",
    },
] as const;

export const orderSettledABI = {
    anonymous: false,
    inputs: [
        {
            indexed: true,
            name: "owner",
            type: "address",
        },
        {
            indexed: true,
            name: "orderHash",
            type: "bytes32",
        },
        {
            indexed: false,
            name: "receiveAmount",
            type: "uint256",
        },
        {
            indexed: false,
            name: "sendAmount",
            type: "uint256",
        },
    ],
    name: "OrderSettled",
    type: "event",
} as const;
