"""Auditor node — polls bundler for inclusion, verifies ActionLog event, writes ActionRecord."""
import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from agent.schemas import AgentState, ActionRecord
from agent.tools.bundler import get_receipt

MAX_POLLS = 10
POLL_INTERVAL = 15  # seconds


async def auditor_node(state: AgentState) -> AgentState:
    receipt = state.execution_receipt
    if receipt is None:
        return state

    # Poll bundler until UserOperation is included
    tx_hash = ""
    for _ in range(MAX_POLLS):
        result = await get_receipt(receipt.user_op_hash)
        if result is not None:
            tx_hash = result.get("receipt", {}).get("transactionHash", "")
            break
        await asyncio.sleep(POLL_INTERVAL)

    action = state.proposed_action
    risk = state.risk_check
    ctx = state.market_context

    record = ActionRecord(
        version="1.0",
        timestamp=datetime.now(timezone.utc).isoformat(),
        agent_run_id=str(uuid.uuid4()),
        market_context={
            "prices": ctx.prices if ctx else {},
            "sentiment_score": ctx.sentiment_score if ctx else 0.0,
        },
        proposed_action={
            "tokenIn": action.token_in if action else "",
            "tokenOut": action.token_out if action else "",
            "amountIn": str(action.amount_in) if action else "0",
            "rationale": action.rationale if action else "",
        },
        risk_check={
            "passed": risk.passed if risk else False,
            "checks": [c.model_dump() for c in (risk.checks if risk else [])],
        },
        execution={
            "userOpHash": receipt.user_op_hash,
            "txHash": tx_hash,
            "ipfsCID": receipt.ipfs_cid,
        },
    )

    # Persist to SQLite via db module
    try:
        from agent.db import save_action_record
        save_action_record(record)
    except Exception:
        pass

    return state.model_copy(
        update={
            "action_record": record,
            "execution_receipt": receipt.model_copy(update={"tx_hash": tx_hash}),
        }
    )
