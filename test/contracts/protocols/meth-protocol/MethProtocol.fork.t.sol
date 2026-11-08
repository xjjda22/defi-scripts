// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface IMethStaking {
    function mETH() external view returns (address);
    function ethToMETH(uint256) external view returns (uint256);
    function stake(uint256) external payable;
}

contract MethProtocolForkTest is ProtocolTestBase {
    function test_fork_meth_protocol_stake() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address staking = Addresses.MethProtocol.STAKING;
        address meth = Addresses.MethProtocol.METH_L1;
        _requireCode(staking);
        _requireCode(meth);
        assertEq(IMethStaking(staking).mETH(), meth, "mETH wiring");
        address user = address(0xA11CE);
        uint256 value = 1 ether;
        vm.deal(user, value);
        uint256 expected = IMethStaking(staking).ethToMETH(value);
        require(expected > 0, "zero quote");
        uint256 stakingBefore = staking.balance;
        vm.prank(user);
        IMethStaking(staking).stake{value: value}(expected);
        assertEq(IERC20(meth).balanceOf(user), expected, "mETH minted");
        assertEq(staking.balance - stakingBefore, value, "ETH locked");
    }
}
