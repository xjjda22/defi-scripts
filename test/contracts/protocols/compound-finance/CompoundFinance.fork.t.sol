// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface IComet {
    function supply(address asset, uint256 amount) external;
    function balanceOf(address) external view returns (uint256);
    function isSupplyPaused() external view returns (bool);
}

contract CompoundFinanceForkTest is ProtocolTestBase {
    function test_fork_compound_finance_supply_usdc() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address comet = Addresses.Compound.CUSDCV3;
        address usdc = Addresses.Tokens.USDC_ETHEREUM;
        _requireCode(comet);
        _requireCode(usdc);
        assertTrue(!IComet(comet).isSupplyPaused(), "supply not paused");
        address user = address(0xA11CE);
        uint256 amount = 100e6;
        bytes32 slot = keccak256(abi.encode(user, uint256(9)));
        vm.store(usdc, slot, bytes32(amount));
        uint256 before = IComet(comet).balanceOf(user);
        vm.startPrank(user);
        IERC20(usdc).approve(comet, amount);
        IComet(comet).supply(usdc, amount);
        vm.stopPrank();
        assertTrue(IComet(comet).balanceOf(user) > before, "base balance increased");
        assertTrue(IERC20(usdc).balanceOf(user) < amount, "USDC spent");
    }
}
