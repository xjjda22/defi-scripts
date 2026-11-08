// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IL1StandardBridge, IOptimismPortal, IWorldChainVm} from "./interfaces/IWorldChainBridge.sol";

/// Source-chain custody only. World Chain destination delivery and the L2 credit are not
/// run here: no World Chain RPC is used, and forge never broadcasts past this fork.
contract WorldChainBridgeForkTest is ProtocolTestBase {
    event ETHDepositInitiated(address indexed from, address indexed to, uint256 amount, bytes data);
    event log_named_uint(string key, uint256 value);

    function test_fork_world_chain_bridge_deposit_eth() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address bridge = Addresses.WorldChain.L1STANDARDBRIDGEPROXY;
        address portal = Addresses.WorldChain.OPTIMISMPORTALPROXY;
        address systemConfig = Addresses.WorldChain.SYSTEMCONFIGPROXY;
        _requireCode(bridge);
        _requireCode(portal);
        _requireCode(systemConfig);
        // Implementation-only wiring: a stub or mis-pointed proxy cannot return the book value.
        assertEq(IL1StandardBridge(bridge).systemConfig(), systemConfig, "bridge systemConfig wiring");
        _requireCode(IL1StandardBridge(bridge).messenger());
        // The portal is an EIP-1967 proxy; assert the implementation it delegates to, since
        // code at the proxy address alone would pass against an empty implementation.
        bytes32 implSlot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
        _requireCode(address(uint160(uint256(vm.load(portal, implSlot)))));
        assertTrue(!IOptimismPortal(portal).paused(), "portal paused");
        // This portal predates the OP Mainnet ETHLockbox; at this pin the getter is zero, so
        // the portal itself is the ETH custodian (no third address in the lock check).
        assertEq(IOptimismPortal(portal).ethLockbox(), address(0), "no ETH lockbox at this pin");

        address user = address(uint160(uint256(keccak256("w2a world chain depositor"))));
        uint256 amount = 0.05 ether;
        vm.deal(user, 1 ether);
        uint256 beforeCustody = bridge.balance + portal.balance;
        IWorldChainVm(address(vm)).expectEmit(true, true, false, true, bridge);
        emit ETHDepositInitiated(user, user, amount, "");
        // The bridge rejects msg.sender != tx.origin, so the prank sets both.
        IWorldChainVm(address(vm)).prank(user, user);
        IL1StandardBridge(bridge).depositETH{value: amount}(200000, "");
        uint256 delta = bridge.balance + portal.balance - beforeCustody;
        assertEq(delta, amount, "bridge+portal ETH custody");
        assertEq(user.balance, 0.95 ether, "user ETH spent");
        emit log_named_uint("bridge+portal ETH delta", delta);
    }
}
