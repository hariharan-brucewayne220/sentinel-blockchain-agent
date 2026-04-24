// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ActionLog.sol";

contract ActionLogTest is Test {
    ActionLog alog; // renamed to avoid clash with forge-std log event

    address sentinel = address(0xACC);
    address tokenA   = address(0xAA);
    address tokenB   = address(0xBB);

    function setUp() public {
        alog = new ActionLog(sentinel);
    }

    // -------------------------------------------------------------------------
    // Happy path — event emission
    // -------------------------------------------------------------------------
    function test_LogAction_EmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit ActionLog.ActionExecuted(
            1, tokenA, tokenB, 1e18, 2000e6, "bafybeig123", block.timestamp
        );
        vm.prank(sentinel);
        alog.logAction(tokenA, tokenB, 1e18, 2000e6, "bafybeig123");
    }

    function test_LogAction_ReturnsIncrementingId() public {
        vm.startPrank(sentinel);
        uint256 id1 = alog.logAction(tokenA, tokenB, 1e18, 1e18, "cid1");
        uint256 id2 = alog.logAction(tokenA, tokenB, 1e18, 1e18, "cid2");
        uint256 id3 = alog.logAction(tokenA, tokenB, 1e18, 1e18, "cid3");
        vm.stopPrank();

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(id3, 3);
        assertEq(alog.actionCount(), 3);
    }

    function test_LogAction_CounterIncrements() public {
        vm.warp(1_700_000_000);
        vm.prank(sentinel);
        alog.logAction(tokenA, tokenB, 1e18, 1e18, "cid");
        assertEq(alog.actionCount(), 1);
    }

    // -------------------------------------------------------------------------
    // Access control
    // -------------------------------------------------------------------------
    function test_Revert_NotSentinelAccount() public {
        vm.expectRevert(ActionLog.ActionLog__OnlySentinelAccount.selector);
        alog.logAction(tokenA, tokenB, 1e18, 1e18, "cid");
    }

    function test_OnlyOwnerCanChangeSentinel() public {
        vm.prank(address(0xBAD));
        vm.expectRevert();
        alog.setSentinelAccount(address(0x1234));
    }

    function test_OwnerCanChangeSentinel() public {
        address newSentinel = address(0x1234);
        alog.setSentinelAccount(newSentinel);
        assertEq(alog.sentinelAccount(), newSentinel);

        // old sentinel can no longer log
        vm.prank(sentinel);
        vm.expectRevert(ActionLog.ActionLog__OnlySentinelAccount.selector);
        alog.logAction(tokenA, tokenB, 1e18, 1e18, "cid");

        // new sentinel can log
        vm.prank(newSentinel);
        uint256 id = alog.logAction(tokenA, tokenB, 1e18, 1e18, "cid");
        assertEq(id, 1);
    }

    // -------------------------------------------------------------------------
    // Fuzz: actionId always increments monotonically
    // -------------------------------------------------------------------------
    function testFuzz_ActionIdMonotonicallyIncrements(uint8 n) public {
        n = uint8(bound(n, 1, 50));
        vm.startPrank(sentinel);
        for (uint256 i = 1; i <= n; i++) {
            uint256 id = alog.logAction(tokenA, tokenB, 1e18, 1e18, "cid");
            assertEq(id, i);
        }
        vm.stopPrank();
        assertEq(alog.actionCount(), n);
    }
}
