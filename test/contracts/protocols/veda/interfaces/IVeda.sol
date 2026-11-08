// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IVedaTeller {
    function deposit(address asset, uint256 amount, uint256 minimumMint) external payable returns (uint256);
    function isPaused() external view returns (bool);
    function vault() external view returns (address);
    function accountant() external view returns (address);
    function assetData(address asset) external view returns (bool, bool, uint16);
}

interface IVedaAccountant {
    function getRateInQuoteSafe(address quote) external view returns (uint256);
}

interface IBoringVault {
    function balanceOf(address user) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function decimals() external view returns (uint8);
}

interface IWeth {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address user) external view returns (uint256);
}
