// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;

interface ITornadoClassic {
    function denomination() external view returns (uint256);
    function commitments(bytes32) external view returns (bool);
    function nextIndex() external view returns (uint32);
    function deposit(bytes32 commitment) external payable;
}

contract TornadoCashForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    // Local fork only; no withdrawal proof, relayer or live transaction is involved.
    function test_fork_tornado_deposit() public {
        require(
            vm.envOr("FORK_BLOCK", uint256(0)) > 0 || bytes(vm.envOr("ETHEREUM_RPC_URL", string(""))).length == 0,
            "pin required"
        );
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        address target = Addresses.TornadoCash.TORNADO_CASH_CLASSIC_0_1_ETH_POOL;
        _requireCode(target);
        ITornadoClassic pool = ITornadoClassic(target);
        uint256 amount = pool.denomination();
        assertEq(amount, 0.1 ether, "pool denomination");
        bytes32 commitment = bytes32(
            uint256(keccak256("defi-scripts W1b isolated fixture"))
                % 21888242871839275222246405745257275088548364400416034343698204186575808495617
        );
        require(!pool.commitments(commitment), "fixture already used");
        uint256 beforeBalance = target.balance;
        uint256 next = pool.nextIndex();
        address user = address(uint160(uint256(keccak256("w1b tornado depositor"))));
        vm.deal(user, amount);
        vm.prank(user);
        pool.deposit{value: amount}(commitment);
        require(pool.commitments(commitment), "commitment not registered");
        assertEq(uint256(pool.nextIndex()), next + 1, "one Merkle leaf added");
        assertEq(target.balance - beforeBalance, amount, "ETH locked");
        assertEq(user.balance, 0, "ETH spent");
        emit log_named_uint("pool ETH increase", target.balance - beforeBalance);
        emit log_named_uint("Merkle leaf index", next);
    }
}
