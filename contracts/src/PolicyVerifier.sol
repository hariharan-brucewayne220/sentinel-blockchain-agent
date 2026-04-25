// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Placeholder verifier — replace with the output of `zk/generate_proof.py`
/// (ezkl create-evm-verifier) before production deployment.
///
/// The real verifier proves that the RiskCheck drawdown model evaluated
/// correctly: portfolio_drawdown <= max_drawdown_pct.
///
/// To regenerate:
///   cd zk && python export_model.py && python generate_proof.py
///   cp zk/model/PolicyVerifier.sol contracts/src/PolicyVerifier.sol
contract PolicyVerifier {
    /// @notice Verify a ZK proof that the drawdown check passed.
    /// @param proof   ABI-encoded proof bytes from ezkl prove
    /// @param instances Public inputs: [current_drawdown_fp, max_drawdown_fp]
    ///                  where each value is a fixed-point integer (scale from settings.json)
    /// @return true if the proof is valid
    function verifyProof(
        bytes calldata proof,
        uint256[] calldata instances
    ) external view returns (bool) {
        // Placeholder: always returns true until EZKL verifier is generated.
        // The real implementation is a ~500-line KZG verifier emitted by ezkl.
        return proof.length > 0 && instances.length >= 2;
    }
}
