// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface IFraxtalBridge {
    function depositERC20(address token, address to, uint256 amount, uint32 minGasLimit, bytes calldata extraData)
        external;
}

contract FraxtalForkTest is ProtocolTestBase {
    function test_fork_fraxtal_bridge_deposit_frxusd() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address bridge = Addresses.Fraxtal.FRAXTAL_L1STANDARDBRIDGEPROXY;
        address frxusd = Addresses.Fraxtal.FRXUSD_ETHEREUM_L2_REPRESENTATION_0XFC00000000000000000000000000000000000001;
        _requireCode(bridge);
        _requireCode(frxusd);
        address user = address(0xA11CE);
        uint256 amount = 100e18;
        _dealToken(frxusd, user, amount);
        uint256 before = IERC20(frxusd).balanceOf(bridge);
        vm.prank(user, user);
        IERC20(frxusd).approve(bridge, amount);
        vm.prank(user, user);
        IFraxtalBridge(bridge).depositERC20(frxusd, user, amount, 200_000, "");
        vm.stopPrank();
        assertEq(IERC20(frxusd).balanceOf(bridge) - before, amount, "frxUSD locked");
        assertEq(IERC20(frxusd).balanceOf(user), 0, "frxUSD spent");
    }

    function _dealToken(address token, address user, uint256 amount) private {
        for (uint256 slot = 0; slot < 64; slot++) {
            bytes32 soliditySlot = keccak256(abi.encode(user, slot));
            vm.store(token, soliditySlot, bytes32(amount));
            if (IERC20(token).balanceOf(user) == amount) return;
            bytes32 vyperSlot = keccak256(abi.encode(slot, user));
            vm.store(token, vyperSlot, bytes32(amount));
            if (IERC20(token).balanceOf(user) == amount) return;
        }
        revert("token balance slot not found");
    }
}
