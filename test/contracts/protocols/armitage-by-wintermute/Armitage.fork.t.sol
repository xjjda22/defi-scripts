// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface IArmitageVaultV2 {
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

contract ArmitageForkTest is ProtocolTestBase {
    function test_fork_armitage_usdc_select_deposit() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address vault = Addresses
            .Armitage
            .WINTERMUTE_USDC_SELECT_MORPHO_VAULT_V2_SYMBOL_ARMUSDCS_LARGEST_OF_THE_SEVEN_ARMITAGE_CURATED_VAULTS;
        address usdc = Addresses.Armitage.USDC_ETHEREUM_ASSET_OF_FIVE_OF_THE_SEVEN_VAULTS;
        _requireCode(vault);
        _requireCode(usdc);
        IArmitageVaultV2 v = IArmitageVaultV2(vault);
        assertEq(v.asset(), usdc, "USDC wiring");
        assertEq(v.receiveSharesGate(), address(0), "receive shares gate");
        assertEq(v.sendSharesGate(), address(0), "send shares gate");
        assertEq(v.receiveAssetsGate(), address(0), "receive assets gate");
        assertEq(v.sendAssetsGate(), address(0), "send assets gate");
        address user = address(0xA11CE);
        uint256 amount = 100e6;
        bytes32 slot = keccak256(abi.encode(user, uint256(9)));
        vm.store(usdc, slot, bytes32(amount));
        uint256 preview = v.previewDeposit(amount);
        uint256 supplyBefore = v.totalSupply();
        vm.startPrank(user);
        IERC20(usdc).approve(vault, amount);
        uint256 returned = v.deposit(amount, user);
        vm.stopPrank();
        assertEq(v.balanceOf(user), returned, "shares minted");
        assertEq(returned, preview, "preview price");
        assertEq(v.totalSupply() - supplyBefore, returned, "supply delta");
        assertEq(IERC20(usdc).balanceOf(user), 0, "USDC spent");
    }
}
