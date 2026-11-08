// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";
import {IVault} from "./interfaces/IVault.sol";

/// One public ERC-4626 deposit primitive from the existing JS recipe. No mock vault.
contract RockawayxForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_rockawayx_deposit() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address target = Addresses.Rockawayx.ROCKAWAYX_USDC_YIELD_VAULT_V2;
        address usdc = Addresses.Usdc.USDC;
        _requireCode(target);
        _requireCode(usdc);
        IVault vault = IVault(target);
        assertEq(vault.asset(), usdc, "USDC implementation wiring");
        address user = address(uint160(uint256(keccak256("rockawayx depositor"))));
        uint256 amount = 100e6;
        // Morpho V2 maxDeposit is always zero by design: validate all gates instead.
        assertEq(vault.receiveSharesGate(), address(0), "receive shares gated");
        assertEq(vault.sendSharesGate(), address(0), "send shares gated");
        assertEq(vault.receiveAssetsGate(), address(0), "receive assets gated");
        assertEq(vault.sendAssetsGate(), address(0), "send assets gated");
        // USDC FiatTokenV2 balances slot 9, already documented by the receiver tests.
        vm.store(usdc, keccak256(abi.encode(user, uint256(9))), bytes32(amount));
        // Settle public V2 fee accrual before isolating the deposit supply delta.
        vault.accrueInterest();
        uint256 beforeShares = vault.balanceOf(user);
        uint256 beforeSupply = vault.totalSupply();
        uint256 preview = vault.previewDeposit(amount);
        assertTrue(preview > 0, "preview");
        vm.startPrank(user);
        IERC20(usdc).approve(target, amount);
        uint256 returned = vault.deposit(amount, user);
        vm.stopPrank();
        uint256 minted = vault.balanceOf(user) - beforeShares;
        assertEq(IERC20(usdc).balanceOf(user), 0, "USDC spent");
        assertEq(minted, returned, "deposit return");
        assertEq(minted, preview, "preview shares");
        assertEq(vault.totalSupply() - beforeSupply, minted, "supply delta");
        uint256 value = vault.convertToAssets(minted);
        assertTrue(value <= amount && value + 2 >= amount, "share value rounding");
        emit log_named_uint("USDC deposited", amount);
        emit log_named_uint("shares minted", minted);
    }
}
