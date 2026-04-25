// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "account-abstraction/interfaces/IEntryPoint.sol";
import "../src/PolicyGuard.sol";
import "../src/ActionLog.sol";
import "../src/SentinelAccount.sol";
import "../src/SentinelPaymaster.sol";

/// @notice One-shot deploy script for the Sentinel contract suite on Base Sepolia.
///
/// Usage:
///   forge script script/Deploy.s.sol \
///     --rpc-url base_sepolia \
///     --broadcast \
///     --verify
///
/// Required env vars:
///   PRIVATE_KEY      — deployer private key (no 0x prefix needed by vm.envUint)
///   BASE_SEPOLIA_RPC — RPC endpoint (consumed by foundry.toml [rpc_endpoints])
contract Deploy is Script {
    // EntryPoint v0.7 canonical address (same on every EVM chain)
    address constant ENTRY_POINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    // Demo policy parameters (18-decimal USD values)
    uint256 constant MAX_TRADE_SIZE_USD   = 10_000e18; // $10,000 per trade
    uint256 constant DAILY_DRAWDOWN_LIMIT = 1_000e18;  // $1,000 daily drawdown
    uint256 constant COOLDOWN_PERIOD      = 5 minutes; // 5 min between trades on same token

    // Paymaster pre-fund amount
    uint256 constant PAYMASTER_DEPOSIT = 0.02 ether;

    uint256 constant CHAIN_ID_BASE_SEPOLIA = 84532;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Pre-flight: deployer must hold enough ETH to fund the paymaster
        require(
            deployer.balance >= PAYMASTER_DEPOSIT,
            string.concat(
                "Deploy: deployer balance too low; need 0.05 ETH, have ",
                vm.toString(deployer.balance)
            )
        );

        vm.startBroadcast(deployerPrivateKey);

        // -----------------------------------------------------------------------
        // 1. Deploy PolicyGuard (placeholder sentinelAccount = address(0x1))
        //    NOTE: PolicyGuard and ActionLog are owned by the deployer EOA (not the proxy).
        //    Call policyGuard.transferOwnership(multisig) before mainnet use.
        // -----------------------------------------------------------------------
        PolicyGuard policyGuard = new PolicyGuard(
            address(0x1),        // sentinelAccount — updated after proxy is known
            MAX_TRADE_SIZE_USD,
            DAILY_DRAWDOWN_LIMIT,
            COOLDOWN_PERIOD
        );

        // -----------------------------------------------------------------------
        // 2. Deploy ActionLog (placeholder sentinelAccount = address(0x1))
        // -----------------------------------------------------------------------
        ActionLog actionLog = new ActionLog(
            address(0x1)         // sentinelAccount — updated after proxy is known
        );

        // -----------------------------------------------------------------------
        // 3. Deploy SentinelAccount (UUPS upgradeable)
        //    a) Deploy the implementation contract
        //    b) Encode initializer calldata
        //    c) Wrap in ERC1967Proxy
        // -----------------------------------------------------------------------
        SentinelAccount impl = new SentinelAccount(IEntryPoint(ENTRY_POINT));

        bytes memory initData = abi.encodeCall(
            SentinelAccount.initialize,
            (
                deployer,              // owner
                address(policyGuard),
                address(actionLog),
                deployer               // guardian (demo)
            )
        );

        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        address proxyAddress = address(proxy);

        // -----------------------------------------------------------------------
        // 4. Deploy SentinelPaymaster
        // -----------------------------------------------------------------------
        SentinelPaymaster paymaster = new SentinelPaymaster(IEntryPoint(ENTRY_POINT));

        // -----------------------------------------------------------------------
        // 5. Post-deployment wiring
        // -----------------------------------------------------------------------

        // Replace placeholder with real proxy address
        policyGuard.setSentinelAccount(proxyAddress);
        actionLog.setSentinelAccount(proxyAddress);

        // Register the proxy so the paymaster sponsors its operations
        paymaster.setAccountRegistered(proxyAddress, true);

        // Fund paymaster gas sponsorship on the EntryPoint
        paymaster.depositToEntryPoint{value: PAYMASTER_DEPOSIT}();

        // Verify wiring took effect
        assert(policyGuard.sentinelAccount() == proxyAddress);
        assert(actionLog.sentinelAccount()   == proxyAddress);
        assert(paymaster.registeredAccounts(proxyAddress));

        vm.stopBroadcast();

        // -----------------------------------------------------------------------
        // 6. Write deployment addresses to deployments/base-sepolia.json
        // -----------------------------------------------------------------------
        string memory json = "deployment";

        vm.serializeString(json, "network",            "base-sepolia");
        vm.serializeUint(json,   "chainId",            CHAIN_ID_BASE_SEPOLIA);
        vm.serializeString(json, "entryPoint",         vm.toString(ENTRY_POINT));
        vm.serializeString(json, "PolicyGuard",        vm.toString(address(policyGuard)));
        vm.serializeString(json, "ActionLog",          vm.toString(address(actionLog)));
        vm.serializeString(json, "SentinelAccountImpl", vm.toString(address(impl)));
        vm.serializeString(json, "SentinelAccount",    vm.toString(proxyAddress));
        vm.serializeString(json, "SentinelPaymaster",  vm.toString(address(paymaster)));
        string memory finalJson = vm.serializeString(json, "deployedAt", vm.toString(block.timestamp));

        vm.writeJson(finalJson, "deployments/base-sepolia.json");

        // -----------------------------------------------------------------------
        // 7. Console summary
        // -----------------------------------------------------------------------
        console2.log("=== Sentinel deployment complete ===");
        console2.log("Deployer          :", deployer);
        console2.log("PolicyGuard       :", address(policyGuard));
        console2.log("ActionLog         :", address(actionLog));
        console2.log("SentinelAccountImpl:", address(impl));
        console2.log("SentinelAccount   :", proxyAddress);
        console2.log("SentinelPaymaster :", address(paymaster));
        console2.log("EntryPoint        :", ENTRY_POINT);
    }
}

// =============================================================================
// forge verify-contract reference commands (run after --broadcast)
// =============================================================================
//
// forge verify-contract <POLICY_GUARD_ADDR> \
//   src/PolicyGuard.sol:PolicyGuard \
//   --chain base-sepolia \
//   --constructor-args $(cast abi-encode "constructor(address,uint256,uint256,uint256)" \
//       0x0000000000000000000000000000000000000001 \
//       10000000000000000000000 \
//       1000000000000000000000 \
//       300) \
//   --watch
//
// forge verify-contract <ACTION_LOG_ADDR> \
//   src/ActionLog.sol:ActionLog \
//   --chain base-sepolia \
//   --constructor-args $(cast abi-encode "constructor(address)" \
//       0x0000000000000000000000000000000000000001) \
//   --watch
//
// forge verify-contract <SENTINEL_ACCOUNT_IMPL_ADDR> \
//   src/SentinelAccount.sol:SentinelAccount \
//   --chain base-sepolia \
//   --constructor-args $(cast abi-encode "constructor(address)" \
//       0x0000000071727De22E5E9d8BAf0edAc6f37da032) \
//   --watch
//
// forge verify-contract <SENTINEL_ACCOUNT_PROXY_ADDR> \
//   lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy \
//   --chain base-sepolia \
//   --watch
//
// forge verify-contract <SENTINEL_PAYMASTER_ADDR> \
//   src/SentinelPaymaster.sol:SentinelPaymaster \
//   --chain base-sepolia \
//   --constructor-args $(cast abi-encode "constructor(address)" \
//       0x0000000071727De22E5E9d8BAf0edAc6f37da032) \
//   --watch
