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
