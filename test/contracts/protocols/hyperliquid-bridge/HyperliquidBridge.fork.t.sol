// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IBridge2, IBridgeUsdc, IHyperliquidVmEmit} from "./interfaces/IHyperliquidBridge.sol";

/// Bridge2's source deposit is a USDC transfer; no Bridge2 storage transition is
/// claimed. Hyperliquid validators and destination credit are outside this fork.
contract HyperliquidBridgeForkTest is ProtocolTestBase {
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event log_named_uint(string key, uint256 value);

    function test_fork_hyperliquid_bridge_deposit() public {
        if (!_fork("ARBITRUM_RPC_URL", 42161)) return;
        emit log_named_uint("EVM block number", block.number);
        emit log_named_uint("requested L2 fork pin", vm.envOr("FORK_BLOCK", uint256(0)));
        // On Arbitrum BLOCKNUMBER is the L1 number,
        // not the L2 RPC height. _fork selects the requested L2 block explicitly.
        require(vm.envOr("FORK_BLOCK", uint256(0)) > 0, "L2 pin required");
        address escrow = Addresses.HyperliquidBridge.HYPERLIQUID_BRIDGE_BRIDGE2_ARBITRUM_USDC_ESCROW;
        address token = Addresses.Tokens.USDC_ARBITRUM;
        _requireCode(escrow);
        _requireCode(token);
        assertTrue(!IBridge2(escrow).paused(), "Bridge2 paused");
        assertEq(IBridge2(escrow).usdcToken(), token, "Bridge2 implementation asset wiring");
        IBridgeUsdc usdc = IBridgeUsdc(token);
        // src/utils/impersonate.js WHALES.arbitrum.USDC, supplied by the runner.
        address whale = vm.envOr("FORK_ARBITRUM_USDC_WHALE", address(0));
        require(whale != address(0), "set FORK_ARBITRUM_USDC_WHALE from registry");
        address user = address(uint160(uint256(keccak256("hyperliquid depositor"))));
        uint256 amount = 10e6;
        require(usdc.balanceOf(whale) >= amount, "USDC whale balance");
        vm.prank(whale);
        require(usdc.transfer(user, amount), "USDC funding transfer");
        uint256 beforeEscrow = usdc.balanceOf(escrow);
        uint256 beforeUser = usdc.balanceOf(user);
        IHyperliquidVmEmit(address(vm)).expectEmit(true, true, false, true, token);
        emit Transfer(user, escrow, amount);
        vm.prank(user);
        require(usdc.transfer(escrow, amount), "source deposit transfer");
        assertEq(beforeUser - usdc.balanceOf(user), amount, "depositor USDC debit");
        assertEq(usdc.balanceOf(escrow) - beforeEscrow, amount, "escrow USDC delta");
        emit log_named_uint("escrow USDC delta", usdc.balanceOf(escrow) - beforeEscrow);
    }
}
