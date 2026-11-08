// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface IMetaPoolSpETH {
    function depositETH(address receiver) external payable returns (uint256);
    function previewDeposit(uint256) external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
}

contract MetaPoolForkTest is ProtocolTestBase {
    function test_fork_meta_pool_deposit_eth() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address speth = Addresses.MetaPool.SPETH_ERC_4626_STAKING;
        address pool = Addresses.MetaPool.LIQUID_UNSTAKE_POOL;
        _requireCode(speth);
        _requireCode(pool);
        address user = address(0xA11CE);
        uint256 value = 0.1 ether;
        vm.deal(user, value);
        uint256 preview = IMetaPoolSpETH(speth).previewDeposit(value);
        require(preview > 0, "preview shares");
        uint256 before = IMetaPoolSpETH(speth).balanceOf(user);
        uint256 custodyBefore = speth.balance + pool.balance;
        vm.prank(user);
        uint256 returned = IMetaPoolSpETH(speth).depositETH{value: value}(user);
        assertEq(returned, preview, "preview price");
        assertEq(IMetaPoolSpETH(speth).balanceOf(user) - before, returned, "shares minted");
        assertEq(speth.balance + pool.balance - custodyBefore, value, "ETH custody delta");
    }
}
