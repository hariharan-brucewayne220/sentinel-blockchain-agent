"""Researcher node — gathers market context: prices, portfolio state, news sentiment."""
import os
from openai import AsyncOpenAI
from agent.schemas import AgentState, MarketContext
from agent.tools.chainlink import get_chainlink_prices
from agent.tools.subgraph import get_portfolio_state

ACCOUNT_ADDRESS = os.getenv("SENTINEL_ACCOUNT_ADDRESS", "")

_client: AsyncOpenAI | None = None

def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI()
    return _client

RAG_SYSTEM = """You are a financial data analyst. Given raw market prices and portfolio data,
produce a brief sentiment score (-1 to 1) and a one-sentence market summary. Return JSON:
{"sentiment_score": float, "summary": str}"""


async def researcher_node(state: AgentState) -> AgentState:
    prices = get_chainlink_prices(["ETH", "BTC"])

    portfolio = {}
    if ACCOUNT_ADDRESS:
        try:
            portfolio = await get_portfolio_state(ACCOUNT_ADDRESS)
        except Exception:
            portfolio = {}

    # Lightweight RAG sentiment: ask gpt-4o for a quick market read
    sentiment_score = 0.0
    retrieved_docs: list = []
    try:
        resp = await _get_client().chat.completions.create(
            model="gpt-4o",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": RAG_SYSTEM},
                {
                    "role": "user",
                    "content": f"Prices: {prices}. Portfolio actions: {list(portfolio.keys())}. "
                    "What is the current market sentiment?",
                },
            ],
            max_tokens=200,
        )
        import json
        result = json.loads(resp.choices[0].message.content)
        sentiment_score = float(result.get("sentiment_score", 0.0))
        retrieved_docs = [{"source": "gpt-4o-synthesis", "summary": result.get("summary", "")}]
    except Exception:
        pass

    portfolio_value_usd = sum(
        prices.get(token.upper(), 0) * amount
        for token, amount in (portfolio.get("holdings") or {}).items()
    )

    return state.model_copy(
        update={
            "market_context": MarketContext(
                prices=prices,
                holdings=portfolio.get("holdings") or {},
                sentiment_score=sentiment_score,
                retrieved_docs=retrieved_docs,
                portfolio_value_usd=portfolio_value_usd,
            )
        }
    )
