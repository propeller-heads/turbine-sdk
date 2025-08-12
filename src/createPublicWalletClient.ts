import type { Address } from "abitype";

import {
    Transport,
    Chain,
    Account,
    RpcSchema,
    Prettify,
    ClientConfig,
    Client,
    WalletRpcSchema,
    PublicRpcSchema,
    WalletActions,
    PublicActions,
    CreateClientErrorType,
    ParseAccount,
    createClient,
    walletActions,
    publicActions,
} from "viem";
import { ErrorType } from "viem/_types/errors/utils";

export type PublicWalletClientConfig<
    transport extends Transport = Transport,
    chain extends Chain | undefined = Chain | undefined,
    accountOrAddress extends Account | Address | undefined =
        | Account
        | Address
        | undefined,
    rpcSchema extends RpcSchema | undefined = undefined,
> = Prettify<
    Pick<
        ClientConfig<transport, chain, accountOrAddress, rpcSchema>,
        | "account"
        | "cacheTime"
        | "ccipRead"
        | "chain"
        | "key"
        | "name"
        | "pollingInterval"
        | "rpcSchema"
        | "transport"
    >
>;

export type PublicWalletClient<
    transport extends Transport = Transport,
    chain extends Chain | undefined = Chain | undefined,
    account extends Account | undefined = Account | undefined,
    rpcSchema extends RpcSchema | undefined = undefined,
> = Prettify<
    Client<
        transport,
        chain,
        account,
        rpcSchema extends RpcSchema
            ? [...WalletRpcSchema, ...PublicRpcSchema, ...rpcSchema]
            : WalletRpcSchema & PublicRpcSchema,
        WalletActions<chain, account> & PublicActions<transport, chain>
    >
>;

export type CreatePublicWalletClientErrorType = CreateClientErrorType | ErrorType;

/**
 * Creates a Public Wallet Client with a given [Transport](https://viem.sh/docs/clients/intro) configured for a [Chain](https://viem.sh/docs/clients/chains).
 *
 * - Docs:
 *  - https://viem.sh/docs/clients/wallet
 *  - https://viem.sh/docs/clients/public
 *
 * A Public Wallet Client is an interface to interact with [Ethereum Account(s)](https://ethereum.org/en/glossary/#account) and provides the ability to retrieve accounts, execute transactions, sign messages, etc. through [Wallet Actions](https://viem.sh/docs/actions/wallet/introduction).
 *
 *
 * The Public Wallet Client supports signing over:
 * - [JSON-RPC Accounts](https://viem.sh/docs/clients/wallet#json-rpc-accounts) (e.g. Browser Extension Wallets, WalletConnect, etc).
 * - [Local Accounts](https://viem.sh/docs/clients/wallet#local-accounts-private-key-mnemonic-etc) (e.g. private key/mnemonic wallets).
 * Also it is an interface to "public" [JSON-RPC API](https://ethereum.org/en/developers/docs/apis/json-rpc/) methods such as retrieving block numbers, transactions, reading from smart contracts, etc through [Public Actions](/docs/actions/public/introduction).
 *
 * @param config - {@link PublicWalletClientConfig}
 * @returns A Public Wallet Client. {@link PublicWalletClient}
 *
 */
export function createPublicWalletClient<
    transport extends Transport,
    chain extends Chain | undefined = undefined,
    accountOrAddress extends Account | Address | undefined =
        | Account
        | Address
        | undefined,
    rpcSchema extends RpcSchema | undefined = undefined,
>(
    parameters: PublicWalletClientConfig<transport, chain, accountOrAddress, rpcSchema>
): PublicWalletClient<transport, chain, ParseAccount<accountOrAddress>, rpcSchema>;

export function createPublicWalletClient(
    parameters: PublicWalletClientConfig
): PublicWalletClient {
    const {
        key = "publicWallet",
        name = "Public Wallet Client",
        transport,
    } = parameters;
    const client = createClient({
        ...parameters,
        key,
        name,
        transport,
        type: "publicWalletClient",
    });
    return client.extend(walletActions).extend(publicActions) as any;
}
