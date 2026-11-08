// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;

interface IStarkGateBridge {
    function estimateDepositFeeWei() external view returns (uint256);
    function deposit(address token, uint256 amount, uint256 l2Recipient) external payable;
}

contract StarknetBridgeForkTest is ProtocolTestBase {
    address private constant ETH_TOKEN_SENTINEL = 0x0000000000000000000000000000000000455448;

    function test_fork_starknet_bridge_deposit_eth() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address bridge = Addresses.StarknetBridge.STARKGATE_ETH_BRIDGE;
        address core = Addresses.StarknetBridge.STARKNET_CORE_CONTRACT;
        _requireCode(bridge);
        _requireCode(core);
        address user = address(0xA11CE);
        uint256 amount = 0.05 ether;
        uint256 fee = IStarkGateBridge(bridge).estimateDepositFeeWei();
        vm.deal(user, amount + fee);
        uint256 before = bridge.balance;
        vm.prank(user, user);
        IStarkGateBridge(bridge).deposit{value: amount + fee}(ETH_TOKEN_SENTINEL, amount, uint256(uint160(user)));
        assertEq(bridge.balance - before, amount, "ETH locked");
    }
}
