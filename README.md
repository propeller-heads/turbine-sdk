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

### Contract addresses

| Contract     | Address |
| ------------ | ------- |
| OrderSettler | 0x0C16bE7A4C9cFDe42e37a18aEF32e2b5214cc2BD    |

### Architecture

TODO

### How it works

A simplified workflow goes like this:

-   users and market makers submit their trade orders to Turbine API running in a TEE ([see more on orders](#orders))
-   Turbine determines the market mid-price using multiple oracles and updates limit prices of orders that rely on mid-price delta
-   Turbine matches the orders, finding coincidences of wants, and determines uniform market clearing prices ([see more on matching algorithm](#matching-algorithm))
-   Turbine sends a transaction to the OrderSettler contract on L1 chain
-   the OrderSettler contract executes the settlement transaction and transfers tokens between users and market makers.

### Orders

Orders in Turbine are represented by the `OrderIntent` interface. They contain the following fields:

- `owner`: The address of the user who created the order
- `sellToken`: Address of the token being sold
- `buyToken`: Address of the token being bought
- `sellAmount`: Amount of sell token (in atomic units)
- `minBuyAmount`: Minimum amount of buy token to receive (defines the limit price)
- `midPriceDelta`: Allowed deviation from market mid-price (in basis points)
  - For example, 100 basis points = 1% worse than mid-price
- `startTime`: Unix timestamp when the order becomes valid
- `endTime`: Unix timestamp when the order expires
- `partialFill`: Boolean flag allowing partial fills of the order
- `callData`: Optional call data for smart orders, allowing custom routing
- `callDataTarget`: Target address for the call data
- `salt`: Random value to ensure order uniqueness

### Matching algorithm

TODO

## Submitting orders

> You can submit orders using our frontend: https://swap.propellerheads.xyz/turbine

It is possible to submit orders with the SDK.

### Basic Setup

```typescript
import { TurbineClient } from 'turbine-rust-sdk';
import { createPublicClient, createWalletClient, http } from 'viem';
import { mainnet } from 'viem/chains';

// Create Viem clients
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL)
});

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(RPC_URL)
});

// Create Turbine client with default endpoint
const turbineClient = new TurbineClient();
```

### Creating an Order

```typescript
import { Token } from 'turbine-rust-sdk';
import { getRandomSalt } from 'turbine-rust-sdk';

// Define tokens
const USDC = new Token('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC');
const WETH = new Token('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'WETH');

// Create an order to sell USDC for WETH
const order = {
  sellToken: USDC.address,
  buyToken: WETH.address,
  sellAmount: USDC.toOnchainAmount(100), // Sell 100 USDC
  buyAmount: WETH.toOnchainAmount(0.05), // Buy 0.05 WETH
  midPriceDelta: 500, // At most 5% worse than market mid-price
  startTime: Math.floor(Date.now() / 1000),          // Start now
  endTime: Math.floor(Date.now() / 1000) + 3600,     // End in 1 hour
  partialFill: true,
  callData: '0x',
  callDataTarget: NULL_ADDRESS,
  salt: getRandomSalt()
};
```

### Submitting an Order

```typescript
// Submit the order
const orderId = await turbineClient.addOrder(
  order,
  walletClient,
  publicClient
);

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

Note: This SDK handles the necessary Permit2 approvals for token spending automatically. The orders are signed using your wallet and sent to the Turbine API, which will match and settle them according to the Turbine protocol rules.