import httpx
import os

ENTRYPOINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
PIMLICO_API_KEY = os.getenv("PIMLICO_API_KEY", "")
BUNDLER_URL = f"https://api.pimlico.io/v2/base-sepolia/rpc?apikey={PIMLICO_API_KEY}"


async def send_user_op(user_op: dict) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            BUNDLER_URL,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "eth_sendUserOperation",
                "params": [user_op, ENTRYPOINT_V07],
            },
        )
        resp.raise_for_status()
        result = resp.json()
        if "error" in result:
            raise RuntimeError(f"Bundler error: {result['error']}")
        return result["result"]  # userOpHash


async def get_receipt(user_op_hash: str) -> dict | None:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            BUNDLER_URL,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "eth_getUserOperationReceipt",
                "params": [user_op_hash],
            },
        )
        resp.raise_for_status()
        return resp.json().get("result")


async def estimate_user_op_gas(user_op: dict) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            BUNDLER_URL,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "eth_estimateUserOperationGas",
                "params": [user_op, ENTRYPOINT_V07],
            },
        )
        resp.raise_for_status()
        result = resp.json()
        if "error" in result:
            raise RuntimeError(f"Gas estimation error: {result['error']}")
        return result["result"]
