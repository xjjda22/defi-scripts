// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";
import {IERC4626} from "../_shared/interfaces/IERC4626.sol";

contract ListaDaoForkTest is ProtocolTestBase {
    function test_fork_lista_dao_usdt_vault_deposit() public {
        if (!_fork("BSC_RPC_URL", 56)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address vault = Addresses.ListaDao.MOOLAHVAULT_USDT;
        address usdt = Addresses.ListaDao.USDT;
        _requireCode(vault);
        _requireCode(usdt);
        IERC4626 v = IERC4626(vault);
        assertEq(v.asset(), usdt, "USDT wiring");
        address user = address(0xA11CE);
        uint256 amount = 100e18;
        _dealToken(usdt, user, amount);
        uint256 preview = v.previewDeposit(amount);
        require(preview > 0, "preview shares");
        vm.startPrank(user);
        IERC20(usdt).approve(vault, amount);
        uint256 returned = v.deposit(amount, user);
        vm.stopPrank();
        assertEq(v.balanceOf(user), returned, "shares minted");
        assertEq(returned, preview, "preview price");
        assertEq(IERC20(usdt).balanceOf(user), 0, "USDT spent");
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
