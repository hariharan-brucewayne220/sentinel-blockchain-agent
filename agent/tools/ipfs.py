import httpx
import json
import os

PINATA_JWT = os.getenv("PINATA_JWT", "")
PINATA_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS"


async def pin_json(data: dict) -> str:
    headers = {
        "Authorization": f"Bearer {PINATA_JWT}",
        "Content-Type": "application/json",
    }
    payload = {
        "pinataContent": data,
        "pinataMetadata": {"name": f"sentinel-reasoning-{data.get('agent_run_id', 'unknown')}"},
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(PINATA_URL, headers=headers, json=payload)
        resp.raise_for_status()
        return resp.json()["IpfsHash"]


async def fetch_json(cid: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"https://gateway.pinata.cloud/ipfs/{cid}")
        resp.raise_for_status()
        return resp.json()
