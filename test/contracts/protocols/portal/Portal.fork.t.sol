// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IPortalTokenBridge, IPortalCore, IPortalWeth, IPortalVmLogs} from "./interfaces/IPortal.sol";

/// Wormhole Portal source-chain wrap/transfer. Guardians sign the VAA and the
/// destination mint is off-fork; this proves custody plus the published payload.
contract PortalForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_portal_wrap_and_transfer_eth() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address bridge = Addresses.Portal.TOKEN_BRIDGE_WTT;
        address core = Addresses.Portal.WORMHOLE_CORE;
        address weth = Addresses.Portal.WETH_WRAPPED_BY_WRAPANDTRANSFERETH_AND_HELD_BY_THE_TOKEN_BRIDGE;
        _requireCode(bridge);
        _requireCode(core);
        _requireCode(weth);
        uint256 value = 0.05 ether;
        uint256 fee = IPortalCore(core).messageFee();
        address user = address(uint160(uint256(keccak256("portal user"))));
        vm.deal(user, value + fee);
        uint256 heldBefore = IPortalWeth(weth).balanceOf(bridge);

        vm.startPrank(user);
        IPortalVmLogs(address(vm)).recordLogs();
        uint64 sequence = IPortalTokenBridge(bridge).wrapAndTransferETH{value: value + fee}(
            23, bytes32(uint256(uint160(user))), 0, 0
        );
        vm.stopPrank();

        assertEq(IPortalWeth(weth).balanceOf(bridge) - heldBefore, value, "WETH custody delta");
        assertEq(user.balance, 0, "ETH spent including message fee");
        _assertPayload(bridge, core, weth, user, value, sequence);
        emit log_named_uint("bridge WETH increase", value);
        emit log_named_uint("message fee", fee);
        emit log_named_uint("Wormhole sequence", sequence);
    }

    function _assertPayload(
        address bridge,
        address core,
        address weth,
        address user,
        uint256 value,
        uint64 sequence
    ) internal {
        IPortalVmLogs.Log[] memory logs = IPortalVmLogs(address(vm)).getRecordedLogs();
        bytes32 signature = keccak256("LogMessagePublished(address,uint64,uint32,bytes,uint8)");
        bytes32 senderTopic = bytes32(uint256(uint160(bridge)));
        uint256 found;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != core || logs[i].topics.length != 2 || logs[i].topics[0] != signature) continue;
            assertEq(uint256(logs[i].topics[1]), uint256(senderTopic), "Token Bridge emitter");
            (uint64 emittedSequence, uint32 nonce, bytes memory payload, uint8 consistency) =
                abi.decode(logs[i].data, (uint64, uint32, bytes, uint8));
            assertEq(uint256(emittedSequence), uint256(sequence), "sequence");
            assertEq(uint256(nonce), 0, "nonce");
            require(consistency > 0, "consistency");
            require(payload.length == 133 && uint8(payload[0]) == 1, "transfer payload");
            assertEq(_word(payload, 1), value / 1e10, "8-decimal amount");
            assertEq(_word(payload, 33), uint256(uint160(weth)), "WETH token");
            assertEq(_u16(payload, 65), 2, "Ethereum token chain");
            assertEq(_word(payload, 67), uint256(uint160(user)), "recipient");
            assertEq(_u16(payload, 99), 23, "Arbitrum destination");
            assertEq(_word(payload, 101), 0, "arbiter fee");
            ++found;
        }
        assertEq(found, 1, "one Portal message");

    }

    function _word(bytes memory data, uint256 offset) internal pure returns (uint256 word) {
        assembly {
            word := mload(add(add(data, 0x20), offset))
        }
    }

    function _u16(bytes memory data, uint256 offset) internal pure returns (uint256) {
        return _word(data, offset) >> 240;
    }
}
