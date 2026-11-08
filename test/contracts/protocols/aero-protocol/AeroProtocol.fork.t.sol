// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface IAeroV2Pool {
    function factory() external view returns (address);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint256, uint256, uint256);
    function balanceOf(address user) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function mint(address to) external returns (uint256);
}

/// Aero's post-migration v2 AERO/USDC pool entry. This proves the core LP mint;
/// the Metarouter wrappers and gauge staking are not part of this primitive.
contract AeroProtocolForkTest is ProtocolTestBase {
    struct Before {
        uint256 reserve0;
        uint256 reserve1;
        uint256 supply;
        uint256 aero;
        uint256 usdc;
    }
    IAeroV2Pool private pool;
    address private aero;
    address private usdc;
    address private token0;
    address private token1;
    event log_named_uint(string key, uint256 value);

    function test_fork_aero_add_liquidity() public {
        if (!_fork("BASE_RPC_URL", 8453)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        pool = IAeroV2Pool(Addresses.AeroProtocolDex.AERO_V2_AERO_USDC_POOL);
        aero = Addresses.AeroProtocolDex.AERO_TOKEN_POST_MIGRATION;
        usdc = Addresses.AeroProtocolDex.NATIVE_USDC_AERO_V2_POOL_ASSET;
        _requireCode(address(pool));
        _requireCode(Addresses.AeroProtocolDex.AERO_V2_POOLFACTORY);
        _requireCode(aero);
        _requireCode(usdc);
        assertEq(pool.factory(), Addresses.AeroProtocolDex.AERO_V2_POOLFACTORY, "pool factory wiring");
        token0 = pool.token0();
        token1 = pool.token1();
        require((token0 == aero && token1 == usdc) || (token0 == usdc && token1 == aero), "pool assets");
        _addLiquidity();
    }

    function _addLiquidity() internal {
        (uint256 reserve0, uint256 reserve1,) = pool.getReserves();
        uint256 usdcAmount = 100e6;
        uint256 aeroAmount = token0 == aero
            ? (usdcAmount * reserve0) / reserve1 + 1
            : (usdcAmount * reserve1) / reserve0 + 1;
        address user = address(0xA11CE);
        address aeroWhale = Addresses.AeroProtocolDex.AERO_VOTINGESCROW_AERO_FUNDING_FIXTURE;
        address usdcWhale = vm.envOr("FORK_USDC_WHALE", address(0));
        require(usdcWhale != address(0), "configured Base USDC whale required");
        require(IERC20(aero).balanceOf(aeroWhale) >= aeroAmount, "AERO fixture balance");
        vm.prank(aeroWhale);
        IERC20(aero).transfer(user, aeroAmount);
        vm.prank(usdcWhale);
        IERC20(usdc).transfer(user, usdcAmount);

        Before memory beforeState = Before(
            reserve0,
            reserve1,
            pool.totalSupply(),
            IERC20(aero).balanceOf(user),
            IERC20(usdc).balanceOf(user)
        );
        vm.startPrank(user);
        IERC20(token0).transfer(address(pool), token0 == aero ? aeroAmount : usdcAmount);
        IERC20(token1).transfer(address(pool), token1 == aero ? aeroAmount : usdcAmount);
        uint256 minted = pool.mint(user);
        vm.stopPrank();

        assertEq(minted, pool.balanceOf(user), "LP minted");
        assertEq(pool.totalSupply() - beforeState.supply, minted, "supply delta");
        (uint256 newReserve0, uint256 newReserve1,) = pool.getReserves();
        assertEq(newReserve0 - beforeState.reserve0, aeroAmount, "AERO reserve delta");
        assertEq(newReserve1 - beforeState.reserve1, usdcAmount, "USDC reserve delta");
        assertEq(beforeState.aero - IERC20(aero).balanceOf(user), aeroAmount, "AERO spent");
        assertEq(beforeState.usdc - IERC20(usdc).balanceOf(user), usdcAmount, "USDC spent");
        emit log_named_uint("AERO deposited", aeroAmount);
        emit log_named_uint("USDC deposited", usdcAmount);
        emit log_named_uint("LP minted", minted);
    }
}
