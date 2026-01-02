# Turbine Scripts

This directory contains scripts for interacting with the Turbine protocol.

> [!Warning]
> Please read and understand the script before running it. Running a script may incur costs.

> [!Warning]
> These scripts are not meant to be used in production. They are for demonstration purposes only.

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

## Available scripts

### Submit Orders

**Command:** `yarn submit-orders`

Submits two market orders to Turbine: sells 50 USDC for WETH and 0.02 WETH for USDC. Both orders have a 5% mid-price delta and are valid for 5 minutes.

### Add Liquidity

**Command:** `yarn add-liquidity`

**Interactive:** Yes (prompts for confirmation)

Adds 10 USDC and 0.004 WETH (≈ $10) to the USDC/WETH pool with 0.3% fee. Prints the liquidity addition details and intent hash.

### Remove Liquidity

**Command:** `yarn remove-liquidity`

Submits a remove-liquidity intent through the Turbine API. Burns 20% of the account's LP token balance from the USDC/WETH 0.3% pool. Prints the intent hash that will be settled by the backend. Requires manual update of the LP token address in the script.

### Remove Liquidity On-Chain

**Command:** `yarn remove-liquidity-onchain`

Submits a remove-liquidity intent directly to the `TurbineLiquidityRouter` smart contract on-chain. Burns 20% of the account's LP token balance from the USDC/WETH 0.3% pool. Prints the transaction hash once the intent is queued. Requires manual update of the LP token address in the script.

### Execute Pending On-Chain Intents

**Command:** `yarn execute-pending-onchain-intents <intentHash1> [intentHash2] ...`

Executes one or more pending remove-liquidity intents that were previously queued on-chain. Provide intent hashes as arguments. The script triggers intents execution and exits once the transaction is confirmed.

### Approve LP Token

**Command:** `yarn approve-lp-token`

**Interactive:** Yes (prompts to select a pool)

Grants infinite approval to the Permit2 contract to spend LP tokens from a selected pool. Displays the first 10 registered pools and prompts you to select one interactively.

### Create Pool

**Command:** `yarn create-pool`

Creates a new USDC/WETH pool with a 0.3% fee. Prints the transaction hash once the pool is initialized on-chain.

### List Pools

**Command:** `yarn list-pools`

Lists all registered pools with their token pairs, fees, LP token addresses, and current reserves.

### Get Order States

**Command:** `yarn get-order-states <orderHash1> [orderHash2] ...`

Polls and displays the current state of one or more orders. Provide order hashes as arguments. The script continuously polls every 12 seconds until all orders reach a final state (not Active or PendingCancellation).

### Get Permit2 Nonce

**Command:** `yarn get-permit2-nonce <owner> <token> <spender>`

Retrieves the current Permit2 nonce for a given owner, token, and spender combination. Provide three addresses as arguments: owner address, token address, and spender address.
