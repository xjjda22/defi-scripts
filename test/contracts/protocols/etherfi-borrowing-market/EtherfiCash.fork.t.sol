// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;

interface IEtherfiCashToken {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
}

interface IEtherfiCashSpoke {
    struct Reserve {
        address underlying;
        address hub;
        uint16 assetId;
        uint8 decimals;
        uint24 collateralRisk;
        uint8 flags;
        uint32 dynamicConfigKey;
    }

    struct ReserveConfig {
        uint24 collateralRisk;
        bool paused;
        bool frozen;
        bool borrowable;
        bool receiveSharesEnabled;
    }
    function getReserve(uint256) external view returns (Reserve memory);
    function getReserveConfig(uint256) external view returns (ReserveConfig memory);
    function getUserSuppliedAssets(uint256, address) external view returns (uint256);
    function getUserSuppliedShares(uint256, address) external view returns (uint256);
    function supply(uint256, uint256, address) external returns (uint256, uint256);
    function withdraw(uint256, uint256, address) external returns (uint256, uint256);
}

contract EtherfiCashForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    function test_fork_etherfi_cash_supply() public {
        require(
            vm.envOr("FORK_BLOCK", uint256(0)) > 0 || bytes(vm.envOr("OPTIMISM_RPC_URL", string(""))).length == 0,
            "pin required"
        );
        if (!_fork("OPTIMISM_RPC_URL", 10)) return;
        address target = Addresses.EtherfiBorrowingMarket.SPOKE_AAVE_V4;
        address hub = Addresses.EtherfiBorrowingMarket.LIQUIDITY_HUB_AAVE_V4;
        address usdc = Addresses.Tokens.USDC_OPTIMISM;
        _requireCode(target);
        _requireCode(hub);
        _requireCode(usdc);
        IEtherfiCashSpoke spoke = IEtherfiCashSpoke(target);
        IEtherfiCashSpoke.Reserve memory reserve = spoke.getReserve(0);
        assertEq(reserve.underlying, usdc, "reserve USDC");
        assertEq(reserve.hub, hub, "reserve hub");
        assertEq(uint256(reserve.decimals), 6, "reserve decimals");
        IEtherfiCashSpoke.ReserveConfig memory config = spoke.getReserveConfig(0);
        require(!config.paused && !config.frozen, "reserve paused/frozen");
        address user = address(uint160(uint256(keccak256("w1b etherfi cash supplier"))));
        // Existing EXTRA_WHALES.optimism.USDC; never take funding from the tested Hub.
        address whale = vm.envOr("FORK_USDC_WHALE", address(0));
        require(whale != address(0) && whale != hub, "external USDC whale required");
        require(IEtherfiCashToken(usdc).balanceOf(whale) >= 100e6, "USDC whale balance");
        vm.prank(whale);
        require(IEtherfiCashToken(usdc).transfer(user, 100e6), "whale transfer");
        assertEq(IEtherfiCashToken(usdc).balanceOf(user), 100e6, "funded USDC");
        uint256 beforeBalance = IEtherfiCashToken(usdc).balanceOf(hub);
        vm.startPrank(user);
        IEtherfiCashToken(usdc).approve(target, 100e6);
        spoke.supply(0, 100e6, user);
        vm.stopPrank();
        uint256 supplied = spoke.getUserSuppliedAssets(0, user);
        uint256 shares = spoke.getUserSuppliedShares(0, user);
        require(shares > 0 && supplied <= 100e6 && supplied + 1 >= 100e6, "supply share accounting");
        assertEq(IEtherfiCashToken(usdc).balanceOf(user), 0, "USDC spent");
        assertEq(IEtherfiCashToken(usdc).balanceOf(hub) - beforeBalance, 100e6, "Hub USDC increase");
        emit log_named_uint("Hub USDC increase", 100e6);
        emit log_named_uint("supplied USDC assets", supplied);
        emit log_named_uint("supply shares minted", shares);
    }
}
