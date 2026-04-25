"""Strategist node — proposes a swap action or NO_ACTION using gpt-4o + 1inch quotes."""
import json
from openai import AsyncOpenAI
from agent.schemas import AgentState, ProposedAction
from agent.tools.oneinch import get_quote

_client: AsyncOpenAI | None = None

def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI()
    return _client

SYSTEM_PROMPT = """You are a DeFi portfolio strategist on Base Sepolia testnet. Given market context, propose ONE swap.

Rules:
- If portfolio holds USDC and sentiment >= 0 → swap USDC to WETH (growth positioning)
- If portfolio holds WETH and sentiment < -0.3 → swap WETH to USDC (defensive)
- Always propose a trade if there is any balance — this is a testnet demo agent
- Use amount_in_usd of at most 10 USD worth (small testnet amounts)
- NEVER return no_action=true if there are holdings

Return JSON exactly:
{
  "no_action": false,
  "token_in": "0x...",
  "token_out": "0x...",
  "amount_in_usd": float,
  "rationale": "one sentence"
}

Base Sepolia token addresses (ALWAYS use these exact addresses):
- WETH: 0x4200000000000000000000000000000000000006
- USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e"""


async def strategist_node(state: AgentState) -> AgentState:
    if state.market_context is None:
        return state.model_copy(
            update={"proposed_action": ProposedAction(
                token_in="", token_out="", amount_in=0,
                rationale="No market context", no_action=True
            )}
        )

    ctx = state.market_context
    resp = await _get_client().chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": json.dumps({
                    "prices": ctx.prices,
                    "holdings": ctx.holdings,
                    "sentiment_score": ctx.sentiment_score,
                    "portfolio_value_usd": ctx.portfolio_value_usd,
                    "recent_events": [d.get("summary", "") for d in ctx.retrieved_docs[:3]],
                }),
            },
        ],
        max_tokens=400,
    )

    result = json.loads(resp.choices[0].message.content)

    if result.get("no_action"):
        return state.model_copy(
            update={"proposed_action": ProposedAction(
                token_in="", token_out="", amount_in=0,
                rationale=result.get("rationale", "No action taken"), no_action=True
            )}
        )

    token_in = result["token_in"]
    token_out = result["token_out"]
    eth_price = ctx.prices.get("ETH", 2000)
    amount_in_usd = float(result.get("amount_in_usd", result.get("amount_in_eth", 0.01) * eth_price))
    # Convert USD amount to token units
    usdc_addr = "0x036cbd53842c5426634e7929541ec2318f3dcf7e"
    if token_in.lower() == usdc_addr:
        amount_in = int(amount_in_usd * 1e6)   # USDC has 6 decimals
    else:
        amount_in = int((amount_in_usd / eth_price) * 1e18)  # WETH has 18 decimals

    # Get 1inch quote for expected output
    expected_out = 0
    try:
        quote = await get_quote(token_in, token_out, amount_in)
        expected_out = int(quote.get("toAmount", 0))
    except Exception:
        pass

    return state.model_copy(
        update={"proposed_action": ProposedAction(
            token_in=token_in,
            token_out=token_out,
            amount_in=amount_in,
            rationale=result.get("rationale", ""),
            expected_amount_out=expected_out,
            no_action=False,
        )}
    )
