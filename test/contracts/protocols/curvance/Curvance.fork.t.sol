// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";
import {IERC4626} from "../_shared/interfaces/IERC4626.sol";

interface IWMON {
    function deposit() external payable;
}

interface ICurvanceCToken {
    function marketManager() external view returns (address);
}

contract CurvanceForkTest is ProtocolTestBase {
    function test_fork_curvance_cwmon_deposit() public {
        if (!_fork("MONAD_RPC_URL", 143)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address vault = Addresses.Curvance.CWMON_WMON_USDC;
        address manager = Addresses.Curvance.MARKETMANAGER_WMON_USDC;
        address wmon = Addresses.Tokens.WETH_MONAD;
        _requireCode(vault);
        _requireCode(manager);
        _requireCode(wmon);
        assertEq(ICurvanceCToken(vault).marketManager(), manager, "market manager wiring");
        address user = address(0xA11CE);
        uint256 amount = 1e18;
        vm.deal(user, amount);
        vm.prank(user);
        IWMON(wmon).deposit{value: amount}();
        IERC4626 v = IERC4626(vault);
        uint256 preview = v.previewDeposit(amount);
        require(preview > 0, "preview shares");
        vm.startPrank(user);
        IERC20(wmon).approve(vault, amount);
        uint256 returned = v.deposit(amount, user);
        vm.stopPrank();
        assertEq(v.balanceOf(user), returned, "shares minted");
        assertTrue(returned > 0, "shares minted");
        uint256 drift = returned > preview ? returned - preview : preview - returned;
        assertTrue(drift * 10_000 <= preview, "preview within 1 bp");
        assertEq(IERC20(wmon).balanceOf(user), 0, "WMON spent");
    }
}
