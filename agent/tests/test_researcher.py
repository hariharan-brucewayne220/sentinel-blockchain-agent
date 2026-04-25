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
