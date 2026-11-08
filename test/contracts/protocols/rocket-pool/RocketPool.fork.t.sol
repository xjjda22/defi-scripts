// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface IRocketDepositPool {
    function deposit() external payable;
    function getMaximumDepositAmount() external view returns (uint256);
}

contract RocketPoolForkTest is ProtocolTestBase {
    function test_fork_rocket_pool_deposit_eth() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address pool = Addresses.RocketPool.DEPOSIT_POOL;
        address reth = Addresses.RocketPool.RETH;
        _requireCode(pool);
        _requireCode(reth);
        uint256 value = 0.05 ether;
        require(IRocketDepositPool(pool).getMaximumDepositAmount() >= value, "deposit cap");
        address user = address(0xA11CE);
        vm.deal(user, value);
        uint256 before = IERC20(reth).balanceOf(user);
        vm.prank(user, user);
        IRocketDepositPool(pool).deposit{value: value}();
        assertTrue(IERC20(reth).balanceOf(user) > before, "rETH minted");
    }
}
