// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {ITether} from "./interfaces/ITether.sol";

/// Transfer-only coverage: Tether mint and redemption remain off-chain/KYC-gated.
contract TetherForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_tether_transfer() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address target = Addresses.Tether.USDT;
        _requireCode(target);
        ITether usdt = ITether(target);
        assertEq(usdt.symbol(), "USDT", "token identity");
        assertEq(usdt.decimals(), 6, "USDT precision");
        // From src/utils/impersonate.js WHALES.ethereum.USDT or runtime.js EXTRA_WHALES.
        address whale = vm.envOr("FORK_USDT_WHALE", address(0));
        require(whale != address(0), "set FORK_USDT_WHALE from registry");
        address user = address(uint160(uint256(keccak256("tether receiver"))));
        uint256 amount = 100e6;
        uint256 from = usdt.balanceOf(whale);
        uint256 to = usdt.balanceOf(user);
        uint256 supply = usdt.totalSupply();
        require(from >= amount, "USDT whale balance");
        vm.prank(whale);
        usdt.transfer(user, amount); // legacy USDT returns no bool
        assertEq(from - usdt.balanceOf(whale), amount, "sender debit");
        assertEq(usdt.balanceOf(user) - to, amount, "receiver credit");
        assertEq(usdt.totalSupply(), supply, "transfer supply unchanged");
        emit log_named_uint("USDT sender debit", from - usdt.balanceOf(whale));
        emit log_named_uint("USDT receiver credit", usdt.balanceOf(user) - to);
    }
}
