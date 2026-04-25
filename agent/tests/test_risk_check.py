import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from agent.schemas import AgentState, MarketContext, ProposedAction
from agent.nodes.risk_check import risk_check_node


def _make_state(no_action: bool = False) -> AgentState:
    return AgentState(
        market_context=MarketContext(prices={"ETH": 2000.0}, sentiment_score=0.2),
        proposed_action=ProposedAction(
            token_in="0x4200000000000000000000000000000000000006",
            token_out="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            amount_in=int(0.04 * 1e18),
            rationale="test",
            no_action=no_action,
        ),
    )


@pytest.mark.asyncio
async def test_risk_check_passes():
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = """{
        "passed": true,
        "checks": [{"rule": "maxTradeSize", "passed": true, "detail": "$80 < $100"}],
        "explanation": "All checks passed"
    }"""

    with patch("agent.nodes.risk_check._get_client") as mock_get_client:
        mock_get_client.return_value.chat.completions.create = AsyncMock(return_value=mock_response)
        state = _make_state()
        result = await risk_check_node(state)

    assert result.risk_check is not None
    assert result.risk_check.passed is True
    assert len(result.risk_check.checks) == 1


@pytest.mark.asyncio
async def test_risk_check_blocked():
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = """{
        "passed": false,
        "checks": [{"rule": "maxTradeSize", "passed": false, "detail": "$150 > $100"}],
        "explanation": "Trade size exceeded"
    }"""

    with patch("agent.nodes.risk_check._get_client") as mock_get_client:
        mock_get_client.return_value.chat.completions.create = AsyncMock(return_value=mock_response)
        state = _make_state()
        result = await risk_check_node(state)

    assert result.risk_check is not None
    assert result.risk_check.passed is False


@pytest.mark.asyncio
async def test_risk_check_skips_no_action():
    state = _make_state(no_action=True)
    with patch("agent.nodes.risk_check._get_client") as mock_get_client:
        mock_get_client.return_value.chat.completions.create = AsyncMock()
        result = await risk_check_node(state)

    mock_get_client.return_value.chat.completions.create.assert_not_called()
    assert result.risk_check is not None
    assert result.risk_check.passed is True
