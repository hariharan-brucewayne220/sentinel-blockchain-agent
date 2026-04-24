// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/PolicyGuard.sol";

/// @notice Mock Chainlink feed for deterministic tests
contract MockFeed {
    int256 public price;
    uint256 public updatedAt;
    uint8   public decimals = 8;

    constructor(int256 _price) {
        price = _price;
        updatedAt = block.timestamp;
    }

    function latestRoundData() external view returns (
        uint80, int256, uint256, uint256, uint80
    ) {
        return (0, price, 0, updatedAt, 0);
    }

    function setStale() external { updatedAt = 1; } // fixed old timestamp guaranteed stale
    function setPrice(int256 _p) external { price = _p; updatedAt = block.timestamp; }
}

contract PolicyGuardTest is Test {
    PolicyGuard guard;
    MockFeed    feed;

    address sentinel = address(0xACC);
    address tokenA   = address(0xAA);
    address tokenB   = address(0xBB);

    // 100 USD cap, 200 USD drawdown, 60s cooldown
    uint256 constant MAX_TRADE   = 100e18;
    uint256 constant MAX_DRAWDOWN = 200e18;
    uint256 constant COOLDOWN    = 60;

    function setUp() public {
        vm.warp(10_000); // start well past 0 so stale checks and cooldown math don't underflow
        guard = new PolicyGuard(sentinel, MAX_TRADE, MAX_DRAWDOWN, COOLDOWN);
        feed  = new MockFeed(2000e8); // $2000 per token (8 decimals)

        guard.setTokenWhitelist(tokenA, true);
        guard.setTokenWhitelist(tokenB, true);
        guard.setPriceFeed(tokenA, address(feed));
    }

    // -------------------------------------------------------------------------
    // Happy path
    // -------------------------------------------------------------------------
    function test_CheckPolicy_Passes() public {
        vm.prank(sentinel);
        // 0.04 tokenA × $2000 = $80 — under $100 cap
        guard.checkPolicy(tokenA, tokenB, 0.04e18);
    }

    // -------------------------------------------------------------------------
    // Token whitelist
    // -------------------------------------------------------------------------
    function test_Revert_TokenInNotWhitelisted() public {
        address rogue = address(0xBAD);
        vm.prank(sentinel);
        vm.expectRevert(abi.encodeWithSelector(PolicyGuard.PolicyGuard__TokenNotWhitelisted.selector, rogue));
        guard.checkPolicy(rogue, tokenB, 1e18);
    }

    function test_Revert_TokenOutNotWhitelisted() public {
        address rogue = address(0xBAD);
        vm.prank(sentinel);
        vm.expectRevert(abi.encodeWithSelector(PolicyGuard.PolicyGuard__TokenNotWhitelisted.selector, rogue));
        guard.checkPolicy(tokenA, rogue, 0.01e18);
    }

    // -------------------------------------------------------------------------
    // Trade size cap
    // -------------------------------------------------------------------------
    function test_Revert_TradeSizeExceeded() public {
        // 0.06e18 × $2000 = $120 > $100 cap
        vm.prank(sentinel);
        vm.expectRevert(abi.encodeWithSelector(
            PolicyGuard.PolicyGuard__TradeSizeExceeded.selector,
            120e18, MAX_TRADE
        ));
        guard.checkPolicy(tokenA, tokenB, 0.06e18);
    }

    function testFuzz_TradeSizeCapEnforced(uint256 amount) public {
        // amount that would exceed $100 cap: amount > 0.05e18
        amount = bound(amount, 0.051e18, 1000e18);
        vm.prank(sentinel);
        vm.expectPartialRevert(PolicyGuard.PolicyGuard__TradeSizeExceeded.selector);
        guard.checkPolicy(tokenA, tokenB, amount);
    }

    function testFuzz_TradeSizeUnderCapPasses(uint256 amount) public {
        // amount that stays under cap: amount <= 0.05e18 (= $100 at $2000/token)
        amount = bound(amount, 1, 0.05e18);
        vm.prank(sentinel);
        guard.checkPolicy(tokenA, tokenB, amount);
    }

    // -------------------------------------------------------------------------
    // Cooldown
    // -------------------------------------------------------------------------
    function test_Revert_CooldownActive() public {
        vm.prank(sentinel);
        guard.checkPolicy(tokenA, tokenB, 0.01e18);

        vm.prank(sentinel);
        vm.expectPartialRevert(PolicyGuard.PolicyGuard__CooldownActive.selector);
        guard.checkPolicy(tokenA, tokenB, 0.01e18);
    }

    function test_CooldownExpires() public {
        vm.prank(sentinel);
        guard.checkPolicy(tokenA, tokenB, 0.01e18);

        vm.warp(block.timestamp + COOLDOWN + 1);
        vm.prank(sentinel);
        guard.checkPolicy(tokenA, tokenB, 0.01e18); // should not revert
    }

    // -------------------------------------------------------------------------
    // Drawdown
    // -------------------------------------------------------------------------
    function test_Revert_DrawdownExceeded() public {
        vm.prank(sentinel);
        guard.recordLoss(200e18); // fills the bucket to limit

        // Use a token pair with no feed → USD = 0 → trade size skipped, drawdown fires
        address freshIn  = address(0xCC);
        address freshOut = address(0xDD);
        guard.setTokenWhitelist(freshIn, true);
        guard.setTokenWhitelist(freshOut, true);

        vm.prank(sentinel);
        vm.expectPartialRevert(PolicyGuard.PolicyGuard__DrawdownExceeded.selector);
        guard.checkPolicy(freshIn, freshOut, 0.01e18);
    }

    function test_DrawdownWindowResets() public {
        vm.prank(sentinel);
        guard.recordLoss(200e18);

        vm.warp(block.timestamp + 24 hours + 1);
        feed.setPrice(2000e8); // refresh feed so it's not stale after warp
        vm.prank(sentinel);
        guard.checkPolicy(tokenA, tokenB, 0.01e18); // window reset, should pass
    }

    // -------------------------------------------------------------------------
    // Oracle staleness
    // -------------------------------------------------------------------------
    function test_Revert_StaleOracle() public {
        feed.setStale();
        vm.prank(sentinel);
        vm.expectPartialRevert(PolicyGuard.PolicyGuard__StaleOraclePrice.selector);
        guard.checkPolicy(tokenA, tokenB, 0.01e18);
    }

    // -------------------------------------------------------------------------
    // Access control
    // -------------------------------------------------------------------------
    function test_Revert_NotSentinelAccount() public {
        vm.expectRevert(PolicyGuard.PolicyGuard__OnlySentinelAccount.selector);
        guard.checkPolicy(tokenA, tokenB, 0.01e18); // caller = address(this), not sentinel
    }

    function test_OnlyOwnerCanUpdatePolicy() public {
        vm.prank(address(0xBAD));
        vm.expectRevert();
        guard.updatePolicy(1e18, 1e18, 30);
    }

    function test_UpdatePolicy_ChangesValues() public {
        guard.updatePolicy(50e18, 100e18, 120);
        assertEq(guard.maxTradeSizeUsd(),    50e18);
        assertEq(guard.dailyDrawdownLimit(), 100e18);
        assertEq(guard.cooldownPeriod(),     120);
    }

    function test_SetSentinelAccount_Changes() public {
        address next = address(0x9999);
        guard.setSentinelAccount(next);
        assertEq(guard.sentinelAccount(), next);
    }

    // -------------------------------------------------------------------------
    // Invariant: drawdown never exceeds limit in any sequence of recordLoss calls
    // -------------------------------------------------------------------------
    function testFuzz_DrawdownNeverExceedsLimitPostCheck(uint256 loss1, uint256 loss2) public {
        loss1 = bound(loss1, 0, MAX_DRAWDOWN);
        loss2 = bound(loss2, 0, MAX_DRAWDOWN);

        vm.startPrank(sentinel);
        guard.recordLoss(loss1);
        guard.recordLoss(loss2);
        vm.stopPrank();

        // After losses, checkPolicy should revert if cumulativeDrawdown >= limit.
        // Use fresh tokens with no price feed → USD = 0 → trade size skipped, drawdown check fires.
        if (guard.cumulativeDrawdown() >= MAX_DRAWDOWN) {
            address freshIn  = address(0xCC);
            address freshOut = address(0xDD);
            guard.setTokenWhitelist(freshIn, true);
            guard.setTokenWhitelist(freshOut, true);
            vm.prank(sentinel);
            vm.expectPartialRevert(PolicyGuard.PolicyGuard__DrawdownExceeded.selector);
            guard.checkPolicy(freshIn, freshOut, 0.01e18);
        }
    }
}
