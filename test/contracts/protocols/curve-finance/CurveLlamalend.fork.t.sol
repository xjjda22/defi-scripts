// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;

interface ILlamalendFactory {
    function vaults(uint256) external view returns (address);
}

interface ILlamalendVault {
    function asset() external view returns (address);
    function maxDeposit(address) external view returns (uint256);
    function previewDeposit(uint256) external view returns (uint256);
    function deposit(uint256, address) external returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function convertToAssets(uint256) external view returns (uint256);
}

interface ILlamalendCrvusd {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
}

contract CurveLlamalendForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_curve_llamalend_deposit() public {
        require(
            vm.envOr("FORK_BLOCK", uint256(0)) > 0 || bytes(vm.envOr("ETHEREUM_RPC_URL", string(""))).length == 0,
            "pin required"
        );
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        address factory = Addresses.CurveLlamalend.LLAMALEND_V1_ONEWAYLENDINGFACTORY;
        address target = Addresses.CurveLlamalend.LLAMALEND_WSTETH_LONG_VAULT_FACTORY_VAULTS_13;
        address crvusd = Addresses.CurveLlamalend.CRVUSD;
        _requireCode(factory);
        _requireCode(target);
        _requireCode(crvusd);
        assertEq(ILlamalendFactory(factory).vaults(13), target, "factory vault index");
        ILlamalendVault vault = ILlamalendVault(target);
        assertEq(vault.asset(), crvusd, "crvUSD asset");
        address user = address(uint160(uint256(keccak256("w1b llamalend lender"))));
        uint256 amount = 100e18;
        require(vault.maxDeposit(user) >= amount, "vault capacity");
        // Existing EXTRA_WHALES.ethereum.crvUSD in runtime.js, supplied by the runner.
        address whale = vm.envOr("FORK_CRVUSD_WHALE", address(0));
        require(whale != address(0), "configured crvUSD whale required");
        require(ILlamalendCrvusd(crvusd).balanceOf(whale) >= amount, "crvUSD whale balance");
        vm.prank(whale);
        require(ILlamalendCrvusd(crvusd).transfer(user, amount), "whale transfer");
        uint256 expected = vault.previewDeposit(amount);
        uint256 supply = vault.totalSupply();
        vm.startPrank(user);
        ILlamalendCrvusd(crvusd).approve(target, amount);
        uint256 minted = vault.deposit(amount, user);
        vm.stopPrank();
        require(minted > 0, "zero shares");
        assertEq(minted, expected, "preview match");
        assertEq(vault.balanceOf(user), minted, "user shares");
        assertEq(vault.totalSupply() - supply, minted, "supply increase");
        assertEq(ILlamalendCrvusd(crvusd).balanceOf(user), 0, "crvUSD spent");
        uint256 valued = vault.convertToAssets(minted);
        require(valued <= amount && amount - valued <= 1e12, "share value rounding");
        emit log_named_uint("Llamalend shares minted", minted);
        emit log_named_uint("crvUSD share value", valued);
    }
}
