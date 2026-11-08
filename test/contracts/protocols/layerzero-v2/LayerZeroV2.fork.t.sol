// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IOftAdapter, ILayerZeroEndpoint, ILayerZeroUsdt} from "./interfaces/ILayerZero.sol";

/// Actual deployed USDT0 OApp -> EndpointV2 send, not an endpoint mock.
/// Only source-chain nonce/custody are proven. No DVN or destination delivery.
contract LayerZeroV2ForkTest is ProtocolTestBase {
    struct Before {
        uint256 nonce;
        uint256 locked;
    }
    event log_named_uint(string key, uint256 value);

    function test_fork_layerzero_v2_send() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        IOftAdapter adapter = IOftAdapter(Addresses.LayerzeroV2.USDT0_OFT_ADAPTER_OAPP_USED_BY_FORK_LAYERZERO_SEND);
        ILayerZeroEndpoint endpoint = ILayerZeroEndpoint(Addresses.LayerzeroV2.ENDPOINTV2);
        ILayerZeroUsdt usdt = ILayerZeroUsdt(Addresses.Tether.USDT);
        _requireCode(address(adapter));
        _requireCode(address(endpoint));
        _requireCode(address(usdt));
        assertEq(adapter.endpoint(), address(endpoint), "OApp endpoint implementation wiring");
        assertEq(adapter.token(), address(usdt), "OApp asset wiring");
        assertEq(uint256(endpoint.eid()), 30101, "Ethereum EID");
        _requireCode(endpoint.getSendLibrary(address(adapter), 30110));
        bytes32 peer = adapter.peers(30110);
        require(peer != bytes32(0), "Arbitrum peer");
        address user = address(uint160(uint256(keccak256("layerzero user"))));
        {
            // Existing USDT whale from impersonate.js / runtime.js, supplied by runner.
            address whale = vm.envOr("FORK_USDT_WHALE", address(0));
            require(whale != address(0) && usdt.balanceOf(whale) >= 100e6, "USDT whale");
            vm.prank(whale);
            usdt.transfer(user, 100e6);
        }
        IOftAdapter.SendParam memory param =
            IOftAdapter.SendParam(30110, bytes32(uint256(uint160(user))), 100e6, 0, "", "", "");
        (,, IOftAdapter.OftReceipt memory quoted) = adapter.quoteOFT(param);
        require(quoted.amountReceivedLD > 0, "OFT quote");
        param.minAmountLD = quoted.amountReceivedLD;
        IOftAdapter.Fee memory fee = adapter.quoteSend(param, false);
        require(fee.nativeFee > 0 && fee.lzTokenFee == 0, "native fee quote");
        vm.deal(user, fee.nativeFee);
        Before memory beforeState =
            Before(endpoint.outboundNonce(address(adapter), 30110, peer), usdt.balanceOf(address(adapter)));
        vm.startPrank(user);
        usdt.approve(address(adapter), 100e6);
        (IOftAdapter.MessageReceipt memory message, IOftAdapter.OftReceipt memory sent) =
            adapter.send{value: fee.nativeFee}(param, fee, user);
        vm.stopPrank();
        assertEq(
            uint256(endpoint.outboundNonce(address(adapter), 30110, peer)),
            beforeState.nonce + 1,
            "outbound nonce delta"
        );
        assertEq(uint256(message.nonce), beforeState.nonce + 1, "message nonce");
        require(message.guid != bytes32(0), "message GUID");
        assertEq(sent.amountSentLD, quoted.amountSentLD, "sent quote");
        assertEq(sent.amountReceivedLD, quoted.amountReceivedLD, "received quote");
        assertEq(usdt.balanceOf(address(adapter)) - beforeState.locked, quoted.amountSentLD, "USDT locked");
        assertEq(usdt.balanceOf(user), 100e6 - sent.amountSentLD, "USDT spent");
        emit log_named_uint("outbound nonce before", beforeState.nonce);
        emit log_named_uint("outbound nonce after", endpoint.outboundNonce(address(adapter), 30110, peer));
        emit log_named_uint("USDT locked", sent.amountSentLD);
    }
}
