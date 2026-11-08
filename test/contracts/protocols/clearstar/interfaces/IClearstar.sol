// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// Morpho Vault V2 surface the Clearstar test calls. V2's `maxDeposit` is a
/// fixed zero sentinel, so the four share/asset gates are the recipe's pre-check
/// and the liquidity adapter decides whether a full redeem can settle.
interface IClearstarVaultV2 {
    function asset() external view returns (address);
    function receiveSharesGate() external view returns (address);
    function sendSharesGate() external view returns (address);
    function receiveAssetsGate() external view returns (address);
    function sendAssetsGate() external view returns (address);
    function liquidityAdapter() external view returns (address);
    function maxDeposit(address receiver) external view returns (uint256);
    function totalAssets() external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function balanceOf(address owner) external view returns (uint256);
    function decimals() external view returns (uint8);
    function previewDeposit(uint256 assets) external view returns (uint256);
    function previewRedeem(uint256 shares) external view returns (uint256);
    function deposit(uint256 assets, address receiver) external returns (uint256);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256);
    function lastUpdate() external view returns (uint64);
    function accrueInterest() external;
}

/// The shared `Vm` declares only the four-argument `expectEmit`; the emitter-scoped
/// form is needed to bind the log to the vault rather than any contract.
interface IClearstarVmEmit {
    function expectEmit(bool topic1, bool topic2, bool topic3, bool data, address emitter) external;
}
