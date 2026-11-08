// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";
import {IERC4626} from "../_shared/interfaces/IERC4626.sol";

contract FluidLendingForkTest is ProtocolTestBase {
    function test_fork_fluid_lending_supply_usdc() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address vault = Addresses.FluidLending.FLUID_FUSDC_FTOKEN_FUSDC_ERC_4626_LENDING_TOKEN;
        address usdc = Addresses.FluidLending.USDC_FUSDC_UNDERLYING;
        _requireCode(vault);
        _requireCode(usdc);
        IERC4626 v = IERC4626(vault);
        assertEq(v.asset(), usdc, "USDC wiring");
        address user = address(0xA11CE);
        uint256 amount = 100e6;
        bytes32 slot = keccak256(abi.encode(user, uint256(9)));
        vm.store(usdc, slot, bytes32(amount));
        uint256 preview = v.previewDeposit(amount);
        require(preview > 0, "preview shares");
        vm.startPrank(user);
        IERC20(usdc).approve(vault, amount);
        uint256 returned = v.deposit(amount, user);
        vm.stopPrank();
        assertEq(v.balanceOf(user), returned, "shares minted");
        assertEq(returned, preview, "preview price");
        assertEq(IERC20(usdc).balanceOf(user), 0, "USDC spent");
    }
}
