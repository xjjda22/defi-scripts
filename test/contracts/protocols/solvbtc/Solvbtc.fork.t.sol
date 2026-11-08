// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface ISolvRouter {
    function checkPoolPermission(bytes32 poolId) external view returns (bool);
    function createSubscription(bytes32 poolId, uint256 currencyAmount) external returns (uint256);
}

contract SolvbtcForkTest is ProtocolTestBase {
    bytes32 private constant WBTC_POOL_ID = 0x716db7dc196abe78d5349c7166896f674ab978af26ada3e5b3ea74c5a1b48307;

    function test_fork_solvbtc_create_subscription() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address router = Addresses.Solvbtc.SOLVBTC_ROUTER;
        address solvbtc = Addresses.Solvbtc.SOLVBTC;
        address wbtc = Addresses.Tokens.WBTC_ETHEREUM;
        _requireCode(router);
        _requireCode(solvbtc);
        _requireCode(wbtc);
        assertTrue(ISolvRouter(router).checkPoolPermission(WBTC_POOL_ID), "pool permission");
        address user = address(0xA11CE);
        uint256 amount = 0.01e8;
        address whale = vm.envOr("FORK_WBTC_WHALE", address(0));
        require(whale != address(0), "configured WBTC whale required");
        vm.prank(whale);
        IERC20(wbtc).transfer(user, amount);
        uint256 before = IERC20(solvbtc).balanceOf(user);
        vm.startPrank(user);
        IERC20(wbtc).approve(router, amount);
        uint256 minted = ISolvRouter(router).createSubscription(WBTC_POOL_ID, amount);
        vm.stopPrank();
        assertEq(IERC20(solvbtc).balanceOf(user) - before, minted, "SolvBTC minted");
        assertTrue(minted > 0, "SolvBTC output");
        assertEq(IERC20(wbtc).balanceOf(user), 0, "WBTC spent");
    }
}
