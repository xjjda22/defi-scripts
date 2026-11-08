// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IHumaPst} from "./interfaces/IHumaPst.sol";

/// API-only-seven exception: Huma's PST mint/redeem lives in the Solana program,
/// which is off this EVM fork. This asserts the deployed Ethereum CCIP token's
/// identity and live supply; it does not claim a mint, redeem or transfer.
contract HumaForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_huma_pst_invariants() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address target = Addresses.Huma.PST_ETHEREUM;
        _requireCode(target);
        IHumaPst pst = IHumaPst(target);
        assertEq(pst.symbol(), "PST", "token symbol");
        assertEq(pst.name(), "PayFi Strategy Token", "token name");
        assertEq(uint256(pst.decimals()), 6, "token decimals");
        uint256 supply = pst.totalSupply();
        assertTrue(supply > 1e6, "live PST supply");
        emit log_named_uint("PST total supply (read-only)", supply);
    }
}
