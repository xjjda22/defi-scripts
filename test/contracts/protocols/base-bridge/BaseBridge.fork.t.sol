// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;

interface IBaseStandardBridge {
    function depositETHTo(address to, uint32 minGasLimit, bytes calldata extraData) external payable;
    function messenger() external view returns (address);
}

interface IBasePortal {
    function ethLockbox() external view returns (address);
}

contract BaseBridgeForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_base_bridge_deposit() public {
        require(
            vm.envOr("FORK_BLOCK", uint256(0)) > 0 || bytes(vm.envOr("ETHEREUM_RPC_URL", string(""))).length == 0,
            "pin required"
        );
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        address bridge = Addresses.BaseBridge.L1STANDARDBRIDGE;
        address portal = Addresses.BaseBridge.OPTIMISMPORTAL;
        _requireCode(bridge);
        _requireCode(portal);
        _requireCode(IBaseStandardBridge(bridge).messenger());
        address lockbox;
        // Old portal implementations predate ethLockbox(); in that case custody is the portal.
        try IBasePortal(portal).ethLockbox() returns (address resolved) {
            lockbox = resolved;
        } catch {}
        if (lockbox != address(0)) {
            _requireCode(lockbox);
            require(lockbox != bridge && lockbox != portal, "distinct custody");
        }
        uint256 beforeBalance = bridge.balance + portal.balance + lockbox.balance;
        address user = address(uint160(uint256(keccak256("w1b base depositor"))));
        vm.deal(user, 1 ether);
        vm.prank(user);
        IBaseStandardBridge(bridge).depositETHTo{value: 0.05 ether}(user, 200000, "");
        uint256 delta = bridge.balance + portal.balance + lockbox.balance - beforeBalance;
        assertEq(delta, 0.05 ether, "source ETH custody");
        assertEq(user.balance, 0.95 ether, "user ETH spent");
        emit log_named_uint("source-chain ETH locked", delta);
    }
}
