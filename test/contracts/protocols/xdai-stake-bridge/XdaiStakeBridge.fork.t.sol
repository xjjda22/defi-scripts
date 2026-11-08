// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface IXDaiBridge {
    function erc20token() external view returns (address);
    function getBridgeMode() external view returns (bytes4);
    function validatorContract() external view returns (address);
    function isInitialized() external view returns (bool);
    function minPerTx() external view returns (uint256);
    function maxPerTx() external view returns (uint256);
    function dailyLimit() external view returns (uint256);
    function totalSpentPerDay(uint256 day) external view returns (uint256);
    function relayTokens(address receiver, uint256 value) external;
}

contract XdaiStakeBridgeForkTest is ProtocolTestBase {
    function test_fork_xdai_stake_bridge_relay_usds() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address bridge = Addresses
            .XdaiStakeBridge
            .XDAI_STAKE_BRIDGE_ETHEREUM_SIDE_POA_ETERNALSTORAGEPROXY_IMPLEMENTATION_0X257BDD093CAB1BD39EBF837DCB60F33D031D7D49;
        address usds =
            Addresses.XdaiStakeBridge.USDS_THE_BRIDGE_S_COLLATERAL_ERC20TOKEN_LOCKED_ON_ETHEREUM_XDAI_MINTED_ON_GNOSIS;
        _requireCode(bridge);
        _requireCode(usds);
        IXDaiBridge b = IXDaiBridge(bridge);
        assertEq(b.erc20token(), usds, "USDS wiring");
        assertTrue(b.getBridgeMode() == bytes4(0x18762d46), "erc-to-native mode");
        assertTrue(b.isInitialized(), "bridge initialized");
        uint256 amount = 100e18;
        assertTrue(amount >= b.minPerTx() && amount <= b.maxPerTx(), "bridge limits");
        address user = address(0xA11CE);
        _dealToken(usds, user, amount);
        uint256 day = block.timestamp / 86400;
        uint256 collateralBefore = IERC20(usds).balanceOf(bridge);
        uint256 spentBefore = b.totalSpentPerDay(day);
        vm.startPrank(user);
        IERC20(usds).approve(bridge, amount);
        b.relayTokens(user, amount);
        vm.stopPrank();
        assertEq(IERC20(usds).balanceOf(bridge) - collateralBefore, amount, "USDS locked");
        assertEq(b.totalSpentPerDay(day) - spentBefore, amount, "daily spend delta");
        assertEq(IERC20(usds).balanceOf(user), 0, "USDS spent");
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
