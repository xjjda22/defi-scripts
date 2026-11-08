// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface IKpkVaultV2 {
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

contract KpkForkTest is ProtocolTestBase {
    function test_fork_kpk_usdc_prime_deposit() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address vault = Addresses.Kpk.KPK_USDC_PRIME_MORPHO_VAULT_V2;
        address usdc = Addresses.Tokens.USDC_ETHEREUM;
        _requireCode(vault);
        _requireCode(usdc);
        IKpkVaultV2 v = IKpkVaultV2(vault);
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
        require(preview > 0, "preview shares");
        uint256 supplyBefore = v.totalSupply();
        vm.startPrank(user);
        IERC20(usdc).approve(vault, amount);
        uint256 returned = v.deposit(amount, user);
        vm.stopPrank();
        assertEq(v.balanceOf(user), returned, "shares minted");
        assertEq(returned, preview, "preview price");
        assertEq(IERC20(usdc).balanceOf(user), 0, "USDC spent");
        assertEq(v.totalSupply() - supplyBefore, returned, "share supply delta");
    }
}
