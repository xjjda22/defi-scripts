// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";
import {IClearstarVaultV2, IClearstarVmEmit} from "./interfaces/IClearstar.sol";

/// Clearstar cbAssets USDC Vault is a Morpho Vault V2 on Base. `maxDeposit` returns 0
/// by design (a sentinel, not evidence the vault is closed), so the four gates are only
/// a pre-check. The real primitive here is the public ERC-4626 round trip: USDC in,
/// shares minted at the exact `previewDeposit` price, every share redeemed for USDC.
/// Morpho V2 settles its interest cache inside `deposit`; at the pin the cache is stale,
/// so the permissionless `accrueInterest()` is called first to make both previews exact
/// at the pinned timestamp instead of quoting a price the deposit will not use.
contract ClearstarForkTest is ProtocolTestBase {
    struct Before {
        uint256 shares;
        uint256 supply;
        uint256 assets;
    }

    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
    );
    event log_named_uint(string key, uint256 value);

    function test_fork_clearstar_usdc_vault_deposit_redeem() public {
        if (!_fork("BASE_RPC_URL", 8453)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address target = Addresses.Clearstar.CLEARSTAR_CBASSETS_VAULT_USDC_VAULT_V2;
        address usdc = Addresses.Tokens.USDC_BASE;
        _requireCode(target);
        _requireCode(usdc);
        _checkWiring(target, usdc);
        _settleInterest(target);
        _roundTrip(target, usdc);
    }

    /// Deployment and gate wiring; unset gates are what the JS recipe checks before
    /// depositing, and on their own prove nothing about capacity.
    function _checkWiring(address target, address usdc) private view {
        IClearstarVaultV2 vault = IClearstarVaultV2(target);
        assertEq(vault.asset(), usdc, "USDC implementation wiring");
        assertEq(vault.decimals(), 18, "share decimals");
        assertEq(vault.receiveSharesGate(), address(0), "receive shares gate");
        assertEq(vault.sendSharesGate(), address(0), "send shares gate");
        assertEq(vault.receiveAssetsGate(), address(0), "receive assets gate");
        assertEq(vault.sendAssetsGate(), address(0), "send assets gate");
        assertEq(vault.maxDeposit(address(this)), 0, "V2 maxDeposit sentinel");
        // Without a liquidity adapter the idle balance cannot always fund a full redeem.
        assertTrue(vault.liquidityAdapter() != address(0), "liquidity adapter wired for full exit");
    }

    /// Settles the stale cache permissionlessly so `previewDeposit` is the exact price the
    /// deposit will use, and proves the unprivileged caller receives no shares for it.
    function _settleInterest(address target) private {
        IClearstarVaultV2 vault = IClearstarVaultV2(target);
        require(uint256(vault.lastUpdate()) < block.timestamp, "cache already current");
        address keeper = address(uint160(uint256(keccak256("clearstar permissionless accrual caller"))));
        vm.prank(keeper);
        vault.accrueInterest();
        assertEq(uint256(vault.lastUpdate()), block.timestamp, "interest settled to the pin timestamp");
        assertEq(vault.balanceOf(keeper), 0, "accrual caller receives no shares");
    }

    function _roundTrip(address target, address usdc) private {
        IClearstarVaultV2 vault = IClearstarVaultV2(target);
        uint256 amount = 100e6;
        address user = address(uint160(uint256(keccak256("clearstar depositor"))));
        _fundUsdc(usdc, user, amount);
        uint256 preview = vault.previewDeposit(amount);
        require(preview > 0, "preview shares");
        Before memory beforeState = Before(vault.balanceOf(user), vault.totalSupply(), vault.totalAssets());

        vm.startPrank(user);
        IERC20(usdc).approve(target, amount);
        // expectEmit binds to the very next log, so it is armed after the USDC approval.
        IClearstarVmEmit(address(vm)).expectEmit(true, true, false, true, target);
        emit Deposit(user, user, amount, preview);
        uint256 returned = vault.deposit(amount, user);
        vm.stopPrank();

        uint256 minted = vault.balanceOf(user) - beforeState.shares;
        assertEq(minted, preview, "shares minted at the exact preview price");
        assertEq(minted, returned, "deposit return");
        assertEq(IERC20(usdc).balanceOf(user), 0, "USDC spent");
        assertEq(vault.totalSupply() - beforeState.supply, minted, "user-only share supply delta");
        assertEq(vault.totalAssets() - beforeState.assets, amount, "vault assets delta is exactly the deposit");
        emit log_named_uint("USDC deposited", amount);
        emit log_named_uint("shares minted", minted);

        uint256 redeemPreview = vault.previewRedeem(minted);
        assertTrue(redeemPreview > 0 && redeemPreview <= amount, "redeem preview");
        IClearstarVmEmit(address(vm)).expectEmit(true, true, true, true, target);
        emit Withdraw(user, user, user, redeemPreview, minted);
        vm.prank(user);
        uint256 assetsOut = vault.redeem(minted, user, user);
        assertEq(assetsOut, redeemPreview, "redeem return matches previewRedeem");
        assertEq(IERC20(usdc).balanceOf(user), assetsOut, "USDC returned");
        assertEq(vault.balanceOf(user), 0, "every share redeemed");
        // One wei of share-price rounding is the documented round-trip slack, not a loss.
        assertTrue(assetsOut + 1 >= amount, "USDC round trip within rounding");
        emit log_named_uint("USDC returned on redeem", assetsOut);
        emit log_named_uint("USDC round-trip shortfall (wei)", amount - assetsOut);
    }

    function _fundUsdc(address usdc, address user, uint256 amount) private {
        // Existing EXTRA_WHALES.base.USDC fixture; never guess a Base USDC storage slot.
        address whale = vm.envOr("FORK_USDC_WHALE", address(0));
        require(whale != address(0), "configured Base USDC whale required");
        require(IERC20(usdc).balanceOf(whale) >= amount, "USDC whale balance");
        vm.prank(whale);
        require(IERC20(usdc).transfer(user, amount), "whale transfer");
        assertEq(IERC20(usdc).balanceOf(user), amount, "funded USDC");
    }
}
