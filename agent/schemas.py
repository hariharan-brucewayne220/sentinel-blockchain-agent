from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Any


class MarketContext(BaseModel):
    prices: dict[str, float] = Field(default_factory=dict)
    holdings: dict[str, float] = Field(default_factory=dict)
    sentiment_score: float = 0.0
    retrieved_docs: list[dict[str, Any]] = Field(default_factory=list)
    portfolio_value_usd: float = 0.0


class ProposedAction(BaseModel):
    token_in: str
    token_out: str
    amount_in: int  # raw token units (18 decimals)
    rationale: str
    expected_amount_out: int = 0
    no_action: bool = False


class PolicyCheck(BaseModel):
    rule: str
    passed: bool
    detail: str


class RiskCheckResult(BaseModel):
    passed: bool
    checks: list[PolicyCheck] = Field(default_factory=list)
    explanation: str = ""


class ExecutionReceipt(BaseModel):
    user_op_hash: str
    tx_hash: str = ""
    ipfs_cid: str
    proof_cid: str = ""


class ActionRecord(BaseModel):
    version: str = "1.0"
    timestamp: str
    agent_run_id: str
    market_context: dict[str, Any]
    proposed_action: dict[str, Any]
    risk_check: dict[str, Any]
    execution: dict[str, Any]


class AgentState(BaseModel):
    market_context: MarketContext | None = None
    proposed_action: ProposedAction | None = None
    risk_check: RiskCheckResult | None = None
    execution_receipt: ExecutionReceipt | None = None
    action_record: ActionRecord | None = None
    error: str | None = None
    retry_count: int = 0
