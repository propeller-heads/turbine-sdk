# Turbine Scripts

This directory contains scripts for interacting with the Turbine protocol.

> [!Warning]
> Please read and understand the script before running it. Running a script may incur costs.

> [!Warning]
> These scripts are not meant to be used in production. They are for demonstration purposes only.

## Prerequisites

1. **Private Key Authentication**: You need a private key for the account that will interact with Turbine
2. **Token Balances**: The account must have sufficient balances of the tokens being used
3. **Permit2 Approvals**: The account must have approved the Permit2 contract to spend the tokens

## Authentication Setup

### Recommended: Encrypted Keystore (Secure)

For local development, use an encrypted keystore file to securely store your private key:

1. **Create a keystore** (for new users):
   ```bash
   yarn create-keystore
   ```
   Follow the prompts to:
   - Enter your private key (input will be masked)
   - Choose a strong password (12+ characters recommended)
   - Confirm the password
   - Choose a filename (default: `default.json`)

2. **Or migrate from environment variable**:
   ```bash
   yarn migrate-env-to-keystore
   ```
   This will help you transition from `PRIVATE_KEY` env var to an encrypted keystore.

**Security Benefits:**
- 🔐 Private key encrypted with scrypt
- 🚫 No plaintext keys in environment variables or shell history
- 🔒 File permissions set to owner-only (0600)
- ✅ Compatible with standard Ethereum keystore format

**After setup**, all scripts will automatically:
- Detect keystores in `scripts/.keystores/`
- Prompt for your password when needed
- Use the decrypted key only during signing operations

### Alternative: Environment Variable (CI/Automation Only)

⚠️ **WARNING**: Only use environment variables in CI/CD pipelines with proper secret management systems (GitHub Secrets, AWS Secrets Manager, HashiCorp Vault, etc.). **Never** use environment variables for local development or commit `.env` files to version control.

```bash
# For CI/automation only - Not recommended for local development
export PRIVATE_KEY="your_private_key_here"
```

Scripts will fall back to `PRIVATE_KEY` environment variable if no keystore is found.

## Environment Variables

Optional environment variables for all scripts:

```bash
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

### Approve Token

**Command:** `yarn approve-token <tokenAddress> [tokenAddress2] ... [-y]`

**Interactive:** Yes (prompts for confirmation unless `-y` is passed)

Grants infinite approval to the Permit2 contract to spend one or more tokens. Provide token addresses as arguments. The script will check the current allowance for each token and skip those that already have infinite approval. It prompts for confirmation before submitting any transactions unless the `-y` flag is passed.

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
