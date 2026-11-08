// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";
import {IERC4626} from "../_shared/interfaces/IERC4626.sol";

contract SaturnForkTest is ProtocolTestBase {
    function test_fork_saturn_stake_usdat() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address vault = Addresses.Saturn.SUSDAT_STAKEDUSDAT_ERC_4626;
        address usdat = Addresses.Saturn.USDAT;
        _requireCode(vault);
        _requireCode(usdat);
        IERC4626 v = IERC4626(vault);
        assertEq(v.asset(), usdat, "USDat wiring");
        address user = address(0xA11CE);
        uint256 amount = 100e6;
        address whale = vm.envOr("FORK_USDAT_WHALE", address(0));
        require(whale != address(0), "configured USDat whale required");
        vm.prank(whale);
        IERC20(usdat).transfer(user, amount);
        uint256 preview = v.previewDeposit(amount);
        require(preview > 0, "preview shares");
        vm.startPrank(user);
        IERC20(usdat).approve(vault, amount);
        uint256 returned = v.deposit(amount, user);
        vm.stopPrank();
        assertEq(v.balanceOf(user), returned, "shares minted");
        assertEq(returned, preview, "preview price");
        assertEq(IERC20(usdat).balanceOf(user), 0, "USDat spent");
    }
}
