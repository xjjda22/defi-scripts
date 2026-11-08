// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface IFluidDexPool {
    function swapIn(bool swap0to1, uint256 amountIn, uint256 amountOutMin, address to)
        external
        payable
        returns (uint256);
}

interface IFluidDexResolver {
    function getDexTokens(address dex) external view returns (address token0, address token1);
    function estimateSwapIn(address dex, bool swap0to1, uint256 amountIn, uint256 amountOutMin)
        external
        payable
        returns (uint256);
}

contract FluidDexForkTest is ProtocolTestBase {
    address private constant NATIVE = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    function test_fork_fluid_dex_swap_native_to_usdc() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address pool = Addresses.FluidDex.FLUID_DEX_USDC_NATIVE_ETH_POOL;
        address resolver = Addresses.FluidDex.FLUID_DEX_RESOLVER;
        address usdc = Addresses.Tokens.USDC_ETHEREUM;
        _requireCode(pool);
        _requireCode(resolver);
        _requireCode(usdc);
        (address token0, address token1) = IFluidDexResolver(resolver).getDexTokens(pool);
        assertEq(token0, usdc, "token0 wiring");
        assertEq(token1, NATIVE, "token1 wiring");
        address user = address(0xA11CE);
        uint256 amount = 0.05 ether;
        vm.deal(user, amount);
        uint256 quote = IFluidDexResolver(resolver).estimateSwapIn{value: amount}(pool, false, amount, 0);
        require(quote > 0, "quote");
        uint256 before = IERC20(usdc).balanceOf(user);
        vm.prank(user);
        uint256 received = IFluidDexPool(pool).swapIn{value: amount}(false, amount, quote * 999 / 1000, user);
        assertEq(IERC20(usdc).balanceOf(user) - before, received, "USDC received");
        assertTrue(received > 0, "swap output");
    }
}
