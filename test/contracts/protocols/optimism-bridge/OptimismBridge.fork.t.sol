// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;

interface IOptimismPortal {
    function ethLockbox() external view returns (address);
}

interface IOptimismBridge {
    function depositETH(uint32 minGasLimit, bytes calldata extraData) external payable;
}

contract OptimismBridgeForkTest is ProtocolTestBase {
    function test_fork_optimism_bridge_deposit_eth() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address portal = Addresses.OptimismBridge.OPTIMISMPORTAL;
        address bridge = Addresses.OptimismBridge.L1STANDARDBRIDGE;
        _requireCode(portal);
        _requireCode(bridge);
        address user = address(0xA11CE);
        uint256 value = 0.05 ether;
        vm.deal(user, value);
        address lockbox = IOptimismPortal(portal).ethLockbox();
        uint256 before = bridge.balance + portal.balance;
        if (lockbox != address(0)) before += lockbox.balance;
        vm.prank(user, user);
        IOptimismBridge(bridge).depositETH{value: value}(200_000, "");
        uint256 lockedAfter = bridge.balance + portal.balance;
        if (lockbox != address(0)) lockedAfter += lockbox.balance;
        assertEq(lockedAfter - before, value, "bridge ETH locked");
    }
}
