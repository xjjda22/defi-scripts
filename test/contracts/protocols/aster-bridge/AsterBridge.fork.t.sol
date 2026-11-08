// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;

interface IAsterVault {
    function depositNative(uint256 broker) external payable;
}

contract AsterBridgeForkTest is ProtocolTestBase {
    function test_fork_aster_bridge_deposit_native_bnb() public {
        if (!_fork("BSC_RPC_URL", 56)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address bridge = Addresses.AsterBridge.ASTER_DEPOSIT_BRIDGE_ASTHERUSVAULT_ERC_1967_PROXY;
        _requireCode(bridge);
        address user = address(0xA11CE);
        uint256 amount = 0.5 ether;
        vm.deal(user, amount);
        uint256 before = bridge.balance;
        vm.prank(user, user);
        IAsterVault(bridge).depositNative{value: amount}(0);
        assertEq(bridge.balance - before, amount, "BNB locked");
    }
}
