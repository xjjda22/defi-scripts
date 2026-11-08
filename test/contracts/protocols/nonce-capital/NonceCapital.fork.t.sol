// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IVedaTeller, IVedaAccountant, IBoringVault, IWeth} from "../veda/interfaces/IVeda.sol";

/// Nonce Capital attribution: this is the SAME ether.fi Liquid ETH BoringVault
/// as the Veda row. Nonce is its curator, not a separate deployed protocol.
/// No claim is made about Nonce's Liquid USD/BTC or OP Mainnet Midas exposure.
contract NonceCapitalForkTest is ProtocolTestBase {
    struct Before {
        uint256 supply;
        uint256 shares;
        uint256 weth;
    }

    event log_named_uint(string key, uint256 value);

    function test_fork_nonce_capital_liquid_eth_deposit() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address vault = Addresses.Veda.LIQUID_ETH_BORINGVAULT;
        address teller = Addresses.Veda.TELLER;
        address weth = Addresses.Veda.WETH;
        _requireCode(vault);
        _requireCode(teller);
        _requireCode(weth);
        IVedaTeller t = IVedaTeller(teller);
        assertEq(t.vault(), vault, "Teller vault wiring");
        assertTrue(!t.isPaused(), "Teller paused");
        uint256 amount = 0.01 ether;
        uint256 expected;
        {
            (bool open,, uint16 premium) = t.assetData(weth);
            assertTrue(open, "WETH deposits closed");
            address accountant = t.accountant();
            _requireCode(accountant);
            uint256 rate = IVedaAccountant(accountant).getRateInQuoteSafe(weth);
            assertTrue(rate > 0, "accountant rate");
            expected = amount * 10 ** IBoringVault(vault).decimals() / rate;
            expected -= expected * premium / 10000;
            assertTrue(expected > 0, "expected shares");
        }
        address user = address(uint160(uint256(keccak256("nonce-capital depositor"))));
        vm.deal(user, amount);
        vm.prank(user);
        IWeth(weth).deposit{value: amount}();
        Before memory beforeState = Before(
            IBoringVault(vault).totalSupply(), IBoringVault(vault).balanceOf(user), IWeth(weth).balanceOf(vault)
        );
        vm.startPrank(user);
        IWeth(weth).approve(vault, amount);
        uint256 returned = t.deposit(weth, amount, expected);
        vm.stopPrank();
        uint256 minted = IBoringVault(vault).balanceOf(user) - beforeState.shares;
        assertEq(minted, expected, "accountant-priced shares");
        assertEq(minted, returned, "deposit return");
        assertEq(IBoringVault(vault).totalSupply() - beforeState.supply, minted, "supply delta");
        assertEq(IWeth(weth).balanceOf(user), 0, "WETH spent");
        assertEq(IWeth(weth).balanceOf(vault) - beforeState.weth, amount, "vault WETH delta");
        emit log_named_uint("WETH deposited into shared Veda/Nonce vault", amount);
        emit log_named_uint("Liquid ETH shares minted", minted);
    }
}
