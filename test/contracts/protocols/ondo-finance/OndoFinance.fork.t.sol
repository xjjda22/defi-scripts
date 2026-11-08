// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";
import {IRusdy} from "./interfaces/IOndo.sol";

/// rUSDY is Ondo's public rebasing wrapper. Unlike issuer subscription, an
/// existing holder can unwrap rUSDY for USDY without registration.
contract OndoFinanceForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_ondo_unwrap_rusdy() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address rusdyAddress = Addresses.OndoFinance.RUSDY_REBASING_USDY;
        address usdy = Addresses.OndoFinance.USDY;
        _requireCode(rusdyAddress);
        _requireCode(usdy);
        IRusdy rusdy = IRusdy(rusdyAddress);
        assertEq(rusdy.usdy(), usdy, "USDY asset wiring");
        assertTrue(!rusdy.paused(), "rUSDY not paused");

        address user = address(uint160(uint256(keccak256("ondo rusdy holder"))));
        address whale = vm.envOr("FORK_ONDO_RUSDY_WHALE", address(0));
        uint256 amount = 100e18;
        require(whale != address(0) && rusdy.balanceOf(whale) >= amount, "rUSDY whale");
        vm.prank(whale);
        IERC20(rusdyAddress).transfer(user, amount);

        uint256 shares = rusdy.getSharesByRUSDY(amount);
        uint256 expectedUsdy = shares / rusdy.USDY_TO_RUSDY_SHARES_MULTIPLIER();
        uint256 supplyBefore = rusdy.totalShares();
        uint256 usdyBefore = IERC20(usdy).balanceOf(user);
        vm.prank(user);
        rusdy.unwrap(amount);

        assertEq(rusdy.balanceOf(user), 0, "rUSDY burned");
        assertEq(supplyBefore - rusdy.totalShares(), shares, "share supply delta");
        assertEq(IERC20(usdy).balanceOf(user) - usdyBefore, expectedUsdy, "USDY received");
        emit log_named_uint("rUSDY unwrapped", amount);
        emit log_named_uint("USDY received", expectedUsdy);
    }
}
