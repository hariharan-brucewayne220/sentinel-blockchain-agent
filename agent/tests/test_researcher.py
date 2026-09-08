import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from agent.schemas import AgentState
from agent.nodes.researcher import researcher_node


@pytest.mark.asyncio
async def test_researcher_returns_market_context():
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = '{"sentiment_score": 0.3, "summary": "Neutral market"}'

    with patch("agent.nodes.researcher.get_chainlink_prices", return_value={"ETH": 2000.0}), \
         patch("agent.nodes.researcher.get_portfolio_state", new_callable=AsyncMock, return_value={}), \
         patch("agent.nodes.researcher._get_client") as mock_get_client:
        mock_get_client.return_value.chat.completions.create = AsyncMock(return_value=mock_response)

        state = AgentState()
        result = await researcher_node(state)

    assert result.market_context is not None
    assert result.market_context.prices["ETH"] == 2000.0
    assert result.market_context.sentiment_score == 0.3


@pytest.mark.asyncio
async def test_researcher_handles_api_failure():
    with patch("agent.nodes.researcher.get_chainlink_prices", return_value={}), \
         patch("agent.nodes.researcher.get_portfolio_state", new_callable=AsyncMock, return_value={}), \
         patch("agent.nodes.researcher._get_client") as mock_get_client:
        mock_get_client.return_value.chat.completions.create = AsyncMock(side_effect=Exception("API error"))

        state = AgentState()
        result = await researcher_node(state)

    assert result.market_context is not None
    assert result.market_context.sentiment_score == 0.0


@pytest.mark.asyncio
async def test_researcher_does_not_swallow_rpc_failure_into_empty_portfolio():
    """An unreachable RPC must fail the cycle, not look like a $0 portfolio.

    Regression guard: the balance read used to be wrapped in a bare
    `except Exception: holdings = {}`, so running with no RPC produced a
    market_context claiming portfolio_value_usd == 0.0 and the strategist then
    sized trades against that fabricated state.
    """
    with patch("agent.nodes.researcher.ACCOUNT_ADDRESS", "0x287326DDFf84973f9D23e6495cc9d727F14f7F34"), \
         patch("agent.nodes.researcher.get_chainlink_prices", return_value={"ETH": 2000.0}), \
         patch(
             "agent.nodes.researcher.get_token_balances",
             side_effect=ConnectionError("RPC unreachable"),
         ), \
         patch("agent.nodes.researcher._get_client"):
        with pytest.raises(ConnectionError, match="RPC unreachable"):
            await researcher_node(AgentState())


def test_price_feed_raises_when_rpc_unconfigured():
    """A missing RPC endpoint is a misconfiguration, not "no price for this token"."""
    import agent.tools.chainlink as chainlink

    with patch.object(chainlink, "RPC_URL", ""):
        with pytest.raises(chainlink.RpcNotConfigured, match="BASE_SEPOLIA_RPC"):
            chainlink.get_price_usd("ETH")


def test_price_feed_returns_none_for_unknown_symbol():
    """With an RPC configured, an unknown symbol is still a plain None."""
    import agent.tools.chainlink as chainlink

    with patch.object(chainlink, "RPC_URL", "https://example.invalid"):
        assert chainlink.get_price_usd("NOSUCHTOKEN") is None
