// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";
import {IERC4626} from "../_shared/interfaces/IERC4626.sol";

contract YearnForkTest is ProtocolTestBase {
    function test_fork_yearn_usdc_vault_deposit() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address vault = Addresses.Yearn.USDC_1_YVAULT;
        address usdc = Addresses.Yearn.USDC;
        _requireCode(vault);
        _requireCode(usdc);
        IERC4626 v = IERC4626(vault);
        assertEq(v.asset(), usdc, "USDC wiring");
        address user = address(0xA11CE);
        uint256 amount = 100e6;
        bytes32 slot = keccak256(abi.encode(user, uint256(9)));
        vm.store(usdc, slot, bytes32(amount));
        uint256 before = v.balanceOf(user);
        vm.startPrank(user);
        IERC20(usdc).approve(vault, amount);
        v.deposit(amount, user);
        vm.stopPrank();
        assertTrue(v.balanceOf(user) > before, "yUSDC shares minted");
        assertEq(IERC20(usdc).balanceOf(user), 0, "USDC spent");
    }
}
