// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface ILiquityStabilityPool {
    function lusdToken() external view returns (address);
    function provideToSP(uint256 amount, address hint) external;
    function withdrawFromSP(uint256 amount) external;
    function getTotalLUSDDeposits() external view returns (uint256);
    function getCompoundedLUSDDeposit(address) external view returns (uint256);
}

contract LiquityForkTest is ProtocolTestBase {
    function test_fork_liquity_stability_pool_round_trip() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address pool = Addresses.Liquity.V1_STABILITYPOOL;
        address lusd = Addresses.Liquity.LUSD;
        _requireCode(pool);
        _requireCode(lusd);
        ILiquityStabilityPool p = ILiquityStabilityPool(pool);
        assertEq(p.lusdToken(), lusd, "LUSD wiring");
        address user = address(0xA11CE);
        uint256 amount = 1000 ether;
        _dealLusd(lusd, user, amount);
        uint256 totalBefore = p.getTotalLUSDDeposits();
        vm.prank(user);
        p.provideToSP(amount, address(0));
        assertEq(p.getCompoundedLUSDDeposit(user), amount, "pool deposit");
        assertEq(p.getTotalLUSDDeposits() - totalBefore, amount, "pool total delta");
        vm.prank(user);
        p.withdrawFromSP(amount);
        assertEq(p.getCompoundedLUSDDeposit(user), 0, "deposit cleared");
        assertEq(p.getTotalLUSDDeposits(), totalBefore, "pool total restored");
    }

    function _dealLusd(address token, address user, uint256 amount) private {
        for (uint256 slot = 0; slot < 32; slot++) {
            bytes32 soliditySlot = keccak256(abi.encode(user, slot));
            vm.store(token, soliditySlot, bytes32(amount));
            if (IERC20(token).balanceOf(user) == amount) return;
            bytes32 vyperSlot = keccak256(abi.encode(slot, user));
            vm.store(token, vyperSlot, bytes32(amount));
            if (IERC20(token).balanceOf(user) == amount) return;
        }
        revert("LUSD balance slot not found");
    }
}
