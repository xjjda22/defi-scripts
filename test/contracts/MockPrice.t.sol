// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MockPrice} from "../../src/simulation/fork/contracts/MockPrice.sol";
import {TestBase, vm} from "./helpers/TestBase.sol";

/// MockPrice has no setters on purpose: the fork tests install values with
/// anvil_setStorageAt, which maps to vm.store here.
contract MockPriceTest is TestBase {
    MockPrice internal price;

    bytes32 internal constant PRICE_SLOT = keccak256("defi-scripts.mock.price");
    bytes32 internal constant DEC_SLOT = keccak256("defi-scripts.mock.decimals");

    function setUp() public {
        price = new MockPrice();
    }

    function test_defaultsToZeroPriceAndEightDecimals() public view {
        assertEq(uint256(price.price()), 0, "default price");
        assertEq(price.latestAnswer(), 0, "default answer");
        assertEq(uint256(price.decimals()), 8, "default decimals");
    }

    function test_latestRoundDataUsesCurrentBlockAndRoundOne() public view {
        (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound) =
            price.latestRoundData();
        assertEq(uint256(roundId), 1, "roundId");
        assertEq(answer, 0, "answer");
        assertEq(startedAt, block.timestamp, "startedAt");
        assertEq(updatedAt, block.timestamp, "updatedAt");
        assertEq(uint256(answeredInRound), 1, "answeredInRound");
    }

    function test_priceReadsPriceSlot() public {
        vm.store(address(price), PRICE_SLOT, bytes32(uint256(1234e8)));

        assertEq(price.price(), 1234e8, "price()");
        assertEq(price.price_w(), 1234e8, "price_w()");
        assertEq(price.latestAnswer(), int256(1234e8), "latestAnswer()");
        (, int256 answer,,,) = price.latestRoundData();
        assertEq(answer, int256(1234e8), "latestRoundData answer");
    }

    function test_decimalsReadsDecSlotAndFallsBackToEight() public {
        vm.store(address(price), DEC_SLOT, bytes32(uint256(18)));
        assertEq(uint256(price.decimals()), 18, "18 decimals");

        vm.store(address(price), DEC_SLOT, bytes32(uint256(6)));
        assertEq(uint256(price.decimals()), 6, "6 decimals");

        vm.store(address(price), DEC_SLOT, bytes32(0));
        assertEq(uint256(price.decimals()), 8, "zero falls back to 8");
    }

    function test_latestAnswerCastsUnsignedPriceToInt() public {
        vm.store(address(price), PRICE_SLOT, bytes32(type(uint256).max));

        assertEq(price.latestAnswer(), -1, "uint max casts to -1");
        assertEq(price.price(), type(uint256).max, "price stays unsigned");
    }
}
