// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface ISkyConverter {
    function daiToUsds(address recipient, uint256 daiAmount) external;
}

contract MakerForkTest is ProtocolTestBase {
    function test_fork_maker_sky_dai_to_usds() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address dai = Addresses.Maker.DAI;
        address usds = Addresses.Maker.USDS;
        address converter = Addresses.Maker.DAI_USDS_CONVERTER;
        _requireCode(dai);
        _requireCode(usds);
        _requireCode(converter);
        address user = address(0xA11CE);
        uint256 amount = 100e18;
        address whale = vm.envOr("FORK_DAI_WHALE", address(0));
        require(whale != address(0), "configured DAI whale required");
        vm.prank(whale);
        IERC20(dai).transfer(user, amount);
        vm.startPrank(user);
        IERC20(dai).approve(converter, amount);
        ISkyConverter(converter).daiToUsds(user, amount);
        vm.stopPrank();
        uint256 minted = IERC20(usds).balanceOf(user);
        assertTrue(minted > 0 && minted <= amount, "USDS minted");
        assertEq(IERC20(dai).balanceOf(user), 0, "DAI spent");
    }
}
