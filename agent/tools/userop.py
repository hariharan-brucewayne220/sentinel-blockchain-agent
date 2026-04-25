"""ERC-4337 v0.7 UserOperation hash computation and signing."""
from web3 import Web3
from eth_account import Account
from eth_abi import encode

ENTRYPOINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
CHAIN_ID = 84532  # Base Sepolia


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
    paymaster = op.get("paymaster")
    if paymaster and paymaster not in (None, "0x"):
        pm_verif = int((op.get("paymasterVerificationGasLimit") or "0x0"), 16)
        pm_postop = int((op.get("paymasterPostOpGasLimit") or "0x0"), 16)
        pm_data = bytes.fromhex((op.get("paymasterData") or "0x")[2:])
        paymaster_and_data = (
            bytes.fromhex(paymaster[2:])
            + pm_verif.to_bytes(16, "big")
            + pm_postop.to_bytes(16, "big")
            + pm_data
        )
    else:
        paymaster_and_data = b""

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
