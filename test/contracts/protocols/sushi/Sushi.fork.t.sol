// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface ISushiV2Router {
    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory);
    function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)
        external
        payable
        returns (uint256[] memory);
}

contract SushiForkTest is ProtocolTestBase {
    function test_fork_sushi_swap_eth_for_usdc() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address router = Addresses.Sushiswap.V2_ROUTER;
        address usdc = Addresses.Tokens.USDC_ETHEREUM;
        address weth = Addresses.Tokens.WETH_ETHEREUM;
        _requireCode(router);
        _requireCode(usdc);
        _requireCode(weth);
        address user = address(0xA11CE);
        uint256 amount = 0.05 ether;
        vm.deal(user, amount);
        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = usdc;
        uint256 quote = ISushiV2Router(router).getAmountsOut(amount, path)[1];
        require(quote > 0, "quote");
        uint256 before = IERC20(usdc).balanceOf(user);
        vm.prank(user);
        ISushiV2Router(router).swapExactETHForTokens{value: amount}(quote * 99 / 100, path, user, block.timestamp + 600);
        assertEq(IERC20(usdc).balanceOf(user) - before, quote, "USDC received");
    }
}
