"""LangGraph pipeline: Researcher → Strategist → RiskCheck → Executor → Auditor."""
from langgraph.graph import StateGraph, END
from agent.schemas import AgentState
from agent.nodes.researcher import researcher_node
from agent.nodes.strategist import strategist_node
from agent.nodes.risk_check import risk_check_node
from agent.nodes.executor import executor_node
from agent.nodes.auditor import auditor_node

MAX_RISK_RETRIES = 3


def _route_after_risk(state: AgentState) -> str:
    if state.proposed_action and state.proposed_action.no_action:
        return END
    if state.risk_check and not state.risk_check.passed:
        if state.retry_count < MAX_RISK_RETRIES:
            return "strategist"
        return END
    return "executor"


def build_graph() -> StateGraph:
    builder = StateGraph(AgentState)

    builder.add_node("researcher", researcher_node)
    builder.add_node("strategist", strategist_node)
    builder.add_node("risk_check", risk_check_node)
    builder.add_node("executor", executor_node)
    builder.add_node("auditor", auditor_node)

    builder.set_entry_point("researcher")
    builder.add_edge("researcher", "strategist")
    builder.add_edge("strategist", "risk_check")
    builder.add_conditional_edges(
        "risk_check",
        _route_after_risk,
        {"strategist": "strategist", "executor": "executor", END: END},
    )
    builder.add_edge("executor", "auditor")
    builder.add_edge("auditor", END)

    return builder.compile()


sentinel_graph = build_graph()
