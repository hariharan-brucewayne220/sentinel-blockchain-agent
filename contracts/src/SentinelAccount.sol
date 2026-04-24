// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "account-abstraction/samples/SimpleAccount.sol";
import "./PolicyGuard.sol";
import "./ActionLog.sol";

/// @notice ERC-4337 smart account that enforces PolicyGuard before every swap
///         and writes an audit entry to ActionLog after every swap.
///
///         Extends eth-infinitism SimpleAccount (v0.7). The agent's signing key
///         is the owner EOA. All trades flow through executeSwap(), not execute().
contract SentinelAccount is SimpleAccount {
    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------
    error SentinelAccount__SwapFailed(bytes reason);

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------
    PolicyGuard public policyGuard;
    ActionLog   public actionLog;
    address     public guardian;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event GuardianSet(address indexed guardian);
    event PolicyGuardUpdated(address indexed policyGuard);
    event ActionLogUpdated(address indexed actionLog);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(IEntryPoint _entryPoint) SimpleAccount(_entryPoint) {}

    /// @notice Initialiser called once after proxy deployment.
    function initialize(
        address _owner,
        address _policyGuard,
        address _actionLog,
        address _guardian
    ) external initializer {
        // initialise SimpleAccount (sets owner)
        super.initialize(_owner);
        policyGuard = PolicyGuard(_policyGuard);
        actionLog   = ActionLog(_actionLog);
        guardian    = _guardian;
    }

    // -------------------------------------------------------------------------
    // Swap entry point — the only path the agent uses
    // -------------------------------------------------------------------------

    /// @notice Execute a DEX swap through PolicyGuard.
    ///         Called via a UserOperation from the agent.
    /// @param dex          DEX router address (e.g. 1inch)
    /// @param tokenIn      ERC-20 being sold
    /// @param tokenOut     ERC-20 being bought
    /// @param amountIn     Amount of tokenIn to sell
    /// @param swapCalldata Encoded swap calldata from 1inch API
    /// @param reasoningCID IPFS CID of the agent's reasoning blob
    function executeSwap(
        address dex,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        bytes calldata swapCalldata,
        string calldata reasoningCID
    ) external {
        _requireFromEntryPointOrOwner();

        // 1. Policy check — reverts if any rule violated
        policyGuard.checkPolicy(tokenIn, tokenOut, amountIn);

        // 2. Execute swap on DEX
        uint256 balanceBefore = _balanceOf(tokenOut);
        (bool ok, bytes memory reason) = dex.call(swapCalldata);
        if (!ok) revert SentinelAccount__SwapFailed(reason);
        uint256 amountOut = _balanceOf(tokenOut) - balanceBefore;

        // 3. Record loss if applicable (simplified: record 0 here, agent updates off-chain)
        //    A production version would compute USD delta via Chainlink and call recordLoss.

        // 4. Emit audit log with IPFS reasoning CID
        actionLog.logAction(tokenIn, tokenOut, amountIn, amountOut, reasoningCID);
    }

    // -------------------------------------------------------------------------
    // Admin (owner-only, called via execute() UserOperation)
    // -------------------------------------------------------------------------
    function setPolicyGuard(address _policyGuard) external {
        _requireFromEntryPointOrOwner();
        policyGuard = PolicyGuard(_policyGuard);
        emit PolicyGuardUpdated(_policyGuard);
    }

    function setActionLog(address _actionLog) external {
        _requireFromEntryPointOrOwner();
        actionLog = ActionLog(_actionLog);
        emit ActionLogUpdated(_actionLog);
    }

    function setGuardian(address _guardian) external {
        _requireFromEntryPointOrOwner();
        guardian = _guardian;
        emit GuardianSet(_guardian);
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------
    function _balanceOf(address token) internal view returns (uint256) {
        (bool ok, bytes memory data) = token.staticcall(
            abi.encodeWithSignature("balanceOf(address)", address(this))
        );
        require(ok, "balanceOf failed");
        return abi.decode(data, (uint256));
    }
}
