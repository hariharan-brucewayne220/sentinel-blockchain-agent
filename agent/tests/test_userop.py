"""paymasterAndData packing and v0.7 hash coverage for agent/tools/userop.py.

Layout under test (account-abstraction v0.7 core/UserOperationLib.sol):
    paymaster[0:20] + paymasterVerificationGasLimit[20:36] + paymasterPostOpGasLimit[36:52] + paymasterData[52:]
"""
import json
import pathlib

import pytest
from eth_account import Account
from eth_account.messages import encode_defunct

from agent.tools.userop import (
    PAYMASTER_DATA_OFFSET,
    PAYMASTER_POSTOP_GAS_OFFSET,
    PAYMASTER_VALIDATION_GAS_OFFSET,
    get_user_op_hash,
    has_paymaster,
    pack_paymaster_and_data,
    sign_user_op,
)

# Deployed SentinelPaymaster on Base Sepolia (contracts/deployments/base-sepolia.json)
PAYMASTER = "0x4cA1Dd59F9d690bd1Fa4739AC157A2Bea12924DB"
SENDER = "0x287326DDFf84973f9D23e6495cc9d727F14f7F34"
PM_VERIF_GAS = 100_000  # 0x186a0
PM_POSTOP_GAS = 50_000  # 0xc350


def _base_op() -> dict:
    return {
        "sender": SENDER,
        "nonce": "0x1",
        "factory": None,
        "factoryData": None,
        "callData": "0xdeadbeef",
        "callGasLimit": hex(300_000),
        "verificationGasLimit": hex(200_000),
        "preVerificationGas": hex(60_000),
        "maxFeePerGas": hex(int(2e9)),
        "maxPriorityFeePerGas": hex(int(1e9)),
        "paymaster": None,
        "paymasterVerificationGasLimit": None,
        "paymasterPostOpGasLimit": None,
        "paymasterData": None,
        "signature": "0x",
    }


def _sponsored_op(paymaster_data: str = "0x") -> dict:
    return {
        **_base_op(),
        "paymaster": PAYMASTER,
        "paymasterVerificationGasLimit": hex(PM_VERIF_GAS),
        "paymasterPostOpGasLimit": hex(PM_POSTOP_GAS),
        "paymasterData": paymaster_data,
    }


def test_offsets_match_user_operation_lib():
    assert (PAYMASTER_VALIDATION_GAS_OFFSET, PAYMASTER_POSTOP_GAS_OFFSET, PAYMASTER_DATA_OFFSET) == (20, 36, 52)


def test_pack_paymaster_and_data_exact_bytes():
    packed = pack_paymaster_and_data(_sponsored_op())

    expected = (
        bytes.fromhex("4cA1Dd59F9d690bd1Fa4739AC157A2Bea12924DB")
        + PM_VERIF_GAS.to_bytes(16, "big")
        + PM_POSTOP_GAS.to_bytes(16, "big")
    )
    assert packed == expected
    assert len(packed) == PAYMASTER_DATA_OFFSET
    assert packed.hex() == (
        "4ca1dd59f9d690bd1fa4739ac157a2bea12924db"
        "000000000000000000000000000186a0"
        "0000000000000000000000000000c350"
    )

    # Slices the EntryPoint reads in unpackPaymasterStaticFields
    assert packed[:PAYMASTER_VALIDATION_GAS_OFFSET] == bytes.fromhex(PAYMASTER[2:])
    assert int.from_bytes(packed[PAYMASTER_VALIDATION_GAS_OFFSET:PAYMASTER_POSTOP_GAS_OFFSET], "big") == PM_VERIF_GAS
    assert int.from_bytes(packed[PAYMASTER_POSTOP_GAS_OFFSET:PAYMASTER_DATA_OFFSET], "big") == PM_POSTOP_GAS
    assert packed[PAYMASTER_DATA_OFFSET:] == b""


def test_pack_paymaster_data_is_appended_after_static_fields():
    packed = pack_paymaster_and_data(_sponsored_op(paymaster_data="0xabcd01"))
    assert len(packed) == PAYMASTER_DATA_OFFSET + 3
    assert packed[PAYMASTER_DATA_OFFSET:] == bytes.fromhex("abcd01")
    assert packed[:PAYMASTER_DATA_OFFSET] == pack_paymaster_and_data(_sponsored_op())


