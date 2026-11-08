// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// Fluid Lite iETHv2: an ERC-4626 vault over stETH with a withdrawal fee. Only the
/// members the JS flow `fluidLiteDeposit` calls are declared here.
interface IFluidLiteVault {
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function balanceOf(address owner) external view returns (uint256);
    function maxDeposit(address receiver) external view returns (uint256);
    function previewDeposit(uint256 assets) external view returns (uint256);
    function previewRedeem(uint256 shares) external view returns (uint256);
    function withdrawalFeePercentage() external view returns (uint256);
    function deposit(uint256 assets, address receiver) external returns (uint256);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256);
}
