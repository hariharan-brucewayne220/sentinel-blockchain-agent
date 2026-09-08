"""Executor node: paymaster attachment on the UserOp sent to the bundler (all I/O mocked)."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from eth_account import Account
from eth_account.messages import encode_defunct

from agent.nodes import executor as executor_mod
from agent.schemas import AgentState, MarketContext, PolicyCheck, ProposedAction, RiskCheckResult
from agent.tools.userop import get_user_op_hash

TEST_KEY = "0x" + "11" * 32
ACCOUNT = "0x287326DDFf84973f9D23e6495cc9d727F14f7F34"
PAYMASTER = "0x4cA1Dd59F9d690bd1Fa4739AC157A2Bea12924DB"
USER_OP_HASH = "0x" + "aa" * 32

# Shape of a Pimlico v0.7 eth_estimateUserOperationGas result for a sponsored op
ESTIMATE = {
    "callGasLimit": "0x30d40",
    "verificationGasLimit": "0x2ee00",
    "preVerificationGas": "0xd6d8",
    "paymasterVerificationGasLimit": "0x7530",
    "paymasterPostOpGasLimit": "0x1388",
}
PAYMASTER_KEYS = ("paymaster", "paymasterVerificationGasLimit", "paymasterPostOpGasLimit", "paymasterData")


def _state() -> AgentState:
    return AgentState(
        market_context=MarketContext(prices={"ETH": 2000.0}, sentiment_score=0.2),
        proposed_action=ProposedAction(
            token_in="0x4200000000000000000000000000000000000006",
            token_out="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            amount_in=int(0.01 * 1e18),
            rationale="test",
        ),
        risk_check=RiskCheckResult(
            passed=True,
            checks=[PolicyCheck(rule="maxTradeSize", passed=True, detail="ok")],
        ),
    )


def _mock_web3_class() -> MagicMock:
    w3_cls = MagicMock(name="Web3")
    w3 = w3_cls.return_value
    w3.eth.contract.return_value.encode_abi.return_value = "0xdeadbeef"
    w3.eth.contract.return_value.functions.getNonce.return_value.call.return_value = 7
    w3_cls.to_checksum_address.side_effect = lambda a: a
    return w3_cls


async def _run(monkeypatch, estimate=ESTIMATE):
    """Run executor_node with bundler, IPFS and web3 mocked. Returns (state, sent_op, estimate_inputs)."""
    monkeypatch.setenv("BASE_SEPOLIA_RPC", "http://rpc.invalid")
    monkeypatch.setattr(executor_mod, "PRIVATE_KEY", TEST_KEY)
    monkeypatch.setattr(executor_mod, "SENTINEL_ACCOUNT", ACCOUNT)

    estimate_inputs: list[dict] = []

    async def _estimate(op):
        estimate_inputs.append(dict(op))  # snapshot: executor mutates the dict afterwards
        if isinstance(estimate, Exception):
            raise estimate
        return dict(estimate)

    send = AsyncMock(return_value=USER_OP_HASH)
    pin = AsyncMock(return_value="QmTestCid")

    with patch.object(executor_mod, "Web3", _mock_web3_class()), \
         patch.object(executor_mod, "estimate_user_op_gas", side_effect=_estimate), \
         patch.object(executor_mod, "send_user_op", send), \
         patch.object(executor_mod, "pin_json", pin):
        result = await executor_mod.executor_node(_state())

    send.assert_awaited_once()
    assert pin.await_count == 2
    sent_op = send.await_args.args[0]
    return result, sent_op, estimate_inputs


def _assert_signed_by(op: dict, key: str):
    recovered = Account.recover_message(encode_defunct(get_user_op_hash(op)), signature=op["signature"])
    assert recovered == Account.from_key(key).address


@pytest.mark.asyncio
async def test_sponsored_userop_carries_paymaster_fields(monkeypatch):
    monkeypatch.setenv("SENTINEL_PAYMASTER_ADDRESS", PAYMASTER)
    monkeypatch.delenv("USE_PAYMASTER", raising=False)

    result, sent, estimate_inputs = await _run(monkeypatch)

    # Pimlico must see the paymaster during estimation to return paymaster gas limits
    assert estimate_inputs[0]["paymaster"] == PAYMASTER
    assert estimate_inputs[0]["paymasterData"] == "0x"
    assert estimate_inputs[0]["paymasterVerificationGasLimit"] == hex(executor_mod.DEFAULT_PAYMASTER_VERIFICATION_GAS)

    # Sent op uses the bundler's estimated paymaster limits, empty paymasterData
    assert sent["paymaster"] == PAYMASTER
    assert sent["paymasterVerificationGasLimit"] == ESTIMATE["paymasterVerificationGasLimit"]
    assert sent["paymasterPostOpGasLimit"] == ESTIMATE["paymasterPostOpGasLimit"]
    assert sent["paymasterData"] == "0x"
    assert sent["callGasLimit"] == ESTIMATE["callGasLimit"]
    assert sent["nonce"] == hex(7)
    assert sent["sender"] == ACCOUNT

    # Signature commits to the final (post-estimation, sponsored) op
    _assert_signed_by(sent, TEST_KEY)

    assert result.execution_receipt is not None
    assert result.execution_receipt.user_op_hash == USER_OP_HASH
    assert result.execution_receipt.ipfs_cid == "QmTestCid"


@pytest.mark.asyncio
async def test_sponsored_userop_falls_back_to_default_limits_when_estimation_fails(monkeypatch):
    monkeypatch.setenv("SENTINEL_PAYMASTER_ADDRESS", PAYMASTER)
    monkeypatch.delenv("USE_PAYMASTER", raising=False)

    _, sent, _ = await _run(monkeypatch, estimate=RuntimeError("Gas estimation error"))

    assert sent["paymaster"] == PAYMASTER
    assert sent["paymasterVerificationGasLimit"] == hex(executor_mod.DEFAULT_PAYMASTER_VERIFICATION_GAS)
    assert sent["paymasterPostOpGasLimit"] == hex(executor_mod.DEFAULT_PAYMASTER_POSTOP_GAS)
    assert sent["paymasterData"] == "0x"
    _assert_signed_by(sent, TEST_KEY)


@pytest.mark.asyncio
async def test_sponsored_userop_keeps_defaults_when_estimate_omits_paymaster_limits(monkeypatch):
    monkeypatch.setenv("SENTINEL_PAYMASTER_ADDRESS", PAYMASTER)
    monkeypatch.delenv("USE_PAYMASTER", raising=False)
    estimate = {k: v for k, v in ESTIMATE.items() if not k.startswith("paymaster")}

    _, sent, _ = await _run(monkeypatch, estimate=estimate)

    assert sent["paymaster"] == PAYMASTER
    assert sent["paymasterVerificationGasLimit"] == hex(executor_mod.DEFAULT_PAYMASTER_VERIFICATION_GAS)
    assert sent["paymasterPostOpGasLimit"] == hex(executor_mod.DEFAULT_PAYMASTER_POSTOP_GAS)
    assert sent["callGasLimit"] == ESTIMATE["callGasLimit"]


@pytest.mark.asyncio
async def test_unsponsored_userop_when_paymaster_env_unset(monkeypatch):
    monkeypatch.delenv("SENTINEL_PAYMASTER_ADDRESS", raising=False)
    monkeypatch.delenv("USE_PAYMASTER", raising=False)

    _, sent, estimate_inputs = await _run(monkeypatch)

    for key in PAYMASTER_KEYS:
        assert key in sent  # v0.7 JSON shape keeps the keys, as null
        assert sent[key] is None
        assert estimate_inputs[0][key] is None
    _assert_signed_by(sent, TEST_KEY)


@pytest.mark.asyncio
@pytest.mark.parametrize("flag", ["false", "0", "no", "OFF"])
async def test_use_paymaster_false_disables_sponsorship(monkeypatch, flag):
    monkeypatch.setenv("SENTINEL_PAYMASTER_ADDRESS", PAYMASTER)
    monkeypatch.setenv("USE_PAYMASTER", flag)

    _, sent, _ = await _run(monkeypatch)

    for key in PAYMASTER_KEYS:
        assert sent[key] is None


def test_paymaster_config_rejects_malformed_address(monkeypatch):
    monkeypatch.setenv("SENTINEL_PAYMASTER_ADDRESS", "0x1234")
    monkeypatch.delenv("USE_PAYMASTER", raising=False)
    with pytest.raises(ValueError):
        executor_mod._paymaster_config()
