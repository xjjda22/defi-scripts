// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IOmniBridge, IVmLogs} from "./interfaces/INearBridge.sol";

/// Source-chain lock only. The NEAR side verifies this deposit through its light client;
/// no NEAR verification or destination credit is executed on this machine.
contract NearBridgeForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_near_bridge_init_transfer() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address bridge = Addresses.NearBridge.OMNI_BRIDGE;
        _requireCode(bridge);
        // The book entry is an ERC-1967 proxy; assert the implementation it delegates to.
        bytes32 implSlot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
        _requireCode(address(uint160(uint256(vm.load(bridge, implSlot)))));

        address user = address(uint160(uint256(keccak256("w2a near depositor"))));
        uint256 amount = 0.05 ether;
        vm.deal(user, 1 ether);
        uint256 beforeBalance = bridge.balance;
        IVmLogs(address(vm)).recordLogs();
        vm.prank(user);
        IOmniBridge(bridge).initTransfer{value: amount}(address(0), uint128(amount), 0, 0, "near:alice.near", "");

        uint256 delta = bridge.balance - beforeBalance;
        assertEq(delta, amount, "Omni Bridge ETH custody");
        assertEq(user.balance, 0.95 ether, "user ETH spent");

        bytes32 topic = keccak256("InitTransfer(address,address,uint64,uint128,uint128,uint128,string,string)");
        IVmLogs.Log[] memory logs = IVmLogs(address(vm)).getRecordedLogs();
        uint256 matched;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter != bridge) continue;
            if (logs[i].topics.length != 4 || logs[i].topics[0] != topic) continue;
            matched++;
            assertTrue(logs[i].topics[1] == bytes32(uint256(uint160(user))), "InitTransfer sender");
            assertTrue(logs[i].topics[2] == bytes32(0), "InitTransfer token is native");
            uint256 originNonce = uint256(logs[i].topics[3]);
            assertTrue(originNonce > 0, "InitTransfer originNonce");
            (uint128 loggedAmount, uint128 fee, uint128 nativeFee, string memory recipient, string memory message) =
                abi.decode(logs[i].data, (uint128, uint128, uint128, string, string));
            assertEq(uint256(loggedAmount), amount, "InitTransfer amount");
            assertEq(uint256(fee), 0, "InitTransfer fee");
            assertEq(uint256(nativeFee), 0, "InitTransfer nativeFee");
            assertEq(recipient, "near:alice.near", "InitTransfer recipient");
            assertEq(message, "", "InitTransfer message");
            emit log_named_uint("InitTransfer origin nonce", originNonce);
        }
        assertEq(matched, 1, "exactly one InitTransfer");
        emit log_named_uint("Omni Bridge ETH increase", delta);
    }
}
