// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface ISentora {
    function asset() external view returns (address);
    function receiveSharesGate() external view returns (address);
    function sendSharesGate() external view returns (address);
    function receiveAssetsGate() external view returns (address);
    function sendAssetsGate() external view returns (address);
    function _totalAssets() external view returns (uint128);
    function lastUpdate() external view returns (uint64);
    function totalSupply() external view returns (uint256);
    function balanceOf(address holder) external view returns (uint256);
    function performanceFeeRecipient() external view returns (address);
    function managementFeeRecipient() external view returns (address);
    function accrueInterestView() external view returns (uint256, uint256, uint256);
    function accrueInterest() external;
}
