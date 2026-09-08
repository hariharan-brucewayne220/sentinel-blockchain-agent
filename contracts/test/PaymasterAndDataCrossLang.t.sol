// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {UserOperationLib} from "account-abstraction/core/UserOperationLib.sol";

/// @notice Exposes the EntryPoint's internal `unpackPaymasterStaticFields` as an
/// external function, because it takes `bytes calldata` and can only be reached
/// through an external call.
contract UnpackHarness {
    function unpack(bytes calldata paymasterAndData)
        external
        pure
        returns (address paymaster, uint256 validationGasLimit, uint256 postOpGasLimit)
    {
        return UserOperationLib.unpackPaymasterStaticFields(paymasterAndData);
    }
}

/// @notice Cross-language check that the Python agent's `paymasterAndData` packing
/// is byte-compatible with the account-abstraction v0.7 EntryPoint that consumes it.
///
/// The Python side (agent/tools/userop.py::pack_paymaster_and_data) writes its exact
/// output into test/fixtures/paymaster_and_data.json; agent/tests/test_userop.py
/// asserts Python still reproduces those bytes. Here we take the same bytes and feed
/// them through the real UserOperationLib, so a change on either side breaks a test
/// instead of only failing on-chain.
contract PaymasterAndDataCrossLangTest is Test {
    UnpackHarness internal harness;
    string internal json;

    uint256 internal constant CASE_COUNT = 3;

    function setUp() public {
        harness = new UnpackHarness();
        json = vm.readFile("test/fixtures/paymaster_and_data.json");
    }

    function _key(uint256 i, string memory field) internal pure returns (string memory) {
        return string.concat(".cases[", vm.toString(i), "].", field);
    }

    /// The Python bytes round-trip through the EntryPoint's own unpacking.
    function test_PythonPackedBytes_UnpackViaUserOperationLib() public view {
        for (uint256 i = 0; i < CASE_COUNT; i++) {
            bytes memory packed = vm.parseJsonBytes(json, _key(i, "packed"));
            address expectedPaymaster = vm.parseJsonAddress(json, _key(i, "paymaster"));
            uint256 expectedVerificationGas = vm.parseJsonUint(json, _key(i, "paymasterVerificationGasLimit"));
            uint256 expectedPostOpGas = vm.parseJsonUint(json, _key(i, "paymasterPostOpGasLimit"));
            string memory name = vm.parseJsonString(json, _key(i, "name"));

            (address paymaster, uint256 validationGasLimit, uint256 postOpGasLimit) = harness.unpack(packed);

            assertEq(paymaster, expectedPaymaster, string.concat(name, ": paymaster address"));
            assertEq(validationGasLimit, expectedVerificationGas, string.concat(name, ": verification gas limit"));
            assertEq(postOpGasLimit, expectedPostOpGas, string.concat(name, ": postOp gas limit"));
        }
    }

    /// The fixed 52-byte prefix is exactly the static fields, and anything after it
    /// is the untouched `paymasterData` tail.
    function test_PythonPackedBytes_LayoutMatchesUserOperationLibOffsets() public view {
        assertEq(UserOperationLib.PAYMASTER_VALIDATION_GAS_OFFSET, 20, "validation gas offset");
        assertEq(UserOperationLib.PAYMASTER_POSTOP_GAS_OFFSET, 36, "postOp gas offset");
        assertEq(UserOperationLib.PAYMASTER_DATA_OFFSET, 52, "data offset");

        for (uint256 i = 0; i < CASE_COUNT; i++) {
            bytes memory packed = vm.parseJsonBytes(json, _key(i, "packed"));
            bytes memory paymasterData = vm.parseJsonBytes(json, _key(i, "paymasterData"));
            string memory name = vm.parseJsonString(json, _key(i, "name"));

            assertEq(
                packed.length,
                UserOperationLib.PAYMASTER_DATA_OFFSET + paymasterData.length,
                string.concat(name, ": total length")
            );

            bytes memory tail = new bytes(paymasterData.length);
            for (uint256 j = 0; j < paymasterData.length; j++) {
                tail[j] = packed[UserOperationLib.PAYMASTER_DATA_OFFSET + j];
            }
            assertEq(tail, paymasterData, string.concat(name, ": paymasterData tail"));
        }
    }

    /// Sanity check in the opposite direction: bytes packed here in Solidity with the
    /// same layout unpack identically, so the fixture is not just self-consistent.
    function testFuzz_SolidityPackedBytes_RoundTrip(
        address paymaster,
        uint128 validationGas,
        uint128 postOpGas,
        bytes calldata paymasterData
    ) public view {
        bytes memory packed = abi.encodePacked(paymaster, validationGas, postOpGas, paymasterData);

        (address gotPaymaster, uint256 gotValidationGas, uint256 gotPostOpGas) = harness.unpack(packed);

        assertEq(gotPaymaster, paymaster);
        assertEq(gotValidationGas, uint256(validationGas));
        assertEq(gotPostOpGas, uint256(postOpGas));
        assertEq(packed.length, UserOperationLib.PAYMASTER_DATA_OFFSET + paymasterData.length);
    }
}
