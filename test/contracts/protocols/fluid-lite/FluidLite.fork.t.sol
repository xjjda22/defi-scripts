// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";
import {IFluidLiteVault} from "./interfaces/IFluidLiteVault.sol";

/// Fluid Lite iETHv2 (ERC-4626 over stETH): the public deposit/redeem primitive in
/// src/simulation/fork/vaultFlows.js `fluidLiteDeposit`. The vault keeps
/// withdrawalFeePercentage() (1e6 = 100%) of redeemed assets; previewRedeem is gross.
contract FluidLiteForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_fluid_lite_deposit_redeem() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address vault = Addresses.FluidLite.IETHV2_STETH_VAULT;
        address steth = Addresses.Lido.STETH;
        // src/simulation/fork/runtime.js EXTRA_WHALES.ethereum.stETH[0]: the wstETH
        // contract holds stETH. No guessed storage slot.
        address whale = Addresses.Lido.WSTETH;
        _requireCode(vault);
        _requireCode(steth);
        _requireCode(whale);
        IFluidLiteVault feeVault = IFluidLiteVault(vault);
        assertEq(feeVault.asset(), steth, "stETH implementation wiring");

        address user = address(uint160(uint256(keccak256("w2 fluid lite staker"))));
        uint256 amount = 1e18;
        require(feeVault.maxDeposit(user) >= amount, "deposit closed");
        require(IERC20(steth).balanceOf(whale) >= amount + 2, "stETH fixture balance");
        // Fund a 2 wei cushion: stETH is share-based and a transfer can land 1-2 wei
        // short of the requested amount (the JS flow's freshFrom does the same).
        vm.prank(whale);
        require(IERC20(steth).transfer(user, amount + 2), "fixture stETH transfer");
        require(IERC20(steth).balanceOf(user) >= amount, "funded stETH");
        uint256 before = IERC20(steth).balanceOf(user);

        uint256 preview = feeVault.previewDeposit(amount);
        require(preview > 0, "zero preview");
        uint256 supplyBefore = feeVault.totalSupply();
        vm.startPrank(user);
        IERC20(steth).approve(vault, amount);
        uint256 shares = feeVault.deposit(amount, user);
        vm.stopPrank();

        // stETH rebases; a transfer can land 1-2 wei short of `amount`.
        uint256 pulled = before - IERC20(steth).balanceOf(user);
        require(pulled <= amount && pulled + 2 >= amount, "stETH pulled");
        assertEq(shares, feeVault.balanceOf(user), "shares balance");
        assertEq(shares, preview, "shares match previewDeposit");
        assertEq(feeVault.totalSupply() - supplyBefore, shares, "share supply delta");
        emit log_named_uint("stETH deposited", pulled);
        emit log_named_uint("iETHv2 shares minted", shares);

        _redeemAll(vault, steth, user, shares);
    }

    function _redeemAll(address vault, address steth, address user, uint256 shares) internal {
        IFluidLiteVault feeVault = IFluidLiteVault(vault);
        uint256 expected = feeVault.previewRedeem(shares);
        uint256 feePpm = feeVault.withdrawalFeePercentage();
        uint256 fee = (expected * feePpm) / 1_000_000;
        uint256 want = expected - fee;
        uint256 mid = IERC20(steth).balanceOf(user);
        vm.prank(user);
        uint256 returned = feeVault.redeem(shares, user, user);
        uint256 got = IERC20(steth).balanceOf(user) - mid;
        assertEq(feeVault.balanceOf(user), 0, "shares left");
        // redeem() returns the net assets; stETH's share rounding can move the
        // recipient's balance by 1-2 wei around that number (the JS flow allows 2).
        assertEq(returned, want, "redeem return is net of fee");
        require(got <= want + 2 && got + 2 >= want, "stETH net of withdrawal fee");
        emit log_named_uint("withdrawal fee ppm", feePpm);
        emit log_named_uint("previewRedeem gross stETH", expected);
        emit log_named_uint("withdrawal fee stETH", fee);
        emit log_named_uint("stETH received after fee", got);
    }
}
