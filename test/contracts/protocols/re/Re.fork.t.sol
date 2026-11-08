// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IRestrictedToken} from "./interfaces/IRestrictedToken.sol";

/// API-only-seven read-only exception: Re mint/redemption requires KYC/KYB.
/// Check circulating supply, precision, identity and deployed proxy implementation.
/// These are NOT mint/deposit or redemption tests.
contract ReForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_re_supply_invariants() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        _checkToken(Addresses.Re.REUSD, "reUSD");
        _checkToken(Addresses.Re.REUSDE, "reUSDe");
    }

    function _checkToken(address token, string memory expectedSymbol) internal {
        _requireCode(token);
        // EIP-1967 implementation slot, derived rather than a magic address literal.
        bytes32 slot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
        address implementation = address(uint160(uint256(vm.load(token, slot))));
        _requireCode(implementation);
        IRestrictedToken t = IRestrictedToken(token);
        assertEq(t.symbol(), expectedSymbol, "implementation token identity");
        assertEq(uint256(t.decimals()), 18, "token precision");
        uint256 supply = t.totalSupply();
        assertTrue(supply > 10 ** 18, "circulating supply above one token");
        emit log_named_uint(expectedSymbol, supply);
    }
}
