"""
Export the RiskCheck drawdown model to ONNX format for EZKL proof generation.

The model proves a single inequality: portfolio_drawdown <= max_drawdown_pct.
Inputs  : [current_drawdown, max_drawdown_pct]  (both in range [0, 1])
Output  : [1.0] if check passes, [0.0] if it fails

EZKL converts this ONNX model into a ZK circuit and generates a Solidity
verifier (PolicyVerifier.sol) that can be deployed on-chain.
"""

import json
import os

import numpy as np
import torch
import torch.nn as nn


class DrawdownCheck(nn.Module):
    """Single-neuron network: passes when drawdown is within allowed threshold."""

    def __init__(self) -> None:
        super().__init__()
        # w = [-1, 1], b = 0  →  output = max_drawdown - current_drawdown
        # Positive output means check passes.
        self.linear = nn.Linear(2, 1, bias=True)
        with torch.no_grad():
            self.linear.weight.copy_(torch.tensor([[-1.0, 1.0]]))
            self.linear.bias.copy_(torch.tensor([0.0]))
        self.sigmoid = nn.Sigmoid()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.sigmoid(self.linear(x) * 20)  # steepen the sigmoid boundary


def main() -> None:
    model = DrawdownCheck()
    model.eval()

    dummy = torch.tensor([[0.05, 0.10]])  # 5% drawdown, 10% limit → should pass

    out_dir = os.path.join(os.path.dirname(__file__), "model")
    os.makedirs(out_dir, exist_ok=True)

    onnx_path = os.path.join(out_dir, "drawdown_check.onnx")
    torch.onnx.export(
        model,
        dummy,
        onnx_path,
        input_names=["drawdown_input"],
        output_names=["pass_probability"],
        opset_version=12,
    )
    print(f"Exported ONNX model → {onnx_path}")

    # Write sample input for EZKL calibration
    sample_input = {"input_data": [[0.05, 0.10]]}
    input_path = os.path.join(out_dir, "input.json")
    with open(input_path, "w") as f:
        json.dump(sample_input, f)
    print(f"Wrote sample input → {input_path}")

    # Quick sanity check
    with torch.no_grad():
        result = model(dummy)
    print(f"Sanity check — drawdown=0.05, limit=0.10 → score={result.item():.4f} (expected ~1.0)")

    passing_case = torch.tensor([[0.08, 0.10]])
    with torch.no_grad():
        r2 = model(passing_case)
    print(f"Sanity check — drawdown=0.08, limit=0.10 → score={r2.item():.4f} (expected ~1.0)")

    failing_case = torch.tensor([[0.15, 0.10]])
    with torch.no_grad():
        r3 = model(failing_case)
    print(f"Sanity check — drawdown=0.15, limit=0.10 → score={r3.item():.4f} (expected ~0.0)")


if __name__ == "__main__":
    main()
