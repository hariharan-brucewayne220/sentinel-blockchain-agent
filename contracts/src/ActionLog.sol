// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Append-only audit log. Every agent trade emits an event that links
///         the on-chain execution to the agent's off-chain reasoning blob on IPFS.
contract ActionLog is Ownable {
    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------
    error ActionLog__OnlySentinelAccount();

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------
    address public sentinelAccount;
    uint256 public actionCount;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted once per agent-initiated trade.
    /// @param actionId     Monotonic counter — unique ID for this action
    /// @param tokenIn      ERC-20 sold
    /// @param tokenOut     ERC-20 bought
    /// @param amountIn     Raw amount of tokenIn
    /// @param amountOut    Raw amount of tokenOut received
    /// @param reasoningCID IPFS CID of the agent's reasoning blob (full CIDv1 string)
    /// @param timestamp    block.timestamp at execution
    event ActionExecuted(
        uint256 indexed actionId,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        string  reasoningCID,
        uint256 timestamp
    );

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address _sentinelAccount) Ownable(msg.sender) {
        sentinelAccount = _sentinelAccount;
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------
    modifier onlySentinelAccount() {
        if (msg.sender != sentinelAccount) revert ActionLog__OnlySentinelAccount();
        _;
    }

    // -------------------------------------------------------------------------
    // Core
    // -------------------------------------------------------------------------

    /// @notice Record a completed trade. Called by SentinelAccount post-swap.
    function logAction(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        string calldata reasoningCID
    ) external onlySentinelAccount returns (uint256 actionId) {
        actionId = ++actionCount;
        emit ActionExecuted(actionId, tokenIn, tokenOut, amountIn, amountOut, reasoningCID, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------
    function setSentinelAccount(address _account) external onlyOwner {
        sentinelAccount = _account;
    }
}
