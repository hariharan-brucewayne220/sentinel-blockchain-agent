"""Entry point — single-cycle or 15-minute loop mode."""
import argparse
import asyncio
import signal
import sys
from dotenv import load_dotenv
from agent.graph import sentinel_graph
from agent.schemas import AgentState

load_dotenv()

_shutdown = False


def _handle_signal(sig, frame):
    global _shutdown
    print("\nShutdown requested — completing current cycle then stopping.")
    _shutdown = True


async def run_cycle() -> AgentState:
    initial = AgentState()
    result = await sentinel_graph.ainvoke(initial)
    return result


async def main_loop(interval_seconds: int = 900) -> None:
    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    while not _shutdown:
        print(f"Starting agent cycle...")
        try:
            state = await run_cycle()
            if state.execution_receipt:
                print(f"Cycle complete. UserOp: {state.execution_receipt.user_op_hash}")
                print(f"IPFS CID: {state.execution_receipt.ipfs_cid}")
            elif state.proposed_action and state.proposed_action.no_action:
                print("Cycle complete. No action taken.")
            else:
                print("Cycle complete.")
        except Exception as e:
            print(f"Cycle error: {e}")

        if _shutdown:
            break

        print(f"Sleeping {interval_seconds}s until next cycle...")
        for _ in range(interval_seconds):
            if _shutdown:
                break
            await asyncio.sleep(1)

    print("Agent stopped.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sentinel AI Portfolio Agent")
    parser.add_argument("--loop", action="store_true", help="Run on 15-minute cron")
    parser.add_argument("--interval", type=int, default=900, help="Cycle interval in seconds")
    args = parser.parse_args()

    if args.loop:
        asyncio.run(main_loop(args.interval))
    else:
        result = asyncio.run(run_cycle())
        if result.execution_receipt:
            print(f"Done. UserOp: {result.execution_receipt.user_op_hash}")
        elif result.proposed_action and result.proposed_action.no_action:
            print(f"Done. No action: {result.proposed_action.rationale}")
        else:
            print("Done.")