@pytest.mark.parametrize("paymaster", [None, "", "0x"])
def test_unsponsored_op_packs_to_empty(paymaster):
    op = {**_base_op(), "paymaster": paymaster}
    assert has_paymaster(op) is False
    assert pack_paymaster_and_data(op) == b""


def test_pack_rejects_non_address_paymaster():
    with pytest.raises(ValueError):
        pack_paymaster_and_data({**_sponsored_op(), "paymaster": "0x1234"})


def test_hash_changes_when_paymaster_attached():
    unsponsored = get_user_op_hash(_base_op())
    sponsored = get_user_op_hash(_sponsored_op())
    assert unsponsored != sponsored

    # "0x" paymaster is the same as no paymaster
    assert get_user_op_hash({**_base_op(), "paymaster": "0x"}) == unsponsored

    # Each packed field is part of the hash pre-image
    assert get_user_op_hash({**_sponsored_op(), "paymasterVerificationGasLimit": hex(PM_VERIF_GAS + 1)}) != sponsored
    assert get_user_op_hash({**_sponsored_op(), "paymasterPostOpGasLimit": hex(PM_POSTOP_GAS + 1)}) != sponsored
    assert get_user_op_hash(_sponsored_op(paymaster_data="0x01")) != sponsored


def test_signature_commits_to_paymaster_fields():
    key = "0x" + "11" * 32
    signer = Account.from_key(key).address

    sig = sign_user_op(_sponsored_op(), key)
    recovered_ok = Account.recover_message(encode_defunct(get_user_op_hash(_sponsored_op())), signature=sig)
    assert recovered_ok == signer

    # The same signature does not verify for the unsponsored op
    recovered_bad = Account.recover_message(encode_defunct(get_user_op_hash(_base_op())), signature=sig)
    assert recovered_bad != signer


# --- Cross-language fixture -------------------------------------------------
# contracts/test/fixtures/paymaster_and_data.json is the single source of truth
# shared with contracts/test/PaymasterAndDataCrossLang.t.sol, which feeds the very
# same `packed` bytes through the real account-abstraction
# UserOperationLib.unpackPaymasterStaticFields. This test asserts the Python packer
# still reproduces those bytes, so a change on either side of the language boundary
# fails a test instead of only failing on-chain.

FIXTURE_PATH = (
    pathlib.Path(__file__).resolve().parents[2] / "contracts" / "test" / "fixtures" / "paymaster_and_data.json"
)


def _fixture_cases():
    with FIXTURE_PATH.open() as fh:
        return json.load(fh)["cases"]


def test_cross_language_fixture_is_present_and_populated():
    cases = _fixture_cases()
    assert len(cases) == 3, "Solidity side hard-codes CASE_COUNT = 3; keep the two in step"


@pytest.mark.parametrize("case", _fixture_cases(), ids=lambda c: c["name"])
def test_python_packing_matches_cross_language_fixture(case):
    op = {
        **_base_op(),
        "paymaster": case["paymaster"],
        "paymasterVerificationGasLimit": case["paymasterVerificationGasLimit"],
        "paymasterPostOpGasLimit": case["paymasterPostOpGasLimit"],
        "paymasterData": case["paymasterData"],
    }

    packed = pack_paymaster_and_data(op)

    assert packed.hex() == case["packed"][2:].lower(), (
        f"{case['name']}: Python packing drifted from the fixture the Solidity test reads. "
        f"Got 0x{packed.hex()}"
    )

    # And the fixture's own fields are internally consistent with the layout.
    assert packed[:PAYMASTER_VALIDATION_GAS_OFFSET].hex() == case["paymaster"][2:].lower()
    assert int.from_bytes(
        packed[PAYMASTER_VALIDATION_GAS_OFFSET:PAYMASTER_POSTOP_GAS_OFFSET], "big"
    ) == int(case["paymasterVerificationGasLimit"], 16)
    assert int.from_bytes(
        packed[PAYMASTER_POSTOP_GAS_OFFSET:PAYMASTER_DATA_OFFSET], "big"
    ) == int(case["paymasterPostOpGasLimit"], 16)
    assert packed[PAYMASTER_DATA_OFFSET:] == _hex_to_bytes_for_test(case["paymasterData"])


def _hex_to_bytes_for_test(value: str) -> bytes:
    return bytes.fromhex(value[2:]) if value and value != "0x" else b""
