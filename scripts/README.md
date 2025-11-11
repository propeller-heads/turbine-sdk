# Turbine Scripts

This directory contains scripts for interacting with the Turbine protocol.

## Prerequisites

1. **Private Key**: You need a private key for the account that will submit the orders
2. **Token Balances**: The account must have sufficient balances of the tokens being sold
3. **Permit2 Approvals**: The account must have approved the Permit2 contract to spend the tokens

## Environment Variables

Set the following environment variables before running the script:

```bash
# Required: Your private key (with 0x prefix)
export PRIVATE_KEY="your_private_key_here"

# Optional: Turbine API URL (defaults to http://0.0.0.0:8080/api)
export TURBINE_API_URL="https://your-turbine-api.com/api"

# Optional: RPC URL for Ethereum mainnet (uses default if not set)
export RPC_URL="https://your-rpc-endpoint.com"
```

## Usage

### Submit Orders

Run the script using npm/yarn:

```bash
# Using npm
npm run submit-orders

# Using yarn
yarn submit-orders

# Or directly with ts-node
npx ts-node scripts/submit-orders.ts
```

#### What the Script Does

The script submits two orders to Turbine:

1. **Order 1**: Sell USDC for WETH
2. **Order 2**: Sell WETH for USDC

Check the code for the exact amounts.

Both orders are configured as:

-   Market orders (no minimum buy amount)
-   25% mid-price delta
-   Valid for 5 minutes

### Add Liquidity

Run the script:

```bash
# Using yarn
yarn add-liquidity
```

#### What the Script Does

The script adds liquidity to the Turbine pool.

1. **Adds 10 USDC and 0.004 WETH ≈ $10** to the USDC/WETH pool with 0.3% fee.

Check the code to update the amounts.

The script will print the liquidity addition details and the intent hash.

### Remove Liquidity (API)

```bash
yarn remove-liquidity
```

This script submits a remove-liquidity intent through the Turbine API. It burns 1 LP token (configurable in the script) from the same USDC/WETH 0.3% pool and prints the resulting intent hash that will later be settled by the backend.

### Remove Liquidity On-Chain

```bash
yarn remove-liquidity-onchain
```

This script signs the removal intent and immediately submits it to the `TurbineLiquidityRouter` smart contract. Update the LP token amount in the script before running it. The script prints the transaction hash once the intent is queued on-chain.

### Execute Pending On-Chain Intents

```bash
yarn execute-pending-onchain-intents 0xIntentHash1 0xIntentHash2
```

Provide one or more intent hashes as arguments. The script authenticates, connects to the router, and calls `executePendingIntents` to process the queued remove-liquidity intents directly on-chain, exiting once the transaction is confirmed.
