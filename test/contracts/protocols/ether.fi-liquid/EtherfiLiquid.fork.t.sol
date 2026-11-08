// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {
    IEtherfiLiquidTeller,
    IEtherfiLiquidAccountant,
    IEtherfiLiquidVault,
    IEtherfiLiquidWeth
} from "./interfaces/IEtherfiLiquid.sol";

/// ether.fi Liquid ETH is a Veda BoringVault. The W1 Veda and Nonce Capital rows deposit
/// into this SAME vault; the three rows are separate board-row attributions, not three
/// independent deployments or liquidity, and none of them claims the vault's whole TVL.
/// Primitive: native ETH wrapped to WETH and deposited through the Teller for
/// accountant-priced shares.
contract EtherfiLiquidForkTest is ProtocolTestBase {
    struct Before {
        uint256 supply;
        uint256 shares;
        uint256 weth;
    }

    event log_named_uint(string key, uint256 value);

    function test_fork_etherfi_liquid_eth_deposit() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address vault = Addresses.Veda.LIQUID_ETH_BORINGVAULT;
        address teller = Addresses.Veda.TELLER;
        address weth = Addresses.Veda.WETH;
        _requireCode(vault);
        _requireCode(teller);
        _requireCode(weth);
        IEtherfiLiquidTeller t = IEtherfiLiquidTeller(teller);
        // Deployment wiring: the book Teller is the one that serves the book vault.
        assertEq(t.vault(), vault, "Teller vault wiring");
        assertTrue(!t.isPaused(), "Teller paused");
        assertEq(IEtherfiLiquidVault(vault).decimals(), 18, "share decimals");

        uint256 amount = 0.01 ether;
        uint256 expected;
        {
            (bool open,, uint16 premium) = t.assetData(weth);
            assertTrue(open, "WETH deposits closed");
            address accountant = t.accountant();
            _requireCode(accountant);
            uint256 rate = IEtherfiLiquidAccountant(accountant).getRateInQuoteSafe(weth);
            assertTrue(rate > 0, "accountant rate");
            expected = amount * 10 ** IEtherfiLiquidVault(vault).decimals() / rate;
            expected -= expected * premium / 10000;
            assertTrue(expected > 0, "expected shares");
        }

        address user = address(uint160(uint256(keccak256("etherfi liquid depositor"))));
        vm.deal(user, amount);
        vm.prank(user);
        IEtherfiLiquidWeth(weth).deposit{value: amount}();
        assertEq(IEtherfiLiquidWeth(weth).balanceOf(user), amount, "WETH wrapped");
        Before memory beforeState = Before(
            IEtherfiLiquidVault(vault).totalSupply(),
            IEtherfiLiquidVault(vault).balanceOf(user),
            IEtherfiLiquidWeth(weth).balanceOf(vault)
        );

        vm.startPrank(user);
        IEtherfiLiquidWeth(weth).approve(vault, amount);
        uint256 returned = t.deposit(weth, amount, expected);
        vm.stopPrank();

        uint256 minted = IEtherfiLiquidVault(vault).balanceOf(user) - beforeState.shares;
        assertEq(minted, expected, "accountant-priced shares");
        assertEq(minted, returned, "deposit return");
        assertEq(IEtherfiLiquidVault(vault).totalSupply() - beforeState.supply, minted, "share supply delta");
        assertEq(IEtherfiLiquidWeth(weth).balanceOf(user), 0, "WETH spent");
        assertEq(IEtherfiLiquidWeth(weth).balanceOf(vault) - beforeState.weth, amount, "vault WETH delta");
        emit log_named_uint("WETH deposited into the ether.fi Liquid vault", amount);
        emit log_named_uint("Liquid ETH shares minted", minted);
    }
}
