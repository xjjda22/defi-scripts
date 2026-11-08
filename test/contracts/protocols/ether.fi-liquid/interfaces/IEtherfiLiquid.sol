// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// Only the Teller/accountant/vault surface the deposit primitive needs.
interface IEtherfiLiquidTeller {
    function deposit(address asset, uint256 amount, uint256 minimumMint) external payable returns (uint256);
    function isPaused() external view returns (bool);
    function vault() external view returns (address);
    function accountant() external view returns (address);
    function assetData(address asset) external view returns (bool, bool, uint16);
}

interface IEtherfiLiquidAccountant {
    function getRateInQuoteSafe(address quote) external view returns (uint256);
}

interface IEtherfiLiquidVault {
    function balanceOf(address user) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function decimals() external view returns (uint8);
}

interface IEtherfiLiquidWeth {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address user) external view returns (uint256);
}
