// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface IGroveVaultV2 {
    function asset() external view returns (address);
    function balanceOf(address) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function previewDeposit(uint256) external view returns (uint256);
    function deposit(uint256, address) external returns (uint256);
    function receiveSharesGate() external view returns (address);
    function sendSharesGate() external view returns (address);
    function receiveAssetsGate() external view returns (address);
    function sendAssetsGate() external view returns (address);
}

contract GroveFinanceForkTest is ProtocolTestBase {
    function test_fork_grove_usdc_vault_deposit() public {
        if (!_fork("BASE_RPC_URL", 8453)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address vault = Addresses.Grove.GROVE_X_STEAKHOUSE_USDC_MORPHO_VAULT_V2_SYMBOL_GROVE_STEAKUSDC;
        address usdc = Addresses.Grove.USDC_BASE_THE_VAULT_ASSET;
        _requireCode(vault);
        _requireCode(usdc);
        IGroveVaultV2 v = IGroveVaultV2(vault);
        assertEq(v.asset(), usdc, "USDC wiring");
        assertEq(v.receiveSharesGate(), address(0), "receive shares gate");
        assertEq(v.sendSharesGate(), address(0), "send shares gate");
        assertEq(v.receiveAssetsGate(), address(0), "receive assets gate");
        assertEq(v.sendAssetsGate(), address(0), "send assets gate");
        address user = address(0xA11CE);
        uint256 amount = 100e6;
        address whale = vm.envOr("FORK_USDC_WHALE", address(0));
        require(whale != address(0), "configured Base USDC whale required");
        vm.prank(whale);
        IERC20(usdc).transfer(user, amount);
        uint256 preview = v.previewDeposit(amount);
        vm.startPrank(user);
        IERC20(usdc).approve(vault, amount);
        uint256 returned = v.deposit(amount, user);
        vm.stopPrank();
        assertEq(v.balanceOf(user), returned, "shares minted");
        assertEq(returned, preview, "preview price");
        assertTrue(IERC20(usdc).balanceOf(user) < amount, "USDC spent");
    }
}
