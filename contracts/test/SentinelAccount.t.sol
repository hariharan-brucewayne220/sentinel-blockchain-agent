// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/SentinelAccount.sol";
import "../src/PolicyGuard.sol";
import "../src/ActionLog.sol";
import "account-abstraction/interfaces/IEntryPoint.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @notice Minimal ERC-20 mock for balance tracking
contract MockERC20 {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function burn(address from, uint256 amount) external { balanceOf[from] -= amount; }
}

/// @notice DEX that swaps tokenIn for tokenOut 1:1 (for test simplicity)
contract MockDex {
    MockERC20 public tokenIn;
    MockERC20 public tokenOut;
    bool public shouldFail;

    constructor(address _in, address _out) {
        tokenIn  = MockERC20(_in);
        tokenOut = MockERC20(_out);
    }

    function setFail(bool _fail) external { shouldFail = _fail; }

    function swap(address account, uint256 amountIn) external {
        require(!shouldFail, "DEX: swap failed");
        tokenIn.burn(account, amountIn);
        tokenOut.mint(account, amountIn); // 1:1 for simplicity
    }
}

/// @notice Minimal EntryPoint stub — only implements the IEntryPoint interface surface used by
///         SentinelAccount's inherited BaseAccount and _requireFromEntryPointOrOwner.
contract MockEntryPoint {
    function handleOps(bytes calldata, address payable) external {}
    function getNonce(address, uint192) external pure returns (uint256) { return 0; }
    function depositTo(address) external payable {}
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IEntryPoint).interfaceId || interfaceId == 0x01ffc9a7;
    }
    receive() external payable {}
}

contract SentinelAccountTest is Test {
    SentinelAccount account;
    PolicyGuard     guard;
    ActionLog       alog;
    MockEntryPoint  ep;
    MockERC20       tokenA;
    MockERC20       tokenB;
    MockDex         dex;

    address owner   = address(0xAA);
    address guardian = address(0xBB);

    uint256 constant MAX_TRADE    = 100e18;
    uint256 constant MAX_DRAWDOWN = 200e18;
    uint256 constant COOLDOWN     = 60;

    function setUp() public {
        vm.warp(10_000);

        ep = new MockEntryPoint();

        // Predict proxy address so PolicyGuard/ActionLog can be constructed with it
        // Deploy implementation first
        SentinelAccount impl = new SentinelAccount(IEntryPoint(address(ep)));

        // Deploy PolicyGuard and ActionLog with a placeholder sentinel (updated after proxy deploy)
        guard = new PolicyGuard(address(0x1), MAX_TRADE, MAX_DRAWDOWN, COOLDOWN);
        alog  = new ActionLog(address(0x1));

        // Deploy UUPS proxy — this calls initialize in the same tx
        bytes memory initData = abi.encodeWithSelector(
            SentinelAccount.initialize.selector,
            owner, address(guard), address(alog), guardian
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        account = SentinelAccount(payable(address(proxy)));

        // Update PolicyGuard and ActionLog to point to the real proxy
        guard.setSentinelAccount(address(account));
        alog.setSentinelAccount(address(account));

        // Setup tokens and DEX
        tokenA = new MockERC20();
        tokenB = new MockERC20();
        dex    = new MockDex(address(tokenA), address(tokenB));

        // Whitelist tokens
        guard.setTokenWhitelist(address(tokenA), true);
        guard.setTokenWhitelist(address(tokenB), true);

        // Give the account some tokenA to sell
        tokenA.mint(address(account), 10e18);
    }

    // -------------------------------------------------------------------------
    // Initialisation
    // -------------------------------------------------------------------------
    function test_Initialize_SetsState() public view {
        assertEq(account.owner(),    owner);
        assertEq(account.guardian(), guardian);
        assertEq(address(account.policyGuard()), address(guard));
        assertEq(address(account.actionLog()),   address(alog));
    }

    function test_Initialize_CannotBeCalledAgain() public {
        vm.expectRevert();
        account.initialize(address(0x1234), address(guard), address(alog), address(0));
    }

    // -------------------------------------------------------------------------
    // executeSwap — happy path
    // -------------------------------------------------------------------------
    function test_ExecuteSwap_LogsAction() public {
        bytes memory swapData = abi.encodeWithSignature(
            "swap(address,uint256)", address(account), 0.01e18
        );

        vm.expectEmit(true, true, true, false);
        emit ActionLog.ActionExecuted(1, address(tokenA), address(tokenB), 0.01e18, 0.01e18, "bafytest", 0);

        vm.prank(owner);
        account.executeSwap(address(dex), address(tokenA), address(tokenB), 0.01e18, swapData, "bafytest");

        assertEq(alog.actionCount(), 1);
        assertEq(tokenB.balanceOf(address(account)), 0.01e18);
    }

    // -------------------------------------------------------------------------
    // executeSwap — policy enforcement
    // -------------------------------------------------------------------------
    function test_ExecuteSwap_RevertsOnPolicyViolation() public {
        // TokenC is not whitelisted — PolicyGuard should revert
        MockERC20 tokenC = new MockERC20();
        bytes memory swapData = abi.encodeWithSignature(
            "swap(address,uint256)", address(account), 0.01e18
        );

        vm.prank(owner);
        vm.expectPartialRevert(PolicyGuard.PolicyGuard__TokenNotWhitelisted.selector);
        account.executeSwap(address(dex), address(tokenC), address(tokenB), 0.01e18, swapData, "cid");
    }

    function test_ExecuteSwap_RevertsWhenDexFails() public {
        dex.setFail(true);
        bytes memory swapData = abi.encodeWithSignature(
            "swap(address,uint256)", address(account), 0.01e18
        );

        vm.prank(owner);
        vm.expectPartialRevert(SentinelAccount.SentinelAccount__SwapFailed.selector);
        account.executeSwap(address(dex), address(tokenA), address(tokenB), 0.01e18, swapData, "cid");
    }

    // -------------------------------------------------------------------------
    // Access control on executeSwap
    // -------------------------------------------------------------------------
    function test_ExecuteSwap_RevertsForNonOwner() public {
        bytes memory swapData = abi.encodeWithSignature(
            "swap(address,uint256)", address(account), 0.01e18
        );

        vm.prank(address(0xBAD));
        vm.expectRevert();
        account.executeSwap(address(dex), address(tokenA), address(tokenB), 0.01e18, swapData, "cid");
    }

    // -------------------------------------------------------------------------
    // Admin setters
    // -------------------------------------------------------------------------
    function test_SetPolicyGuard() public {
        PolicyGuard newGuard = new PolicyGuard(address(account), MAX_TRADE, MAX_DRAWDOWN, COOLDOWN);
        vm.prank(owner);
        account.setPolicyGuard(address(newGuard));
        assertEq(address(account.policyGuard()), address(newGuard));
    }

    function test_SetActionLog() public {
        ActionLog newLog = new ActionLog(address(account));
        vm.prank(owner);
        account.setActionLog(address(newLog));
        assertEq(address(account.actionLog()), address(newLog));
    }

    function test_SetGuardian() public {
        address newGuardian = address(0xCC);
        vm.prank(owner);
        account.setGuardian(newGuardian);
        assertEq(account.guardian(), newGuardian);
    }

    function test_AdminSetters_RevertForNonOwner() public {
        vm.startPrank(address(0xBAD));
        vm.expectRevert();
        account.setPolicyGuard(address(0x1));
        vm.stopPrank();
    }
}
