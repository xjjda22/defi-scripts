// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface IVenusVToken {
    function underlying() external view returns (address);
    function balanceOf(address) external view returns (uint256);
    function mint(uint256 amount) external returns (uint256);
    function redeem(uint256 shares) external returns (uint256);
}

contract VenusCorePoolForkTest is ProtocolTestBase {
    function test_fork_venus_core_pool_supply_usdc() public {
        if (!_fork("BSC_RPC_URL", 56)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address vault = Addresses.VenusCorePool.VUSDC;
        address usdc = Addresses.VenusCorePool.USDC;
        _requireCode(vault);
        _requireCode(usdc);
        IVenusVToken v = IVenusVToken(vault);
        assertEq(v.underlying(), usdc, "USDC wiring");
        address user = address(0xA11CE);
        uint256 amount = 100e18;
        _dealToken(usdc, user, amount);
        uint256 before = v.balanceOf(user);
        vm.startPrank(user);
        IERC20(usdc).approve(vault, amount);
        v.mint(amount);
        vm.stopPrank();
        uint256 shares = v.balanceOf(user) - before;
        assertTrue(shares > 0, "vUSDC shares minted");
        assertTrue(IERC20(usdc).balanceOf(user) < amount, "USDC spent");
        vm.prank(user);
        v.redeem(shares);
        assertEq(v.balanceOf(user), before, "shares redeemed");
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
