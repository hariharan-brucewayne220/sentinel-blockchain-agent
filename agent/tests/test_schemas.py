from agent.schemas import (
    MarketContext, ProposedAction, RiskCheckResult, PolicyCheck,
    ExecutionReceipt, ActionRecord, AgentState
)


def test_agent_state_defaults():
    state = AgentState()
    assert state.market_context is None
    assert state.proposed_action is None
    assert state.retry_count == 0


def test_market_context():
    ctx = MarketContext(prices={"ETH": 2000.0}, sentiment_score=0.5)
    assert ctx.prices["ETH"] == 2000.0
    assert ctx.sentiment_score == 0.5


def test_proposed_action_no_action():
    action = ProposedAction(token_in="", token_out="", amount_in=0, rationale="flat market", no_action=True)
    assert action.no_action is True


def test_risk_check_result():
    checks = [PolicyCheck(rule="maxTradeSize", passed=True, detail="$80 < $100 limit")]
    result = RiskCheckResult(passed=True, checks=checks, explanation="All checks passed")
    assert result.passed is True
    assert len(result.checks) == 1


def test_action_record_serialization():
    record = ActionRecord(
        timestamp="2026-04-24T00:00:00Z",
        agent_run_id="test-123",
        market_context={"prices": {}},
        proposed_action={"tokenIn": "0x1"},
        risk_check={"passed": True},
        execution={"userOpHash": "0xabc"},
    )
    data = record.model_dump_json()
    assert "test-123" in data
