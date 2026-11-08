// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import * as Addresses from "../_shared/Addresses.sol";
import {IERC20} from "../_shared/interfaces/IERC20.sol";
import {IUniswapV3Router, IWETH} from "./interfaces/IUniswapV3Router.sol";

/// Uniswap V3 exact-input swap on the real mainnet router against a fork.
///
///   ETHEREUM_RPC_URL=... FORK_BLOCK=26363300 forge test \
///     --match-path 'test/contracts/protocols/uniswap/**' -vv
///
/// WETH -> USDC through the 0.05% pool. The delta is exact: the recipient's
/// USDC balance equals the router's return value, and the wallet's WETH is
/// fully spent. `factory()` is the identity check — the real SwapRouter answers
/// with the canonical V3 factory.
contract UniswapV3ForkTest is ProtocolTestBase {
    function test_fork_uniswap_v3_swap() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;

        address router = Addresses.Uniswap.V3_ROUTER;
        address weth = Addresses.Tokens.WETH_ETHEREUM;
        address usdc = Addresses.Tokens.USDC_ETHEREUM;
        _requireCode(router);
        _requireCode(weth);
        _requireCode(usdc);

        address factory = Addresses.Uniswap.V3_FACTORY;
        _requireCode(factory);
        assertEq(IUniswapV3Router(router).factory(), factory, "not uniswap v3 router");

        address user = address(0xB0B);
        vm.deal(user, 2 ether);

        vm.startPrank(user);
        IWETH(weth).deposit{value: 1 ether}();
        IERC20(weth).approve(router, 1 ether);

        uint256 amountOut = IUniswapV3Router(router).exactInputSingle(
            IUniswapV3Router.ExactInputSingleParams({
                tokenIn: weth,
                tokenOut: usdc,
                fee: 500,
                recipient: user,
                deadline: block.timestamp + 600,
                amountIn: 1 ether,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );
        vm.stopPrank();

        assertTrue(amountOut > 0, "amountOut");
        assertEq(IERC20(usdc).balanceOf(user), amountOut, "usdc");
        assertEq(IERC20(weth).balanceOf(user), 0, "weth spent");
    }
}
