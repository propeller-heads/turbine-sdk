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
| OrderSettler | 0x0C16bE7A4C9cFDe42e37a18aEF32e2b5214cc2BD |

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

## Submitting orders via the SDK

> [!TIP]
> You can also submit orders using our frontend: <https://swap.propellerheads.xyz/turbine>

### Available environments to submit orders

The available URLs are:

-   **DEV** environment: <http://dev-turbine.propellerheads.xyz/api/>
-   **STAGING** environment in a TEE on DStack: <https://cf57bca965c02d1dbfccc8a4677856765800efab-8080.dstack-prod5.phala.network/>

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
// Submit the order
const orderId = await turbineClient.addOrder(order, walletClient, publicClient);

console.log(`Order submitted with ID: ${orderId}`);
```

### Batch Submitting Orders

```typescript
// Submit multiple orders at once
const orderIds = await turbineClient.addOrders(
    [order1, order2, order3],
    walletClient,
    publicClient
);
```

> [!Note]
> This SDK handles the necessary Permit2 approvals for token spending automatically. The orders are signed using your wallet and sent to the Turbine API, which will match and settle them according to the Turbine protocol rules.
