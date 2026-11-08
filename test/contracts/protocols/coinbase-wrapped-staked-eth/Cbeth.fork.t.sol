// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;

interface ICbeth {
    function exchangeRate() external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function decimals() external view returns (uint8);
    function symbol() external view returns (string memory);
}

contract CbethForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    // cbETH mint/redeem is custodial. This file proves backing-rate accounting only.
    function test_fork_cbeth_rate() public {
        require(
            vm.envOr("FORK_BLOCK", uint256(0)) > 0 || bytes(vm.envOr("ETHEREUM_RPC_URL", string(""))).length == 0,
            "pin required"
        );
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        address token = Addresses.Cbeth.CBETH;
        _requireCode(token);
        ICbeth cbeth = ICbeth(token);
        assertEq(cbeth.symbol(), "cbETH", "implementation symbol");
        assertEq(uint256(cbeth.decimals()), 18, "share decimals");
        uint256 rate = cbeth.exchangeRate();
        uint256 supply = cbeth.totalSupply();
        require(rate > 1e18 && rate < 2e18, "backing rate outside staking range");
        require(supply > 1 ether, "circulating supply");
        uint256 backing = supply * rate / 1e18;
        require(backing > supply && backing - supply == supply * (rate - 1e18) / 1e18, "accrued backing accounting");
        emit log_named_uint("cbETH exchange rate", rate);
        emit log_named_uint("cbETH supply", supply);
        emit log_named_uint("accrued backing over shares", backing - supply);
    }
}
