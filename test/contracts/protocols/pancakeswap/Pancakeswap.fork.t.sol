// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;

interface IPancakeToken {
    function deposit() external payable;
    function approve(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

interface IPancakeFactory {
    function getPool(address, address, uint24) external view returns (address);
}

interface IPancakeRouter {
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
    function factory() external view returns (address);
    function exactInputSingle(ExactInputSingleParams calldata) external payable returns (uint256);
}

contract PancakeswapForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_pancakeswap_v3_swap() public {
        require(
            vm.envOr("FORK_BLOCK", uint256(0)) > 0 || bytes(vm.envOr("ETHEREUM_RPC_URL", string(""))).length == 0,
            "pin required"
        );
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        address router = Addresses.Pancakeswap.V3_ROUTER;
        address factory = Addresses.Pancakeswap.V3_FACTORY;
        address weth = Addresses.Tokens.WETH_ETHEREUM;
        address usdc = Addresses.Tokens.USDC_ETHEREUM;
        _requireCode(router);
        _requireCode(factory);
        _requireCode(weth);
        _requireCode(usdc);
        assertEq(IPancakeRouter(router).factory(), factory, "Pancake factory");
        _requireCode(IPancakeFactory(factory).getPool(weth, usdc, 500));
        address user = address(uint160(uint256(keccak256("w1b pancake trader"))));
        vm.deal(user, 0.05 ether);
        uint256 beforeUsdc = IPancakeToken(usdc).balanceOf(user);
        vm.startPrank(user);
        IPancakeToken(weth).deposit{value: 0.05 ether}();
        IPancakeToken(weth).approve(router, 0.05 ether);
        uint256 out = IPancakeRouter(router)
            .exactInputSingle(
                IPancakeRouter.ExactInputSingleParams({
                    tokenIn: weth,
                    tokenOut: usdc,
                    fee: 500,
                    recipient: user,
                    deadline: block.timestamp + 600,
                    amountIn: 0.05 ether,
                    amountOutMinimum: 1,
                    sqrtPriceLimitX96: 0
                })
            );
        vm.stopPrank();
        require(out > 0, "zero swap output");
        assertEq(IPancakeToken(usdc).balanceOf(user) - beforeUsdc, out, "USDC equals router return");
        assertEq(IPancakeToken(weth).balanceOf(user), 0, "WETH spent");
        emit log_named_uint("WETH spent", 0.05 ether);
        emit log_named_uint("USDC received", out);
    }
}
