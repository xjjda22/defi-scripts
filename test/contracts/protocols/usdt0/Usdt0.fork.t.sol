// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IUsdt0Adapter, IUsdt0Endpoint, IUsdt0Token, IUsdt0VmLogs} from "./interfaces/IUsdt0.sol";

/// Source-chain USDT0 OFT send. Destination minting needs off-chain DVN/executor delivery.
contract Usdt0ForkTest is ProtocolTestBase {
    struct Before {
        uint256 nonce;
        uint256 locked;
    }
    event log_named_uint(string key, uint256 value);

    function test_fork_usdt0_send() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        IUsdt0Adapter adapter = IUsdt0Adapter(Addresses.Usdt0.USDT0_OFT_ADAPTER_LOCKS_USDT);
        IUsdt0Endpoint endpoint = IUsdt0Endpoint(Addresses.LayerzeroV2.ENDPOINTV2);
        IUsdt0Token usdt = IUsdt0Token(Addresses.Usdt0.USDT_LOCKED_ASSET);
        _requireCode(address(adapter));
        _requireCode(address(endpoint));
        _requireCode(address(usdt));
        assertEq(adapter.endpoint(), address(endpoint), "OApp endpoint wiring");
        assertEq(adapter.token(), address(usdt), "OFT asset wiring");
        assertEq(uint256(endpoint.eid()), 30101, "Ethereum EID");
        _requireCode(endpoint.getSendLibrary(address(adapter), 30110));
        bytes32 peer = adapter.peers(30110);
        require(peer != bytes32(0), "Arbitrum peer");

        address user = address(uint160(uint256(keccak256("usdt0 user"))));
        address whale = vm.envOr("FORK_USDT_WHALE", address(0));
        require(whale != address(0) && usdt.balanceOf(whale) >= 100e6, "USDT whale");
        vm.prank(whale);
        usdt.transfer(user, 100e6);

        IUsdt0Adapter.SendParam memory param =
            IUsdt0Adapter.SendParam(30110, bytes32(uint256(uint160(user))), 100e6, 0, "", "", "");
        (,, IUsdt0Adapter.OftReceipt memory quoted) = adapter.quoteOFT(param);
        require(quoted.amountReceivedLD > 0, "OFT quote");
        param.minAmountLD = quoted.amountReceivedLD;
        IUsdt0Adapter.Fee memory fee = adapter.quoteSend(param, false);
        require(fee.nativeFee > 0 && fee.lzTokenFee == 0, "native fee quote");
        vm.deal(user, fee.nativeFee);
        Before memory beforeState =
            Before(endpoint.outboundNonce(address(adapter), 30110, peer), usdt.balanceOf(address(adapter)));

        vm.startPrank(user);
        usdt.approve(address(adapter), 100e6);
        IUsdt0VmLogs(address(vm)).recordLogs();
        (IUsdt0Adapter.MessageReceipt memory message, IUsdt0Adapter.OftReceipt memory sent) =
            adapter.send{value: fee.nativeFee}(param, fee, user);
        vm.stopPrank();

        _assertPacket(address(endpoint), endpoint.getSendLibrary(address(adapter), 30110));
        assertEq(endpoint.outboundNonce(address(adapter), 30110, peer), beforeState.nonce + 1, "nonce delta");
        assertEq(uint256(message.nonce), beforeState.nonce + 1, "message nonce");
        require(message.guid != bytes32(0), "message GUID");
        assertEq(sent.amountSentLD, quoted.amountSentLD, "sent quote");
        assertEq(sent.amountReceivedLD, quoted.amountReceivedLD, "received quote");
        assertEq(usdt.balanceOf(address(adapter)) - beforeState.locked, quoted.amountSentLD, "USDT locked");
        assertEq(usdt.balanceOf(user), 100e6 - sent.amountSentLD, "USDT spent");
        emit log_named_uint("USDT locked", sent.amountSentLD);
        emit log_named_uint("outbound nonce after", endpoint.outboundNonce(address(adapter), 30110, peer));
    }

    function _assertPacket(address endpoint, address expectedLibrary) internal {
        IUsdt0VmLogs.Log[] memory logs = IUsdt0VmLogs(address(vm)).getRecordedLogs();
        bytes32 signature = keccak256("PacketSent(bytes,bytes,address)");
        uint256 packets;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != endpoint || logs[i].topics.length != 1 || logs[i].topics[0] != signature) continue;
            (bytes memory payload,, address sendLibrary) = abi.decode(logs[i].data, (bytes, bytes, address));
            require(payload.length > 0, "empty packet");
            assertEq(sendLibrary, expectedLibrary, "configured send library");
            ++packets;
        }
        assertEq(packets, 1, "one EndpointV2 PacketSent");
    }
}
