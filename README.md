# Turbine SDK

Turbine is a protocol that lets users swap tokens without revealing their intention to do so.

The Turbine protocol is described in more detail [in a section below](#the-turbine-protocol).

This SDK helps you with submitting orders to Turbine.

## Installation

Make sure you have [Node.js](https://nodejs.org/en/download/package-manager) and [Yarn](https://yarnpkg.com/getting-started/install) installed.

Install dependencies with:

```bash
yarn
```

## The Turbine protocol

A market that is private and protected from extraction – where anyone can trade large orders with peace of mind.

-   **Secure**: Utilizing TEEs and advanced privacy techniques

-   **Private**: Pre-settlement privacy for all trades

-   **Darkpool**: A trading venue where order information is not publicly displayed

-   **Passive Liquidity**: Liquidity providers provide passive liquidity

-   **Low market impact**: Minimizing price slippage and front-running risks

### Advantages for Market Makers

Market makers benefit from Turbine in several ways:

-   **Reduced adverse selection**: Without order visibility, predatory trading strategies cannot target your orders
-   **Lower hedging costs**: The TEE-protected environment prevents front-running, reducing the cost of managing inventory
-   **Diverse counterparties**: Access to a pool of users specifically looking for trading large volumes and privacy-preserving execution
-   **Simplified integration**: Submit orders through an intuitive API with flexible parameters

### How it works

A simplified workflow goes like this:

1. **Order submission**: Users and market makers submit signed orders through the API ([see more on orders](#orders))
2. **Secure storage**: Orders are securely stored in the TEE, invisible to outside observers
3. **Price discovery**: The system determines current market prices via multiple oracles and updates limit prices of orders that rely on mid-price delta
4. **Matching engine**: Turbine matches orders, finding coincidences of wants, and determines uniform market clearing prices
5. **Settlement preparation**: Turbine prepares the settlement transaction with matched orders
6. **On-chain settlement**: The OrderSettler contract executes the settlement, transferring tokens between participants

### Contract addresses

| Contract     | Address                                    |
| ------------ | ------------------------------------------ |
| OrderSettler | 0x7B39F073d2f2511a5e1ff664AeC5daee02044967 |

### Orders

Orders in Turbine are represented by the `OrderIntent` interface. They contain the following fields:

-   `owner`: The address of the user who created the order
-   `sellToken`: Address of the token being sold
-   `buyToken`: Address of the token being bought
-   `sellAmount`: Amount of sell token (in atomic units)
-   `minBuyAmount`: Minimum amount of buy token to receive (defines the limit price)
-   `midPriceDelta`: Allowed deviation from market mid-price (in basis points)
    -   For example, 100 basis points = 1% worse than mid-price
-   `startTime`: Unix timestamp when the order becomes valid
-   `endTime`: Unix timestamp when the order expires
-   `partialFill`: Boolean flag allowing partial fills of the order
-   `callData`: Optional call data for smart orders, allowing custom routing
-   `callDataTarget`: Target address for the call data
-   `salt`: Random value to ensure order uniqueness

The `callData` can be used to route the order to a specific contract or to perform additional actions when executing the swap. The `callDataTarget` is the address of the contract that will execute the `callData`.

When settling the batch, the `OrderSettler` first transfers the `buyToken` to the `callDataTarget`, then executes the `callData` from the `callDataTarget` contract, which should transfer the `sellToken` to the `OrderSettler` contract.

In case of partial fills, the `OrderSettler` will update the `sellAmount` in the `callData` before executing it. The function encoded in `callData` should be able to handle this and transfer the correct amount of `sellToken` to the `OrderSettler`, in the same ratio as the amounts specified in the `OrderIntent`. Please reach out to us to tell us the offset of the `sellAmount` in the `callData` if you want to use this feature.

## Submitting orders via the SDK

> [!TIP]
> You can also submit orders using our frontend: <https://swap.propellerheads.xyz/turbine>

> [!Note]
> For this alpha version Turbine has a limit of 60 active orders per `owner`.

### Available environments to submit orders

The available URLs are:

-   **DEV** environment: <http://dev-turbine.propellerheads.xyz/api>
-   **STAGING** environment in a TEE on DStack: <https://cf57bca965c02d1dbfccc8a4677856765800efab-8080.dstack-prod5.phala.network>

> [!WARNING]
> The URL of the STAGING environment is subject to change.

The `TurbineClient` gets the default URL from environment variables.

```bash
export TURBINE_API_URL=...
```

### Basic Setup

```typescript
import { TurbineClient } from "turbine-sdk/turbineClient";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

// Create Viem clients
const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(RPC_URL),
});

const walletClient = createWalletClient({
    account: privateKeyToAccount(PRIVATE_KEY),
    chain: mainnet,
    transport: http(RPC_URL),
});

// Create Turbine client that uses the URL from TURBINE_API_URL environment variable by default.
// You can also manually specify the URL: new TurbineClient("https://...")
const turbineClient = new TurbineClient();
```

### Creating an Order

```typescript
import { Token, OrderIntent } from "turbine-sdk/models";
import { getRandomSalt } from "turbine-sdk/turbineClient";

// Define tokens
const USDC = new Token("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", 6, "USDC");
const WETH = new Token("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 18, "WETH");

// Create an order to sell USDC for WETH
const order: OrderIntent = {
    owner: walletClient.account.address,
    sellToken: USDC.address,
    buyToken: WETH.address,
    sellAmount: USDC.toOnchainAmount(100), // Sell 100 USDC
    minBuyAmount: WETH.toOnchainAmount(0.05), // Buy 0.05 WETH
    midPriceDelta: 500, // At most 5% worse than market mid-price
    startTime: Math.floor(Date.now() / 1000), // Start now
    endTime: Math.floor(Date.now() / 1000) + 3600, // End in 1 hour
    partialFill: true,
    callData: "0x",
    callDataTarget: NULL_ADDRESS,
    salt: getRandomSalt(),
};
```

### Submitting an Order

```typescript
const orderHash = await turbineClient.addOrder(order, walletClient, publicClient);
console.log(`Order submitted with ID: ${orderHash}`);
```

### Batch Submitting Orders

```typescript
const orderHashes = await turbineClient.addOrders(
    [order1, order2, order3],
    walletClient,
    publicClient
);
```

### Cancelling an Order

```typescript
const orderHash = await turbineClient.cancelOrder(order, walletClient);
console.log(`Order cancelled with ID: ${orderHash}`);
```

> [!Note]
> Turbine requires infinite approvals and this SDK handles the necessary infinite Permit2 approvals for token spending automatically. The orders are signed using your wallet and sent to the Turbine API, which will match and settle them according to the Turbine protocol rules.

## Add liquidity to a Turbine pool via the SDK

TODO: Add details about Turbine Liquidity provisioning

### Creating an intent to add liquidity

```typescript
import { Token, AddLiquidityIntent } from "turbine-sdk/models";
import { getRandomSalt } from "turbine-sdk/turbineClient";

// Define tokens
const USDC = new Token("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", 6, "USDC");
const WETH = new Token("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 18, "WETH");

// Create an intent to provide 3000 USDC and 1 WETH to the USDC/WETH Turbine pool
const intent: AddLiquidityIntent = {
    owner: walletClient.account.address,
    token0: USDC.address,
    token1: WETH.address,
    fee: 3000,
    maxToken0: USDC.toOnchainAmount(3000),
    maxToken1: WETH.toOnchainAmount(1),
    salt: getRandomSalt(),
};
```

### Submitting an intent to add liquidity

```typescript
const intentHash = await turbineClient.addLiquidity(intent, walletClient, publicClient);
console.log(`Liquidity intent submitted with ID: ${intentHash}`);
```

## Remove liquidity from a Turbine pool via the SDK

### Creating an intent to remove liquidity

```typescript
import { Token, RemoveLiquidityIntent } from "turbine-sdk/models";
import { getRandomSalt } from "turbine-sdk/turbineClient";

// Define tokens
const USDC = new Token("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", 6, "USDC");
const WETH = new Token("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 18, "WETH");

// Create an intent to burn 10_000 LP tokens from the USDC/WETH Turbine pool
const intent: RemoveLiquidityIntent = {
    owner: walletClient.account.address,
    token0: USDC.address,
    token1: WETH.address,
    fee: 3000,
    lpToken: "0x8893eFd5338C5159D43678A07F4796713fBD491B",
    lpTokenAmount: 10_000,
    salt: getRandomSalt(),
};
```

### Submitting an intent to remove liquidity

```typescript
const intentHash = await turbineClient.removeLiquidity(
    intent,
    walletClient,
    publicClient
);
console.log(`Liquidity intent submitted with ID: ${intentHash}`);
```
