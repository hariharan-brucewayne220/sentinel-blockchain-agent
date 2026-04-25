"""Executor node — deterministic: builds UserOperation, pins reasoning blob, submits to bundler."""
import os
import uuid
import asyncio
from datetime import datetime, timezone
from web3 import Web3
from eth_account import Account
from agent.schemas import AgentState, ExecutionReceipt
from agent.tools.bundler import send_user_op, estimate_user_op_gas
from agent.tools.ipfs import pin_json
from agent.tools.uniswap import get_swap_calldata
from agent.tools.userop import sign_user_op

PRIVATE_KEY = os.getenv("PRIVATE_KEY", "")
SENTINEL_ACCOUNT = os.getenv("SENTINEL_ACCOUNT_ADDRESS", "")
SENTINEL_PAYMASTER = os.getenv("SENTINEL_PAYMASTER_ADDRESS", "")
ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"

SENTINEL_ACCOUNT_ABI = [
    {
        "inputs": [
            {"name": "dex", "type": "address"},
            {"name": "tokenIn", "type": "address"},
            {"name": "tokenOut", "type": "address"},
            {"name": "amountIn", "type": "uint256"},
            {"name": "swapCalldata", "type": "bytes"},
            {"name": "reasoningCID", "type": "string"},
        ],
        "name": "executeSwap",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    }
]


def _build_reasoning_blob(state: AgentState, run_id: str) -> dict:
    ctx = state.market_context
    action = state.proposed_action
    risk = state.risk_check
    return {
        "version": "1.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "agent_run_id": run_id,
        "market_context": {
            "prices": ctx.prices if ctx else {},
            "sentiment_score": ctx.sentiment_score if ctx else 0.0,
            "retrieved_docs": ctx.retrieved_docs if ctx else [],
        },
        "proposed_action": {
            "tokenIn": action.token_in if action else "",
            "tokenOut": action.token_out if action else "",
            "amountIn": str(action.amount_in) if action else "0",
            "rationale": action.rationale if action else "",
        },
        "risk_check": {
            "passed": risk.passed if risk else False,
            "checks": [c.model_dump() for c in (risk.checks if risk else [])],
        },
        "execution": {},  # filled post-submission
    }


async def executor_node(state: AgentState) -> AgentState:
    action = state.proposed_action
    risk = state.risk_check

    if action is None or action.no_action:
        return state

    if risk is None or not risk.passed:
        return state

    run_id = str(uuid.uuid4())
    blob = _build_reasoning_blob(state, run_id)

    # Pin reasoning blob to IPFS before building calldata
    cid = await pin_json(blob)

    rpc_url = os.getenv("BASE_SEPOLIA_RPC", "")
    w3 = Web3(Web3.HTTPProvider(rpc_url)) if rpc_url else None

    # Build Uniswap V3 swap calldata (1inch doesn't support Base Sepolia)
    dex_address, swap_calldata = get_swap_calldata(
        action.token_in, action.token_out, action.amount_in, SENTINEL_ACCOUNT
    )

    # Build executeSwap calldata
    if w3:
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(SENTINEL_ACCOUNT),
            abi=SENTINEL_ACCOUNT_ABI,
        )
        call_data = contract.encode_abi(
            "executeSwap",
            args=[
                Web3.to_checksum_address(dex_address),
                Web3.to_checksum_address(action.token_in),
                Web3.to_checksum_address(action.token_out),
                action.amount_in,
                bytes.fromhex(swap_calldata.removeprefix("0x") if isinstance(swap_calldata, str) else swap_calldata.hex()),
                cid,
            ],
        )
    else:
        call_data = "0x"

    # Construct ERC-4337 UserOperation (v0.7 packed format)
    account = Account.from_key(PRIVATE_KEY) if PRIVATE_KEY else None
    nonce = 0
    if w3 and account:
        ep_abi = [{"inputs": [{"name": "sender", "type": "address"}, {"name": "key", "type": "uint192"}], "name": "getNonce", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"}]
        ep = w3.eth.contract(address=Web3.to_checksum_address(ENTRYPOINT), abi=ep_abi)
        # Nonce is for the SentinelAccount (sender), not the EOA
        nonce = ep.functions.getNonce(Web3.to_checksum_address(SENTINEL_ACCOUNT), 0).call()

    # ERC-4337 v0.7 UserOperation format (EntryPoint 0x00000000717...)
    call_data_hex = call_data if isinstance(call_data, str) else ("0x" + call_data.hex())
    user_op = {
        "sender": SENTINEL_ACCOUNT,
        "nonce": hex(nonce),
        "factory": None,
        "factoryData": None,
        "callData": call_data_hex,
        "callGasLimit": hex(300_000),
        "verificationGasLimit": hex(200_000),
        "preVerificationGas": hex(60_000),
        "maxFeePerGas": hex(int(2e9)),
        "maxPriorityFeePerGas": hex(int(1e9)),
        "paymaster": None,
        "paymasterVerificationGasLimit": None,
        "paymasterPostOpGasLimit": None,
        "paymasterData": None,
        "signature": "0x" + "00" * 65,  # placeholder, replaced below
    }

    # Estimate gas from bundler with dummy signature, then sign with real values
    try:
        gas_est = await estimate_user_op_gas(user_op)
        user_op["callGasLimit"] = gas_est.get("callGasLimit", user_op["callGasLimit"])
        user_op["verificationGasLimit"] = gas_est.get("verificationGasLimit", user_op["verificationGasLimit"])
        user_op["preVerificationGas"] = gas_est.get("preVerificationGas", user_op["preVerificationGas"])
    except Exception:
        pass  # use defaults if estimation fails

    if PRIVATE_KEY:
        user_op["signature"] = sign_user_op(user_op, PRIVATE_KEY)

    user_op_hash = await send_user_op(user_op)

    # Update blob with execution data and re-pin
    blob["execution"] = {"userOpHash": user_op_hash}
    cid = await pin_json(blob)

    return state.model_copy(
        update={"execution_receipt": ExecutionReceipt(
            user_op_hash=user_op_hash,
            ipfs_cid=cid,
        )}
    )
