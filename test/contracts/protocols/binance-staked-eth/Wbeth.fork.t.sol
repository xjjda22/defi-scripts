// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IWbeth} from "./interfaces/IWbeth.sol";

/// Binance wBETH public mint only. Redemption remains custodial and is not claimed.
contract WbethForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_binance_staked_eth_deposit() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address target = Addresses.BinanceStakedEth.WBETH;
        _requireCode(target);
        IWbeth wbeth = IWbeth(target);
        uint256 rate = wbeth.exchangeRate(); // implementation-only getter
        assertTrue(rate > 1 ether, "exchange rate");
        address user = address(uint160(uint256(keccak256("wbeth user"))));
        uint256 amount = 1 ether;
        vm.deal(user, amount);
        uint256 beforeBalance = wbeth.balanceOf(user);
        uint256 beforeSupply = wbeth.totalSupply();
        uint256 beforeEth = target.balance;
        vm.prank(user);
        wbeth.deposit{value: amount}(address(0));
        uint256 minted = wbeth.balanceOf(user) - beforeBalance;
        uint256 expected = amount * 1 ether / rate;
        assertTrue(minted > 0 && minted + 1 >= expected && minted <= expected + 1, "rate-priced mint");
        assertEq(wbeth.totalSupply() - beforeSupply, minted, "supply delta");
        assertEq(target.balance - beforeEth, amount, "ETH locked");
        assertEq(user.balance, 0, "ETH spent");
        emit log_named_uint("wBETH minted", minted);
        emit log_named_uint("ETH locked", target.balance - beforeEth);
    }
}
