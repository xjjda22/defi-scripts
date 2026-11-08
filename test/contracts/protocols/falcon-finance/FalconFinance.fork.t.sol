// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";
import {IERC4626} from "./interfaces/IERC4626.sol";

/// Falcon Finance sUSDf: one public ERC-4626 stake/unstake round trip over USDf,
/// the primitive in src/simulation/fork/entryRequestFlows.js `falconStake`.
/// USDf is pulled from the existing Curve USDC/USDf pool fixture, not minted:
/// minting from collateral is KYC-gated and is not called.
contract FalconFinanceForkTest is ProtocolTestBase {
    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
    );
    event log_named_uint(string key, uint256 value);

    function test_fork_falcon_finance_stake() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address vault = Addresses.FalconFinance.SUSDF_ERC_4626_OVER_USDF;
        address usdf = Addresses.FalconFinance.USDF;
        _requireCode(vault);
        _requireCode(usdf);
        // Funding fixture, not a protocol target: runtime.js EXTRA_WHALES.ethereum.USDf
        // is the public "USDC/USDf" Curve pool; the runner exports it as FORK_USDF_WHALE.
        address usdfWhale = vm.envOr("FORK_USDF_WHALE", address(0));
        require(usdfWhale != address(0), "set FORK_USDF_WHALE from runtime fixture");
        require(usdfWhale != vault, "USDf fixture must not be the vault");
        _requireCode(usdfWhale);
        IERC4626 sUsdf = IERC4626(vault);
        assertEq(sUsdf.asset(), usdf, "USDf implementation wiring");

        address user = address(uint160(uint256(keccak256("w2 falcon usdf staker"))));
        uint256 amount = 100e18;
        require(sUsdf.maxDeposit(user) >= amount, "deposit closed");
        require(IERC20(usdf).balanceOf(usdfWhale) >= amount, "Curve USDf fixture balance");
        vm.prank(usdfWhale);
        require(IERC20(usdf).transfer(user, amount), "fixture USDf transfer");
        assertEq(IERC20(usdf).balanceOf(user), amount, "funded USDf");

        uint256 vaultBefore = IERC20(usdf).balanceOf(vault);
        uint256 supplyBefore = sUsdf.totalSupply();
        uint256 preview = sUsdf.previewDeposit(amount);
        require(preview > 0, "zero preview");
        vm.startPrank(user);
        IERC20(usdf).approve(vault, amount);
        // expectEmit binds the next log, so it must follow the approval, not precede it.
        vm.expectEmit(true, true, false, true);
        emit Deposit(user, user, amount, preview);
        uint256 returned = sUsdf.deposit(amount, user);
        vm.stopPrank();
        uint256 minted = sUsdf.balanceOf(user);
        assertEq(minted, returned, "deposit return");
        assertEq(IERC20(usdf).balanceOf(user), 0, "USDf spent");
        assertEq(IERC20(usdf).balanceOf(vault) - vaultBefore, amount, "vault USDf increase");
        assertEq(sUsdf.totalSupply() - supplyBefore, minted, "share supply delta");
        _withinBps(minted, preview, "shares vs previewDeposit");
        emit log_named_uint("USDf staked", amount);
        emit log_named_uint("sUSDf shares minted", minted);

        _redeemAll(vault, usdf, user, minted, amount);
    }

    function _redeemAll(address vault, address usdf, address user, uint256 shares, uint256 staked) internal {
        IERC4626 sUsdf = IERC4626(vault);
        uint256 preview = sUsdf.previewRedeem(shares);
        vm.expectEmit(true, true, true, true);
        emit Withdraw(user, user, user, preview, shares);
        vm.prank(user);
        uint256 received = sUsdf.redeem(shares, user, user);
        assertEq(sUsdf.balanceOf(user), 0, "shares left");
        assertEq(IERC20(usdf).balanceOf(user), received, "USDf received");
        _withinBps(received, preview, "USDf vs previewRedeem");
        _withinBps(received, staked, "USDf vs staked");
        emit log_named_uint("USDf received on redeem", received);
        emit log_named_uint("sUSDf shares left", sUsdf.balanceOf(user));
    }

    /// 1 bp tolerance, matching the JS flow: same-block preview is normally exact.
    function _withinBps(uint256 observed, uint256 expected, string memory err) internal pure {
        uint256 tolerance = expected / 10_000;
        require(observed <= expected + tolerance && observed + tolerance >= expected, err);
    }
}
