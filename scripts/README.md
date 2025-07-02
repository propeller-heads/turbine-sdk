# Turbine Order Submission Script

This script demonstrates how to use the TurbineClient to submit orders to the Turbine protocol.

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

Run the script using npm/yarn:

```bash
# Using npm
npm run submit-orders

# Using yarn
yarn submit-orders

# Or directly with ts-node
npx ts-node scripts/submit-orders.ts
```

## What the Script Does

The script submits two orders to Turbine:

1. **Order 1**: Sell USDC for WETH
2. **Order 2**: Sell WETH for USDC

Check the code for the exact amounts.

Both orders are configured as:

-   Market orders (no minimum buy amount)
-   25% mid-price delta
-   Valid for 5 minutes
