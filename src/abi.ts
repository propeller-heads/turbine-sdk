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
        // {
        //     name: "maxGas",
        //     type: "uint32",
        // },
        {
            name: "midPriceDelta",
            type: "int32",
        },
        // {
        //     name: "endMidPriceDelta",
        //     type: "uint32",
        // },
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
        // {
        //     name: "callData",
        //     type: "bytes",
        // },
        // {
        //     name: "callDataTarget",
        //     type: "address",
        // },
        {
            name: "salt",
            type: "bytes32",
        },
    ],
    name: "order",
    type: "tuple",
};
