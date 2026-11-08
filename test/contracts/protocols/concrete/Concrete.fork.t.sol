// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;

interface IConcreteVault {
    function asset() external view returns (address);
    function getDepositLimits() external view returns (uint256 maximum, uint256 minimum);
    function previewDeposit(uint256 assets) external view returns (uint256);
    function deposit(uint256 assets, address receiver) external returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

interface IConcreteUsdt {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external;
    function transfer(address, uint256) external;
}

contract ConcreteForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_concrete_deposit() public {
        require(
            vm.envOr("FORK_BLOCK", uint256(0)) > 0 || bytes(vm.envOr("ETHEREUM_RPC_URL", string(""))).length == 0,
            "pin required"
        );
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        address target = Addresses.Concrete.CONCRETE_DECENTRALIZED_FINANCE_USDT_CTDEFIUSDT;
        address usdt = Addresses.Tokens.USDT_ETHEREUM;
        _requireCode(target);
        _requireCode(usdt);
        IConcreteVault vault = IConcreteVault(target);
        assertEq(vault.asset(), usdt, "USDT asset");
        uint256 amount = 100e6;
        (uint256 maximum, uint256 minimum) = vault.getDepositLimits();
        require(amount >= minimum && amount <= maximum, "deposit limits");
        // Only a pre-existing whale from src/utils/impersonate.js may fund this fixture.
        // Pass FORK_USDT_WHALE from WHALES.ethereum.USDT; never discover/write token slots.
        address whale = vm.envOr("FORK_USDT_WHALE", address(0));
        require(whale != address(0), "configured USDT whale required");
        require(IConcreteUsdt(usdt).balanceOf(whale) >= amount, "USDT whale balance");
        address user = address(uint160(uint256(keccak256("w1b concrete depositor"))));
        vm.prank(whale);
        IConcreteUsdt(usdt).transfer(user, amount);
        assertEq(IConcreteUsdt(usdt).balanceOf(user), amount, "USDT funded");
        uint256 preview = vault.previewDeposit(amount);
        uint256 supply = vault.totalSupply();
        vm.startPrank(user);
        IConcreteUsdt(usdt).approve(target, amount);
        uint256 minted = vault.deposit(amount, user);
        vm.stopPrank();
        require(minted > 0, "zero shares");
        assertEq(minted, preview, "preview shares");
        assertEq(vault.balanceOf(user), minted, "user shares");
        assertEq(vault.totalSupply() - supply, minted, "supply increase");
        assertEq(IConcreteUsdt(usdt).balanceOf(user), 0, "USDT spent");
        emit log_named_uint("ctDefiUSDT shares minted", minted);
        emit log_named_uint("USDT spent", amount);
    }
}
