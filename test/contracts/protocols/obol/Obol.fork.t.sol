// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;
import {IUniswapV3Router, IWETH} from "../uniswap/interfaces/IUniswapV3Router.sol";

interface IObolToken {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
    function totalSupply() external view returns (uint256);
}

interface IObolFixed {
    function STAKE_TOKEN() external view returns (address);
    function LST() external view returns (address);
    function SHARE_SCALE_FACTOR() external view returns (uint256);
    function stake(uint256) external returns (uint256);
}

interface IObolRebasing {
    function STAKER() external view returns (address);
    function FIXED_LST() external view returns (address);
    function sharesForStake(uint256) external view returns (uint256);
}

interface IObolStaker {
    function STAKE_TOKEN() external view returns (address);
    function totalStaked() external view returns (uint256);
}

interface IObolFundingFactory {
    function getPool(address, address, uint24) external view returns (address);
}

contract ObolForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_obol_stake() public {
        require(
            vm.envOr("FORK_BLOCK", uint256(0)) > 0 || bytes(vm.envOr("ETHEREUM_RPC_URL", string(""))).length == 0,
            "pin required"
        );
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        address fixedToken = Addresses.Obol.STOBOL_FIXEDSTAKEDOBOL_NON_REBASING_STAKED_OBOL;
        address obol = Addresses.Obol.OBOL_TOKEN_THE_STAKED_ASSET;
        address staker = Addresses.Obol.OBOLSTAKER_REWARD_STREAMING_STAKING_CONTRACT;
        address rebasing = Addresses.Obol.RSTOBOL_REBASING_STAKED_OBOL_THE_STOBOL_ACCOUNTING_CORE_READ_FROM_STOBOL_LST;
        _requireCode(fixedToken);
        _requireCode(obol);
        _requireCode(staker);
        _requireCode(rebasing);
        assertEq(IObolFixed(fixedToken).STAKE_TOKEN(), obol, "fixed stake token");
        assertEq(IObolFixed(fixedToken).LST(), rebasing, "LST wiring");
        assertEq(IObolRebasing(rebasing).STAKER(), staker, "staker wiring");
        assertEq(IObolRebasing(rebasing).FIXED_LST(), fixedToken, "fixed LST wiring");
        assertEq(IObolStaker(staker).STAKE_TOKEN(), obol, "staker token");
        address user = address(uint160(uint256(keccak256("w1b OBOL staker"))));
        uint256 amount = _buyObol(user, obol);
        uint256 expected = IObolRebasing(rebasing).sharesForStake(amount) / IObolFixed(fixedToken).SHARE_SCALE_FACTOR();
        require(expected > 0, "zero stake quote");
        uint256 stakedBefore = IObolStaker(staker).totalStaked();
        uint256 supplyBefore = IObolToken(fixedToken).totalSupply();
        vm.startPrank(user);
        IObolToken(obol).approve(fixedToken, amount);
        uint256 minted = IObolFixed(fixedToken).stake(amount);
        vm.stopPrank();
        assertEq(IObolToken(obol).balanceOf(user), 0, "OBOL spent");
        assertEq(IObolToken(fixedToken).balanceOf(user), minted, "minted receipt");
        require(minted > 0 && minted <= expected + 1 && minted + 1 >= expected, "share accounting");
        assertEq(IObolStaker(staker).totalStaked() - stakedBefore, amount, "stake accounting increase");
        uint256 supplyDelta = IObolToken(fixedToken).totalSupply() - supplyBefore;
        require(supplyDelta >= minted && supplyDelta <= minted + 1, "fixed supply rounding");
        emit log_named_uint("OBOL staked", amount);
        emit log_named_uint("stOBOL minted", minted);
        emit log_named_uint("stOBOL supply increase", supplyDelta);
    }

    function _buyObol(address user, address obol) private returns (uint256 bought) {
        // Funding fixture: buy real OBOL with wrapped native ETH. No guessed OBOL
        // balance slot / anvil_dealERC20; runtime.js has no configured OBOL whale.
        address router = Addresses.Uniswap.V3_ROUTER;
        address factory = Addresses.Uniswap.V3_FACTORY;
        address weth = Addresses.Tokens.WETH_ETHEREUM;
        _requireCode(router);
        _requireCode(factory);
        _requireCode(weth);
        assertEq(IUniswapV3Router(router).factory(), factory, "funding router factory");
        _requireCode(IObolFundingFactory(factory).getPool(weth, obol, 10000));
        vm.deal(user, 0.001 ether);
        vm.startPrank(user);
        IWETH(weth).deposit{value: 0.001 ether}();
        IObolToken(weth).approve(router, 0.001 ether);
        bought = IUniswapV3Router(router)
            .exactInputSingle(
                IUniswapV3Router.ExactInputSingleParams({
                    tokenIn: weth,
                    tokenOut: obol,
                    fee: 10000,
                    recipient: user,
                    deadline: block.timestamp + 600,
                    amountIn: 0.001 ether,
                    amountOutMinimum: 1,
                    sqrtPriceLimitX96: 0
                })
            );
        vm.stopPrank();
        require(bought > 0, "OBOL funding output");
        assertEq(IObolToken(obol).balanceOf(user), bought, "bought real OBOL");
        assertEq(IObolToken(weth).balanceOf(user), 0, "funding WETH spent");
    }
}
