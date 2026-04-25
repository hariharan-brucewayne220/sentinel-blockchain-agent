import os
from web3 import Web3

RPC_URL = os.getenv("BASE_SEPOLIA_RPC", "")

AGGREGATOR_ABI = [
    {
        "inputs": [],
        "name": "latestRoundData",
        "outputs": [
            {"name": "roundId", "type": "uint80"},
            {"name": "answer", "type": "int256"},
            {"name": "startedAt", "type": "uint256"},
            {"name": "updatedAt", "type": "uint256"},
            {"name": "answeredInRound", "type": "uint80"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function",
    },
]

# Base Sepolia Chainlink feeds
PRICE_FEEDS: dict[str, str] = {
    "ETH": "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1",
    "BTC": "0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298",
}


def get_price_usd(symbol: str) -> float | None:
    feed_address = PRICE_FEEDS.get(symbol.upper())
    if not feed_address or not RPC_URL:
        return None
    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    contract = w3.eth.contract(address=Web3.to_checksum_address(feed_address), abi=AGGREGATOR_ABI)
    _, answer, _, updated_at, _ = contract.functions.latestRoundData().call()
    decimals = contract.functions.decimals().call()
    return answer / (10 ** decimals)


def get_chainlink_prices(tokens: list[str]) -> dict[str, float]:
    return {t: p for t in tokens if (p := get_price_usd(t)) is not None}
