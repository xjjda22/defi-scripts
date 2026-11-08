// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IVault {
    function feeRecipient() external view returns (address);
    function asset() external view returns (address);
    function previewDeposit(uint256 assets) external view returns (uint256);
    function deposit(uint256 assets, address receiver) external returns (uint256);
    function balanceOf(address user) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);
    function maxDeposit(address user) external view returns (uint256);
}
