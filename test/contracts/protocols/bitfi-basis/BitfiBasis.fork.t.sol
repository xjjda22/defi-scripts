// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface IBitfiVault {
    function underlyingAsset() external view returns (address);
    function paused() external view returns (bool);
    function minDepositTokenAmount() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function previewDeposit(uint256) external view returns (uint256);
    function deposit(uint256 amount, uint256 minAmount) external;
}

contract BitfiBasisForkTest is ProtocolTestBase {
    function test_fork_bitfi_bfbtc_deposit() public {
        if (!_fork("BSC_RPC_URL", 56)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address vault = Addresses.BitfiBasis.BFBTC_BITFI_BITCOIN_THE_BSC_BASIS_VAULT;
        address btcb = Addresses.BitfiBasis.BTCB_BSC_BTC_THE_VAULT_S_UNDERLYINGASSET;
        _requireCode(vault);
        _requireCode(btcb);
        IBitfiVault v = IBitfiVault(vault);
        assertEq(v.underlyingAsset(), btcb, "BTCB wiring");
        assertTrue(!v.paused(), "vault not paused");
        address user = address(0xA11CE);
        uint256 amount = 0.01 ether;
        assertTrue(amount >= v.minDepositTokenAmount(), "below minimum");
        _dealToken(btcb, user, amount);
        uint256 preview = v.previewDeposit(amount);
        require(preview > 0, "preview shares");
        uint256 before = v.balanceOf(user);
        uint256 supplyBefore = v.totalSupply();
        vm.startPrank(user);
        IERC20(btcb).approve(vault, amount);
        v.deposit(amount, preview * 99 / 100);
        vm.stopPrank();
        uint256 minted = v.balanceOf(user) - before;
        assertEq(minted, preview, "bfBTC minted");
        assertEq(v.totalSupply() - supplyBefore, minted, "supply delta");
        assertEq(IERC20(btcb).balanceOf(user), 0, "BTCB spent");
    }

    function _dealToken(address token, address user, uint256 amount) private {
        for (uint256 slot = 0; slot < 64; slot++) {
            bytes32 soliditySlot = keccak256(abi.encode(user, slot));
            vm.store(token, soliditySlot, bytes32(amount));
            if (IERC20(token).balanceOf(user) == amount) return;
            bytes32 vyperSlot = keccak256(abi.encode(slot, user));
            vm.store(token, vyperSlot, bytes32(amount));
            if (IERC20(token).balanceOf(user) == amount) return;
        }
        revert("token balance slot not found");
    }
}
