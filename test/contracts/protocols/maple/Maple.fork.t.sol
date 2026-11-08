// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IMaplePool, IMapleManager} from "./interfaces/IMaple.sol";

/// API-only-seven exception: first deposit needs a Maple signature. Read-only
/// supply, exchange rate and bidirectional manager wiring, never a forged deposit.
contract MapleForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_maple_pool_invariants() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address target = Addresses.Maple.SYRUPUSDC_POOLV2;
        _requireCode(target);
        _requireCode(Addresses.Usdc.USDC);
        IMaplePool pool = IMaplePool(target);
        assertEq(pool.asset(), Addresses.Usdc.USDC, "USDC implementation wiring");
        address manager = pool.manager();
        _requireCode(manager);
        assertEq(IMapleManager(manager).pool(), target, "manager pool wiring");
        assertEq(pool.symbol(), "syrupUSDC", "pool identity");
        uint256 supply = pool.totalSupply();
        uint256 rate = pool.convertToAssets(1e6);
        assertTrue(supply > 1e6, "live pool supply");
        assertTrue(rate > 1e6, "yield-accrued share rate");
        emit log_named_uint("syrupUSDC total supply (read-only)", supply);
        emit log_named_uint("USDC per 1e6 shares (read-only)", rate);
    }
}
