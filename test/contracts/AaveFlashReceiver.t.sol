// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AaveFlashReceiver} from "../../src/simulation/fork/contracts/FlashReceivers.sol";
import {MockERC20, TestBase, vm} from "./helpers/TestBase.sol";

contract AaveFlashReceiverTest is TestBase {
    address internal constant POOL = address(0xA11CE);

    MockERC20 internal token;
    AaveFlashReceiver internal receiver;

    function setUp() public {
        token = new MockERC20("Mock Token", "MCK", 18);
        receiver = new AaveFlashReceiver(POOL);
    }

    function test_constructorSetsPoolAndZeroState() public view {
        assertEq(receiver.pool(), POOL, "pool");
        assertEq(receiver.seenAmount(), 0, "seenAmount");
        assertEq(receiver.seenPremium(), 0, "seenPremium");
        assertEq(receiver.seenBalance(), 0, "seenBalance");
    }

    function test_executeOperationRevertsForNonPool() public {
        vm.expectRevert(bytes("pool"));
        receiver.executeOperation(address(token), 1 ether, 0, address(this), "");
    }

    function test_executeOperationRecordsCallbackAndApprovesRepayment() public {
        token.mint(address(receiver), 100 ether);

        vm.prank(POOL);
        bool ok = receiver.executeOperation(address(token), 100 ether, 1 ether, address(this), "");

        assertTrue(ok, "returns true");
        assertEq(receiver.seenAmount(), 100 ether, "seenAmount");
        assertEq(receiver.seenPremium(), 1 ether, "seenPremium");
        assertEq(receiver.seenBalance(), 100 ether, "seenBalance");
        assertEq(token.allowance(address(receiver), POOL), 101 ether, "approval is amount + premium");
    }
}
