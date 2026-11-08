// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";
import {IEtherfiCashLiquid} from "./interfaces/IEtherfiCashLiquid.sol";

/// ether.fi Cash Liquid: an Aave V4 Spoke over one Liquidity Hub on OP Mainnet.
/// The existing JS recipe (src/simulation/fork/etherfiCashFlow.js) supplies USDC to
/// reserve 0 and withdraws the whole position; this is that public primitive, no mock.
contract EtherfiCashLiquidForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_etherfi_cash_liquid_supply_withdraw() public {
        if (!_fork("OPTIMISM_RPC_URL", 10)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address target = Addresses.EtherfiCashLiquid.SPOKE_AAVE_V4;
        address hub = Addresses.EtherfiCashLiquid.LIQUIDITY_HUB_AAVE_V4;
        address lens = Addresses.EtherfiCashLiquid.AAVEV4LENS;
        address usdc = Addresses.Tokens.USDC_OPTIMISM;
        _requireCode(target);
        _requireCode(hub);
        _requireCode(lens);
        _requireCode(usdc);
        IEtherfiCashLiquid spoke = IEtherfiCashLiquid(target);
        IEtherfiCashLiquid.Reserve memory reserve = spoke.getReserve(0);
        assertEq(reserve.underlying, usdc, "reserve USDC");
        assertEq(reserve.hub, hub, "reserve hub");
        assertEq(uint256(reserve.assetId), 0, "reserve id");
        assertEq(uint256(reserve.decimals), 6, "reserve decimals");
        IEtherfiCashLiquid.ReserveConfig memory config = spoke.getReserveConfig(0);
        require(!config.paused && !config.frozen, "reserve paused/frozen");

        address user = address(uint160(uint256(keccak256("w2 etherfi cash liquid supplier"))));
        uint256 amount = 100e6;
        // src/utils/impersonate.js EXTRA_WHALES.optimism.USDC[1]: aOptUSDCn holds the
        // pool's native USDC; the runner exports it as FORK_USDC_WHALE. Never the Hub.
        address whale = vm.envOr("FORK_USDC_WHALE", address(0));
        require(whale != address(0) && whale != hub, "external USDC whale required");
        require(IERC20(usdc).balanceOf(whale) >= amount, "USDC whale balance");
        vm.prank(whale);
        require(IERC20(usdc).transfer(user, amount), "whale transfer");
        assertEq(IERC20(usdc).balanceOf(user), amount, "funded USDC");

        uint256 hubBefore = IERC20(usdc).balanceOf(hub);
        vm.startPrank(user);
        IERC20(usdc).approve(target, amount);
        spoke.supply(0, amount, user);
        vm.stopPrank();

        uint256 supplied = spoke.getUserSuppliedAssets(0, user);
        uint256 shares = spoke.getUserSuppliedShares(0, user);
        require(shares > 0, "no supply shares");
        require(supplied <= amount && supplied + 1 >= amount, "supply share accounting");
        assertEq(IERC20(usdc).balanceOf(user), 0, "USDC spent");
        assertEq(IERC20(usdc).balanceOf(hub) - hubBefore, amount, "Hub USDC increase");
        emit log_named_uint("Hub USDC increase", amount);
        emit log_named_uint("supplied USDC assets", supplied);
        emit log_named_uint("supply shares minted", shares);

        _withdrawAll(target, hub, usdc, user, supplied);
    }

    /// Withdraw with MaxUint256: the Spoke caps it at the user's whole position
    /// (the JS recipe does the same after interest can leave a dust share behind).
    function _withdrawAll(address target, address hub, address usdc, address user, uint256 supplied) internal {
        IEtherfiCashLiquid spoke = IEtherfiCashLiquid(target);
        uint256 hubMid = IERC20(usdc).balanceOf(hub);
        vm.prank(user);
        spoke.withdraw(0, type(uint256).max, user);
        uint256 back = IERC20(usdc).balanceOf(user);
        // 1 bp of the supplied amount absorbs accrued interest between read and withdraw.
        uint256 tolerance = supplied / 10_000 + 2;
        require(back >= supplied && back <= supplied + tolerance, "withdraw return");
        assertEq(hubMid - IERC20(usdc).balanceOf(hub), back, "Hub USDC returned");
        assertEq(spoke.getUserSuppliedShares(0, user), 0, "shares left");
        emit log_named_uint("USDC withdrawn from Hub", back);
        emit log_named_uint("shares left after withdraw", spoke.getUserSuppliedShares(0, user));
    }
}
