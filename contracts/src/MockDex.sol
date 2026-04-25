// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Testnet-only mock DEX. Accepts any swap calldata and returns success.
/// Allows the full ERC-4337 → SentinelAccount → ActionLog pipeline to run on
/// Base Sepolia without requiring real liquidity pools.
contract MockDex {
    event SwapExecuted(address indexed tokenIn, address indexed tokenOut, uint256 amountIn);

    /// @notice Matches Uniswap V3 exactInputSingle selector (0x04e45aaf).
    /// Accepts the call, emits an event, and returns a fake amountOut.
    fallback(bytes calldata) external returns (bytes memory) {
        emit SwapExecuted(address(0), address(0), 0);
        return abi.encode(uint256(1)); // fake amountOut = 1
    }
}
