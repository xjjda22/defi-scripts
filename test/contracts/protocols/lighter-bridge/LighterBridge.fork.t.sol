// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;

interface ILighterDeposit {
    function deposit(address to, uint16 assetIndex, uint8 routeType, uint256 amount) external payable;
}

interface ILighterUsdc {
    function balanceOf(address user) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract LighterBridgeForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_lighter_deposit() public {
        require(
            vm.envOr("FORK_BLOCK", uint256(0)) > 0 || bytes(vm.envOr("ETHEREUM_RPC_URL", string(""))).length == 0,
            "pin required"
        );
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        address lighter = Addresses.LighterBridge.LIGHTER_ZKLIGHTER_PROXY;
        address usdc = Addresses.LighterBridge.USDC;
        _requireCode(lighter);
        _requireCode(usdc);
        bytes32 slot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
        _requireCode(address(uint160(uint256(vm.load(lighter, slot)))));
        address user = address(uint160(uint256(keccak256("w1b lighter depositor"))));
        uint256 amount = 20e6;
        // USDC balances mapping slot 9, documented by the existing W0 Aave fixture.
        vm.store(usdc, keccak256(abi.encode(user, uint256(9))), bytes32(amount));
        assertEq(ILighterUsdc(usdc).balanceOf(user), amount, "USDC fixture");
        uint256 beforeBalance = ILighterUsdc(usdc).balanceOf(lighter);
        vm.startPrank(user);
        ILighterUsdc(usdc).approve(lighter, amount);
        ILighterDeposit(lighter).deposit(user, 3, 0, amount);
        vm.stopPrank();
        assertEq(ILighterUsdc(usdc).balanceOf(user), 0, "USDC spent");
        uint256 delta = ILighterUsdc(usdc).balanceOf(lighter) - beforeBalance;
        assertEq(delta, amount, "Lighter USDC escrow");
        emit log_named_uint("Lighter USDC increase", delta);
    }
}
