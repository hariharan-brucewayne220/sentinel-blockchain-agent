"""
EZKL pipeline: compile circuit, run setup, prove, and export PolicyVerifier.sol.

Run in order after export_model.py:
  python export_model.py
  python generate_proof.py

Outputs:
  model/settings.json         – circuit settings
  model/circuit.compiled      – compiled circuit
  model/pk.key / vk.key       – proving/verification keys
  model/proof.json            – proof artifact
  model/PolicyVerifier.sol    – Solidity verifier (copy to contracts/src/)
"""

import json
import os
import subprocess
import sys


MODEL_DIR = os.path.join(os.path.dirname(__file__), "model")
ONNX = os.path.join(MODEL_DIR, "drawdown_check.onnx")
INPUT = os.path.join(MODEL_DIR, "input.json")


def run(cmd: list[str], *, check: bool = True) -> subprocess.CompletedProcess:
    print(f"$ {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=False, check=False)
    if check and result.returncode != 0:
        sys.exit(result.returncode)
    return result


def main() -> None:
    if not os.path.exists(ONNX):
        print("ERROR: ONNX model not found. Run export_model.py first.")
        sys.exit(1)

    settings = os.path.join(MODEL_DIR, "settings.json")
    compiled = os.path.join(MODEL_DIR, "circuit.compiled")
    srs = os.path.join(MODEL_DIR, "kzg.srs")
    pk = os.path.join(MODEL_DIR, "pk.key")
    vk = os.path.join(MODEL_DIR, "vk.key")
    witness = os.path.join(MODEL_DIR, "witness.json")
    proof = os.path.join(MODEL_DIR, "proof.json")
    verifier = os.path.join(MODEL_DIR, "PolicyVerifier.sol")

    print("\n=== Step 1: Generate settings ===")
    run(["ezkl", "gen-settings", "-M", ONNX, "--settings-path", settings])

    print("\n=== Step 2: Calibrate settings ===")
    run(["ezkl", "calibrate-settings", "-M", ONNX, "--data", INPUT, "--settings-path", settings])

    print("\n=== Step 3: Compile circuit ===")
    run(["ezkl", "compile-circuit", "-M", ONNX, "--compiled-circuit", compiled, "--settings-path", settings])

    print("\n=== Step 4: Download SRS ===")
    run(["ezkl", "get-srs", "--srs-path", srs, "--settings-path", settings])

    print("\n=== Step 5: Setup (generate pk/vk) ===")
    run(["ezkl", "setup", "--compiled-circuit", compiled, "--srs-path", srs, "--vk-path", vk, "--pk-path", pk])

    print("\n=== Step 6: Generate witness ===")
    run(["ezkl", "gen-witness", "-M", ONNX, "-D", INPUT, "--compiled-circuit", compiled, "-O", witness])

    print("\n=== Step 7: Prove ===")
    run(["ezkl", "prove", "--compiled-circuit", compiled, "--witness", witness, "--pk-path", pk, "--proof-path", proof, "--srs-path", srs])

    print("\n=== Step 8: Verify proof ===")
    run(["ezkl", "verify", "--proof-path", proof, "--settings-path", settings, "--vk-path", vk, "--srs-path", srs])

    print("\n=== Step 9: Create EVM verifier ===")
    run(["ezkl", "create-evm-verifier", "--vk-path", vk, "--srs-path", srs, "--sol-code-path", verifier, "--settings-path", settings])

    print(f"\n✓ PolicyVerifier.sol written to {verifier}")
    print("  Copy it to contracts/src/PolicyVerifier.sol and run 'forge build'")

    # Compute and display proof CID hint
    print("\n=== Proof artifact ===")
    with open(proof) as f:
        proof_data = json.load(f)
    print(f"  Proof instances: {len(proof_data.get('instances', [[]]))}")
    print("  Pin model/proof.json to IPFS (Pinata) and store the CID in the agent's ActionRecord.proof_cid field.")


if __name__ == "__main__":
    main()
