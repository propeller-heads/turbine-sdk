# Turbine SDK

Turbine is a protocol that lets users swap tokens without revealing their intention to do so.  
Read the docs at https://docs.propellerheads.xyz/turbine.

This SDK helps you interact with Turbine.

## Table of Contents
- [Installation](#installation)
- [Basic setup](#basic-setup)
- [Swapping tokens](#swapping-tokens)
    - [Submitting orders](#submitting-orders)
    - [Checking order state](#checking-order-state)
    - [Cancelling an Order](#cancelling-an-order)
- [Liquidity management](#liquidity-management)
    - [Adding liquidity to a Turbine pool](#adding-liquidity-to-a-turbine-pool)
    - [Removing liquidity from a Turbine pool](#removing-liquidity-from-a-turbine-pool)
    - [Checking liquidity intent state](#checking-liquidity-intent-state)
- [Example scripts](#example-scripts)


## Installation

Make sure you have [Node.js](https://nodejs.org/en/download/package-manager) and [Yarn](https://yarnpkg.com/getting-started/install) installed.

Install dependencies with:

```bash
yarn
```

## Basic setup

The main entry point is the `TurbineClient` class.

Here's how to instantiate it. This example requires a private key and an RPC URL.

> [!Note]
> The available API URLs are:
>
> -   `dev` environment: <https://dev-api.turbine.exchange/api>
> -   `staging` environment in a TEE on DStack: <https://staging-api.turbine.exchange/api>

```typescript
import { TurbineClient } from "turbine-sdk/turbineClient";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

// Create Viem clients
const account = privateKeyToAccount(PRIVATE_KEY);
const walletClient = createWalletClient({
    account: account,
    chain: mainnet,
    transport: http(RPC_URL),
});
const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(RPC_URL),
});

// Create Turbine client.
// It uses the URL from TURBINE_API_URL environment variable by default.
// You can also manually specify the URL as a third argument.
const turbineClient = await TurbineClient.create(walletClient, publicClient);
```

## Swapping tokens

### Submitting orders

> [!Important]
> **You need to allow Permit2 contract to spend your sell token!** You can do this by running the `yarn approve-token <tokenAddress>` script.

> [!Note]
> When placing orders, SDK automatically adds necessary Permit2 approvals. If you're using a `walletClient` with a private key, these approvals are signed automatically without asking for confirmation.

> [!Note]
> For the alpha version Turbine has a limit of 60 active orders per `owner`.

> [!TIP]
> You can also submit orders using our frontend: <https://app.turbine.exchange/>

#### Orders

Orders in Turbine are represented by the `OrderIntent` interface. They contain the following fields:

-   `owner`: The address of the user who is selling the tokens
-   `sellToken`: Address of the token being sold
-   `buyToken`: Address of the token being bought
-   `sellAmount`: Amount of sell token (in atomic units)
-   `minBuyAmount`: Minimum amount of buy token to receive (defines the limit price)
-   `midPriceDelta`: Allowed deviation from market mid-price (in basis points)
    -   For example, 100 basis points = 1% worse than mid-price
-   `startTime`: Unix timestamp when the order becomes valid
    -   Note: only immediately valid orders are supported for now.
-   `endTime`: Unix timestamp when the order expires
-   `partialFill`: Boolean flag allowing partial fills of the order.
    -   Note: only partially fillable orders are supported for now.
-   `callData`: Optional call data for smart orders, allowing custom routing (see #smart-orders below)
-   `callDataTarget`: Target address for the call data
-   `salt`: Random value to ensure order uniqueness

#### Smart Orders

Smart orders allow using a third party smart contract to route the order.

Smart orders are executed by calling a function encoded in `callData` on the `callDataTarget` contract.

Smart orders were intented to be used by market makers. If you are a market maker and want to use Turbine with your own router contract, please reach out to Propeller Heads.

Smart orders will be deprecated soon. Market makers are encouraged to submit their quotes as regular orders.

#### Creating an Order

```typescript
import { NULL_ADDRESS, USDC, WETH } from "turbine-sdk/constants";
import { OrderIntent } from "turbine-sdk/models";
import { getRandomSalt } from "turbine-sdk/turbineClient";

// Create an order to sell USDC for WETH
const order: OrderIntent = {
    owner: account.address,
    sellToken: USDC.address,
    buyToken: WETH.address,
    sellAmount: USDC.toOnchainAmount("100"), // Sell 100 USDC
    minBuyAmount: WETH.toOnchainAmount("0.05"), // Buy 0.05 WETH
    midPriceDelta: 500, // At most 5% worse than market mid-price
    startTime: Math.floor(Date.now() / 1000), // Start now
    endTime: Math.floor(Date.now() / 1000) + 3600, // End in 1 hour
    partialFill: true,
    callData: "0x",
    callDataTarget: NULL_ADDRESS,
    salt: getRandomSalt(),
};
```

#### Submitting an Order

```typescript
const orderHash = await turbineClient.addOrder(order);
console.log(`Order submitted with ID: ${orderHash}`);
```

Expect Turbine to execute your order after some time (if it can be executed at current market conditions).

#### Batch Submitting Orders

```typescript
const orderHashes = await turbineClient.addOrders([order1, order2, order3]);
```

### Checking order state

```typescript
const orderStates = await turbineClient.getOrderStates([
    orderHash1,
    orderHash2,
    orderHash3,
]);
console.log(orderStates);
```

### Cancelling an Order

```typescript
await turbineClient.cancelOrder(orderHash);
```

Please note that order cancellation is subject to speedbump (see Turbine docs). An order will not be cancelled immediately, but after a short delay.

## Liquidity management

> [!TIP]
> You can also submit liquidity intents using our frontend: <https://app.turbine.exchange/>

### Adding liquidity to a Turbine pool

#### Creating an intent to add liquidity

```typescript
import { AddLiquidityIntent } from "turbine-sdk/models";
import { getRandomSalt } from "turbine-sdk/turbineClient";
import { USDC, WETH } from "turbine-sdk/constants";

// Create an intent to provide 3000 USDC and 1 WETH
// to the USDC/WETH Turbine pool at 0.3% fee tier
const intent: AddLiquidityIntent = {
    owner: account.address,
    token0: USDC.address,
    token1: WETH.address,
    fee: 3000, // 0.3%
    token0Amount: USDC.toOnchainAmount("3000"),
    token1Amount: WETH.toOnchainAmount("1"),
    exact: true,
    salt: getRandomSalt(),
};
```

#### Submitting an intent to add liquidity

```typescript
const intentHash = await turbineClient.addLiquidity(intent);
console.log(`Liquidity intent submitted with ID: ${intentHash}`);
```

Expect Turbine to take your tokens, add them to the pool, and mint you LP tokens.

### Removing liquidity from a Turbine pool

#### Creating an intent to remove liquidity

You need to know the LP token address of the pool you want to remove liquidity from. You have received this token when you provided liquidity to the pool.

You can get LP token's address by calling `getPools` method and inspecting the result:

```typescript
const pools = await turbineClient.getPools();
console.log(pools);
```

...or you can use the `list-pools` script, which will print the list of pools with their LP token addresses:

```bash
yarn list-pools
```

Now you can create an intent to remove liquidity:

```typescript
import { RemoveLiquidityIntent } from "turbine-sdk/models";
import { getRandomSalt } from "turbine-sdk/turbineClient";
import { USDC, WETH } from "turbine-sdk/constants";

// Create an intent to burn 10_000 LP tokens from the USDC/WETH Turbine pool
const intent: RemoveLiquidityIntent = {
    owner: account.address,
    token0: USDC.address,
    token1: WETH.address,
    fee: 3000, // 0.3%
    lpToken: "0x24746c26c7b83ddabbaf384e02c3eb0e7b8cd307",
    lpTokenAmount: 10_000,
    salt: getRandomSalt(),
};
```

#### Submitting an intent to remove liquidity via API

```typescript
const intentHash = await turbineClient.removeLiquidity(intent);
console.log(`Liquidity intent submitted with ID: ${intentHash}`);
```

Expect Turbine to burn your LP tokens, and send you a share of the pool's liquidity.

#### Submitting an intent to remove liquidity on-chain

In case Turbine goes offline, you can submit an intent to remove liquidity directly on-chain.

```typescript
const intentHash = await turbineClient.submitRemoveLiquidityIntentOnchain(intent);
console.log(`Liquidity intent submitted with ID: ${intentHash}`);
```

This will submit a transaction to the `TurbineLiquidityRouter` contract. Now your intent needs to wait a bit to pass a speedbump, and then you can execute it.

#### Executing pending intents on-chain

```typescript
const intentHash = await turbineClient.executePendingRemoveLiquidityIntentsOnchain([
    intentHash,
]);
```

This will submit a transaction to the `TurbineLiquidityRouter` contract to execute your intent. Expect your LP tokens to be burned and your share of the pool's liquidity to be sent to you.

### Checking liquidity intent state

```typescript
const intentStates = await turbineClient.getLiquidityIntents([
    intentHash1,
    intentHash2,
    intentHash3,
]);
console.log(intentStates);
```

This will return the state of the liquidity intents submitted via API. It won't list the intents submitted on-chain.

## Example scripts

This repository contains example scripts that demonstrate common actions on Turbine.

The scripts are located in the `scripts` directory.

See the [scripts README](scripts/README.md) for more details.
