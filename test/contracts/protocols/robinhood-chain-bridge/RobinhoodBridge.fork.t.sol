// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;

interface IRobinhoodInbox {
    function bridge() external view returns (address);
    function depositEth() external payable returns (uint256);
}

contract RobinhoodBridgeForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_robinhood_deposit() public {
        require(
            vm.envOr("FORK_BLOCK", uint256(0)) > 0 || bytes(vm.envOr("ETHEREUM_RPC_URL", string(""))).length == 0,
            "pin required"
        );
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        address inbox = Addresses.RobinhoodChainBridge.DELAYED_INBOX;
        address bridge = Addresses.RobinhoodChainBridge.BRIDGE;
        _requireCode(inbox);
        _requireCode(bridge);
        // Implementation-only wiring getter: rejects empty proxy implementations.
        assertEq(IRobinhoodInbox(inbox).bridge(), bridge, "bridge wiring");
        address user = address(uint160(uint256(keccak256("w1b robinhood depositor"))));
        vm.deal(user, 1 ether);
        uint256 beforeBalance = bridge.balance;
        vm.prank(user);
        IRobinhoodInbox(inbox).depositEth{value: 0.05 ether}();
        assertEq(bridge.balance - beforeBalance, 0.05 ether, "bridge ETH locked");
        assertEq(user.balance, 0.95 ether, "user ETH spent");
        emit log_named_uint("bridge ETH increase", bridge.balance - beforeBalance);
    }
}
