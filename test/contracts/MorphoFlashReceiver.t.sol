// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MorphoFlashReceiver} from "../../src/simulation/fork/contracts/FlashReceivers.sol";
import {MockERC20, TestBase, vm} from "./helpers/TestBase.sol";

interface IMorphoCallback {
    function onMorphoFlashLoan(uint256 assets, bytes calldata data) external;
}

/// Minimal Morpho Blue flash lender: sends the assets, calls back, then pulls
/// them back through the allowance the receiver is expected to set.
contract MockMorpho {
    MockERC20 public immutable token;
    uint256 public lastAssets;
    bytes public lastData;

    constructor(MockERC20 token_) {
        token = token_;
    }

    function flashLoan(address token_, uint256 assets, bytes calldata data) external {
        require(token_ == address(token), "token");
        lastAssets = assets;
        lastData = data;
        token.transfer(msg.sender, assets);
        IMorphoCallback(msg.sender).onMorphoFlashLoan(assets, data);
        token.transferFrom(msg.sender, address(this), assets);
    }
}

contract MorphoFlashReceiverTest is TestBase {
    MockERC20 internal token;
    MockMorpho internal morpho;
    MorphoFlashReceiver internal receiver;

    function setUp() public {
        token = new MockERC20("Mock Token", "MCK", 18);
        morpho = new MockMorpho(token);
        receiver = new MorphoFlashReceiver(address(morpho));
    }

    function test_constructorSetsMorphoAndZeroState() public view {
        assertEq(receiver.morpho(), address(morpho), "morpho");
        assertEq(receiver.token(), address(0), "token unset");
        assertEq(receiver.seenAmount(), 0, "seenAmount");
        assertEq(receiver.seenBalance(), 0, "seenBalance");
    }

    function test_onMorphoFlashLoanRevertsForNonMorpho() public {
        vm.expectRevert(bytes("morpho"));
        receiver.onMorphoFlashLoan(1 ether, "");
    }

    function test_runBorrowsAndRepaysThroughApproval() public {
        token.mint(address(morpho), 100 ether);

        receiver.run(address(token), 100 ether);

        assertEq(receiver.token(), address(token), "token recorded");
        assertEq(receiver.seenAmount(), 100 ether, "seenAmount");
        assertEq(receiver.seenBalance(), 100 ether, "seenBalance");
        assertEq(morpho.lastAssets(), 100 ether, "morpho lent amount");
        assertEq(token.balanceOf(address(morpho)), 100 ether, "flash loan repaid");
        assertEq(token.allowance(address(receiver), address(morpho)), 0, "allowance consumed");
        assertEq(token.balanceOf(address(receiver)), 0, "receiver holds nothing");
    }

    function test_onMorphoFlashLoanFromMorphoRecordsBalanceAndApproves() public {
        // `token` is only written by run(), so seed it with a zero-asset loan.
        receiver.run(address(token), 0);
        token.mint(address(receiver), 40 ether);

        vm.prank(address(morpho));
        receiver.onMorphoFlashLoan(40 ether, "");

        assertEq(receiver.seenAmount(), 40 ether, "seenAmount");
        assertEq(receiver.seenBalance(), 40 ether, "seenBalance");
        assertEq(token.allowance(address(receiver), address(morpho)), 40 ether, "approval");
    }
}
