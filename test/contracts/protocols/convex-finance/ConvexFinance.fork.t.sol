// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IERC20} from "../_shared/interfaces/IERC20.sol";

interface ICurvePool {
    function calc_token_amount(uint256[3] calldata amounts, bool isDeposit) external view returns (uint256);
    function add_liquidity(uint256[3] calldata amounts, uint256 minMintAmount) external;
}

interface IConvexBooster {
    function poolInfo(uint256 pid)
        external
        view
        returns (address lptoken, address token, address gauge, address crvRewards, address stash, bool shutdown);
    function deposit(uint256 pid, uint256 amount, bool stake) external returns (bool);
}

interface IConvexRewardPool {
    function balanceOf(address) external view returns (uint256);
}

contract ConvexFinanceForkTest is ProtocolTestBase {
    function test_fork_convex_finance_deposit_3crv() public {
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        require(vm.envOr("FORK_BLOCK", uint256(0)) == block.number && block.number > 0, "pin required");
        address curve = Addresses.CurveDex.CURVE_3POOL;
        address lp = Addresses.CurveDex.CURVE_3CRV_LP_TOKEN;
        address booster = Addresses.ConvexFinance.BOOSTER_MAIN_DEPOSIT_CONTRACT;
        address usdc = Addresses.Tokens.USDC_ETHEREUM;
        address dai = Addresses.Tokens.DAI_ETHEREUM;
        _requireCode(curve);
        _requireCode(lp);
        _requireCode(booster);
        address user = address(0xA11CE);
        uint256 usdcAmount = 100e6;
        bytes32 slot = keccak256(abi.encode(user, uint256(9)));
        vm.store(usdc, slot, bytes32(usdcAmount));
        address daiWhale = vm.envOr("FORK_DAI_WHALE", address(0));
        require(daiWhale != address(0), "configured DAI whale required");
        vm.prank(daiWhale);
        IERC20(dai).transfer(user, 100e18);
        uint256[3] memory amounts = [uint256(100e18), usdcAmount, 0];
        uint256 expected = ICurvePool(curve).calc_token_amount(amounts, true);
        vm.startPrank(user);
        IERC20(usdc).approve(curve, usdcAmount);
        IERC20(dai).approve(curve, 100e18);
        ICurvePool(curve).add_liquidity(amounts, expected * 99 / 100);
        uint256 minted = IERC20(lp).balanceOf(user);
        IERC20(lp).approve(booster, minted);
        (,,, address rewardPool,,) = IConvexBooster(booster).poolInfo(9);
        _requireCode(rewardPool);
        uint256 gaugeBefore = IConvexRewardPool(rewardPool).balanceOf(user);
        IConvexBooster(booster).deposit(9, minted, true);
        vm.stopPrank();
        assertEq(IConvexRewardPool(rewardPool).balanceOf(user) - gaugeBefore, minted, "LP staked");
        assertEq(IERC20(lp).balanceOf(user), 0, "LP spent");
    }
}
