// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// The Uniswap V3 SwapRouter02-era surface: `exactInputSingle` with the classic
/// `ExactInputSingleParams` struct (`deadline`, no `deadline` in the V2 router),
/// plus `factory()`, which the real router answers with the V3 factory address.
interface IUniswapV3Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);

    function factory() external view returns (address);
}

/// WETH9's wrapped-deposit entry point: `deposit` mints 1:1 against msg.value.
interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 wad) external;
}
