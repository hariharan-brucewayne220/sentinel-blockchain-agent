// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "account-abstraction/core/BasePaymaster.sol";
import "account-abstraction/interfaces/IEntryPoint.sol";

/// @notice Verifying paymaster that sponsors gas for registered SentinelAccounts.
///         Holds an ETH deposit on the EntryPoint. Validates that the UserOperation
///         originates from a whitelisted SentinelAccount address.
contract SentinelPaymaster is BasePaymaster {
    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------
    error SentinelPaymaster__SenderNotRegistered(address sender);

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------
    mapping(address => bool) public registeredAccounts;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event AccountRegistered(address indexed account, bool registered);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(IEntryPoint _entryPoint) BasePaymaster(_entryPoint) {}

    // -------------------------------------------------------------------------
    // IPaymaster implementation
    // -------------------------------------------------------------------------

    /// @inheritdoc BasePaymaster
    function _validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32, /* userOpHash */
        uint256  /* maxCost */
    ) internal view override returns (bytes memory context, uint256 validationData) {
        if (!registeredAccounts[userOp.sender])
            revert SentinelPaymaster__SenderNotRegistered(userOp.sender);

        // No post-op context needed; return empty context and SIG_VALIDATION_SUCCESS (0)
        return ("", 0);
    }

    /// @inheritdoc BasePaymaster
    function _postOp(
        PostOpMode, /* mode */
        bytes calldata, /* context */
        uint256, /* actualGasCost */
        uint256  /* actualUserOpFeePerGas */
    ) internal pure override {
        // No post-op logic needed for this simple paymaster
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Register or deregister a SentinelAccount for gas sponsorship.
    function setAccountRegistered(address account, bool registered) external onlyOwner {
        registeredAccounts[account] = registered;
        emit AccountRegistered(account, registered);
    }

    /// @notice Deposit ETH into the EntryPoint for gas sponsorship.
    function depositToEntryPoint() external payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }

    /// @notice Withdraw ETH from the EntryPoint.
    function withdrawFromEntryPoint(address payable to, uint256 amount) external onlyOwner {
        entryPoint.withdrawTo(to, amount);
    }

    receive() external payable {}
}
