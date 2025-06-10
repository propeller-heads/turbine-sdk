export const orderIntentABI = {
    components: [
        {
            name: "owner",
            type: "address",
        },
        {
            name: "sellToken",
            type: "address",
        },
        {
            name: "buyToken",
            type: "address",
        },
        {
            name: "sellAmount",
            type: "uint256",
        },
        {
            name: "minBuyAmount",
            type: "uint256",
        },
        {
            name: "midPriceDelta",
            type: "int32",
        },
        {
            name: "startTime",
            type: "uint256",
        },
        {
            name: "endTime",
            type: "uint256",
        },
        {
            name: "partialFill",
            type: "bool",
        },
        {
            name: "callData",
            type: "bytes",
        },
        {
            name: "callDataTarget",
            type: "address",
        },
        {
            name: "salt",
            type: "bytes32",
        },
    ],
    name: "order",
    type: "tuple",
};

export const addLiquidityIntentABI = {
    components: [
        {
            name: "owner",
            type: "address",
        },
        {
            name: "token0",
            type: "address",
        },
        {
            name: "token1",
            type: "address",
        },
        {
            name: "fee",
            type: "uint24",
        },
        {
            name: "maxToken0",
            type: "uint128",
        },
        {
            name: "maxToken1",
            type: "uint128",
        },
        {
            name: "salt",
            type: "bytes32",
        },
    ],
    name: "addLiquidityIntent",
    type: "tuple",
};

export const removeLiquidityIntentABI = {
    components: [
        {
            name: "owner",
            type: "address",
        },
        {
            name: "token0",
            type: "address",
        },
        {
            name: "token1",
            type: "address",
        },
        {
            name: "fee",
            type: "uint24",
        },
        {
            name: "lpToken",
            type: "address",
        },
        {
            name: "lpTokenAmount",
            type: "uint128",
        },
        {
            name: "salt",
            type: "bytes32",
        },
    ],
    name: "removeLiquidityIntent",
    type: "tuple",
};

export const turbineHookABI = [
    {
        inputs: [],
        name: "getRegisteredPools",
        outputs: [
            {
                components: [
                    {
                        name: "poolId",
                        type: "bytes32",
                    },
                    {
                        name: "token0",
                        type: "address",
                    },
                    {
                        name: "token1",
                        type: "address",
                    },
                    {
                        name: "fee",
                        type: "uint24",
                    },
                    {
                        name: "lpToken",
                        type: "address",
                    },
                    {
                        name: "reserve0",
                        type: "uint128",
                    },
                    {
                        name: "reserve1",
                        type: "uint128",
                    },
                    {
                        name: "liquidity",
                        type: "uint256",
                    },
                ],
                name: "poolsData",
                type: "tuple[]",
            },
        ],
        stateMutability: "view",
        type: "function",
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
