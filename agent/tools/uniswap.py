"""Build Uniswap V3 exactInputSingle swap calldata for Base Sepolia."""
from web3 import Web3
from eth_abi import encode

# MockDex on Base Sepolia (testnet — no real liquidity needed)
UNISWAP_V3_ROUTER = "0x992e95FaDe5959a51a120b4e490653CC2198a936"

# exactInputSingle function selector
SELECTOR = bytes.fromhex("04e45aaf")


def get_swap_calldata(
    token_in: str,
    token_out: str,
    amount_in: int,
    recipient: str,
    fee: int = 3000,
) -> tuple[str, str]:
    """Return (router_address, calldata_hex) for a Uniswap V3 exactInputSingle swap."""
    params = (
        Web3.to_checksum_address(token_in),
        Web3.to_checksum_address(token_out),
        fee,
        Web3.to_checksum_address(recipient),
        amount_in,
        0,   # amountOutMinimum — 0 for testnet (no slippage protection)
        0,   # sqrtPriceLimitX96 — 0 = no limit
    )
    encoded = encode(
        ["(address,address,uint24,address,uint256,uint256,uint160)"],
        [params],
    )
    calldata = "0x" + SELECTOR.hex() + encoded.hex()
    return UNISWAP_V3_ROUTER, calldata
