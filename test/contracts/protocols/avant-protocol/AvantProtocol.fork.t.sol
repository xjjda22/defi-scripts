// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";
import {IERC4626} from "../_shared/interfaces/IERC4626.sol";

contract AvantProtocolForkTest is ProtocolTestBase {
    function test_fork_avant_stake_avusd() public {
        if (!_fork("AVALANCHE_RPC_URL", 43114)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address vault = Addresses.Avant.SAVUSD_STAKED_AVUSD_ERC_4626_VAULT_SYMBOL_SAVUSD_ASSET_AVUSD;
        address avusd = Addresses.Avant.AVUSD_AVANT_USD_THE_STAKED_ASSET_18_DECIMALS;
        _requireCode(vault);
        _requireCode(avusd);
        IERC4626 v = IERC4626(vault);
        assertEq(v.asset(), avusd, "avUSD wiring");
        address user = address(0xA11CE);
        uint256 amount = 100e18;
        _dealAvusd(avusd, user, amount);
        uint256 preview = v.previewDeposit(amount);
        require(preview > 0, "preview shares");
        vm.startPrank(user);
        IERC20(avusd).approve(vault, amount);
        uint256 returned = v.deposit(amount, user);
        vm.stopPrank();
        assertEq(v.balanceOf(user), returned, "savUSD minted");
        assertEq(returned, preview, "preview price");
        assertEq(IERC20(avusd).balanceOf(user), 0, "avUSD spent");
    }

    function _dealAvusd(address token, address user, uint256 amount) private {
        for (uint256 slot = 0; slot < 32; slot++) {
            bytes32 soliditySlot = keccak256(abi.encode(user, slot));
            vm.store(token, soliditySlot, bytes32(amount));
            if (IERC20(token).balanceOf(user) == amount) return;
            bytes32 vyperSlot = keccak256(abi.encode(slot, user));
            vm.store(token, vyperSlot, bytes32(amount));
            if (IERC20(token).balanceOf(user) == amount) return;
        }
        revert("avUSD balance slot not found");
    }
}
