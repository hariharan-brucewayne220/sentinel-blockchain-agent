"""RiskCheck node — simulates PolicyGuard rules locally and produces a Policy Decision Record."""
import os
import json
from openai import AsyncOpenAI
from web3 import Web3
from agent.schemas import AgentState, RiskCheckResult, PolicyCheck

_client: AsyncOpenAI | None = None

def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI()
    return _client

POLICY_GUARD_ABI = [
    {"inputs": [], "name": "maxTradeSizeUsd", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "dailyDrawdownLimit", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "cooldownPeriod", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "cumulativeDrawdown", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"type": "address"}], "name": "tokenWhitelist", "outputs": [{"type": "bool"}], "stateMutability": "view", "type": "function"},
]

SYSTEM_PROMPT = """You are a risk compliance officer. Given a proposed trade and current policy parameters,
evaluate each rule and return a JSON Policy Decision Record:
{
  "passed": bool,
  "checks": [{"rule": str, "passed": bool, "detail": str}],
  "explanation": str
}"""


async def risk_check_node(state: AgentState) -> AgentState:
    action = state.proposed_action
    if action is None or action.no_action:
        return state.model_copy(
            update={"risk_check": RiskCheckResult(passed=True, explanation="No action to check")}
        )

    rpc_url = os.getenv("BASE_SEPOLIA_RPC", "")
    policy_guard_address = os.getenv("POLICY_GUARD_ADDRESS", "")
    eth_price = (state.market_context.prices.get("ETH", 2000) if state.market_context else 2000)

    policy_params: dict = {}
    if rpc_url and policy_guard_address:
        try:
            w3 = Web3(Web3.HTTPProvider(rpc_url))
            pg = w3.eth.contract(
                address=Web3.to_checksum_address(policy_guard_address),
                abi=POLICY_GUARD_ABI,
            )
            policy_params = {
                "maxTradeSizeUsd": pg.functions.maxTradeSizeUsd().call(),
                "dailyDrawdownLimit": pg.functions.dailyDrawdownLimit().call(),
                "cooldownPeriod": pg.functions.cooldownPeriod().call(),
                "cumulativeDrawdown": pg.functions.cumulativeDrawdown().call(),
                "tokenInWhitelisted": pg.functions.tokenWhitelist(
                    Web3.to_checksum_address(action.token_in)
                ).call(),
                "tokenOutWhitelisted": pg.functions.tokenWhitelist(
                    Web3.to_checksum_address(action.token_out)
                ).call(),
            }
        except Exception:
            pass

    # Ask gpt-4o-mini to evaluate the rules
    resp = await _get_client().chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": json.dumps({
                    "proposed_action": {
                        "token_in": action.token_in,
                        "token_out": action.token_out,
                        "amount_in_wei": action.amount_in,
                        "amount_in_eth": action.amount_in / 1e18,
                        "estimated_usd": (action.amount_in / 1e18) * eth_price,
                    },
                    "policy_params": policy_params,
                    "eth_price_usd": eth_price,
                }),
            },
        ],
        max_tokens=500,
    )

    result = json.loads(resp.choices[0].message.content)
    checks = [PolicyCheck(**c) for c in result.get("checks", [])]

    return state.model_copy(
        update={"risk_check": RiskCheckResult(
            passed=result.get("passed", False),
            checks=checks,
            explanation=result.get("explanation", ""),
        )}
    )
