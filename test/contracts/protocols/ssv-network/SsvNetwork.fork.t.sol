// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {ISsvNetwork, ISsvNetworkViews, ISsvVmLogs} from "./interfaces/ISsvNetwork.sol";

/// SSV's permissionless operator registration. This proves a public operator
/// entry can be created without validator keyshares; it does not register a validator.
contract SsvNetworkForkTest is ProtocolTestBase {
    event OperatorAdded(uint64 indexed operatorId, address indexed owner, bytes publicKey, uint256 fee);
    event log_named_uint(string key, uint256 value);

    function test_fork_ssv_register_operator() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address network = Addresses.SsvNetwork.SSV_NETWORK_SSVNETWORK_ETH;
        address viewsAddress = Addresses.SsvNetwork.SSV_NETWORK_VIEWS_VIEWS_SSVNETWORK_ETH;
        _requireCode(network);
        _requireCode(viewsAddress);
        ISsvNetworkViews views = ISsvNetworkViews(viewsAddress);
        address user = address(uint160(uint256(keccak256("ssv operator owner"))));
        bytes memory publicKey = abi.encodePacked(
            keccak256("ssv fork public key"), keccak256("ssv fork public key 2"), uint256(block.number)
        );

        vm.startPrank(user);
        ISsvVmLogs(address(vm)).recordLogs();
        uint64 id = ISsvNetwork(network).registerOperator(publicKey, 0, false);
        vm.stopPrank();

        ISsvNetworkViews.OperatorData memory operator = views.getOperatorById(id);
        assertEq(operator.owner, user, "operator owner");
        assertEq(operator.fee, 0, "operator ETH fee");
        assertEq(operator.validatorCount, 0, "new operator validator count");
        assertTrue(!operator.isPrivate, "public operator");
        assertTrue(operator.isActive, "operator active");
        _assertEvent(network, id, user, publicKey, 0);
        emit log_named_uint("operator id", id);
        emit log_named_uint("operator validator count", operator.validatorCount);
    }

    function _assertEvent(address network, uint64 id, address owner, bytes memory publicKey, uint256 fee) internal {
        ISsvVmLogs.Log[] memory logs = ISsvVmLogs(address(vm)).getRecordedLogs();
        bytes32 signature = keccak256("OperatorAdded(uint64,address,bytes,uint256)");
        uint256 found;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != network || logs[i].topics.length != 3 || logs[i].topics[0] != signature) continue;
            assertEq(uint256(logs[i].topics[1]), id, "event operator id");
            assertEq(address(uint160(uint256(logs[i].topics[2]))), owner, "event owner");
            (bytes memory emittedKey, uint256 emittedFee) = abi.decode(logs[i].data, (bytes, uint256));
            assertEq(uint256(keccak256(emittedKey)), uint256(keccak256(publicKey)), "event public key");
            assertEq(emittedFee, fee, "event fee");
            ++found;
        }
        assertEq(found, 1, "one OperatorAdded");
    }
}
