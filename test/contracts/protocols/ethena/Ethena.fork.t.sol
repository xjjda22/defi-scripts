// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IStakedUsde, IUsde} from "./interfaces/IEthena.sol";

/// Public stake only: USDe minting is whitelisted and is not called.
contract EthenaForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_ethena_stake() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address usde = Addresses.Ethena.USDE;
        address susde = Addresses.Ethena.SUSDE;
        _requireCode(usde);
        _requireCode(susde);
        IStakedUsde vault = IStakedUsde(susde);
        assertEq(vault.asset(), usde, "USDe implementation wiring");
        // Choose only an existing USDe whale from runtime.js EXTRA_WHALES.ethereum.USDe.
        // The runner supplies it; no guessed storage slot or mint authority is used.
        address whale = vm.envOr("FORK_USDE_WHALE", address(0));
        require(whale != address(0), "set FORK_USDE_WHALE from runtime registry");
        address user = address(uint160(uint256(keccak256("ethena user"))));
        uint256 amount = 100 ether;
        require(IUsde(usde).balanceOf(whale) >= amount, "USDe whale balance");
        vm.prank(whale);
        require(IUsde(usde).transfer(user, amount), "whale transfer");
        uint256 beforeShares = vault.balanceOf(user);
        uint256 beforeSupply = vault.totalSupply();
        uint256 beforeAssets = IUsde(usde).balanceOf(susde);
        uint256 expected = vault.previewDeposit(amount);
        assertTrue(expected > 0, "preview shares");
        vm.startPrank(user);
        IUsde(usde).approve(susde, amount);
        uint256 returned = vault.deposit(amount, user);
        vm.stopPrank();
        uint256 minted = vault.balanceOf(user) - beforeShares;
        assertEq(minted, expected, "preview shares");
        assertEq(minted, returned, "deposit return");
        assertEq(vault.totalSupply() - beforeSupply, minted, "supply delta");
        assertEq(IUsde(usde).balanceOf(user), 0, "USDe spent");
        assertEq(IUsde(usde).balanceOf(susde) - beforeAssets, amount, "vault USDe delta");
        emit log_named_uint("USDe staked", amount);
        emit log_named_uint("sUSDe minted", minted);
    }
}
