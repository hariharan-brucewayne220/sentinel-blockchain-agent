// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/SentinelPaymaster.sol";
import "account-abstraction/interfaces/IEntryPoint.sol";
import "account-abstraction/interfaces/PackedUserOperation.sol";

/// @notice Minimal EntryPoint stub for paymaster unit tests.
///         Only implements the interface surface the paymaster calls.
contract MockEntryPoint {
    mapping(address => uint256) public deposits;

    function depositTo(address account) external payable {
        deposits[account] += msg.value;
    }

    function withdrawTo(address payable to, uint256 amount) external {
        payable(to).transfer(amount);
    }

    // IERC165
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IEntryPoint).interfaceId || interfaceId == 0x01ffc9a7;
    }

    receive() external payable {}
}

contract SentinelPaymasterTest is Test {
    SentinelPaymaster paymaster;
    MockEntryPoint    ep;

    address registered   = address(0xACC);
    address unregistered = address(0xBAD);

    function setUp() public {
        ep = new MockEntryPoint();
        paymaster = new SentinelPaymaster(IEntryPoint(address(ep)));
        paymaster.setAccountRegistered(registered, true);
    }

    // -------------------------------------------------------------------------
    // Registration
    // -------------------------------------------------------------------------
    function test_RegisteredAccountIsRecognised() public view {
        assertTrue(paymaster.registeredAccounts(registered));
        assertFalse(paymaster.registeredAccounts(unregistered));
    }

    function test_DeregisterAccount() public {
        paymaster.setAccountRegistered(registered, false);
        assertFalse(paymaster.registeredAccounts(registered));
    }

    function test_OnlyOwnerCanRegister() public {
        vm.prank(address(0xBAD));
        vm.expectRevert();
        paymaster.setAccountRegistered(address(0x1234), true);
    }

    // -------------------------------------------------------------------------
    // validatePaymasterUserOp — tested via internal call simulation
    // -------------------------------------------------------------------------
    function _buildUserOp(address sender) internal pure returns (PackedUserOperation memory op) {
        op.sender = sender;
        op.nonce = 0;
        op.initCode = "";
        op.callData = "";
        op.accountGasLimits = bytes32(0);
        op.preVerificationGas = 0;
        op.gasFees = bytes32(0);
        op.paymasterAndData = "";
        op.signature = "";
    }

    function test_Revert_UnregisteredSender() public {
        // Expose internal via inheritance harness trick
        // Instead, test via the paymaster's public validatePaymasterUserOp by spoofing EntryPoint
        PackedUserOperation memory op = _buildUserOp(unregistered);
        vm.prank(address(ep));
        vm.expectRevert(
            abi.encodeWithSelector(
                SentinelPaymaster.SentinelPaymaster__SenderNotRegistered.selector,
                unregistered
            )
        );
        paymaster.validatePaymasterUserOp(op, bytes32(0), 0);
    }

    function test_RegisteredSenderPasses() public {
        PackedUserOperation memory op = _buildUserOp(registered);
        vm.prank(address(ep));
        (bytes memory ctx, uint256 validationData) = paymaster.validatePaymasterUserOp(op, bytes32(0), 0);
        assertEq(ctx.length, 0);
        assertEq(validationData, 0); // SIG_VALIDATION_SUCCESS
    }

    // -------------------------------------------------------------------------
    // Deposit / withdraw
    // -------------------------------------------------------------------------
    function test_DepositToEntryPoint() public {
        paymaster.depositToEntryPoint{value: 1 ether}();
        assertEq(ep.deposits(address(paymaster)), 1 ether);
    }

    function test_OnlyOwnerCanWithdraw() public {
        vm.deal(address(ep), 1 ether);
        vm.prank(address(0xBAD));
        vm.expectRevert();
        paymaster.withdrawFromEntryPoint(payable(address(0xBAD)), 0.1 ether);
    }

    function test_ReceiveEth() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(paymaster).call{value: 0.5 ether}("");
        assertTrue(ok);
        assertEq(address(paymaster).balance, 0.5 ether);
    }
}
