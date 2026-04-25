import httpx
import os

ONEINCH_API_KEY = os.getenv("ONEINCH_API_KEY", "")
BASE_URL = "https://api.1inch.dev/swap/v6.0/84532"  # Base Sepolia chain ID


async def get_quote(token_in: str, token_out: str, amount: int) -> dict:
    headers = {"Authorization": f"Bearer {ONEINCH_API_KEY}"}
    params = {"src": token_in, "dst": token_out, "amount": str(amount)}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{BASE_URL}/quote", headers=headers, params=params)
        resp.raise_for_status()
        return resp.json()


async def get_swap_calldata(
    token_in: str,
    token_out: str,
    amount: int,
    from_address: str,
    slippage: float = 1.0,
) -> dict:
    headers = {"Authorization": f"Bearer {ONEINCH_API_KEY}"}
    params = {
        "src": token_in,
        "dst": token_out,
        "amount": str(amount),
        "from": from_address,
        "slippage": str(slippage),
        "disableEstimate": "true",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{BASE_URL}/swap", headers=headers, params=params)
        resp.raise_for_status()
        return resp.json()
