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

// {
//     components: [
//         {
//             internalType: "bytes",
//             name: "signature",
//             type: "bytes",
//         },
//         {
//             components: [
//                 {
//                     components: [
//                         {
//                             internalType: "address",
//                             name: "token",
//                             type: "address",
//                         },
//                         {
//                             internalType: "uint160",
//                             name: "amount",
//                             type: "uint160",
//                         },
//                         {
//                             internalType: "uint48",
//                             name: "expiration",
//                             type: "uint48",
//                         },
//                         {
//                             internalType: "uint48",
//                             name: "nonce",
//                             type: "uint48",
//                         },
//                     ],
//                     internalType: "struct IAllowanceTransfer.PermitDetails",
//                     name: "details",
//                     type: "tuple",
//                 },
//                 {
//                     internalType: "address",
//                     name: "spender",
//                     type: "address",
//                 },
//                 {
//                     internalType: "uint256",
//                     name: "sigDeadline",
//                     type: "uint256",
//                 },
//             ],
//             internalType: "struct IAllowanceTransfer.PermitSingle",
//             name: "permit",
//             type: "tuple",
//         },
//     ],
//     internalType: "struct AllowanceParams",
//     name: "allowanceParams",
//     type: "tuple",
// },
// {
//     internalType: "bytes32",
//     name: "salt",
//     type: "bytes32",
// }

export const orderArrayABI = {
    type: "tuple[]",
    components: orderIntentABI.components,
};

export const orderIdABI = {
    name: "orderId",
    type: "bytes32",
};
