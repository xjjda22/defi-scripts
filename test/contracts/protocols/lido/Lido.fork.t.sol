// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import * as Addresses from "../_shared/Addresses.sol";
import {IStETH} from "./interfaces/IStETH.sol";

/// Lido stETH: the permissionless `submit` stake path and the stETH it mints.
/// `submit` returns shares, so the stETH delta is checked exactly against their
/// pooled-ETH value and bounded within 2 wei of the ETH deposited.
contract LidoForkTest is ProtocolTestBase {
    function test_fork_lido_submit() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        address steth = Addresses.Lido.STETH;
        _requireCode(steth);

        // Identity: `getLido()` is not in the deployed stETH ABI — the selector
        // falls through to Lido's fallback and reverts `NON_EMPTY_DATA` (probed
        // at 26363300 and 20000000), so this uses `getLidoLocator()`, which only
        // the real Lido app answers, plus a live share count.
        assertTrue(IStETH(steth).getLidoLocator() != address(0), "not steth");
        assertTrue(IStETH(steth).getTotalShares() > 0, "shares");

        address user = address(0xC0FFEE);
        vm.deal(user, 1 ether);

        uint256 before = IStETH(steth).balanceOf(user);

        vm.prank(user);
        uint256 minted = IStETH(steth).submit{value: 1 ether}(address(0));

        uint256 afterBal = IStETH(steth).balanceOf(user);
        uint256 delta = afterBal - before;
        assertTrue(minted > 0, "minted");

        // `submit` returns minted *shares*, not stETH. The stETH credited is the
        // pooled-ETH value of those shares; that equality holds exactly.
        assertEq(delta, IStETH(steth).getPooledEthByShares(minted), "steth shares");

        // Measured at this block: 1 ETH in, 999999999999999999 stETH out — the
        // 1 wei is share rounding. No more than 2 wei is ever tolerated.
        assertTrue(delta + 2 >= 1 ether && delta <= 1 ether, "steth rounding");
    }
}
