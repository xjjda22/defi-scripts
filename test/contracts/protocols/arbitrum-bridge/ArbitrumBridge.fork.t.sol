// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;

interface IArbitrumInbox {
    function bridge() external view returns (address);
    function depositEth() external payable returns (uint256);
}

contract ArbitrumBridgeForkTest is ProtocolTestBase {
    function test_fork_arbitrum_bridge_deposit_eth() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address inbox = Addresses.ArbitrumBridge.INBOX;
        address bridge = Addresses.ArbitrumBridge.BRIDGE;
        _requireCode(inbox);
        _requireCode(bridge);
        assertEq(IArbitrumInbox(inbox).bridge(), bridge, "bridge wiring");
        address user = address(0xA11CE);
        uint256 value = 0.05 ether;
        vm.deal(user, value);
        uint256 before = bridge.balance;
        vm.prank(user);
        IArbitrumInbox(inbox).depositEth{value: value}();
        assertEq(bridge.balance - before, value, "bridge ETH locked");
    }
}
