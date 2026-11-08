// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface ICurve3Pool {
    function calc_token_amount(uint256[3] calldata amounts, bool isDeposit) external view returns (uint256);
    function add_liquidity(uint256[3] calldata amounts, uint256 minMintAmount) external;
}

contract CurveDexForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_curve_dex_3pool_add_liquidity() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address pool = Addresses.CurveDex.CURVE_3POOL;
        address usdc = Addresses.Tokens.USDC_ETHEREUM;
        address dai = Addresses.Tokens.DAI_ETHEREUM;
        _requireCode(pool);
        _requireCode(usdc);
        _requireCode(dai);
        ICurve3Pool curve = ICurve3Pool(pool);
        address lp = Addresses.CurveDex.CURVE_3CRV_LP_TOKEN;
        _requireCode(lp);
        address user = address(0xA11CE);
        uint256 amount = 100e6;
        bytes32 slot = keccak256(abi.encode(user, uint256(9)));
        vm.store(usdc, slot, bytes32(amount));
        address daiWhale = vm.envOr("FORK_DAI_WHALE", address(0));
        require(daiWhale != address(0), "configured DAI whale required");
        vm.prank(daiWhale);
        IERC20(dai).transfer(user, 100e18);
        uint256[3] memory amounts = [uint256(100e18), amount, 0];
        uint256 expected = curve.calc_token_amount(amounts, true);
        require(expected > 0, "calculated LP");
        uint256 before = IERC20(lp).balanceOf(user);
        vm.startPrank(user);
        IERC20(usdc).approve(pool, amount);
        IERC20(dai).approve(pool, 100e18);
        curve.add_liquidity(amounts, expected * 99 / 100);
        vm.stopPrank();
        uint256 minted = IERC20(lp).balanceOf(user) - before;
        emit log_named_uint("minted", minted);
        emit log_named_uint("expected", expected);
        emit log_named_uint("usdc", IERC20(usdc).balanceOf(user));
        emit log_named_uint("dai", IERC20(dai).balanceOf(user));
        assertTrue(minted > 0, "3Crv minted");
        assertTrue(minted >= expected * 99 / 100, "minimum LP");
        assertEq(IERC20(usdc).balanceOf(user), 0, "USDC spent");
        assertEq(IERC20(dai).balanceOf(user), 0, "DAI spent");
    }
}
