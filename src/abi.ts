export const orderABI = {
    components: [
        {
            internalType: "address",
            name: "owner",
            type: "address",
        },
        {
            internalType: "address",
            name: "sellToken",
            type: "address",
        },
        {
            internalType: "address",
            name: "buyToken",
            type: "address",
        },
        {
            internalType: "uint256",
            name: "sellAmount",
            type: "uint256",
        },
        {
            internalType: "uint256",
            name: "minBuyAmount",
            type: "uint256",
        },
        {
            internalType: "uint32",
            name: "maxGas",
            type: "uint32",
        },
        {
            internalType: "uint32",
            name: "startMidPriceDelta",
            type: "uint32",
        },
        {
            internalType: "uint32",
            name: "endMidPriceDelta",
            type: "uint32",
        },
        {
            internalType: "uint32",
            name: "startTime",
            type: "uint32",
        },
        {
            internalType: "uint32",
            name: "endTime",
            type: "uint32",
        },
        {
            internalType: "uint64",
            name: "createdTimestamp",
            type: "uint64",
        },
        {
            internalType: "bool",
            name: "partialFill",
            type: "bool",
        },
        {
            internalType: "bytes",
            name: "callData",
            type: "bytes",
        },
        {
            internalType: "address",
            name: "callDataTarget",
            type: "address",
        },
        {
            components: [
                {
                    internalType: "bytes",
                    name: "signature",
                    type: "bytes",
                },
                {
                    components: [
                        {
                            components: [
                                {
                                    internalType: "address",
                                    name: "token",
                                    type: "address",
                                },
                                {
                                    internalType: "uint160",
                                    name: "amount",
                                    type: "uint160",
                                },
                                {
                                    internalType: "uint48",
                                    name: "expiration",
                                    type: "uint48",
                                },
                                {
                                    internalType: "uint48",
                                    name: "nonce",
                                    type: "uint48",
                                },
                            ],
                            internalType: "struct IAllowanceTransfer.PermitDetails",
                            name: "details",
                            type: "tuple",
                        },
                        {
                            internalType: "address",
                            name: "spender",
                            type: "address",
                        },
                        {
                            internalType: "uint256",
                            name: "sigDeadline",
                            type: "uint256",
                        },
                    ],
                    internalType: "struct IAllowanceTransfer.PermitSingle",
                    name: "permit",
                    type: "tuple",
                },
            ],
            internalType: "struct AllowanceParams",
            name: "allowanceParams",
            type: "tuple",
        },
        {
            internalType: "bytes32",
            name: "salt",
            type: "bytes32",
        },
    ],
    internalType: "struct Order",
    name: "order",
    type: "tuple",
};

export const orderArrayABI = {
    type: "tuple[]",
    components: orderABI.components,
};

export const orderIdABI = {
    name: "orderId",
    type: "bytes32",
};
