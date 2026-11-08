// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// Only the ERC-4626 members the Falcon sUSDf flow calls. sUSDf is a standard
/// 4626 vault over USDf; minting USDf from collateral is KYC-gated and not used here.
interface IERC4626 {
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function balanceOf(address owner) external view returns (uint256);
    function maxDeposit(address receiver) external view returns (uint256);
    function previewDeposit(uint256 assets) external view returns (uint256);
    function previewRedeem(uint256 shares) external view returns (uint256);
    function deposit(uint256 assets, address receiver) external returns (uint256);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256);
}
