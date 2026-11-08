// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface IEtherfiLiquidityPool {
    function deposit() external payable;
}

contract EtherfiStakeForkTest is ProtocolTestBase {
    function test_fork_etherfi_stake_deposit_eth() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address pool = Addresses.Etherfi.LIQUIDITY_POOL;
        address eeth = Addresses.Etherfi.EETH;
        _requireCode(pool);
        _requireCode(eeth);
        address user = address(0xA11CE);
        uint256 value = 0.05 ether;
        vm.deal(user, value);
        uint256 before = IERC20(eeth).balanceOf(user);
        vm.prank(user);
        IEtherfiLiquidityPool(pool).deposit{value: value}();
        assertTrue(IERC20(eeth).balanceOf(user) > before, "eETH minted");
    }
}
