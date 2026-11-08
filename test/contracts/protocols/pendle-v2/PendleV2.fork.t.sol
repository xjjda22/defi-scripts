// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

struct PendleSwapData {
    uint8 swapType;
    address extRouter;
    bytes extCalldata;
    bool needScale;
}

struct PendleTokenInput {
    address tokenIn;
    uint256 netTokenIn;
    address tokenMintSy;
    address pendleSwap;
    PendleSwapData swapData;
}

interface IPendleMarketV2 {
    function readTokens() external view returns (address sy, address pt, address yt);
    function isExpired() external view returns (bool);
}

interface IPendleRouterV4 {
    function mintPyFromToken(address receiver, address yt, uint256 minPyOut, PendleTokenInput calldata input)
        external
        returns (uint256 netPyOut, uint256 netSyInterm);
}

contract PendleV2ForkTest is ProtocolTestBase {
    function test_fork_pendle_v2_mint_py() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address router = Addresses.Pendle.PENDLE_ROUTER_V4;
        address market = Addresses.Pendle.PENDLE_MARKET_PT_STETH_30DEC2027;
        address wsteth = Addresses.Pendle.WSTETH_INPUT_TOKEN_THE_MARKET_S_UNDERLYINGASSET;
        _requireCode(router);
        _requireCode(market);
        _requireCode(wsteth);
        (, address pt, address yt) = IPendleMarketV2(market).readTokens();
        assertTrue(!IPendleMarketV2(market).isExpired(), "market expired");
        address user = address(0xA11CE);
        uint256 amount = 1e18;
        _dealToken(wsteth, user, amount);
        uint256 before = IERC20(pt).balanceOf(user);
        PendleTokenInput memory input =
            PendleTokenInput(wsteth, amount, wsteth, address(0), PendleSwapData(0, address(0), "", false));
        vm.startPrank(user);
        IERC20(wsteth).approve(router, amount);
        (uint256 netPyOut,) = IPendleRouterV4(router).mintPyFromToken(user, yt, 0, input);
        vm.stopPrank();
        assertTrue(netPyOut > 0, "PY minted");
        assertEq(IERC20(pt).balanceOf(user) - before, netPyOut, "PT balance delta");
        assertEq(IERC20(wsteth).balanceOf(user), 0, "wstETH spent");
    }

    function _dealToken(address token, address user, uint256 amount) private {
        for (uint256 slot = 0; slot < 64; slot++) {
            bytes32 soliditySlot = keccak256(abi.encode(user, slot));
            vm.store(token, soliditySlot, bytes32(amount));
            if (IERC20(token).balanceOf(user) == amount) return;
            bytes32 vyperSlot = keccak256(abi.encode(slot, user));
            vm.store(token, vyperSlot, bytes32(amount));
            if (IERC20(token).balanceOf(user) == amount) return;
        }
        revert("token balance slot not found");
    }
}
