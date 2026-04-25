"""Read live ERC-20 and ETH balances of the SentinelAccount from Base Sepolia."""
import os
from web3 import Web3

RPC_URL = os.getenv("BASE_SEPOLIA_RPC", "https://sepolia.base.org")

# Base Sepolia token addresses
TOKENS = {
    "USDC": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "WETH": "0x4200000000000000000000000000000000000006",
}

ERC20_ABI = [
    {"name": "balanceOf", "type": "function", "inputs": [{"name": "account", "type": "address"}], "outputs": [{"type": "uint256"}], "stateMutability": "view"},
    {"name": "decimals",  "type": "function", "inputs": [], "outputs": [{"type": "uint8"}], "stateMutability": "view"},
]


def get_token_balances(account: str) -> dict[str, float]:
    """Return {symbol: human_readable_amount} for ETH + known ERC-20s."""
    if not account:
        return {}

    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    balances: dict[str, float] = {}

    try:
        eth_wei = w3.eth.get_balance(Web3.to_checksum_address(account))
        balances["ETH"] = eth_wei / 1e18
    except Exception:
        pass

    for symbol, addr in TOKENS.items():
        try:
            contract = w3.eth.contract(address=Web3.to_checksum_address(addr), abi=ERC20_ABI)
            raw = contract.functions.balanceOf(Web3.to_checksum_address(account)).call()
            decimals = contract.functions.decimals().call()
            balances[symbol] = raw / (10 ** decimals)
        except Exception:
            pass

    return {k: v for k, v in balances.items() if v > 0}
