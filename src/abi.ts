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
