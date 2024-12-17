import Web3, { BlockHeaderOutput } from "web3";
import { W3_WEBSOCKET } from "./config";

function connectToWeb3(websocket_url: string): Web3 {
    const web3 = new Web3(new Web3.providers.WebsocketProvider(websocket_url));
    web3.eth.net
        .isListening()
        .then(() => console.log("web3 is connected"))
        .catch((e) => console.log("Something went wrong when connecting to web3."));
    return web3;
}

/**
 * Run a function when a new block is mined.
 *
 * If no new blocks appear for 1 minute, throws an error.
 *
 * @param handleNewBlock Function to invoke on a new block.
 * Should accept one parameter of web3.BlockHeaderOutput type.
 */
export async function onEachBlock(
    handleNewBlock: (blockHeader: BlockHeaderOutput) => void
) {
    if (!W3_WEBSOCKET) {
        throw new Error(
            "W3_WEBSOCKET env var must be set. It should be a URL of form 'wss://...'."
        );
    }
    const web3 = connectToWeb3(W3_WEBSOCKET);
    try {
        const subscription = await web3.eth.subscribe("newBlockHeaders");
        subscription.on("connected", handleConnected);

        let lastBlockTime = Date.now();

        const checkInterval = setInterval(() => {
            if (Date.now() - lastBlockTime > 60_000) {
                clearInterval(checkInterval);
                throw new Error("No new blocks received for 1 minute");
            }
        }, 10_000);

        subscription.on("data", (blockHeader) => {
            lastBlockTime = Date.now();
            handleNewBlock(blockHeader);
        });

        subscription.on("error", (error) => {
            clearInterval(checkInterval);
            handleError(error);
        });
    } catch (error) {
        console.error(`Error subscribing to new blocks: ${error}`);
    }
}

function handleConnected(subscriptionId: string) {
    console.log(`New subscription: ${subscriptionId}`);
}

function handleError(error: Error) {
    throw error;
}
