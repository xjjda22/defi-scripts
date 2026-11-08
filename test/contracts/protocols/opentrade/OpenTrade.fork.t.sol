// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ProtocolTestBase} from "../_shared/ProtocolTestBase.sol";
import {vm} from "../../helpers/TestBase.sol";
import "../_shared/Addresses.sol" as Addresses;

interface IOpenTradeVault {
    function totalSupply() external view returns (uint256);
    function exchangeRate() external view returns (uint256);
    function liquidityAssetAddr() external view returns (address);
    function isPermittedLender(address) external view returns (bool);
    function maxDeposit(address) external view returns (uint256);
    function totalAssets() external view returns (uint256);
    function convertToAssets(uint256) external view returns (uint256);
    function convertToShares(uint256) external view returns (uint256);
    function decimals() external view returns (uint8);
    function symbol() external view returns (string memory);
}

contract OpenTradeForkTest is ProtocolTestBase {
    event log_named_uint(string key, uint256 value);

    // Official book: https://docs.opentrade.io/developers/contract-addresses
    // KYC-gated vault: prove exchange-rate and aggregate backing consistency, not deposit access.
    function test_fork_opentrade_backing() public {
        require(
            vm.envOr("FORK_BLOCK", uint256(0)) > 0 || bytes(vm.envOr("ETHEREUM_RPC_URL", string(""))).length == 0,
            "pin required"
        );
        if (!_fork("ETHEREUM_RPC_URL", 1)) return;
        address target = Addresses.Opentrade.FLEXIBLE_TERM_USDC_VAULT_XTBT;
        _requireCode(target);
        IOpenTradeVault vault = IOpenTradeVault(target);
        assertEq(vault.symbol(), "XTBT", "implementation symbol");
        assertEq(uint256(vault.decimals()), 6, "share scale");
        address usdc = Addresses.Tokens.USDC_ETHEREUM;
        _requireCode(usdc);
        assertEq(vault.liquidityAssetAddr(), usdc, "liquidity asset wiring");
        address user = address(uint160(uint256(keccak256("w1b unapproved OpenTrade lender"))));
        require(!vault.isPermittedLender(user) && vault.maxDeposit(user) == 0, "KYC gate enforced");
        uint256 supply = vault.totalSupply();
        uint256 assets = vault.totalAssets();
        require(supply > 1e6 && assets > supply, "funded yield-bearing book");
        uint256 rate = vault.convertToAssets(1e6);
        require(rate > 1e6 && rate < 2e6, "accrued share backing");
        // PoolFlex is not a plain ERC-4626 totalAssets/totalSupply ratio:
        // convertToAssets/convertToShares use the separately accrued 1e18 exchangeRate.
        // Verified PoolFlex implementation linked from the official vault's Etherscan page.
        uint256 storedRate = vault.exchangeRate();
        require(storedRate > 1e18, "yield accrued in stored rate");
        assertEq(vault.convertToAssets(supply), supply * storedRate / 1e18, "aggregate conversion at stored rate");
        assertEq(rate, 1e6 * storedRate / 1e18, "unit conversion at stored rate");
        uint256 roundTrip = vault.convertToShares(rate);
        require(roundTrip <= 1e6 && 1e6 - roundTrip <= 1, "share conversion rounding");
        emit log_named_uint("XTBT supply", supply);
        emit log_named_uint("XTBT total assets", assets);
        emit log_named_uint("USDC per 1 XTBT", rate);
        emit log_named_uint("accrued assets over shares", assets - supply);
    }
}
