// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IRootChainManager, IEtherPredicate, IPolygonVmEmit} from "./interfaces/IPolygonBridge.sol";

/// Source-chain custody only; Polygon validator delivery and L2 credit are not run.
contract PolygonBridgeForkTest is ProtocolTestBase {
    event LockedEther(address indexed depositor, address indexed depositReceiver, uint256 amount);
    event log_named_uint(string key, uint256 value);

    function test_fork_polygon_bridge_deposit_ether() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address manager = Addresses.PolygonBridge.ROOTCHAINMANAGERPROXY;
        address predicate = Addresses.PolygonBridge.ETHERPREDICATEPROXY;
        _requireCode(manager);
        _requireCode(predicate);
        _requireCode(IRootChainManager(manager).implementation());
        _requireCode(IEtherPredicate(predicate).implementation());
        address user = address(uint160(uint256(keccak256("polygon depositor"))));
        uint256 amount = 0.05 ether;
        vm.deal(user, amount);
        uint256 beforeEth = predicate.balance;
        IPolygonVmEmit(address(vm)).expectEmit(true, true, false, true, predicate);
        emit LockedEther(user, user, amount);
        vm.prank(user);
        IRootChainManager(manager).depositEtherFor{value: amount}(user);
        assertEq(predicate.balance - beforeEth, amount, "predicate ETH locked");
        assertEq(user.balance, 0, "depositor ETH spent");
        emit log_named_uint("predicate ETH delta", predicate.balance - beforeEth);
    }
}
