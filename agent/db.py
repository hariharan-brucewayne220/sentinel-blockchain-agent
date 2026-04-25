"""Supabase persistence for ActionRecords."""
import os
from supabase import create_client, Client
from agent.schemas import ActionRecord

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

TABLE = "action_records"

_client: Client | None = None


def _get_client() -> Client:
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set")
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def save_action_record(record: ActionRecord) -> None:
    _get_client().table(TABLE).upsert({
        "agent_run_id": record.agent_run_id,
        "timestamp": record.timestamp,
        "data": record.model_dump(),
    }).execute()


def get_recent_records(limit: int = 20) -> list[ActionRecord]:
    resp = (
        _get_client()
        .table(TABLE)
        .select("data")
        .order("timestamp", desc=True)
        .limit(limit)
        .execute()
    )
    return [ActionRecord(**row["data"]) for row in (resp.data or [])]
