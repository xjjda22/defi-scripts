// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface IEigenStrategyManager {
    function depositIntoStrategy(address strategy, address token, uint256 amount) external returns (uint256);
    function stakerDepositShares(address staker, address strategy) external view returns (uint256);
}

contract EigencloudForkTest is ProtocolTestBase {
    function test_fork_eigencloud_deposit_steth_strategy() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address manager = Addresses.Eigencloud.STRATEGYMANAGER;
        address strategy = Addresses.Eigencloud.STETH_STRATEGY;
        address steth = Addresses.Eigencloud.STETH;
        _requireCode(manager);
        _requireCode(strategy);
        _requireCode(steth);
        address user = address(0xA11CE);
        uint256 amount = 0.1 ether;
        address whale = vm.envOr("FORK_STETH_WHALE", address(0));
        require(whale != address(0), "configured stETH whale required");
        vm.prank(whale);
        IERC20(steth).transfer(user, amount);
        uint256 before = IEigenStrategyManager(manager).stakerDepositShares(user, strategy);
        vm.startPrank(user);
        IERC20(steth).approve(manager, amount);
        IEigenStrategyManager(manager).depositIntoStrategy(strategy, steth, amount);
        vm.stopPrank();
        assertTrue(
            IEigenStrategyManager(manager).stakerDepositShares(user, strategy) > before, "strategy shares minted"
        );
        assertEq(IERC20(steth).balanceOf(user), 0, "stETH spent");
    }
}
