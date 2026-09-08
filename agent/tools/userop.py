"""ERC-4337 v0.7 UserOperation hash computation and signing."""
from web3 import Web3
from eth_account import Account
from eth_abi import encode

ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
CHAIN_ID = 84532  # Base Sepolia

# Byte offsets inside `paymasterAndData`, mirroring account-abstraction v0.7
# `core/UserOperationLib.sol` (PAYMASTER_VALIDATION_GAS_OFFSET = 20,
# PAYMASTER_POSTOP_GAS_OFFSET = 36, PAYMASTER_DATA_OFFSET = 52), which is what
# the EntryPoint uses in `unpackPaymasterStaticFields` to split the blob.
PAYMASTER_VALIDATION_GAS_OFFSET = 20
PAYMASTER_POSTOP_GAS_OFFSET = 36
PAYMASTER_DATA_OFFSET = 52


def _hex_to_int(value) -> int:
    if value is None or value == "":
        return 0
    if isinstance(value, int):
        return value
    return int(value, 16)


def _hex_to_bytes(value) -> bytes:
    if not value:
        return b""
    if isinstance(value, (bytes, bytearray)):
        return bytes(value)
    return bytes.fromhex(value[2:] if value.startswith("0x") else value)


def has_paymaster(op: dict) -> bool:
    """True when the op carries a paymaster address (None / "" / "0x" mean unsponsored)."""
    paymaster = op.get("paymaster")
    return bool(paymaster) and paymaster != "0x"


def pack_paymaster_and_data(op: dict) -> bytes:
    """Pack the v0.7 `paymasterAndData` blob from the unpacked bundler-JSON fields.

    Layout (fixed 52-byte prefix, then variable data):

        paymaster (20 bytes)
        + paymasterVerificationGasLimit (uint128, 16 bytes big-endian)
        + paymasterPostOpGasLimit       (uint128, 16 bytes big-endian)
        + paymasterData                 (arbitrary bytes, may be empty)

    Returns b"" for an unsponsored op, which is what the EntryPoint expects
    (`paymasterAndData.length == 0` means "no paymaster").
    """
    if not has_paymaster(op):
        return b""

    paymaster = _hex_to_bytes(op["paymaster"])
    if len(paymaster) != 20:
        raise ValueError(f"paymaster must be a 20-byte address, got {op['paymaster']!r}")

    pm_verif = _hex_to_int(op.get("paymasterVerificationGasLimit"))
    pm_postop = _hex_to_int(op.get("paymasterPostOpGasLimit"))
    pm_data = _hex_to_bytes(op.get("paymasterData"))

    return (
        paymaster
        + pm_verif.to_bytes(16, "big")
        + pm_postop.to_bytes(16, "big")
        + pm_data
    )


def _pack_user_op(op: dict) -> bytes:
    """Pack UserOperation fields for hashing (v0.7 spec)."""
    sender = op["sender"]
    nonce = int(op["nonce"], 16) if isinstance(op["nonce"], str) else op["nonce"]

    # initCode = factory + factoryData (empty if no factory)
    factory = op.get("factory")
    if factory and factory not in (None, "0x"):
        factory_data = bytes.fromhex((op.get("factoryData") or "0x")[2:])
        init_code = bytes.fromhex(factory[2:]) + factory_data
    else:
        init_code = b""

    call_data = bytes.fromhex(op["callData"][2:])

    # accountGasLimits: verificationGasLimit (high 128 bits) | callGasLimit (low 128 bits)
    call_gas = int(op["callGasLimit"], 16)
    verif_gas = int(op["verificationGasLimit"], 16)
    account_gas_limits = (verif_gas << 128) | call_gas

    pre_verif_gas = int(op["preVerificationGas"], 16)

    # gasFees: maxPriorityFeePerGas (high 128 bits) | maxFeePerGas (low 128 bits)
    max_priority = int(op["maxPriorityFeePerGas"], 16)
    max_fee = int(op["maxFeePerGas"], 16)
    gas_fees = (max_priority << 128) | max_fee

    # paymasterAndData: paymaster (20B) + pmVerifGasLimit (16B) + pmPostOpGasLimit (16B) + pmData
    paymaster_and_data = pack_paymaster_and_data(op)

    packed = encode(
        ["address", "uint256", "bytes32", "bytes32", "uint256", "uint256", "uint256", "bytes32"],
        [
            Web3.to_checksum_address(sender),
            nonce,
            Web3.keccak(init_code),
            Web3.keccak(call_data),
            account_gas_limits,
            pre_verif_gas,
            gas_fees,
            Web3.keccak(paymaster_and_data),
        ],
    )
    return packed


def get_user_op_hash(op: dict) -> bytes:
    """Compute the ERC-4337 v0.7 UserOperation hash."""
    packed = _pack_user_op(op)
    op_hash = Web3.keccak(packed)
    final_hash = Web3.keccak(
        encode(
            ["bytes32", "address", "uint256"],
            [op_hash, Web3.to_checksum_address(ENTRYPOINT), CHAIN_ID],
        )
    )
    return final_hash


def sign_user_op(op: dict, private_key: str) -> str:
    """Sign the UserOperation hash with EIP-191 prefix.

    SimpleAccount._validateSignature uses toEthSignedMessageHash() which adds the
    Ethereum signed message prefix before verifying, so we must do the same.
    """
    from eth_account.messages import encode_defunct
    user_op_hash = get_user_op_hash(op)
    signable = encode_defunct(user_op_hash)
    signed = Account.sign_message(signable, private_key=private_key)
    return "0x" + signed.signature.hex()
