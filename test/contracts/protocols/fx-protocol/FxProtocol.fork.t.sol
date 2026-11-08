// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface IFxPoolManager {
    function operate(address pool, uint256 positionId, int256 newCollateral, int256 newDebt)
        external
        returns (uint256);
}

interface IFxPool {
    function getPosition(uint256 positionId) external view returns (uint256 rawCollateral, uint256 rawDebt);
    function ownerOf(uint256 positionId) external view returns (address);
    function getNextPositionId() external view returns (uint32);
}

contract FxProtocolForkTest is ProtocolTestBase {
    function test_fork_fx_protocol_open_wsteth_position() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address manager = Addresses.FxProtocol.F_X_V2_POOLMANAGER;
        address pool = Addresses.FxProtocol.F_X_V2_WSTETH_POOL;
        address wsteth = Addresses.FxProtocol.WSTETH_F_X_COLLATERAL;
        address fxusd = Addresses.FxProtocol.FXUSD;
        _requireCode(manager);
        _requireCode(pool);
        _requireCode(wsteth);
        _requireCode(fxusd);
        address user = address(0xA11CE);
        uint256 collateral = 1e18;
        uint256 debt = 1000e18;
        _dealToken(wsteth, user, collateral);
        vm.startPrank(user);
        IERC20(wsteth).approve(manager, collateral);
        uint256 positionId = IFxPoolManager(manager).operate(pool, 0, int256(collateral), int256(debt));
        vm.stopPrank();
        (uint256 rawCollateral, uint256 rawDebt) = IFxPool(pool).getPosition(positionId);
        assertEq(IFxPool(pool).ownerOf(positionId), user, "position owner");
        assertTrue(rawCollateral > 0, "collateral recorded");
        assertTrue(rawDebt > 0, "debt recorded");
        assertEq(IERC20(wsteth).balanceOf(user), 0, "wstETH spent");
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
