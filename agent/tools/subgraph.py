import httpx
import os


SUBGRAPH_URL = os.getenv("SUBGRAPH_URL", "https://api.studio.thegraph.com/query/sentinel")

PORTFOLIO_QUERY = """
query GetPortfolio($account: String!) {
  actions(where: { tokenOut: $account }, orderBy: timestamp, orderDirection: desc, first: 20) {
    id
    tokenIn
    tokenOut
    amountIn
    amountOut
    reasoningCID
    timestamp
  }
}
"""


async def get_portfolio_state(account: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            SUBGRAPH_URL,
            json={"query": PORTFOLIO_QUERY, "variables": {"account": account}},
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("data", {})
