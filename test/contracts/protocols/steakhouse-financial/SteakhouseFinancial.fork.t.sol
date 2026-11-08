// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";
import {IVault} from "./interfaces/IVault.sol";

/// One public ERC-4626 deposit primitive from the existing JS recipe. No mock vault.
contract SteakhouseFinancialForkTest is ProtocolTestBase {
    struct Before {
        uint256 shares;
        uint256 supply;
        uint256 feeShares;
    }

    event log_named_uint(string key, uint256 value);

    function test_fork_steakhouse_financial_deposit() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address target = Addresses.SteakhouseFinancial.STEAKHOUSE_USDC;
        address usdc = Addresses.Usdc.USDC;
        _requireCode(target);
        _requireCode(usdc);
        IVault vault = IVault(target);
        assertEq(vault.asset(), usdc, "USDC implementation wiring");
        address user = address(uint160(uint256(keccak256("steakhouse-financial depositor"))));
        uint256 amount = 100e6;
        assertTrue(vault.maxDeposit(user) >= amount, "deposit closed");
        // USDC FiatTokenV2 balances slot 9, already documented by the receiver tests.
        vm.store(usdc, keccak256(abi.encode(user, uint256(9))), bytes32(amount));
        address feeRecipient = vault.feeRecipient();
        require(feeRecipient != user, "distinct fee recipient");
        Before memory beforeState = Before(vault.balanceOf(user), vault.totalSupply(), vault.balanceOf(feeRecipient));
        uint256 preview = vault.previewDeposit(amount);
        assertTrue(preview > 0, "preview");
        vm.startPrank(user);
        IERC20(usdc).approve(target, amount);
        uint256 returned = vault.deposit(amount, user);
        vm.stopPrank();
        uint256 minted = vault.balanceOf(user) - beforeState.shares;
        assertEq(IERC20(usdc).balanceOf(user), 0, "USDC spent");
        assertEq(minted, returned, "deposit return");
        assertEq(minted, preview, "preview shares");
        // MetaMorpho V1 mints accrued performance-fee shares during deposit.
        // Account for that exact recipient delta, not a weaker supply >= user mint.
        uint256 feeMinted = vault.balanceOf(feeRecipient) - beforeState.feeShares;
        assertEq(vault.totalSupply() - beforeState.supply, minted + feeMinted, "user plus fee supply delta");
        emit log_named_uint("fee shares minted", feeMinted);
        uint256 value = vault.convertToAssets(minted);
        assertTrue(value <= amount && value + 2 >= amount, "share value rounding");
        emit log_named_uint("USDC deposited", amount);
        emit log_named_uint("shares minted", minted);
    }
}
